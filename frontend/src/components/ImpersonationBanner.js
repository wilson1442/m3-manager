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
 *     restored. Parent should update React state.
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
