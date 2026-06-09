import { useState, useEffect } from "react";
import axios from "axios";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import M3UManagement from "@/pages/M3UManagement";
import UserManagement from "@/pages/UserManagement";
import TenantManagement from "@/pages/TenantManagement";
import Profile from "@/pages/Profile";
import Channels from "@/pages/Channels";
import BrowseChannels from "@/pages/BrowseChannels";
import Categories from "@/pages/Categories";
import Events from "@/pages/Events";
import Settings from "@/pages/Settings";
import Player from "@/pages/Player";
import ReleaseNotes from "@/pages/ReleaseNotes";
import { isImpersonating, ADMIN_TOKEN_KEY, ADMIN_USER_KEY } from "@/lib/impersonation";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");

    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (!token || !savedUser) {
      setLoading(false);
      return;
    }

    // Validate the stashed token against the backend before treating the
    // user as logged in. Without this, an expired JWT (24h lifetime) would
    // route the user to the dashboard, every API call would 401, and they
    // would see a blank screen until they manually signed out.
    let cancelled = false;
    (async () => {
      try {
        const response = await axios.get("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const freshUser = response.data;
        localStorage.setItem("user", JSON.stringify(freshUser));
        setUser(freshUser);
        setIsAuthenticated(true);
      } catch (error) {
        if (cancelled) return;
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          // Token is rejected — clear stale auth and fall through to /login.
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          sessionStorage.removeItem(ADMIN_TOKEN_KEY);
          sessionStorage.removeItem(ADMIN_USER_KEY);
        } else {
          // Network blip or 5xx: trust the cached user optimistically rather
          // than booting the user out for a transient backend hiccup. The
          // global 401 interceptor will catch a truly bad token on the next
          // real API call.
          setUser(JSON.parse(savedUser));
          setIsAuthenticated(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
    setIsAuthenticated(false);
    setUser(null);
  };

  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <Dashboard user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/m3u"
            element={
              isAuthenticated ? (
                <M3UManagement user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/users"
            element={
              isAuthenticated ? (
                <UserManagement user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/tenants"
            element={
              isAuthenticated ? (
                <TenantManagement user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/profile"
            element={
              isAuthenticated ? (
                <Profile user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} theme={theme} updateTheme={updateTheme} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/channels"
            element={
              isAuthenticated ? (
                <Channels user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/browse"
            element={
              isAuthenticated ? (
                <BrowseChannels user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/categories"
            element={
              isAuthenticated ? (
                <Categories user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/events"
            element={
              isAuthenticated ? (
                <Events user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/settings"
            element={
              isAuthenticated ? (
                <Settings user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/release-notes"
            element={
              isAuthenticated ? (
                <ReleaseNotes user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/player"
            element={<Player />}
          />
          <Route
            path="/"
            element={<Landing isAuthenticated={isAuthenticated} />}
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;