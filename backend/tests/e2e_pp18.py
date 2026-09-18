import requests, io

B = "http://localhost:8001/api"

def login(email, pw):
    r = requests.post(f"{B}/auth/login", json={"email": email, "password": pw})
    r.raise_for_status()
    return r.json()["token"]

def h(t): return {"Authorization": f"Bearer {t}"}

pk = login("perangkat@kalteng.go.id", "Kerja123!")
vk = login("verifikator@kalteng.go.id", "Verif123!")
nk = login("penilai@kalteng.go.id", "Nilai123!")
print("logins ok")

period = requests.get(f"{B}/periods/active", headers=h(pk)).json()

# create submission pendidikan
sub = requests.post(f"{B}/submissions", headers=h(pk), json={
    "device_name": "Dinas Pendidikan Kota Palangka Raya", "urusan": "Bidang Pendidikan",
    "sub_urusan": None, "period_id": period["id"]}).json()
sid = sub["id"]
print("submission", sid, "level", sub["level"])

inds = requests.get(f"{B}/indicators/for-submission", headers=h(pk),
                    params={"level": sub["level"], "urusan": "Bidang Pendidikan"}).json()
allind = inds["umum"] + inds["teknis"]
print("indicators umum", len(inds["umum"]), "teknis", len(inds["teknis"]))

# submit before upload -> should fail
r = requests.post(f"{B}/submissions/{sid}/submit", headers=h(pk))
print("submit-before-upload:", r.status_code, r.json().get("detail", "")[:40])

# upload all
for ind in allind:
    files = {"file": (f"bukti_{ind['order']}.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")}
    rr = requests.post(f"{B}/submissions/{sid}/upload", headers=h(pk),
                       data={"indicator_id": ind["id"]}, files=files)
    rr.raise_for_status()
print("uploaded", len(allind), "files")

# submit
r = requests.post(f"{B}/submissions/{sid}/submit", headers=h(pk)); r.raise_for_status()
print("submitted:", r.json()["message"])

# verifikator sees it (area scoped)
q = requests.get(f"{B}/submissions", headers=h(vk)).json()
print("verifikator sees", len(q), "in area")
# reject
r = requests.post(f"{B}/submissions/{sid}/verify", headers=h(vk), json={"action": "reject", "notes": "Perbaiki dokumen SOP"})
print("reject:", r.json()["message"])
# perangkat re-submit
requests.post(f"{B}/submissions/{sid}/submit", headers=h(pk)).raise_for_status()
# approve
r = requests.post(f"{B}/submissions/{sid}/verify", headers=h(vk), json={"action": "approve", "notes": "OK"})
print("approve:", r.json()["message"])

# penilai scores
items = [{"indicator_id": i["id"], "ok": True, "note": "", "data_validasi": "120", "score": 800} for i in allind]
r = requests.post(f"{B}/submissions/{sid}/score", headers=h(nk), json={"items": items, "overall_note": "Baik"})
r.raise_for_status()
sc = r.json()["scoring"]
print("scored: umum", sc["umum_avg"], "teknis", sc["teknis_avg"])

# report preview + save
prev = requests.get(f"{B}/reports/preview", headers=h(nk),
                    params={"area": "Kota Palangka Raya", "device_name": "Dinas Pendidikan Kota Palangka Raya", "apply_multiplier": True}).json()
print("report rows", len(prev["rows"]), "final", prev["rows"][0]["final"], "tipe", prev["rows"][0]["tipe"]["label"])
rep = requests.post(f"{B}/reports", headers=h(nk), json={"area": "Kota Palangka Raya", "device_name": "Dinas Pendidikan Kota Palangka Raya", "apply_multiplier": True}).json()
# excel
xl = requests.get(f"{B}/reports/{rep['id']}/excel", params={"auth": nk})
print("excel:", xl.status_code, xl.headers.get("Content-Type", "")[:40], len(xl.content), "bytes")

# perangkat sees report for their area
pr = requests.get(f"{B}/reports", headers=h(pk)).json()
print("perangkat sees reports:", len(pr))

# isolation: create a different-area verifikator cannot see (login admin to make one)? skip; check verifikator of other area
print("DONE OK")
