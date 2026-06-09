import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import "@/index.css";
import App from "@/App";
import {
  ADMIN_TOKEN_KEY,
  ADMIN_USER_KEY,
  isImpersonating,
  restoreAdminSession,
} from "@/lib/impersonation";

// Global 401 handler.
//
// Impersonation: if a 60-minute impersonation token expires, restore the
// admin session and bounce to /dashboard.
//
// Everything else: a 401 means the user's JWT is expired or revoked. Clear
// stashed auth and send them to /login so they don't sit on a blank
// dashboard wondering why nothing loads.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (isImpersonating()) {
        const restored = restoreAdminSession();
        if (restored) {
          // Dynamic import of sonner so this file stays small.
          import("sonner").then(({ toast }) => {
            toast.info("Impersonation session expired");
          });
          window.location.href = "/dashboard";
        }
      } else if (localStorage.getItem("token")) {
        // Only force a redirect when a token was actually in play. Public
        // routes (Landing, Player) shouldn't be booted to /login for an
        // incidental 401.
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        sessionStorage.removeItem(ADMIN_USER_KEY);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
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
