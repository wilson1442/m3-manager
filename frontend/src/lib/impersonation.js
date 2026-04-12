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

export const ADMIN_TOKEN_KEY = "adminToken";
export const ADMIN_USER_KEY = "adminUser";

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
