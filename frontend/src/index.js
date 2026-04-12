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
