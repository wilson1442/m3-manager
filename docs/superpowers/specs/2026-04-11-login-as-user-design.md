# Login as User (Admin Impersonation) — Design

**Status:** Approved, ready for implementation planning
**Date:** 2026-04-11
**Scope:** Add an admin "Login as user" button to m3u-panel so super_admins and tenant_owners can impersonate users for support and troubleshooting.

## Goal

Let administrators step into a user's session to reproduce issues and verify behavior, without asking the user for their password, and with a clean audit trail of who acted as whom and when.

## Permission model

- **super_admin** may impersonate any non-`super_admin` user (any tenant).
- **tenant_owner** may impersonate users with role `user` within their own tenant. They may not impersonate other tenant_owners or super_admins.
- Nobody may impersonate themselves.
- Nobody may impersonate a super_admin.
- If the target user's tenant is expired, impersonation is refused (same check as login at `backend/server.py:720-732`).
- A token that already carries an `act` claim cannot be used to start a new impersonation (no nesting).

Backend enforces all of the above. Frontend checks are UX-only.

## Session flow

1. Admin is logged in normally. They visit User Management and click **Login as user** on a target row.
2. Frontend calls `POST /api/auth/impersonate/{user_id}` with the admin's current token.
3. Backend validates permissions, issues an impersonation JWT (see below), writes a log line and a `impersonation_events` row, and returns the new token plus the target user object.
4. Frontend stashes the admin's existing `token` and `user` in `sessionStorage` as `adminToken` / `adminUser`, writes the impersonation token/user into `localStorage`, and navigates to `/dashboard`.
5. A persistent amber/red **impersonation banner** renders at the top of every authenticated page: *"⚠️ You are impersonating **jdoe** (acting as admin **ngolia**) — [Return to admin]"*.
6. The banner's **Return to admin** button calls `POST /api/auth/impersonate/stop` (best-effort), restores `adminToken`/`adminUser` from `sessionStorage` back into `localStorage`, clears the stash, and navigates to `/dashboard`.

`sessionStorage` is chosen deliberately: closing the tab automatically ends impersonation, which is a safer default than `localStorage`. Reloads within the same tab keep the banner.

## Backend changes (`backend/server.py`)

### JWT shape

