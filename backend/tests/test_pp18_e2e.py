"""PP 18/2016 end-to-end backend test suite (Si-Scoring Kalteng)."""
import io
import os
import pytest
import requests

BASE = os.environ.get("BACKEND_INTERNAL_URL", "http://localhost:8001") + "/api"

# ---------- helpers ----------
def _login(email, pw):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw}, timeout=10)
    r.raise_for_status()
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def tokens():
    return {
        "admin":       _login("riani.anggun.adp@gmail.com", "Admin@2026"),
        "perangkat":   _login("perangkat@kalteng.go.id",  "Kerja123!"),
        "verifikator": _login("verifikator@kalteng.go.id", "Verif123!"),
        "penilai":     _login("penilai@kalteng.go.id",   "Nilai123!"),
    }


@pytest.fixture(scope="module")
def workflow(tokens):
    """Full workflow -> returns dict with sid, indicators, area."""
    pk, vk, nk = tokens["perangkat"], tokens["verifikator"], tokens["penilai"]
    period = requests.get(f"{BASE}/periods/active", headers=_h(pk)).json()

    sub = requests.post(f"{BASE}/submissions", headers=_h(pk), json={
        "device_name": "TEST_Dinas Pendidikan KPR",
        "urusan": "Bidang Pendidikan",
        "sub_urusan": None,
        "period_id": period["id"],
    }).json()
    sid = sub["id"]

    inds_resp = requests.get(f"{BASE}/indicators/for-submission", headers=_h(pk),
                             params={"level": sub["level"], "urusan": "Bidang Pendidikan"}).json()
    all_inds = inds_resp["umum"] + inds_resp["teknis"]

    # submit before upload MUST fail
    r = requests.post(f"{BASE}/submissions/{sid}/submit", headers=_h(pk))
    assert r.status_code == 400, r.text

    # upload all
    for ind in all_inds:
        files = {"file": (f"bukti_{ind['order']}.pdf", io.BytesIO(b"%PDF-1.4 x"), "application/pdf")}
        rr = requests.post(f"{BASE}/submissions/{sid}/upload", headers=_h(pk),
                           data={"indicator_id": ind["id"]}, files=files)
        rr.raise_for_status()

    # submit
    requests.post(f"{BASE}/submissions/{sid}/submit", headers=_h(pk)).raise_for_status()

    # verifikator reject with note
    r = requests.post(f"{BASE}/submissions/{sid}/verify", headers=_h(vk),
                      json={"action": "reject", "notes": "Perbaiki SOP"})
    assert r.status_code == 200

    # resubmit
    requests.post(f"{BASE}/submissions/{sid}/submit", headers=_h(pk)).raise_for_status()

    # approve
    r = requests.post(f"{BASE}/submissions/{sid}/verify", headers=_h(vk),
                      json={"action": "approve", "notes": "OK"})
    assert r.status_code == 200

    # score all
    items = [{"indicator_id": i["id"], "ok": True, "note": "",
              "data_validasi": "120", "score": 800} for i in all_inds]
    r = requests.post(f"{BASE}/submissions/{sid}/score", headers=_h(nk),
                      json={"items": items, "overall_note": "Baik"})
    r.raise_for_status()
    scoring = r.json()["scoring"]
    return {"sid": sid, "inds": all_inds, "scoring": scoring,
            "device": "TEST_Dinas Pendidikan KPR", "area": "Kota Palangka Raya"}


# ---------- Auth ----------
def test_login_all_roles(tokens):
    for k, v in tokens.items():
        assert isinstance(v, str) and len(v) > 10, f"missing token for {k}"


def test_login_invalid():
    r = requests.post(f"{BASE}/auth/login", json={"email": "nobody@example.com", "password": "bad"})
    assert r.status_code in (400, 401, 403)


# ---------- Indicators ----------
def test_indicators_seeded(tokens):
    r = requests.get(f"{BASE}/indicators/for-submission", headers=_h(tokens["perangkat"]),
                     params={"level": "kabupaten", "urusan": "Bidang Pendidikan"})
    r.raise_for_status()
    data = r.json()
    assert len(data["umum"]) == 3
    assert len(data["teknis"]) >= 1


