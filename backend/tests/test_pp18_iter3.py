"""Iteration 3 backend tests for PP 18/2016 Kalteng.

Covers:
- Indicator weight field save/read (admin)
- Weighted teknis_avg on score_submission
- Score value bounds (0-1000)
- data_validasi max 500 chars validation
- DELETE /submissions/{sid}/upload/{indicator_id} (draft/ditolak only)
- /reference/urusan reachable
"""
import io
import os
import uuid
import pytest
import requests

BASE = os.environ.get("BACKEND_INTERNAL_URL", "http://localhost:8001") + "/api"


def _login(email, pw):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw}, timeout=10)
    r.raise_for_status()
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin":       _login("riani.anggun.adp@gmail.com", "Admin@2026"),
        "perangkat":   _login("perangkat@kalteng.go.id",  "Kerja123!"),
        "verifikator": _login("verifikator@kalteng.go.id", "Verif123!"),
        "penilai":     _login("penilai@kalteng.go.id",   "Nilai123!"),
    }


# ---------------- Indicator weight ----------------
def test_indicator_weight_crud(tokens):
    """Admin creates a teknis indicator with weight, then reads it back."""
    ak = tokens["admin"]
    name = f"TEST_IterWeight_{uuid.uuid4().hex[:6]}"
    body = {"type": "teknis", "name": name, "description": "",
            "level": "kabupaten", "urusan": "Bidang Statistik",
            "sub_urusan": None, "weight": 3.0, "order": 999}
    r = requests.post(f"{BASE}/indicators", headers=_h(ak), json=body)
    assert r.status_code == 200, r.text
    ind = r.json()
    assert ind["weight"] == 3.0
    # Read back
    r = requests.get(f"{BASE}/indicators", headers=_h(ak), params={"type": "teknis", "urusan": "Bidang Statistik"})
    assert r.status_code == 200
    found = [x for x in r.json() if x["id"] == ind["id"]]
    assert found and found[0]["weight"] == 3.0
    # Cleanup
    requests.delete(f"{BASE}/indicators/{ind['id']}", headers=_h(ak))


# ---------------- Reference / urusan ----------------
def test_reference_urusan(tokens):
    r = requests.get(f"{BASE}/reference/urusan", headers=_h(tokens["perangkat"]))
    assert r.status_code == 200
    data = r.json()
    assert "urusan" in data and isinstance(data["urusan"], list)
    assert len(data["urusan"]) > 0


# ---------------- Delete upload (draft) ----------------
def _fresh_submission(pk, urusan="Bidang Pendidikan", device=None):
    period = requests.get(f"{BASE}/periods/active", headers=_h(pk)).json()
    device = device or f"TEST_Iter3_{uuid.uuid4().hex[:6]}"
    sub = requests.post(f"{BASE}/submissions", headers=_h(pk), json={
        "device_name": device, "urusan": urusan, "sub_urusan": None,
        "period_id": period["id"]}).json()
    return sub


def _upload(pk, sid, indicator_id):
    files = {"file": ("x.pdf", io.BytesIO(b"%PDF-1.4 xx"), "application/pdf")}
    r = requests.post(f"{BASE}/submissions/{sid}/upload", headers=_h(pk),
                      data={"indicator_id": indicator_id}, files=files)
    r.raise_for_status()
    return r.json()


def test_delete_upload_when_draft(tokens):
    pk = tokens["perangkat"]
    sub = _fresh_submission(pk)
    sid = sub["id"]
    inds = requests.get(f"{BASE}/indicators/for-submission", headers=_h(pk),
                        params={"level": sub["level"], "urusan": "Bidang Pendidikan"}).json()
    target = inds["umum"][0]
    _upload(pk, sid, target["id"])
    # get submission -> uploads should contain the ind
    s = requests.get(f"{BASE}/submissions/{sid}", headers=_h(pk)).json()
    assert target["id"] in s.get("uploads", {})
    # delete
    r = requests.delete(f"{BASE}/submissions/{sid}/upload/{target['id']}", headers=_h(pk))
    assert r.status_code == 200, r.text
    s2 = requests.get(f"{BASE}/submissions/{sid}", headers=_h(pk)).json()
    assert target["id"] not in (s2.get("uploads") or {})


def test_delete_upload_forbidden_when_selesai(tokens):
    """Cannot delete an upload after status is selesai."""
    pk, vk, nk = tokens["perangkat"], tokens["verifikator"], tokens["penilai"]
    sub = _fresh_submission(pk, device=f"TEST_NoDeleteAfterDone_{uuid.uuid4().hex[:5]}")
    sid = sub["id"]
    inds = requests.get(f"{BASE}/indicators/for-submission", headers=_h(pk),
                        params={"level": sub["level"], "urusan": "Bidang Pendidikan"}).json()
    all_inds = inds["umum"] + inds["teknis"]
    for ind in all_inds:
        _upload(pk, sid, ind["id"])
    requests.post(f"{BASE}/submissions/{sid}/submit", headers=_h(pk)).raise_for_status()
    requests.post(f"{BASE}/submissions/{sid}/verify", headers=_h(vk), json={"action": "approve"}).raise_for_status()
    items = [{"indicator_id": i["id"], "ok": True, "note": "", "data_validasi": "1", "score": 500} for i in all_inds]
    requests.post(f"{BASE}/submissions/{sid}/score", headers=_h(nk), json={"items": items}).raise_for_status()
    # now try delete an upload -> 403
    r = requests.delete(f"{BASE}/submissions/{sid}/upload/{all_inds[0]['id']}", headers=_h(pk))
    assert r.status_code == 403