Extend `create_access_token(data, expires_delta=None)` to:
- Accept an optional `expires_delta` (minutes). Defaults to existing `ACCESS_TOKEN_EXPIRE_MINUTES` (1440).
- Pass through any additional claims in `data`, including `act` (the impersonator's user id).

Normal logins are unchanged. Impersonation tokens are minted with `{"sub": target.id, "act": current_user.id}` and a **60-minute** expiry.

### `get_current_user`

Unchanged for authorization — still decodes `sub` into the target user. One addition: read `payload.get("act")` and attach it to the request context (via `request.state.impersonator_id` or by returning a tuple) so handlers and log emitters can see whether the session is impersonated. All existing permission checks continue to use `current_user`, which gives us full-access impersonation (Option A on the access-scope question) for free.

### New endpoint: `POST /api/auth/impersonate/{user_id}`

Behavior:
1. Require `current_user.role in ("super_admin", "tenant_owner")`. Else 403.
2. Reject if the caller's own token already has an `act` claim (no nesting). 403.
3. Reject if `user_id == current_user.id`. 400.
4. Load target user. Missing → 404.
5. Reject if `target.role == "super_admin"`. 403.
6. If caller is `tenant_owner`:
   - If `target.tenant_id != current_user.tenant_id`: **404** (do not leak cross-tenant existence, matching the pattern at `server.py:950`).
   - If `target.role != "user"`: 403.
7. Run the tenant expiration check from login (lines 720-732). Expired → 403.
8. Mint `create_access_token({"sub": target.id, "act": current_user.id}, expires_delta=60)`.
9. Emit a structured log line: `"Impersonation start: admin=%r target=%r tenant=%s from ip=%s"`.
10. Insert an `impersonation_events` document (schema below). Capture the generated id.
11. Return `{"access_token": ..., "token_type": "bearer", "user": <target user>, "impersonation_id": <event id>}`.

### New endpoint: `POST /api/auth/impersonate/stop`

Behavior:
1. Requires a token that has an `act` claim. If missing, 400 "Not an impersonation session".
2. Emit `logger.info("Impersonation end: admin=%r target=%r")`.
3. `UPDATE impersonation_events SET ended_at = now()` for the most recent open row matching `(admin_id, target_user_id)`. Best-effort; don't fail the request if no row is found.
4. Return `{"ok": true}`. The frontend handles restoring the admin token locally; the server does not reissue one.

### New Mongo collection: `impersonation_events`

```python
{
  "id": str(uuid4()),
  "admin_id": "...",
  "admin_username": "...",          # denormalized for easy reads later
  "target_user_id": "...",
  "target_username": "...",
  "tenant_id": "...",               # target's tenant
  "started_at": datetime,
  "ended_at": datetime | None,
  "ip": "...",
  "user_agent": "..."
}
```

No index migration is part of v1. If a "who impersonated whom" admin view is built later, add `{admin_id: 1, started_at: -1}`.

### What does NOT change

No existing endpoint is gated on the `act` claim. Option A of the access-scope decision means impersonated sessions have full access, including identity-altering actions like password changes. The `impersonation_events` row plus the per-request `act` claim is the accountability story.

## Frontend changes

### `App.js` — session state

Today: `localStorage.token` and `localStorage.user`.

Add:
- `sessionStorage.adminToken` / `sessionStorage.adminUser` — set only while impersonating.
- Derived flag `isImpersonating = !!sessionStorage.getItem("adminToken")`, passed down to `Layout` and `UserManagement`.

`App.js` reads `sessionStorage` on mount alongside `localStorage` so a reload mid-impersonation restores the banner.

### `pages/UserManagement.js` — the button

Add a "Login as user" icon button (lucide `UserCheck` or similar) to the per-row action cluster next to the existing Edit/Delete buttons. Render it only when:

- `user.role === "super_admin"` AND `row.role !== "super_admin"` AND `row.id !== user.id`, OR
- `user.role === "tenant_owner"` AND `row.role === "user"` AND `row.tenant_id === user.tenant_id` AND `row.id !== user.id`

Click handler:
1. `POST /api/auth/impersonate/{row.id}` with the current token.
2. On success: stash `token` and `user` into `sessionStorage.adminToken` / `sessionStorage.adminUser`, write the new token/user into `localStorage` via the existing `handleLogin`-equivalent flow, navigate to `/dashboard`.
3. On failure: `toast.error(...)` with the server message.

### New component: `<ImpersonationBanner />`

Rendered inside `components/Layout.js` (every authenticated page wraps with `Layout`, so one mount point covers the app). Sticky at the top of the content area, amber/red background, clearly non-decorative.

Content:
> ⚠️ You are impersonating **{targetUser.username}** (acting as admin **{adminUser.username}**) — [Return to admin]

"Return to admin" button:
1. `POST /api/auth/impersonate/stop` (best-effort; ignore network errors so the admin can always escape).
2. Pop `adminToken` / `adminUser` out of `sessionStorage`, write them back into `localStorage`.
3. Force an app state refresh and `navigate("/dashboard")`.

### Axios 401 interceptor

If the 60-minute impersonation token expires mid-session, existing API calls will start returning 401. Add a response interceptor (create or extend) that:

- If `isImpersonating`: auto-restore the admin session from `sessionStorage`, show `toast.info("Impersonation session expired.")`, navigate to `/dashboard`.
- Else: fall back to the existing logout flow.

### No route changes

The impersonated user lands on the same `/dashboard` a real user would. Every existing page "just works" because the backend treats the request as the target user.

## Edge cases

| Scenario | Behavior |
|---|---|
| Admin clicks "Login as user" while already impersonating | Backend 403 (`act` claim already present). Button should also be hidden in the banner-active state. |
| Admin reloads page mid-impersonation | `sessionStorage` + `localStorage` both survive reload; banner reappears; session continues. |
| Admin closes the tab mid-impersonation | `sessionStorage` is discarded; a new tab shows only the admin session (or logged out if the admin also closed `localStorage` somehow). |
| Target user is deleted mid-session | Next API call 401/404; interceptor auto-restores admin session. |
| Admin's original token has expired by the time they click "Return to admin" | Restoration writes the expired token back; next API call fails → existing global 401 logout. Acceptable. |
| Target user changes their own password during impersonation | Allowed under full-access policy. Audit row plus log line record the real actor. |
| Multiple browser tabs | `sessionStorage` is per-tab, so impersonating in one tab doesn't affect another. No extra code. |

## Testing plan

### Backend (integration tests, `backend_test.py` style)

- super_admin → impersonate user: 200, decoded token has `sub=user.id` and `act=admin.id`, `exp` ~60 min from now.
- super_admin → impersonate another super_admin: 403.
- super_admin → impersonate self: 400.
- tenant_owner → impersonate user in own tenant: 200.
- tenant_owner → impersonate user in other tenant: 404.
- tenant_owner → impersonate another tenant_owner in same tenant: 403.
- `user` role → impersonate anyone: 403.
- Impersonate user whose tenant is expired: 403.
- Impersonate while caller's token already has `act`: 403.
- `POST /auth/impersonate/stop` with a normal token: 400.
- `POST /auth/impersonate/stop` with an impersonation token: 200; matching `impersonation_events` row has `ended_at` set.
- `impersonation_events` document is written with correct fields on start.

### Frontend (manual smoke — no React test harness exists in repo)

- Button renders only for allowed rows, for each calling role.
- Click → lands on dashboard, banner visible, session is target user's.
- Return to admin → banner gone, back on admin session.
- Reload mid-impersonation → banner survives.
- Close tab mid-impersonation → new tab shows admin session only.

## Out of scope (v1)

- Rate limiting on the impersonate endpoint. Add if/when the login endpoint gets rate limiting; don't introduce new middleware just for this.
- In-app notification to the target user that they were impersonated.
- An admin UI to browse `impersonation_events`. Collection exists so this can be built later; schema supports it.
- Blocking specific endpoints (password change, profile edits, etc.) from impersonated sessions. We chose full access; accountability is via the audit row.
- Nested impersonation.