def test_sub_urusan_returned_for_trantibumlinmas(tokens):
    r = requests.get(f"{BASE}/indicators/for-submission", headers=_h(tokens["perangkat"]),
                     params={"level": "kabupaten",
                             "urusan": "Bidang Ketentraman dan Ketertiban Umum serta Perlindungan Masyarakat",
                             "sub_urusan": "Sub Urusan Kebakaran"})
    assert r.status_code == 200


# ---------- Workflow ----------
def test_workflow_scoring(workflow):
    sc = workflow["scoring"]
    assert sc["umum_avg"] == 800.0
    assert sc["teknis_avg"] == 800.0


def test_perangkat_cannot_verify(tokens, workflow):
    r = requests.post(f"{BASE}/submissions/{workflow['sid']}/verify",
                      headers=_h(tokens["perangkat"]),
                      json={"action": "approve"})
    assert r.status_code in (400, 403)


def test_reject_without_note_rejected(tokens):
    # create a fresh submission and try reject-without-note
    pk, vk = tokens["perangkat"], tokens["verifikator"]
    period = requests.get(f"{BASE}/periods/active", headers=_h(pk)).json()
    sub = requests.post(f"{BASE}/submissions", headers=_h(pk), json={
        "device_name": "TEST_RejectNoNote",
        "urusan": "Bidang Pendidikan", "sub_urusan": None,
        "period_id": period["id"]}).json()
    sid = sub["id"]
    inds = requests.get(f"{BASE}/indicators/for-submission", headers=_h(pk),
                        params={"level": sub["level"], "urusan": "Bidang Pendidikan"}).json()
    for ind in inds["umum"] + inds["teknis"]:
        files = {"file": ("x.pdf", io.BytesIO(b"%PDF"), "application/pdf")}
        requests.post(f"{BASE}/submissions/{sid}/upload", headers=_h(pk),
                      data={"indicator_id": ind["id"]}, files=files).raise_for_status()
    requests.post(f"{BASE}/submissions/{sid}/submit", headers=_h(pk)).raise_for_status()
    r = requests.post(f"{BASE}/submissions/{sid}/verify", headers=_h(vk),
                      json={"action": "reject", "notes": ""})
    assert r.status_code == 400


# ---------- Reports ----------
def test_report_preview_and_save(tokens, workflow):
    nk = tokens["penilai"]
    prev = requests.get(f"{BASE}/reports/preview", headers=_h(nk),
                        params={"area": workflow["area"], "device_name": workflow["device"],
                                "apply_multiplier": True}).json()
    assert len(prev["rows"]) >= 1
    row0 = prev["rows"][0]
    assert row0["final"] == 880.0
    assert row0["tipe"]["label"] == "Tipe A"

    rep = requests.post(f"{BASE}/reports", headers=_h(nk),
                        json={"area": workflow["area"], "device_name": workflow["device"],
                              "apply_multiplier": True}).json()
    xl = requests.get(f"{BASE}/reports/{rep['id']}/excel", params={"auth": nk})
    assert xl.status_code == 200
    assert "openxmlformats" in xl.headers.get("Content-Type", "")
    assert len(xl.content) > 1000


def test_perangkat_sees_own_area_reports(tokens):
    r = requests.get(f"{BASE}/reports", headers=_h(tokens["perangkat"]))
    r.raise_for_status()
    assert isinstance(r.json(), list)


# ---------- Stats + Audit ----------
def test_stats(tokens):
    for role in ("admin", "perangkat", "verifikator", "penilai"):
        r = requests.get(f"{BASE}/stats/overview", headers=_h(tokens[role]))
        assert r.status_code == 200, f"{role}: {r.status_code}"


def test_audit_admin_only(tokens):
    r_admin = requests.get(f"{BASE}/audit", headers=_h(tokens["admin"]))
    assert r_admin.status_code == 200
    r_per = requests.get(f"{BASE}/audit", headers=_h(tokens["perangkat"]))
    assert r_per.status_code in (401, 403)
