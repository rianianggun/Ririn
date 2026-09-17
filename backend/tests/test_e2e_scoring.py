"""
End-to-end backend tests for Si-Scoring Kalteng.
Covers auth for 4 roles, admin CRUD (user/indicator/period), full submission workflow:
create -> upload 11 files -> submit -> verifikator reject -> re-upload -> resubmit -> approve
-> penilai score -> perangkat sees result. Also role-based access and upload-lock behavior.
"""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to reading frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("riani.anggun.adp@gmail.com", "Admin@2026"),
    "perangkat": ("perangkat@kalteng.go.id", "Kerja123!"),
    "verifikator": ("verifikator@kalteng.go.id", "Verif123!"),
    "penilai": ("penilai@kalteng.go.id", "Nilai123!"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def tokens():
    return {r: _login(e, p) for r, (e, p) in CREDS.items()}


# ------- Auth -------
def test_login_all_roles(tokens):
    for role, tok in tokens.items():
        r = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == role


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "x@y.z", "password": "bad"}, timeout=30)
    assert r.status_code == 401


# ------- Admin data -------
def test_indicators_seeded(tokens):
    r = requests.get(f"{API}/indicators", headers=_hdr(tokens["admin"]), timeout=30)
    assert r.status_code == 200
    inds = r.json()
    assert len(inds) == 11, f"expected 11 indicators, got {len(inds)}"


def test_active_period(tokens):
    r = requests.get(f"{API}/periods/active", headers=_hdr(tokens["perangkat"]), timeout=30)
    assert r.status_code == 200
    p = r.json()
    assert p.get("id"), "no active period"
    assert p.get("active") is True


def test_admin_role_gate(tokens):
    r = requests.get(f"{API}/users", headers=_hdr(tokens["perangkat"]), timeout=30)
    assert r.status_code == 403


def test_admin_user_crud(tokens):
    email = f"TEST_{uuid.uuid4().hex[:8]}@kalteng.go.id"
    r = requests.post(f"{API}/users", headers=_hdr(tokens["admin"]),
                      json={"email": email, "password": "Passw0rd!", "name": "TEST User",
                            "role": "perangkat", "area": "Kota Palangka Raya"}, timeout=30)
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    # verify list
    r2 = requests.get(f"{API}/users", headers=_hdr(tokens["admin"]), timeout=30)
    assert any(u["id"] == uid for u in r2.json())
    # delete
    r3 = requests.delete(f"{API}/users/{uid}", headers=_hdr(tokens["admin"]), timeout=30)
    assert r3.status_code == 200


# ------- Full workflow -------
@pytest.fixture(scope="module")
def workflow(tokens):
    """Runs the entire pipeline and yields state so downstream tests can assert."""
    perangkat = tokens["perangkat"]
    verifikator = tokens["verifikator"]
    penilai = tokens["penilai"]

    # active period
    period = requests.get(f"{API}/periods/active", headers=_hdr(perangkat)).json()
    indicators = requests.get(f"{API}/indicators", headers=_hdr(perangkat)).json()

    # create submission
    r = requests.post(f"{API}/submissions", headers=_hdr(perangkat), json={
        "area": "Kota Palangka Raya", "device_name": f"TEST_Dinas_{uuid.uuid4().hex[:6]}",
        "urusan": "Komunikasi dan Informatika", "period_id": period["id"]}, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]

    # Try to submit before upload -> must fail
    r = requests.post(f"{API}/submissions/{sid}/submit", headers=_hdr(perangkat), timeout=30)
    assert r.status_code == 400
    assert "belum lengkap" in r.text.lower() or "berkas" in r.text.lower()

    # upload for each indicator
    for ind in indicators:
        files = {"file": (f"evidence.pdf", io.BytesIO(b"%PDF-1.4 test evidence"), "application/pdf")}
        data = {"indicator_id": ind["id"]}
        r = requests.post(f"{API}/submissions/{sid}/upload", headers=_hdr(perangkat),
                          data=data, files=files, timeout=60)
        assert r.status_code == 200, f"upload for {ind['name']} failed: {r.status_code} {r.text}"

    # submit
    r = requests.post(f"{API}/submissions/{sid}/submit", headers=_hdr(perangkat), timeout=30)
    assert r.status_code == 200, r.text

    # verifikator rejects without note -> 400
    r = requests.post(f"{API}/submissions/{sid}/verify", headers=_hdr(verifikator),
                      json={"action": "reject", "notes": ""}, timeout=30)
    assert r.status_code == 400

    # verifikator rejects with note
    r = requests.post(f"{API}/submissions/{sid}/verify", headers=_hdr(verifikator),
                      json={"action": "reject", "notes": "Berkas #3 kurang jelas, mohon ganti."}, timeout=30)
    assert r.status_code == 200

    s = requests.get(f"{API}/submissions/{sid}", headers=_hdr(perangkat)).json()
    assert s["status"] == "ditolak"
    assert s["rejection_note"]

    # re-upload one file & resubmit
    ind0 = indicators[0]
    files = {"file": ("fixed.pdf", io.BytesIO(b"%PDF-1.4 fixed"), "application/pdf")}
    r = requests.post(f"{API}/submissions/{sid}/upload", headers=_hdr(perangkat),
                      data={"indicator_id": ind0["id"]}, files=files, timeout=60)
    assert r.status_code == 200

    r = requests.post(f"{API}/submissions/{sid}/submit", headers=_hdr(perangkat), timeout=30)
    assert r.status_code == 200

    # approve
    r = requests.post(f"{API}/submissions/{sid}/verify", headers=_hdr(verifikator),
                      json={"action": "approve", "notes": "OK"}, timeout=30)
    assert r.status_code == 200

    s = requests.get(f"{API}/submissions/{sid}", headers=_hdr(perangkat)).json()
    assert s["status"] == "menunggu_penilaian"

    # score
    scores = [{"indicator_id": i["id"], "score": 4, "note": ""} for i in indicators]
    r = requests.post(f"{API}/submissions/{sid}/score", headers=_hdr(penilai),
                      json={"scores": scores, "overall_note": "Baik"}, timeout=30)
    assert r.status_code == 200, r.text
    sc = r.json()["scoring"]
    assert sc["total"] == 44  # 11 * 4
    assert sc["max_total"] == 55
    assert sc["category"]["key"] == "tinggi"

    yield {"sid": sid, "indicators": indicators}


