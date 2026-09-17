from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import requests

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------------- Storage ----------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "siscoring-kalteng"
storage_key = None

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------------- Auth helpers ----------------
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user or not user.get("active", True):
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan / nonaktif")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak untuk peran ini")
        return user
    return checker

# ---------------- Maturity ----------------
def maturity_category(total: float, max_total: float) -> dict:
    pct = (total / max_total * 100) if max_total else 0
    if pct <= 34.5:
        return {"key": "sangat_rendah", "label": "Sangat Rendah"}
    elif pct <= 50.9:
        return {"key": "rendah", "label": "Rendah"}
    elif pct <= 67.3:
        return {"key": "sedang", "label": "Sedang"}
    elif pct <= 83.6:
        return {"key": "tinggi", "label": "Tinggi"}
    return {"key": "sangat_tinggi", "label": "Sangat Tinggi"}

# ---------------- App ----------------
app = FastAPI()
api_router = APIRouter(prefix="/api")

now_iso = lambda: datetime.now(timezone.utc).isoformat()

# ---------------- Models ----------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # admin | perangkat | verifikator | penilai
    area: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    area: Optional[str] = None
    active: Optional[bool] = None

class PasswordReset(BaseModel):
    password: str

class IndicatorInput(BaseModel):
    name: str
    description: Optional[str] = ""
    weight: float = 1.0
    order: Optional[int] = 0

class PeriodInput(BaseModel):
    year: int
    name: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    upload_locked: bool = False
    active: bool = True

class SubmissionCreate(BaseModel):
    area: str
    device_name: str
    urusan: str
    period_id: str

class VerifyInput(BaseModel):
    action: str  # approve | reject
    notes: Optional[str] = ""

class ScoreItem(BaseModel):
    indicator_id: str
    score: float
    note: Optional[str] = ""

class ScoreInput(BaseModel):
    scores: List[ScoreItem]
    overall_note: Optional[str] = ""

# ---------------- Auth routes ----------------
@api_router.post("/auth/login")
async def login(input: LoginInput, response: Response):
    email = input.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    token = create_access_token(user["id"])
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "area": user.get("area"), "token": token}

@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"message": "Berhasil keluar"}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------------- User management ----------------
def public_user(u: dict) -> dict:
    u.pop("password_hash", None)
    return u

@api_router.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.post("/users")
async def create_user(input: UserCreate, user: dict = Depends(require_roles("admin"))):
    email = input.email.lower()
    if input.role not in ("admin", "perangkat", "verifikator", "penilai"):
        raise HTTPException(status_code=400, detail="Peran tidak valid")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    doc = {"id": str(uuid.uuid4()), "email": email, "name": input.name, "role": input.role,
           "area": input.area, "active": True, "password_hash": hash_password(input.password),
           "created_at": now_iso()}
    await db.users.insert_one(doc)
    return public_user({k: v for k, v in doc.items() if k != "_id"})

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, input: UserUpdate, user: dict = Depends(require_roles("admin"))):
    updates = {k: v for k, v in input.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    res = await db.users.update_one({"id": user_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return u

@api_router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, input: PasswordReset, user: dict = Depends(require_roles("admin"))):
    res = await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(input.password)}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    return {"message": "Kata sandi diperbarui"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_roles("admin"))):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus diri sendiri")
    await db.users.delete_one({"id": user_id})
    return {"message": "Pengguna dihapus"}

# ---------------- Indicators ----------------
@api_router.get("/indicators")
async def list_indicators(user: dict = Depends(get_current_user)):
    inds = await db.indicators.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return inds

@api_router.post("/indicators")
async def create_indicator(input: IndicatorInput, user: dict = Depends(require_roles("admin"))):
    count = await db.indicators.count_documents({})
    doc = {"id": str(uuid.uuid4()), "name": input.name, "description": input.description,
           "weight": input.weight, "order": input.order or (count + 1), "created_at": now_iso()}
    await db.indicators.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api_router.put("/indicators/{ind_id}")