# ---------------- Weighted teknis_avg ----------------
def test_teknis_avg_weighted(tokens):
    """Add 2 teknis indicators with different weights, score them, verify weighted avg."""
    ak, pk, vk, nk = tokens["admin"], tokens["perangkat"], tokens["verifikator"], tokens["penilai"]
    # use a fresh urusan to avoid mixing with existing teknis
    marker = uuid.uuid4().hex[:6]
    urusan_name = f"TEST_Urusan_{marker}"
    ind_a = requests.post(f"{BASE}/indicators", headers=_h(ak), json={
        "type": "teknis", "name": f"A_{marker}", "level": "kabupaten",
        "urusan": urusan_name, "sub_urusan": None, "weight": 1.0, "order": 1}).json()
    ind_b = requests.post(f"{BASE}/indicators", headers=_h(ak), json={
        "type": "teknis", "name": f"B_{marker}", "level": "kabupaten",
        "urusan": urusan_name, "sub_urusan": None, "weight": 3.0, "order": 2}).json()
    try:
        sub = _fresh_submission(pk, urusan=urusan_name, device=f"TEST_Weighted_{marker}")
        sid = sub["id"]
        inds = requests.get(f"{BASE}/indicators/for-submission", headers=_h(pk),
                            params={"level": "kabupaten", "urusan": urusan_name}).json()
        all_inds = inds["umum"] + inds["teknis"]
        assert len(inds["teknis"]) == 2
        for ind in all_inds:
            _upload(pk, sid, ind["id"])
        requests.post(f"{BASE}/submissions/{sid}/submit", headers=_h(pk)).raise_for_status()
        requests.post(f"{BASE}/submissions/{sid}/verify", headers=_h(vk),
                      json={"action": "approve"}).raise_for_status()
        # Score umum=any (won't affect teknis_avg); teknis A=200 (w=1), B=800 (w=3) -> weighted = (200*1 + 800*3)/4 = 650
        items = []
        for i in inds["umum"]:
            items.append({"indicator_id": i["id"], "ok": True, "note": "", "data_validasi": "1", "score": 500})
        items.append({"indicator_id": ind_a["id"], "ok": True, "note": "", "data_validasi": "1", "score": 200})
        items.append({"indicator_id": ind_b["id"], "ok": True, "note": "", "data_validasi": "1", "score": 800})
        r = requests.post(f"{BASE}/submissions/{sid}/score", headers=_h(nk), json={"items": items})
        assert r.status_code == 200, r.text
        sc = r.json()["scoring"]
        assert sc["teknis_avg"] == 650.0, f"expected weighted 650, got {sc['teknis_avg']}"
    finally:
        requests.delete(f"{BASE}/indicators/{ind_a['id']}", headers=_h(ak))
        requests.delete(f"{BASE}/indicators/{ind_b['id']}", headers=_h(ak))


# ---------------- Score bounds & data_validasi length ----------------
def _prep_for_score(tokens, device):
    pk, vk = tokens["perangkat"], tokens["verifikator"]
    sub = _fresh_submission(pk, device=device)
    sid = sub["id"]
    inds = requests.get(f"{BASE}/indicators/for-submission", headers=_h(pk),
                        params={"level": sub["level"], "urusan": "Bidang Pendidikan"}).json()
    all_inds = inds["umum"] + inds["teknis"]
    for ind in all_inds:
        _upload(pk, sid, ind["id"])
    requests.post(f"{BASE}/submissions/{sid}/submit", headers=_h(pk)).raise_for_status()
    requests.post(f"{BASE}/submissions/{sid}/verify", headers=_h(vk),
                  json={"action": "approve"}).raise_for_status()
    return sid, all_inds


def test_score_out_of_range_rejected(tokens):
    nk = tokens["penilai"]
    sid, all_inds = _prep_for_score(tokens, f"TEST_ScoreRange_{uuid.uuid4().hex[:5]}")
    items = [{"indicator_id": i["id"], "ok": True, "note": "", "data_validasi": "1", "score": 500}
             for i in all_inds]
    items[0]["score"] = 1500  # invalid
    r = requests.post(f"{BASE}/submissions/{sid}/score", headers=_h(nk), json={"items": items})
    assert r.status_code == 400


def test_data_validasi_max_500(tokens):
    nk = tokens["penilai"]
    sid, all_inds = _prep_for_score(tokens, f"TEST_Val500_{uuid.uuid4().hex[:5]}")
    items = [{"indicator_id": i["id"], "ok": True, "note": "", "data_validasi": "1", "score": 500}
             for i in all_inds]
    items[0]["data_validasi"] = "x" * 501
    r = requests.post(f"{BASE}/submissions/{sid}/score", headers=_h(nk), json={"items": items})
    assert r.status_code == 400
