"""Integration tests for admin impersonation endpoints.

Runs against a live backend at http://localhost:8001. Mirrors the pattern
used by backend_test.py — raw requests, no pytest harness.

Prereqs:
    - Backend running (systemctl status m3u-backend)
    - Throwaway test users seeded via tests/impersonation_fixtures.py

Run:
    python3 impersonation_test.py
"""
import os
import sys
import uuid
import jwt as pyjwt
import requests
from pathlib import Path

# Load SECRET_KEY from backend .env so we can decode returned tokens.
BACKEND_ENV = Path(__file__).resolve().parent / "backend" / ".env"
SECRET_KEY = None
if BACKEND_ENV.exists():
    for line in BACKEND_ENV.read_text().splitlines():
        if line.startswith("SECRET_KEY="):
            SECRET_KEY = line.split("=", 1)[1].strip()
            break
if not SECRET_KEY:
    print("FATAL: could not read SECRET_KEY from backend/.env")
    sys.exit(2)

BASE_URL = os.environ.get("M3U_BACKEND_URL", "http://localhost:8001")
API = f"{BASE_URL}/api"

# Fixtures from tests/impersonation_fixtures.py (all use password 'imp_test_pw')
ADMIN_USERNAME = "imp_test_admin"
OWNER_USERNAME = "imp_test_owner"
USER_USERNAME = "imp_test_user"
USER2_USERNAME = "imp_test_user2"
TEST_PW = "imp_test_pw"

PASSED = 0
FAILED = 0


def check(name, cond, detail=""):
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"  PASS  {name}")
    else:
        FAILED += 1
        print(f"  FAIL  {name} {('- ' + str(detail)) if detail else ''}")


def login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"login failed for {username}: {r.status_code} {r.text}"
    return r.json()["access_token"], r.json()["user"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    admin_token, admin = login(ADMIN_USERNAME, TEST_PW)
    print(f"Logged in as super_admin: {admin['username']}")

    # ---- Test 1: super_admin impersonates a non-admin user ----
    # Find a non-super_admin target to impersonate (use the seeded test user).
    r = requests.get(f"{API}/users", headers=auth(admin_token))
    assert r.status_code == 200, r.text
    test_user_row = next(
        (u for u in r.json() if u["username"] == USER_USERNAME),
        None,
    )
    assert test_user_row, f"seed user {USER_USERNAME} not found — run tests/impersonation_fixtures.py seed"
    target = test_user_row

    r = requests.post(f"{API}/auth/impersonate/{target['id']}", headers=auth(admin_token))
    check("super_admin impersonate non-admin returns 200", r.status_code == 200, r.text)
    if r.status_code == 200:
        body = r.json()
        token = body["access_token"]
        claims = pyjwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        check("token sub == target id", claims.get("sub") == target["id"])
        check("token act == admin id", claims.get("act") == admin["id"])
        check("returned user is target", body["user"]["id"] == target["id"])
        check("impersonation_id present", "impersonation_id" in body)

    # ---- Test 2: self-impersonation is blocked ----
    r = requests.post(f"{API}/auth/impersonate/{admin['id']}", headers=auth(admin_token))
    check("self-impersonation returns 400", r.status_code == 400, r.text)

    # ---- Test 3: nonexistent user returns 404 ----
    r = requests.post(f"{API}/auth/impersonate/{uuid.uuid4()}", headers=auth(admin_token))
    check("nonexistent user returns 404", r.status_code == 404, r.text)

    # ---- Test 4: stop endpoint with a non-impersonation token returns 400 ----
    r = requests.post(f"{API}/auth/impersonate/stop", headers=auth(admin_token))
    check("stop with non-impersonation token returns 400", r.status_code == 400, r.text)

    # ---- Test 5: stop endpoint with an impersonation token returns 200 ----
    r = requests.post(f"{API}/auth/impersonate/{target['id']}", headers=auth(admin_token))
    assert r.status_code == 200, r.text
    imp_token = r.json()["access_token"]

    r = requests.post(f"{API}/auth/impersonate/stop", headers=auth(imp_token))
    check("stop with impersonation token returns 200", r.status_code == 200, r.text)
    check("stop response has ok=true", r.status_code == 200 and r.json().get("ok") is True)

    print(f"\n{PASSED} passed, {FAILED} failed")
    sys.exit(0 if FAILED == 0 else 1)


if __name__ == "__main__":
    main()