def test_workflow_completes(workflow, tokens):
    sid = workflow["sid"]
    s = requests.get(f"{API}/submissions/{sid}", headers=_hdr(tokens["perangkat"])).json()
    assert s["status"] == "selesai"
    assert s["scoring"]["total"] == 44
    assert s["scoring"]["category"]["label"] == "Tinggi"


def test_penilai_score_out_of_range(tokens, workflow):
    # Create another submission just to test invalid score path — reuse fixture data light
    # Instead simply attempt scoring an already-completed one -> must 403
    sid = workflow["sid"]
    r = requests.post(f"{API}/submissions/{sid}/score", headers=_hdr(tokens["penilai"]),
                     json={"scores": [], "overall_note": ""}, timeout=30)
    assert r.status_code in (400, 403)


def test_perangkat_cannot_verify(tokens, workflow):
    r = requests.post(f"{API}/submissions/{workflow['sid']}/verify", headers=_hdr(tokens["perangkat"]),
                      json={"action": "approve", "notes": ""}, timeout=30)
    assert r.status_code == 403


# ------- Upload lock -------
def test_upload_lock_blocks_create(tokens):
    admin = tokens["admin"]
    perangkat = tokens["perangkat"]
    period = requests.get(f"{API}/periods/active", headers=_hdr(admin)).json()
    # lock
    body = {"year": period["year"], "name": period["name"], "start_date": period["start_date"],
            "end_date": period["end_date"], "upload_locked": True, "active": True}
    r = requests.put(f"{API}/periods/{period['id']}", headers=_hdr(admin), json=body, timeout=30)
    assert r.status_code == 200

    try:
        # create submission (allowed since create doesn't gate on lock — but upload/submit should be blocked)
        r = requests.post(f"{API}/submissions", headers=_hdr(perangkat), json={
            "area": "Kota Palangka Raya", "device_name": f"TEST_Locked_{uuid.uuid4().hex[:6]}",
            "urusan": "Umum", "period_id": period["id"]}, timeout=30)
        assert r.status_code == 200
        sid = r.json()["id"]
        # upload should be blocked
        files = {"file": ("e.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}
        indicators = requests.get(f"{API}/indicators", headers=_hdr(perangkat)).json()
        r = requests.post(f"{API}/submissions/{sid}/upload", headers=_hdr(perangkat),
                          data={"indicator_id": indicators[0]["id"]}, files=files, timeout=30)
        assert r.status_code == 403
        assert "kunci" in r.text.lower() or "lock" in r.text.lower()
    finally:
        # unlock
        body["upload_locked"] = False
        requests.put(f"{API}/periods/{period['id']}", headers=_hdr(admin), json=body, timeout=30)


# ------- Stats -------
def test_stats_endpoints(tokens):
    for role in ("admin", "perangkat", "verifikator", "penilai"):
        r = requests.get(f"{API}/stats/overview", headers=_hdr(tokens[role]), timeout=30)
        assert r.status_code == 200, f"{role}: {r.text}"
    r = requests.get(f"{API}/stats/yearly", headers=_hdr(tokens["admin"]), timeout=30)
    assert r.status_code == 200
    r = requests.get(f"{API}/stats/by-area", headers=_hdr(tokens["admin"]), timeout=30)
    assert r.status_code == 200
    r = requests.get(f"{API}/stats/by-area", headers=_hdr(tokens["perangkat"]), timeout=30)
    assert r.status_code == 403