async def update_indicator(ind_id: str, input: IndicatorInput, user: dict = Depends(require_roles("admin"))):
    res = await db.indicators.update_one({"id": ind_id}, {"$set": input.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Indikator tidak ditemukan")
    return await db.indicators.find_one({"id": ind_id}, {"_id": 0})

@api_router.delete("/indicators/{ind_id}")
async def delete_indicator(ind_id: str, user: dict = Depends(require_roles("admin"))):
    await db.indicators.delete_one({"id": ind_id})
    return {"message": "Indikator dihapus"}

# ---------------- Periods ----------------
@api_router.get("/periods")
async def list_periods(user: dict = Depends(get_current_user)):
    return await db.periods.find({}, {"_id": 0}).sort("year", -1).to_list(1000)

@api_router.get("/periods/active")
async def active_period(user: dict = Depends(get_current_user)):
    p = await db.periods.find_one({"active": True}, {"_id": 0})
    return p or {}

@api_router.post("/periods")
async def create_period(input: PeriodInput, user: dict = Depends(require_roles("admin"))):
    if input.active:
        await db.periods.update_many({}, {"$set": {"active": False}})
    doc = {"id": str(uuid.uuid4()), **input.model_dump(), "created_at": now_iso()}
    await db.periods.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api_router.put("/periods/{pid}")
async def update_period(pid: str, input: PeriodInput, user: dict = Depends(require_roles("admin"))):
    if input.active:
        await db.periods.update_many({"id": {"$ne": pid}}, {"$set": {"active": False}})
    res = await db.periods.update_one({"id": pid}, {"$set": input.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Periode tidak ditemukan")
    return await db.periods.find_one({"id": pid}, {"_id": 0})

@api_router.delete("/periods/{pid}")
async def delete_period(pid: str, user: dict = Depends(require_roles("admin"))):
    await db.periods.delete_one({"id": pid})
    return {"message": "Periode dihapus"}

# ---------------- Submissions ----------------
async def enrich_submission(s: dict) -> dict:
    s.pop("_id", None)
    return s

@api_router.get("/submissions")
async def list_submissions(user: dict = Depends(get_current_user)):
    role = user["role"]
    if role == "perangkat":
        q = {"perangkat_user_id": user["id"]}
    elif role == "verifikator":
        q = {"status": {"$in": ["menunggu_verifikasi", "ditolak", "menunggu_penilaian", "selesai"]}}
    elif role == "penilai":
        q = {"status": {"$in": ["menunggu_penilaian", "selesai"]}}
    else:
        q = {}
    subs = await db.submissions.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return subs

@api_router.get("/submissions/{sid}")
async def get_submission(sid: str, user: dict = Depends(get_current_user)):
    s = await db.submissions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan")
    if user["role"] == "perangkat" and s["perangkat_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    return s

async def get_active_period_or_400():
    p = await db.periods.find_one({"active": True})
    if not p:
        raise HTTPException(status_code=400, detail="Belum ada periode evaluasi aktif")
    return p

@api_router.post("/submissions")
async def create_submission(input: SubmissionCreate, user: dict = Depends(require_roles("perangkat"))):
    period = await db.periods.find_one({"id": input.period_id})
    if not period:
        raise HTTPException(status_code=404, detail="Periode tidak ditemukan")
    doc = {
        "id": str(uuid.uuid4()), "period_id": period["id"], "year": period["year"],
        "area": input.area, "device_name": input.device_name, "urusan": input.urusan,
        "perangkat_user_id": user["id"], "perangkat_name": user["name"],
        "status": "draft", "uploads": {}, "verification": None, "scoring": None,
        "rejection_note": None, "history": [{"status": "draft", "at": now_iso(), "by": user["name"]}],
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.submissions.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

async def check_upload_allowed(period_id: str):
    period = await db.periods.find_one({"id": period_id})
    if not period:
        raise HTTPException(status_code=404, detail="Periode tidak ditemukan")
    if period.get("upload_locked"):
        raise HTTPException(status_code=403, detail="Unggahan berkas telah dikunci oleh admin")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if period.get("end_date") and today > period["end_date"]:
        raise HTTPException(status_code=403, detail="Periode unggah berkas telah berakhir")

@api_router.post("/submissions/{sid}/upload")
async def upload_evidence(sid: str, indicator_id: str = Form(...), file: UploadFile = File(...),
                          user: dict = Depends(require_roles("perangkat"))):
    s = await db.submissions.find_one({"id": sid})
    if not s or s["perangkat_user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan")
    if s["status"] not in ("draft", "ditolak"):
        raise HTTPException(status_code=403, detail="Pengajuan tidak dapat diubah pada status ini")
    await check_upload_allowed(s["period_id"])
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    if ext not in ("pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx"):
        raise HTTPException(status_code=400, detail="Format berkas tidak didukung")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/{user['id']}/{sid}/{file_id}.{ext}"
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran berkas maksimal 15MB")
    result = put_object(path, data, file.content_type or "application/octet-stream")
    await db.files.insert_one({"id": file_id, "storage_path": result["path"], "original_filename": file.filename,
                               "content_type": file.content_type, "size": result.get("size", len(data)),
                               "submission_id": sid, "is_deleted": False, "created_at": now_iso()})
    upload_meta = {"file_id": file_id, "original_filename": file.filename, "uploaded_at": now_iso()}
    await db.submissions.update_one({"id": sid}, {"$set": {f"uploads.{indicator_id}": upload_meta, "updated_at": now_iso()}})
    return upload_meta

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, user: dict = Depends(get_current_user)):
    from fastapi import Response as FResponse
    record = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan")
    data, content_type = get_object(record["storage_path"])
    return FResponse(content=data, media_type=record.get("content_type") or content_type,
                     headers={"Content-Disposition": f'inline; filename="{record["original_filename"]}"'})

@api_router.post("/submissions/{sid}/submit")
async def submit_submission(sid: str, user: dict = Depends(require_roles("perangkat"))):
    s = await db.submissions.find_one({"id": sid})
    if not s or s["perangkat_user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan")
    if s["status"] not in ("draft", "ditolak"):
        raise HTTPException(status_code=403, detail="Pengajuan sudah dikirim")
    await check_upload_allowed(s["period_id"])
    indicators = await db.indicators.find({}).to_list(1000)
    missing = [i["name"] for i in indicators if str(i["id"]) not in (s.get("uploads") or {})]
    if missing:
        raise HTTPException(status_code=400, detail=f"Berkas belum lengkap untuk: {', '.join(missing)}")
    hist = s.get("history", [])
    hist.append({"status": "menunggu_verifikasi", "at": now_iso(), "by": user["name"]})
    await db.submissions.update_one({"id": sid}, {"$set": {"status": "menunggu_verifikasi", "rejection_note": None,
                                    "updated_at": now_iso(), "history": hist}})
    return {"message": "Pengajuan dikirim untuk verifikasi"}

@api_router.post("/submissions/{sid}/verify")
async def verify_submission(sid: str, input: VerifyInput, user: dict = Depends(require_roles("verifikator"))):
    s = await db.submissions.find_one({"id": sid})
    if not s:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan")
    if s["status"] != "menunggu_verifikasi":
        raise HTTPException(status_code=403, detail="Pengajuan tidak dalam status verifikasi")
    hist = s.get("history", [])
    if input.action == "approve":
        hist.append({"status": "menunggu_penilaian", "at": now_iso(), "by": user["name"]})
        await db.submissions.update_one({"id": sid}, {"$set": {
            "status": "menunggu_penilaian",
            "verification": {"verifikator_id": user["id"], "verifikator_name": user["name"],
                             "notes": input.notes, "verified_at": now_iso()},
            "updated_at": now_iso(), "history": hist}})
        return {"message": "Pengajuan terverifikasi, diteruskan ke penilai"}
    elif input.action == "reject":
        if not input.notes:
            raise HTTPException(status_code=400, detail="Catatan perbaikan wajib diisi saat menolak")
        hist.append({"status": "ditolak", "at": now_iso(), "by": user["name"], "note": input.notes})
        await db.submissions.update_one({"id": sid}, {"$set": {
            "status": "ditolak", "rejection_note": input.notes,
            "verification": {"verifikator_id": user["id"], "verifikator_name": user["name"],
                             "notes": input.notes, "verified_at": now_iso()},
            "updated_at": now_iso(), "history": hist}})
        return {"message": "Pengajuan dikembalikan ke perangkat untuk perbaikan"}
    raise HTTPException(status_code=400, detail="Aksi tidak valid")

@api_router.post("/submissions/{sid}/score")
async def score_submission(sid: str, input: ScoreInput, user: dict = Depends(require_roles("penilai"))):
    s = await db.submissions.find_one({"id": sid})
    if not s:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan")
    if s["status"] != "menunggu_penilaian":
        raise HTTPException(status_code=403, detail="Pengajuan belum terverifikasi")
    indicators = await db.indicators.find({}, {"_id": 0}).to_list(1000)
    ind_map = {str(i["id"]): i for i in indicators}
    submitted_ids = {item.indicator_id for item in input.scores}
    if len(submitted_ids) != len(indicators) or submitted_ids != set(ind_map.keys()):
        raise HTTPException(status_code=400, detail="Semua variabel harus dinilai tepat satu kali")
    total = 0.0
    weighted = 0.0
    weight_sum = 0.0
    detail = []
    for item in input.scores:
        if item.score < 1 or item.score > 5:
            raise HTTPException(status_code=400, detail="Skor harus 1 - 5")
        ind = ind_map.get(item.indicator_id)
        w = ind["weight"] if ind else 1.0
        total += item.score
        weighted += item.score * w
        weight_sum += w
        detail.append({"indicator_id": item.indicator_id,
                       "indicator_name": ind["name"] if ind else "",
                       "score": item.score, "weight": w, "note": item.note})
    max_total = len(indicators) * 5
    percentage = round(total / max_total * 100, 2) if max_total else 0
    weighted_avg = round(weighted / weight_sum, 2) if weight_sum else 0
    cat = maturity_category(total, max_total)
    hist = s.get("history", [])
    hist.append({"status": "selesai", "at": now_iso(), "by": user["name"]})
    scoring = {"penilai_id": user["id"], "penilai_name": user["name"], "scores": detail,
               "total": round(total, 2), "max_total": max_total, "percentage": percentage,
               "weighted_avg": weighted_avg, "category": cat, "overall_note": input.overall_note,
               "scored_at": now_iso()}
    await db.submissions.update_one({"id": sid}, {"$set": {"status": "selesai", "scoring": scoring,
                                    "updated_at": now_iso(), "history": hist}})
    return {"message": "Penilaian selesai", "scoring": scoring}

# ---------------- Stats ----------------
@api_router.get("/stats/overview")
async def stats_overview(user: dict = Depends(get_current_user)):
    role = user["role"]
    base = {}
    if role == "perangkat":
        base = {"perangkat_user_id": user["id"]}
    counts = {}
    for st in ["draft", "menunggu_verifikasi", "ditolak", "menunggu_penilaian", "selesai"]:
        counts[st] = await db.submissions.count_documents({**base, "status": st})
    counts["total"] = await db.submissions.count_documents(base)
    extra = {}
    if role == "admin":
        extra["users"] = await db.users.count_documents({})
        extra["indicators"] = await db.indicators.count_documents({})
        extra["periods"] = await db.periods.count_documents({})
    return {"counts": counts, **extra}

@api_router.get("/stats/yearly")
async def stats_yearly(user: dict = Depends(get_current_user)):
    q = {"status": "selesai"}
    if user["role"] == "perangkat":
        q["perangkat_user_id"] = user["id"]
    subs = await db.submissions.find(q, {"_id": 0}).to_list(5000)
    by_year: Dict[int, list] = {}
    for s in subs:
        sc = s.get("scoring") or {}
        if "total" in sc:
            by_year.setdefault(s["year"], []).append(sc["total"])
    result = []
    for year in sorted(by_year.keys()):
        vals = by_year[year]
        result.append({"year": year, "avg_total": round(sum(vals) / len(vals), 2),
                       "count": len(vals), "max": max(vals), "min": min(vals)})
    return result

@api_router.get("/stats/by-area")
async def stats_by_area(user: dict = Depends(require_roles("admin", "penilai", "verifikator"))):
    subs = await db.submissions.find({"status": "selesai"}, {"_id": 0}).to_list(5000)
    by_area: Dict[str, list] = {}
    for s in subs:
        sc = s.get("scoring") or {}
        if "total" in sc:
            by_area.setdefault(s["area"], []).append(sc["total"])
    return [{"area": a, "avg_total": round(sum(v) / len(v), 2), "count": len(v)} for a, v in by_area.items()]

# ---------------- Seed ----------------
DEFAULT_INDICATORS = [
    ("Perencanaan Kelembagaan", "Ketersediaan dokumen RKPD/Renja & penetapan target kelembagaan."),
    ("Monitoring dan Pengendalian", "Sistem pemantauan pelaksanaan tugas fungsi & capaian kinerja."),
    ("Penjaminan Mutu Layanan", "Standar mutu pelayanan publik dan evaluasi kepuasan masyarakat."),
    ("Standar Operasional Prosedur (SOP)", "Kelengkapan, kebaruan, dan konsistensi penerapan SOP kerja."),
    ("Pendidikan dan Pelatihan", "Pengembangan kompetensi ASN dan pemenuhan jam pelajaran (JP)."),
    ("Analisis Kebijakan & Pemecahan Masalah", "Kajian akademis, formulasi kebijakan, dan solusi regulasi daerah."),
    ("Manajemen Sumber Daya Terukur", "Efisiensi alokasi anggaran, sarpras, dan optimalisasi SDM."),
    ("Manajemen Risiko Kelembagaan", "Peta risiko, SPIP, dan mitigasi kendala operasional kelembagaan."),
    ("Pengukuran Kinerja Kelembagaan", "Indikator Kinerja Utama (IKU) dan LAKIP/SAKIP perangkat daerah."),
    ("Pengembangan Inovasi Layanan", "Jumlah dan dampak inovasi tata kelola pemerintahan berbasis digital."),
    ("Budaya Organisasi", "Penerapan Core Values BerAKHLAK dan komitmen integritas kerja."),
]

async def seed():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.submissions.create_index("id", unique=True)
    # admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": admin_email, "name": "Administrator",
                                   "role": "admin", "area": None, "active": True,
                                   "password_hash": hash_password(admin_pw), "created_at": now_iso()})
    elif not verify_password(admin_pw, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})
    # demo users
    demo = [
        ("verifikator@kalteng.go.id", "Verif123!", "Budi Verifikator", "verifikator", None),
        ("penilai@kalteng.go.id", "Nilai123!", "Sari Penilai", "penilai", None),
        ("perangkat@kalteng.go.id", "Kerja123!", "Dinas Kominfo Palangka Raya", "perangkat", "Kota Palangka Raya"),
    ]
    for email, pw, name, role, area in demo:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "name": name, "role": role,
                                       "area": area, "active": True, "password_hash": hash_password(pw),
                                       "created_at": now_iso()})
    # indicators
    if await db.indicators.count_documents({}) == 0:
        for idx, (name, desc) in enumerate(DEFAULT_INDICATORS, start=1):
            await db.indicators.insert_one({"id": str(uuid.uuid4()), "name": name, "description": desc,
                                            "weight": 1.0, "order": idx, "created_at": now_iso()})
    # period
    if await db.periods.count_documents({}) == 0:
        y = datetime.now(timezone.utc).year
        await db.periods.insert_one({"id": str(uuid.uuid4()), "year": y, "name": f"Evaluasi Kematangan {y}",
                                     "start_date": f"{y}-01-01", "end_date": f"{y}-12-31",
                                     "upload_locked": False, "active": True, "created_at": now_iso()})

@app.on_event("startup")
async def startup():
    await seed()
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
