# Login as User (Admin Impersonation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Login as user" button in User Management so super_admins and tenant_owners can impersonate users via a short-lived, audit-logged JWT, with one-click return to the original admin session.

**Architecture:** A new endpoint `POST /api/auth/impersonate/{user_id}` mints a 60-minute JWT containing `sub=target.id` and `act=caller.id`. Frontend stashes the admin's existing token in `sessionStorage` and swaps in the impersonation token; a persistent banner in `Layout.js` offers one-click restore via `POST /api/auth/impersonate/stop`. A new Mongo collection `impersonation_events` records the audit trail.

**Tech Stack:** FastAPI + Motor (MongoDB) + PyJWT backend; React 18 + axios + shadcn/ui + lucide-react + sonner frontend. Tests follow the repo's existing `backend_test.py`/`requests`-based integration style — no pytest harness exists.

**Spec:** `docs/superpowers/specs/2026-04-11-login-as-user-design.md`

---

## File Structure

### Backend (`backend/server.py`, single file — existing pattern)
- **Modify `create_access_token`** (server.py:619-624) to accept an optional `expires_delta` and preserve all claims in `data`.
- **Modify `get_current_user`** (server.py:626-661) to extract the optional `act` claim and attach it to `request.state.impersonator_id`. Signature changes to accept `Request`.
- **Add `ImpersonationEvent` Pydantic model** near other models (after `DashboardNotesUpdate`, ~server.py:606).
- **Add two endpoints** after the login handler (after server.py:756):
  - `POST /auth/impersonate/{user_id}` — mint token, log event, insert Mongo doc
  - `POST /auth/impersonate/stop` — log end, patch Mongo doc, 200

### Frontend
- **Create `frontend/src/lib/impersonation.js`** — small helper module with `stashAdminSession`, `restoreAdminSession`, `isImpersonating`, `getImpersonator`. Keeps `sessionStorage` keys in one place.
- **Create `frontend/src/components/ImpersonationBanner.js`** — the sticky amber banner + "Return to admin" button.
- **Modify `frontend/src/App.js`** — read `sessionStorage` on mount; wire `handleLogin` to accept an optional `stashCurrent` flag; add `handleRestoreAdmin` and pass it down.
- **Modify `frontend/src/components/Layout.js`** — render `<ImpersonationBanner />` at the top of `<main>`.
- **Modify `frontend/src/pages/UserManagement.js`** — add "Login as user" icon button to each row with visibility rules; `startImpersonation` handler.
- **Modify `frontend/src/index.js`** — install a global axios response interceptor that, on 401 while `isImpersonating()`, restores the admin session.

### Tests
- **Create `impersonation_test.py`** at repo root (alongside `backend_test.py`, `tenant_expiration_focused_test.py`). Uses `requests` against a running local backend. Runs as a standalone script.

---

## Prerequisites

Before starting, know these about the existing code:

- `backend/server.py` is a single large file. Follow its conventions: `@api_router.post("/...")`, `logger.info(...)`/`logger.warning(...)` with structured `%r` formatting (see server.py:707-710, 751-754 for examples), `raise HTTPException(status_code=..., detail="...")`.
- `User` model: `backend/server.py:432-442`. Role values: `"super_admin"`, `"tenant_owner"`, `"user"`.
- `_client_ip(request)` helper at `backend/server.py:688-697` — reuse for IP capture.
- `db.users.find_one({"id": ...}, {"_id": 0})` is the standard user lookup.
- Tenant expiration check to copy: `backend/server.py:720-732`.
- JWT library imported as `import jwt` at server.py:14. `SECRET_KEY` and `ALGORITHM` defined at 40-41.
- Frontend uses `axios` with relative `/api` base (see any page: `const API = "/api"`). Tokens set via `localStorage.token`.
- `toast` from `"sonner"` for notifications.
- `lucide-react` icons — we'll use `LogIn` for the button and `AlertTriangle` for the banner.
- Tests use raw `requests` (not pytest). Pattern: a class with `run_test(name, method, endpoint, expected_status, ...)` that tracks pass/fail counters. See `backend_test.py` for reference.

---

## Task 1: Extend `create_access_token` to accept custom expiry and extra claims

**Files:**
- Modify: `backend/server.py:619-624`

- [ ] **Step 1: Read the current function**

Current code at `backend/server.py:619-624`:
```python
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
```

- [ ] **Step 2: Replace with extended signature**

Replace the function body with:
```python
def create_access_token(data: dict, expires_minutes: Optional[int] = None):
    """Create a signed JWT.

    Args:
        data: Claims to embed in the token. Must include "sub". May include
            "act" (actor id) for impersonation tokens.
        expires_minutes: Lifetime in minutes. Defaults to
            ACCESS_TOKEN_EXPIRE_MINUTES for normal logins. Impersonation
            callers pass 60.
    """
    to_encode = data.copy()
    minutes = expires_minutes if expires_minutes is not None else ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
```

The existing callers (`register` at line 685, `login` at line 749) continue to work unchanged because `expires_minutes` is optional.

- [ ] **Step 3: Restart backend and smoke-test login**

Run:
```bash
cd /opt/m3u-panel && systemctl restart m3u-panel-backend 2>/dev/null || \
  (cd backend && ./venv/bin/python -c "import server; print('import ok')")
```

Then from another terminal:
```bash
curl -s -X POST http://localhost:8001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"REPLACE_WITH_KNOWN_ADMIN_PASSWORD"}' | head -c 200
```

Expected: a JSON response containing `"access_token"`. If you don't know the admin password, skip the curl — the import check is sufficient for this task.

- [ ] **Step 4: Commit**

```bash
git add backend/server.py
git commit -m "refactor(auth): allow custom expiry on create_access_token"
```

---

## Task 2: Surface the `act` claim through `get_current_user`

**Files:**
- Modify: `backend/server.py:626-661`

- [ ] **Step 1: Add `Request` to the signature and stash `act`**

Replace `get_current_user` (server.py:626-661) with:

```python
async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    # Stash the impersonator id (if any) so downstream handlers and loggers
    # can record that an action was taken by an admin acting as someone else.
    request.state.impersonator_id = payload.get("act")

    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")

    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])

    if user_doc.get('last_login') and isinstance(user_doc['last_login'], str):
        user_doc['last_login'] = datetime.fromisoformat(user_doc['last_login'])

    user = User(**user_doc)

    # Check tenant expiration (skip for super_admin)
    if user.role != "super_admin" and user.tenant_id:
        tenant = await db.tenants.find_one({"id": user.tenant_id}, {"_id": 0})
        if tenant:
            expiration = tenant.get('expiration_date')
            if expiration:
                if isinstance(expiration, str):
                    expiration = datetime.fromisoformat(expiration)
                if expiration.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                    raise HTTPException(status_code=403, detail="Tenant subscription has expired. Please contact your administrator.")

    return user
```

The only changes vs. current code:
1. `request: Request` added as the first parameter (FastAPI will inject it automatically).
2. One new line: `request.state.impersonator_id = payload.get("act")`.

All existing handlers using `Depends(get_current_user)` are unaffected because the only dependency change is the addition of a FastAPI-injected `Request`, which is resolved automatically.

- [ ] **Step 2: Smoke-test that existing auth still works**

Restart backend and hit any authenticated endpoint:
```bash
# use whatever the existing dev workflow is
cd /opt/m3u-panel/backend && ./venv/bin/python -c "import server; print('import ok')"
```

Then in a browser, log in and confirm the dashboard loads. Any 401 on an existing page means the signature change broke something — check the traceback.

- [ ] **Step 3: Commit**

```bash
git add backend/server.py
git commit -m "feat(auth): expose impersonator id via request.state"
```

---

## Task 3: Add `ImpersonationEvent` model

**Files:**
- Modify: `backend/server.py` (insert after `DashboardNotesUpdate`, around line 606)

- [ ] **Step 1: Add the model**

Insert after the `DashboardNotesUpdate` class (server.py:605-606), before `# Backup directory setup`:

```python
class ImpersonationEvent(BaseModel):
    """Audit record written when an admin impersonates a user.

    One row is created on impersonation start; ended_at is patched on stop
    or expires silently (never patched) if the admin closes the tab.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admin_id: str
    admin_username: str
    target_user_id: str
    target_username: str
    tenant_id: Optional[str] = None  # target user's tenant
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    ip: str
    user_agent: Optional[str] = None
```

- [ ] **Step 2: Verify import of the module**

```bash
cd /opt/m3u-panel/backend && ./venv/bin/python -c "import server; print('ok')"
```

Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/server.py
git commit -m "feat(auth): add ImpersonationEvent audit model"
```

---

## Task 4: Add `POST /auth/impersonate/{user_id}` endpoint

**Files:**
- Modify: `backend/server.py` (insert after the `login` handler, i.e. after line 756)

- [ ] **Step 1: Write the test first**

Create `impersonation_test.py` at repo root with this initial content (more tests added in Task 8):

```python
"""Integration tests for admin impersonation endpoints.

Runs against a live backend. Mirrors the pattern used by
backend_test.py and tenant_expiration_focused_test.py — raw requests,
no pytest harness.

Prerequisites:
    - Backend running on http://localhost:8001
    - A super_admin user exists (username/password supplied via env:
      SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD)

Run:
    SUPER_ADMIN_USERNAME=admin SUPER_ADMIN_PASSWORD=... \
      python3 impersonation_test.py
"""
import os
import sys
import uuid
import jwt as pyjwt
import requests

BASE_URL = os.environ.get("M3U_BACKEND_URL", "http://localhost:8001")
API = f"{BASE_URL}/api"
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")

PASSED = 0
FAILED = 0


def check(name, cond, detail=""):
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"  PASS  {name}")
    else:
        FAILED += 1
        print(f"  FAIL  {name} {('- ' + detail) if detail else ''}")


def login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"login failed for {username}: {r.status_code} {r.text}"
    return r.json()["access_token"], r.json()["user"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    admin_user = os.environ.get("SUPER_ADMIN_USERNAME")
    admin_pw = os.environ.get("SUPER_ADMIN_PASSWORD")
    if not (admin_user and admin_pw):
        print("Set SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD env vars.")
        sys.exit(2)

    admin_token, admin = login(admin_user, admin_pw)
    print(f"Logged in as super_admin: {admin['username']}")

    # ---- Test 1: super_admin impersonates an existing non-admin user ----
    # Find any non-super_admin user to impersonate.
    r = requests.get(f"{API}/users", headers=auth(admin_token))
    assert r.status_code == 200, r.text
    candidates = [u for u in r.json() if u["role"] != "super_admin" and u["id"] != admin["id"]]
    assert candidates, "need at least one non-admin user to impersonate"
    target = candidates[0]

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

    print(f"\n{PASSED} passed, {FAILED} failed")
    sys.exit(0 if FAILED == 0 else 1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd /opt/m3u-panel
SUPER_ADMIN_USERNAME=<your-admin> SUPER_ADMIN_PASSWORD=<pw> python3 impersonation_test.py
```

Expected: the first `requests.post(f"{API}/auth/impersonate/...")` returns 404 (endpoint doesn't exist yet), so **all three impersonation-related checks FAIL**. That's what we want.

- [ ] **Step 3: Implement the endpoint**

Insert the following immediately after the existing `login` handler (after `backend/server.py:756`, before `@api_router.get("/auth/me")`):

```python
@api_router.post("/auth/impersonate/{user_id}")
async def impersonate_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Issue a short-lived impersonation token for the target user.

    Permissions:
        - super_admin: any non-super_admin user
        - tenant_owner: only role=user within their own tenant
    Nesting is forbidden: callers whose own token has an `act` claim
    cannot start a new impersonation.
    """
    client_ip = _client_ip(request)
    user_agent = request.headers.get("user-agent")

    # Block nested impersonation.
    if getattr(request.state, "impersonator_id", None) is not None:
        logger.warning(
            "Rejected nested impersonation: caller=%r target=%s from ip=%s",
            current_user.username, user_id, client_ip,
        )
        raise HTTPException(status_code=403, detail="Cannot impersonate while already impersonating")

    # Role gate.
    if current_user.role not in ("super_admin", "tenant_owner"):
        raise HTTPException(status_code=403, detail="Only admins can impersonate users")

    # No self-impersonation.
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot impersonate yourself")

    # Load target.
    target_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_doc:
        # For tenant_owners this also covers cross-tenant lookups — we 404
        # either way to avoid leaking existence across tenant boundaries,
        # matching the pattern at get_user handler.
        raise HTTPException(status_code=404, detail="User not found")

    # Never impersonate a super_admin.
    if target_doc.get("role") == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot impersonate a super admin")

    # Tenant_owner further restrictions.
    if current_user.role == "tenant_owner":
        if target_doc.get("tenant_id") != current_user.tenant_id:
            raise HTTPException(status_code=404, detail="User not found")
        if target_doc.get("role") != "user":
            raise HTTPException(status_code=403, detail="Tenant owners can only impersonate regular users")

    # Tenant expiration check (same shape as login, lines 720-732).
    if target_doc.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": target_doc["tenant_id"]}, {"_id": 0})
        if tenant and tenant.get("expiration_date"):
            expiration = tenant["expiration_date"]
            if isinstance(expiration, str):
                expiration = datetime.fromisoformat(expiration)
            if expiration < datetime.now(timezone.utc):
                logger.warning(
                    "Rejected impersonation: expired tenant target=%r tenant_id=%s admin=%r from ip=%s",
                    target_doc.get("username"), target_doc.get("tenant_id"),
                    current_user.username, client_ip,
                )
                raise HTTPException(status_code=403, detail="Target user's tenant subscription has expired")

    # Mint the impersonation token (60-minute lifetime).
    access_token = create_access_token(
        data={"sub": target_doc["id"], "act": current_user.id},
        expires_minutes=60,
    )

    # Audit row.
    event = ImpersonationEvent(
        admin_id=current_user.id,
        admin_username=current_user.username,
        target_user_id=target_doc["id"],
        target_username=target_doc["username"],
        tenant_id=target_doc.get("tenant_id"),
        ip=client_ip,
        user_agent=user_agent,
    )
    event_doc = event.model_dump()
    event_doc["started_at"] = event_doc["started_at"].isoformat()
    if event_doc.get("ended_at"):
        event_doc["ended_at"] = event_doc["ended_at"].isoformat()
    await db.impersonation_events.insert_one(event_doc)

    logger.info(
        "Impersonation start: admin=%r target=%r tenant=%s from ip=%s event_id=%s",
        current_user.username, target_doc["username"],
        target_doc.get("tenant_id"), client_ip, event.id,
    )

    # Coerce the target user doc into our response model, mirroring the
    # login handler's approach.
    if isinstance(target_doc.get("created_at"), str):
        target_doc["created_at"] = datetime.fromisoformat(target_doc["created_at"])
    if isinstance(target_doc.get("last_login"), str):
        target_doc["last_login"] = datetime.fromisoformat(target_doc["last_login"])
    target_user = User(**{k: v for k, v in target_doc.items() if k != "password"})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": target_user,
        "impersonation_id": event.id,
    }
```

- [ ] **Step 4: Restart backend and re-run the test**

```bash
# restart however your dev backend runs (systemctl / manual uvicorn)
cd /opt/m3u-panel && SUPER_ADMIN_USERNAME=<admin> SUPER_ADMIN_PASSWORD=<pw> python3 impersonation_test.py
```

Expected: all 5 checks from Test 1 + Test 2 (400) + Test 3 (404) pass. Total 7 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add backend/server.py impersonation_test.py
git commit -m "feat(auth): add POST /auth/impersonate/{user_id}"
```

---

## Task 5: Add `POST /auth/impersonate/stop` endpoint

**Files:**
- Modify: `backend/server.py` (add after the `impersonate_user` handler from Task 4)
- Modify: `impersonation_test.py`

- [ ] **Step 1: Add a test for the stop endpoint**

In `impersonation_test.py`, append this block inside `main()` right before the `print(f"\n{PASSED} passed...")` line:

```python
    # ---- Test 4: stop endpoint with a normal token returns 400 ----
    r = requests.post(f"{API}/auth/impersonate/stop", headers=auth(admin_token))
    check("stop with non-impersonation token returns 400", r.status_code == 400, r.text)

    # ---- Test 5: stop endpoint with an impersonation token returns 200 ----
    r = requests.post(f"{API}/auth/impersonate/{target['id']}", headers=auth(admin_token))
    assert r.status_code == 200, r.text
    imp_token = r.json()["access_token"]
    imp_event_id = r.json()["impersonation_id"]

    r = requests.post(f"{API}/auth/impersonate/stop", headers=auth(imp_token))
    check("stop with impersonation token returns 200", r.status_code == 200, r.text)
    check("stop response has ok=true", r.status_code == 200 and r.json().get("ok") is True)
```

- [ ] **Step 2: Run — watch the new checks fail**

```bash
SUPER_ADMIN_USERNAME=<admin> SUPER_ADMIN_PASSWORD=<pw> python3 impersonation_test.py
```

Expected: the three new `check(...)` calls fail (endpoint doesn't exist — 404 is returned instead of 400/200). Earlier tests still pass.

- [ ] **Step 3: Implement the endpoint**

Insert immediately after `impersonate_user` (from Task 4), still before `@api_router.get("/auth/me")`:

```python
@api_router.post("/auth/impersonate/stop")
async def impersonate_stop(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """End an impersonation session.

    Requires that the caller's token carry an `act` claim. Patches the
    matching open impersonation_events row with ended_at and emits a log
    line. The frontend is responsible for restoring the admin token
    locally; the server does not reissue one.
    """
    impersonator_id = getattr(request.state, "impersonator_id", None)
    if impersonator_id is None:
        raise HTTPException(status_code=400, detail="Not an impersonation session")

    now = datetime.now(timezone.utc)

    # Best-effort: patch the most recent open row for this (admin, target).
    # If no row is found (edge case: started before this deploy, or already
    # closed), log and move on.
    result = await db.impersonation_events.update_one(
        {
            "admin_id": impersonator_id,
            "target_user_id": current_user.id,
            "ended_at": None,
        },
        {"$set": {"ended_at": now.isoformat()}},
        # Note: Motor/Mongo doesn't support ORDER BY on updateOne; the
        # ended_at: None filter is precise enough because nested
        # impersonation is forbidden, so at most one row can be open per
        # (admin, target) pair at a time.
    )

    logger.info(
        "Impersonation end: admin_id=%s target=%r matched=%d",
        impersonator_id, current_user.username, result.modified_count,
    )

    return {"ok": True}
```

- [ ] **Step 4: Restart backend and re-run**

```bash
SUPER_ADMIN_USERNAME=<admin> SUPER_ADMIN_PASSWORD=<pw> python3 impersonation_test.py
```

Expected: all checks pass. Total 10 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add backend/server.py impersonation_test.py
git commit -m "feat(auth): add POST /auth/impersonate/stop"
```

---

## Task 6: Add permission edge-case tests (tenant_owner, nesting, expired tenant)

**Files:**
- Modify: `impersonation_test.py`

These tests validate the hardest-to-get-right permission rules. They require a tenant_owner user with known credentials and a user in that tenant.

- [ ] **Step 1: Extend the test script with a tenant_owner section**

Append to `impersonation_test.py`, after the existing tests in `main()` but before the summary print:

```python
    # -----------------------------------------------------------------
    # Tenant-scoped tests — require env vars with tenant_owner creds
    # and a regular user in the same tenant. Skipped if not provided.
    # -----------------------------------------------------------------
    owner_user = os.environ.get("TENANT_OWNER_USERNAME")
    owner_pw = os.environ.get("TENANT_OWNER_PASSWORD")
    if not (owner_user and owner_pw):
        print("\n(skipping tenant_owner tests — set TENANT_OWNER_USERNAME/PASSWORD)")
    else:
        owner_token, owner = login(owner_user, owner_pw)
        print(f"Logged in as tenant_owner: {owner['username']}")

        # List users visible to the owner (their tenant's users).
        r = requests.get(f"{API}/users", headers=auth(owner_token))
        assert r.status_code == 200, r.text
        owner_tenant_users = [u for u in r.json() if u["id"] != owner["id"]]
        same_tenant_user = next((u for u in owner_tenant_users if u["role"] == "user"), None)

        # ---- T6: tenant_owner -> user in own tenant: 200 ----
        if same_tenant_user:
            r = requests.post(
                f"{API}/auth/impersonate/{same_tenant_user['id']}",
                headers=auth(owner_token),
            )
            check("tenant_owner -> own-tenant user: 200", r.status_code == 200, r.text)

        # ---- T7: tenant_owner -> super_admin: 403 or 404 ----
        r = requests.post(
            f"{API}/auth/impersonate/{admin['id']}",
            headers=auth(owner_token),
        )
        check("tenant_owner -> super_admin: 403/404", r.status_code in (403, 404), r.text)

        # ---- T8: 'user' role attempting impersonation: 403 ----
        # We log in as same_tenant_user via the normal login flow. This
        # requires a known password; skip if not supplied via env.
        regular_user_pw = os.environ.get("REGULAR_USER_PASSWORD")
        regular_user_name = os.environ.get("REGULAR_USER_USERNAME")
        if regular_user_name and regular_user_pw:
            try:
                user_token, user_body = login(regular_user_name, regular_user_pw)
                r = requests.post(
                    f"{API}/auth/impersonate/{owner['id']}",
                    headers=auth(user_token),
                )
                check("role=user cannot impersonate: 403", r.status_code == 403, r.text)
            except AssertionError as e:
                check("role=user cannot impersonate: 403", False, str(e))

    # ---- T9: Nesting blocked (impersonation token re-calling impersonate) ----
    r = requests.post(f"{API}/auth/impersonate/{target['id']}", headers=auth(admin_token))
    assert r.status_code == 200
    nested_token = r.json()["access_token"]
    # Pick any other non-admin user.
    another = next(
        (u for u in candidates if u["id"] != target["id"]),
        None,
    )
    if another:
        r = requests.post(
            f"{API}/auth/impersonate/{another['id']}",
            headers=auth(nested_token),
        )
        check("nested impersonation blocked: 403", r.status_code == 403, r.text)
    # Clean up by stopping the outer impersonation.
    requests.post(f"{API}/auth/impersonate/stop", headers=auth(nested_token))
```

- [ ] **Step 2: Run**

```bash
SUPER_ADMIN_USERNAME=<admin> SUPER_ADMIN_PASSWORD=<pw> \
  TENANT_OWNER_USERNAME=<owner> TENANT_OWNER_PASSWORD=<pw> \
  REGULAR_USER_USERNAME=<user> REGULAR_USER_PASSWORD=<pw> \
  python3 impersonation_test.py
```

Expected: all previous tests still pass, plus T6, T7, T9 pass (and T8 if regular-user creds provided). No regressions.

- [ ] **Step 3: Commit**

```bash
git add impersonation_test.py
git commit -m "test(auth): tenant_owner, nesting, and role=user edge cases"
```

---

## Task 7: Frontend — create impersonation session helper

**Files:**
- Create: `frontend/src/lib/impersonation.js`

- [ ] **Step 1: Create the helper module**

Write `frontend/src/lib/impersonation.js`:

```javascript
/**
 * Helpers for admin impersonation session storage.
 *
 * We stash the admin's real token/user in sessionStorage while an
 * impersonation session is active. sessionStorage is per-tab and dies
 * when the tab closes, which is the intended safety default: closing
 * the tab automatically ends impersonation.
 *
 * The "active" token/user always live in localStorage — so every
 * existing page continues to read from the same place it always has.
 */

const ADMIN_TOKEN_KEY = "adminToken";
const ADMIN_USER_KEY = "adminUser";

/**
 * Stash the current localStorage token/user as the admin session,
 * then write the impersonation token/user into localStorage. Call
 * this right after a successful POST /auth/impersonate/{id}.
 */
export function stashAdminSession(impersonationToken, impersonationUser) {
  const currentToken = localStorage.getItem("token");
  const currentUser = localStorage.getItem("user");
  if (currentToken && currentUser) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, currentToken);
    sessionStorage.setItem(ADMIN_USER_KEY, currentUser);
  }
  localStorage.setItem("token", impersonationToken);
  localStorage.setItem("user", JSON.stringify(impersonationUser));
}

/**
 * Pop the stashed admin session back into localStorage. Returns the
 * restored { token, user } or null if no stash was found.
 */
export function restoreAdminSession() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const rawUser = sessionStorage.getItem(ADMIN_USER_KEY);
  if (!token || !rawUser) return null;

  localStorage.setItem("token", token);
  localStorage.setItem("user", rawUser);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
  return { token, user: JSON.parse(rawUser) };
}

/** True iff an admin session is currently stashed. */
export function isImpersonating() {
  return !!sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

/** Returns the stashed admin user object, or null. */
export function getImpersonatorUser() {
  const raw = sessionStorage.getItem(ADMIN_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
```

- [ ] **Step 2: Verify the file imports cleanly**

```bash
cd /opt/m3u-panel/frontend && node -e "const m = require('./src/lib/impersonation.js'); console.log(Object.keys(m));" 2>&1 | tail -5 || true
```

(This may fail due to ESM vs CJS; don't block on it. The real validation is the `yarn start` / build in a later task.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/impersonation.js
git commit -m "feat(frontend): impersonation session helpers"
```

---

## Task 8: Frontend — create `ImpersonationBanner` component

**Files:**
- Create: `frontend/src/components/ImpersonationBanner.js`

- [ ] **Step 1: Write the component**

Write `frontend/src/components/ImpersonationBanner.js`:

```javascript
import axios from "axios";
import { AlertTriangle, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  isImpersonating,
  getImpersonatorUser,
  restoreAdminSession,
} from "@/lib/impersonation";

const API = "/api";

/**
 * Sticky amber banner shown at the top of every authenticated page
 * while impersonation is active. Provides a one-click return to the
 * admin session.
 *
 * Props:
 *   currentUser: the user object currently in session (i.e. the
 *     target of impersonation). Used to display "You are impersonating
 *     <username>".
 *   onRestored: callback invoked after the admin session has been
 *     restored. Parent should update React state and navigate to
 *     /dashboard.
 */
export default function ImpersonationBanner({ currentUser, onRestored }) {
  if (!isImpersonating()) return null;

  const admin = getImpersonatorUser();

  const handleReturn = async () => {
    // Best-effort server notification. Ignore network errors so the
    // admin can always escape, even offline.
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/auth/impersonate/stop`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      // Swallow. Local restore below is what actually ends the session.
    }

    const restored = restoreAdminSession();
    if (restored) {
      toast.success(`Returned to ${restored.user.username}`);
      // onRestored is a hint for the parent; the real source of truth
      // is localStorage, which App.js re-reads on mount. We force a
      // full reload (same pattern as startImpersonation) so every page
      // re-mounts with the admin session and no stale component state
      // from the target user's view lingers.
      onRestored?.(restored.token, restored.user);
      window.location.href = "/dashboard";
    }
  };

  return (
    <div
      data-testid="impersonation-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        background: "hsl(38, 91%, 55%)",
        color: "hsl(220, 15%, 12%)",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        fontWeight: 600,
        borderBottom: "1px solid hsl(38, 91%, 35%)",
        boxShadow: "0 2px 12px hsla(38, 91%, 35%, 0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AlertTriangle className="h-5 w-5" />
        <span>
          You are impersonating <strong>{currentUser?.username}</strong>
          {admin ? (
            <>
              {" "}(acting as admin <strong>{admin.username}</strong>)
            </>
          ) : null}
        </span>
      </div>
      <button
        data-testid="impersonation-return-btn"
        onClick={handleReturn}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "hsl(220, 15%, 12%)",
          color: "hsl(38, 91%, 55%)",
          padding: "6px 14px",
          borderRadius: 8,
          border: "none",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <LogOut className="h-3.5 w-3.5" />
        Return to admin
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ImpersonationBanner.js
git commit -m "feat(frontend): add ImpersonationBanner component"
```

---

## Task 9: Frontend — wire `App.js` for impersonation state

**Files:**
- Modify: `frontend/src/App.js:25-52`

- [ ] **Step 1: Import helpers and add the restore handler**

At the top of `frontend/src/App.js`, add:

```javascript
import { isImpersonating } from "@/lib/impersonation";
```

- [ ] **Step 2: Update `handleLogin` and add `handleRestoreAdmin`**

Replace `handleLogin` (App.js:40-45) and `handleLogout` (47-52) with:

```javascript
  const handleLogin = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  // Called by ImpersonationBanner after it restores the admin session.
  // token/userData are the restored admin values.
  const handleRestoreAdmin = (token, userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    // localStorage is already updated by restoreAdminSession().
  };

  const handleLogout = () => {
    // Full logout: wipe both the active session and any stashed admin.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminUser");
    setIsAuthenticated(false);
    setUser(null);
  };
```

- [ ] **Step 3: Pass `handleRestoreAdmin` down through `Layout`**

Every route that renders an authenticated page currently passes `user={user}` and `onLogout={handleLogout}`. Add `onRestoreAdmin={handleRestoreAdmin}` to each one that uses `Layout` (all authenticated routes — Dashboard, M3UManagement, UserManagement, TenantManagement, Profile, Channels, Categories, Events, Settings, ReleaseNotes).

Use search-and-replace: in `frontend/src/App.js`, for every route where you see `user={user} onLogout={handleLogout}`, add `onRestoreAdmin={handleRestoreAdmin}` as a sibling prop.

Example — change:
```javascript
<Dashboard user={user} onLogout={handleLogout} />
```
to:
```javascript
<Dashboard user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
```

Do the same for M3UManagement, UserManagement, TenantManagement, Channels, Categories, Events, Settings, ReleaseNotes. (Profile already accepts extra props; add it there too.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.js
git commit -m "feat(frontend): wire impersonation restore handler through App routes"
```

---

## Task 10: Frontend — render banner inside `Layout.js`

**Files:**
- Modify: `frontend/src/components/Layout.js:20,230`

- [ ] **Step 1: Import the banner**

At the top of `Layout.js`, add:

```javascript
import ImpersonationBanner from "@/components/ImpersonationBanner";
```

- [ ] **Step 2: Accept the new prop**

Change the component signature at `Layout.js:20`:

```javascript
export default function Layout({ user, onLogout, onRestoreAdmin, children, currentPage }) {
```

- [ ] **Step 3: Render the banner at the top of `<main>`**

Replace `Layout.js:230`:
```javascript
      <main className="lg:ml-64 pt-20 lg:pt-10 px-4 sm:px-6 lg:px-10 pb-10">{children}</main>
```

with:
```javascript
      <main className="lg:ml-64 pt-20 lg:pt-10 pb-10">
        <ImpersonationBanner currentUser={user} onRestored={onRestoreAdmin} />
        <div className="px-4 sm:px-6 lg:px-10">{children}</div>
      </main>
```

The padding moves onto an inner wrapper so the banner stretches full-bleed across the main area while the content keeps its existing horizontal padding.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.js
git commit -m "feat(frontend): render ImpersonationBanner in Layout"
```

---

## Task 11: Frontend — add "Login as user" button in `UserManagement.js`

**Files:**
- Modify: `frontend/src/pages/UserManagement.js:12,417-436`

- [ ] **Step 1: Import `LogIn` icon and session helpers**

At the top of `UserManagement.js`, update the lucide import (line 12):

```javascript
import { Plus, Trash2, UserCircle, Filter, Pencil, LogIn } from "lucide-react";
```

Add below the existing imports:

```javascript
import { useNavigate } from "react-router-dom";
import { stashAdminSession } from "@/lib/impersonation";
```

- [ ] **Step 2: Add a `navigate` hook and impersonation handler**

Inside the `UserManagement` component, right after `const token = localStorage.getItem("token");` (line 41), add:

```javascript
  const navigate = useNavigate();

  const canImpersonate = (row) => {
    if (row.id === user.id) return false;
    if (row.role === "super_admin") return false;
    if (user.role === "super_admin") return true;
    if (user.role === "tenant_owner") {
      return row.role === "user" && row.tenant_id === user.tenant_id;
    }
    return false;
  };

  const handleImpersonate = async (row) => {
    try {
      const response = await axios.post(
        `${API}/auth/impersonate/${row.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const { access_token, user: targetUser } = response.data;
      stashAdminSession(access_token, targetUser);
      toast.success(`Now impersonating ${targetUser.username}`);
      // Force a full reload so App.js picks up the new localStorage state
      // and the banner mounts cleanly. Simpler than plumbing an upward
      // callback.
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to impersonate user");
    }
  };
```

- [ ] **Step 3: Add the button to the row action cluster**

In the action-cell block at `UserManagement.js:417-436`, add a new button *before* the existing Edit button:

```javascript
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canImpersonate(u) && (
                            <Button
                              data-testid={`impersonate-user-${u.id}`}
                              variant="outline"
                              size="sm"
                              title={`Log in as ${u.username}`}
                              onClick={() => handleImpersonate(u)}
                            >
                              <LogIn className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            data-testid={`edit-user-${u.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(u)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            data-testid={`delete-user-${u.id}`}
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog(u)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
```

- [ ] **Step 4: Smoke-test in the browser**

1. `cd /opt/m3u-panel/frontend && yarn start` (or whatever the dev command is).
2. Log in as super_admin, go to Users page.
3. A LogIn icon should appear next to Edit/Delete for every non-super_admin user (and not for yourself).
4. Click it → should land on Dashboard with the amber banner at the top.
5. Click "Return to admin" → banner disappears, back as admin.

If any of that fails: check the browser console for React errors, and check `localStorage` / `sessionStorage` in DevTools to verify the stash/restore logic.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/UserManagement.js
git commit -m "feat(frontend): add Login as User button to UserManagement"
```

---

## Task 12: Frontend — axios 401 interceptor for expired impersonation tokens

**Files:**
- Modify: `frontend/src/index.js`

- [ ] **Step 1: Install the interceptor before `<App />` mounts**

Replace `frontend/src/index.js` with:

```javascript
import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import "@/index.css";
import App from "@/App";
import {
  isImpersonating,
  restoreAdminSession,
} from "@/lib/impersonation";

// Global 401 handler.
//
// If an impersonation token expires mid-session (60-minute lifetime),
// the next API call returns 401. We restore the admin session locally,
// show a toast, and reload. Non-impersonation 401s fall through to
// whatever the calling page already does.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && isImpersonating()) {
      const restored = restoreAdminSession();
      if (restored) {
        // Dynamic import of sonner so this file stays small.
        import("sonner").then(({ toast }) => {
          toast.info("Impersonation session expired");
        });
        window.location.href = "/dashboard";
      }
    }
    return Promise.reject(error);
  },
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Smoke-test the expiry path (manual)**

Because the real expiry is 60 minutes, this is hard to test cleanly. Two options:

**Option A (fastest):** Temporarily change `expires_minutes=60` → `expires_minutes=1` in the backend `impersonate_user` handler, rebuild, impersonate, wait ~70 seconds, click around a page that makes API calls, verify the toast + redirect. **Revert the change after testing.**

**Option B (manual in DevTools):** Impersonate a user, then in DevTools delete `localStorage.token`, then click around. You'll get 401s but since `isImpersonating()` is still true, the interceptor will restore.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.js
git commit -m "feat(frontend): restore admin session on 401 during impersonation"
```

---

## Task 13: Full end-to-end smoke test

**Files:** none (pure verification)

- [ ] **Step 1: Backend tests pass**

```bash
cd /opt/m3u-panel
SUPER_ADMIN_USERNAME=<admin> SUPER_ADMIN_PASSWORD=<pw> \
  TENANT_OWNER_USERNAME=<owner> TENANT_OWNER_PASSWORD=<pw> \
  REGULAR_USER_USERNAME=<user> REGULAR_USER_PASSWORD=<pw> \
  python3 impersonation_test.py
```

Expected: all checks PASS.

- [ ] **Step 2: Frontend path — super_admin**

1. Log in as super_admin.
2. Users page → click LogIn on a tenant_owner and then a user.
3. For each: verify banner appears, sidebar shows the *target* user's role menu, and Return to admin restores you.
4. Reload the page mid-impersonation — banner survives.
5. Close the tab and re-open — new tab shows only the admin session.

- [ ] **Step 3: Frontend path — tenant_owner**

1. Log in as a tenant_owner.
2. Users page — LogIn button should appear only on `role=user` rows in your own tenant, not on super_admins or other tenant_owners.
3. Click LogIn → banner shows "acting as admin <tenant_owner_name>".
4. Return to admin works.

- [ ] **Step 4: Backend log inspection**

```bash
# adjust to however your backend logs are collected
journalctl -u m3u-panel-backend --since "5 min ago" | grep -i impersonation
```

Expected: `Impersonation start:` and `Impersonation end:` lines matching your actions, with correct admin/target/ip fields.

- [ ] **Step 5: Mongo audit inspection**

```bash
mongosh --quiet m3u_panel --eval 'db.impersonation_events.find({}, {admin_username:1, target_username:1, started_at:1, ended_at:1, ip:1, _id:0}).sort({started_at:-1}).limit(10).toArray()'
```
(Adjust database name if different — check `MONGO_URL` / `DB_NAME` in `backend/.env`.)

Expected: recent rows for each impersonation you performed, with `ended_at` set on the ones where you clicked Return to admin.

- [ ] **Step 6: No-op commit marker (optional)**

This step doesn't create code; it's the final gate. If all five steps above are green, you're done.

---

## Summary of changed files

| File | Change |
|---|---|
| `backend/server.py` | Extend `create_access_token`, surface `act` claim in `get_current_user`, add `ImpersonationEvent` model, add two endpoints |
| `impersonation_test.py` | New integration test script |
| `frontend/src/lib/impersonation.js` | New session helper module |
| `frontend/src/components/ImpersonationBanner.js` | New banner component |
| `frontend/src/App.js` | Add restore handler, pass through routes, wipe stash on logout |
| `frontend/src/components/Layout.js` | Render banner inside `<main>` |
| `frontend/src/pages/UserManagement.js` | Add LogIn button + impersonate handler |
| `frontend/src/index.js` | Global axios 401 interceptor |
| `docs/superpowers/specs/2026-04-11-login-as-user-design.md` | (already committed) design spec |
| `docs/superpowers/plans/2026-04-11-login-as-user.md` | (this file) |
