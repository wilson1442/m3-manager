import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import DOMPurify from "dompurify";
import Layout from "@/components/Layout";
import {
  Users,
  ListMusic,
  Building2,
  FileText,
  Radio,
  ArrowUpRight,
  RefreshCw,
  Tv,
  Settings as SettingsIcon,
  Search,
  Calendar,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  CircleOff,
} from "lucide-react";

// Allowlist for sanitizing admin-authored dashboard notes. Keep in sync with
// the identical config in Settings.js (preview) and the backend bleach config.
const NOTES_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "p", "br", "strong", "em", "u", "ul", "ol", "li", "a", "code", "pre", "blockquote"],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

const API = "/api";

/* ------------------------------------------------------------------ */
/*  "Quiet Premium" — scoped design system                            */
/*  Warm neutral dark · single amber accent · Plus Jakarta Sans       */
/* ------------------------------------------------------------------ */
const DashStyles = () => (
  <style>{`
    .dash {
      --dbg:        #0E0E10;   /* warm neutral ink */
      --dbg-2:      #141416;
      --panel:      #18181B;
      --panel-hi:   #1F1F23;
      --line:       #27272A;
      --line-hi:    #323237;

      --text:       #FAFAF9;
      --text-soft:  #D4D4D1;
      --muted:      #A1A1A5;
      --dim:        #6B6B70;

      --accent:     #F5A524;   /* warm amber — the only accent */
      --accent-soft: rgba(245, 165, 36, 0.12);
      --accent-ring: rgba(245, 165, 36, 0.28);

      --good:       #7BC47F;   /* muted sage for "OK" */
      --warn:       #E7B75A;
      --bad:        #E07A6C;   /* soft coral for "bad" */

      --r-lg: 18px;
      --r-md: 14px;
      --r-sm: 10px;

      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--text);
      letter-spacing: -0.005em;
    }
    /* Atmospheric background is applied globally via App.css body bg */

    .dash-title {
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1.02;
    }
    .dash-sub {
      font-weight: 400;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.55;
    }
    .dash-eyebrow {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .dash-card {
      background: linear-gradient(180deg, var(--panel) 0%, var(--dbg-2) 100%);
      border: 1px solid var(--line);
      border-radius: var(--r-lg);
      transition: border-color 220ms ease, transform 220ms ease, box-shadow 220ms ease;
    }
    .dash-card:hover {
      border-color: var(--line-hi);
    }

    .dash-card-ghost {
      background: rgba(24,24,27,0.5);
      border: 1px solid var(--line);
      border-radius: var(--r-lg);
    }

    /* quick action row */
    .dash-action {
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem;
      padding: 18px 20px;
      background: linear-gradient(180deg, var(--panel) 0%, var(--dbg-2) 100%);
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      color: var(--text);
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: border-color 220ms ease, transform 220ms ease, background 220ms ease;
    }
    .dash-action:hover {
      border-color: var(--accent-ring);
      background: linear-gradient(180deg, var(--panel-hi) 0%, var(--panel) 100%);
      transform: translateY(-1px);
    }
    .dash-action-icon {
      flex-shrink: 0;
      width: 40px; height: 40px;
      border-radius: 12px;
      background: var(--accent-soft);
      color: var(--accent);
      display: flex; align-items: center; justify-content: center;
    }

    /* capacity bar */
    .dash-bar {
      position: relative;
      height: 6px;
      background: #222225;
      border-radius: 999px;
      overflow: hidden;
    }
    .dash-bar > span {
      position: absolute; inset: 0;
      transform-origin: left;
      transform: scaleX(0);
      border-radius: 999px;
      animation: dash-fill 1.1s cubic-bezier(.25,.85,.4,1) forwards;
    }
    @keyframes dash-fill { to { transform: scaleX(var(--fill, 0)); } }

    /* soft rise on mount */
    @keyframes dash-rise {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .dash-rise { animation: dash-rise 0.65s cubic-bezier(.25,.85,.4,1) both; }
    .dash-d-1 { animation-delay: 0.03s; }
    .dash-d-2 { animation-delay: 0.08s; }
    .dash-d-3 { animation-delay: 0.13s; }
    .dash-d-4 { animation-delay: 0.18s; }
    .dash-d-5 { animation-delay: 0.23s; }
    .dash-d-6 { animation-delay: 0.28s; }

    /* status pill */
    .dash-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .dash-pill svg { width: 12px; height: 12px; }
    .dash-pill-ok {
      color: var(--good);
      background: rgba(123, 196, 127, 0.09);
      border-color: rgba(123, 196, 127, 0.2);
    }
    .dash-pill-warn {
      color: var(--warn);
      background: rgba(231, 183, 90, 0.09);
      border-color: rgba(231, 183, 90, 0.22);
    }
    .dash-pill-bad {
      color: var(--bad);
      background: rgba(224, 122, 108, 0.09);
      border-color: rgba(224, 122, 108, 0.22);
    }

    .dash-num {
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum", "ss01";
    }

    .dash-divider {
      height: 1px;
      background: var(--line);
      width: 100%;
    }

    /* notes memo */
    .dash-memo h1, .dash-memo h2, .dash-memo h3, .dash-memo h4 {
      font-weight: 600;
      color: var(--text);
      margin-top: 1em;
      margin-bottom: 0.4em;
      letter-spacing: -0.015em;
    }
    .dash-memo h1 { font-size: 18px; }
    .dash-memo h2 { font-size: 16px; }
    .dash-memo h3 { font-size: 14px; }
    .dash-memo p, .dash-memo li {
      font-size: 14px;
      line-height: 1.65;
      color: var(--text-soft);
    }
    .dash-memo ul, .dash-memo ol { padding-left: 1.2em; margin: 0.5em 0; }
    .dash-memo a {
      color: var(--accent);
      text-decoration: none;
      border-bottom: 1px solid var(--accent-ring);
    }
    .dash-memo a:hover { border-color: var(--accent); }
    .dash-memo code {
      background: var(--panel-hi);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 12.5px;
    }
    .dash-memo > *:first-child { margin-top: 0; }
  `}</style>
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function isPlaylistActive(expirationDate) {
  if (!expirationDate) return true;
  try {
    return new Date(expirationDate) > new Date();
  } catch {
    return true;
  }
}

function daysUntil(expirationDate) {
  if (!expirationDate) return null;
  try {
    const diff = new Date(expirationDate) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

/* ------------------------------------------------------------------ */
/*  Pieces                                                            */
/* ------------------------------------------------------------------ */

function MetricCard({ label, value, hint, tone = "default", delayClass }) {
  const toneColor =
    tone === "accent"
      ? "var(--accent)"
      : tone === "warn"
      ? "var(--warn)"
      : tone === "good"
      ? "var(--good)"
      : "var(--text)";
  return (
    <div className={`dash-card p-6 dash-rise ${delayClass}`}>
      <div className="dash-eyebrow">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div
          className="dash-num dash-title"
          style={{ fontSize: 44, color: toneColor }}
        >
          {value}
        </div>
      </div>
      {hint && (
        <div className="dash-sub mt-1" style={{ fontSize: 13 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function PlaylistCard({ playlist, delayClass }) {
  const active = isPlaylistActive(playlist.expiration_date);
  const days = daysUntil(playlist.expiration_date);
  const ac = Number(playlist.active_connections) || 0;
  const mc = Number(playlist.max_connections) || 0;
  const pct = mc > 0 ? Math.min(100, Math.round((ac / mc) * 100)) : 0;

  let status = "ok";
  let statusLabel = "Active";
  let StatusIcon = CheckCircle2;
  if (!active) {
    status = "bad";
    statusLabel = "Expired";
    StatusIcon = CircleOff;
  } else if (days !== null && days <= 7) {
    status = "warn";
    statusLabel = `Expires soon`;
    StatusIcon = AlertTriangle;
  }

  const hasApi = !!playlist.player_api;

  return (
    <div className={`dash-card p-6 dash-rise ${delayClass}`}>
      {/* header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h3
            className="dash-title truncate"
            style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}
            title={playlist.name}
          >
            {playlist.name}
          </h3>
          {playlist.username && (
            <div className="dash-sub mt-1" style={{ fontSize: 13 }}>
              {playlist.username}
            </div>
          )}
        </div>
        <span className={`dash-pill dash-pill-${status === "ok" ? "ok" : status === "warn" ? "warn" : "bad"}`}>
          <StatusIcon />
          {statusLabel}
        </span>
      </div>

      {hasApi ? (
        <>
          {/* Streams + Load */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="dash-eyebrow">Streams</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span
                  className="dash-num dash-title"
                  style={{ fontSize: 36, lineHeight: 1 }}
                >
                  {ac}
                </span>
                <span className="dash-num" style={{ color: "var(--muted)", fontSize: 14 }}>
                  / {mc || "∞"}
                </span>
              </div>
            </div>
            {mc > 0 && (
              <div className="text-right">
                <div className="dash-eyebrow">Load</div>
                <div
                  className="dash-num mt-2"
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color:
                      pct > 85
                        ? "var(--bad)"
                        : pct > 60
                        ? "var(--warn)"
                        : "var(--good)",
                  }}
                >
                  {pct}
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>%</span>
                </div>
              </div>
            )}
          </div>

          {mc > 0 && (
            <div className="dash-bar mb-5" aria-hidden>
              <span
                style={{
                  "--fill": pct / 100,
                  background:
                    pct > 85
                      ? "linear-gradient(90deg, var(--bad), #F4A698)"
                      : pct > 60
                      ? "linear-gradient(90deg, var(--warn), #F5D58A)"
                      : "linear-gradient(90deg, var(--good), #A9DDAB)",
                }}
              />
            </div>
          )}

          {/* meta row */}
          <div className="flex items-center gap-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
            {playlist.expiration_date && (
              <div className="flex items-center gap-2" style={{ color: "var(--muted)", fontSize: 12.5 }}>
                <Clock3 className="h-3.5 w-3.5" />
                {days !== null && days >= 0
                  ? `${days} day${days === 1 ? "" : "s"} left`
                  : "Expired"}
              </div>
            )}
            {playlist.api_last_checked && (
              <div className="ml-auto dash-num" style={{ color: "var(--dim)", fontSize: 11.5 }}>
                synced {new Date(playlist.api_last_checked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          className="py-4 mt-2"
          style={{ borderTop: "1px solid var(--line)", color: "var(--muted)", fontSize: 13 }}
        >
          No Player API configured — live telemetry unavailable.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState(null);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [refreshingPlaylists, setRefreshingPlaylists] = useState(false);
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchNotes();
    fetchPlaylists();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(response.data);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const response = await axios.get(`${API}/m3u`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaylists(response.data || []);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleRefreshPlaylists = async () => {
    setRefreshingPlaylists(true);
    try {
      const response = await axios.get(`${API}/m3u`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaylists(response.data || []);
    } catch (error) {
      console.error("Failed to refresh playlists:", error);
    } finally {
      setRefreshingPlaylists(false);
    }
  };

  const metrics = useMemo(() => {
    const totalPlaylists = playlists.length;
    const activeFeeds = playlists.filter((p) => isPlaylistActive(p.expiration_date)).length;
    const totalActive = playlists.reduce((s, p) => s + (Number(p.active_connections) || 0), 0);
    const totalMax = playlists.reduce((s, p) => s + (Number(p.max_connections) || 0), 0);
    const utilization = totalMax > 0 ? Math.min(100, Math.round((totalActive / totalMax) * 100)) : 0;
    const withExp = playlists
      .filter((p) => p.expiration_date)
      .map((p) => ({ ...p, _days: daysUntil(p.expiration_date) }))
      .filter((p) => p._days !== null && p._days >= 0)
      .sort((a, b) => a._days - b._days);
    const nextExpiring = withExp[0] || null;
    return { totalPlaylists, activeFeeds, totalActive, totalMax, utilization, nextExpiring };
  }, [playlists]);

  const actions = useMemo(() => {
    if (user.role === "super_admin") {
      return [
        { title: "Tenants", sub: "Manage tenant organizations", icon: Building2, onClick: () => navigate("/tenants"), testId: "manage-tenants-btn" },
        { title: "Users", sub: "Accounts across all tenants", icon: Users, onClick: () => navigate("/users"), testId: "manage-users-btn" },
        { title: "Settings", sub: "Global configuration", icon: SettingsIcon, onClick: () => navigate("/settings"), testId: "settings-btn" },
      ];
    }
    if (user.role === "tenant_owner") {
      return [
        { title: "M3U Playlists", sub: "Manage your feeds", icon: ListMusic, onClick: () => navigate("/m3u"), testId: "manage-m3u-btn" },
        { title: "Users", sub: "Team within your tenant", icon: Users, onClick: () => navigate("/users"), testId: "manage-users-btn" },
        { title: "Search Channels", sub: "Find any channel", icon: Search, onClick: () => navigate("/channels"), testId: "channels-btn" },
      ];
    }
    return [
      { title: "Playlists", sub: "Browse available feeds", icon: ListMusic, onClick: () => navigate("/m3u"), testId: "view-playlists-btn" },
      { title: "Search Channels", sub: "Find any channel", icon: Tv, onClick: () => navigate("/channels"), testId: "channels-btn" },
      { title: "Events", sub: "Upcoming & live", icon: Calendar, onClick: () => navigate("/events"), testId: "events-btn" },
    ];
  }, [user.role, navigate]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Still up";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Good evening";
  })();

  const showSignalGrid = !loadingPlaylists && playlists.length > 0;
  const showNotes = !loadingNotes && notes && notes.content;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Layout user={user} onLogout={onLogout} currentPage="dashboard">
      <div className="dash" data-testid="dashboard-page">
        <DashStyles />

        {/* ================= Header ================= */}
        <div className="dash-rise max-w-[1400px] mx-auto">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="dash-eyebrow mb-3">{today}</div>
              <h1
                className="dash-title"
                style={{ fontSize: "clamp(36px, 5vw, 56px)" }}
              >
                {greeting}, {user.username}.
              </h1>
              <p className="dash-sub mt-3 max-w-xl">
                Here's what's happening with your playlists and streams today.
              </p>
            </div>
            {showSignalGrid && (
              <button
                onClick={handleRefreshPlaylists}
                disabled={refreshingPlaylists}
                className="dash-action"
                style={{ width: "auto", padding: "12px 18px" }}
              >
                <div className="flex items-center gap-3">
                  <div className="dash-action-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                    <RefreshCw
                      className={`h-4 w-4 ${refreshingPlaylists ? "animate-spin" : ""}`}
                    />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Refresh</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* ================= Metric row ================= */}
        <div className="max-w-[1400px] mx-auto mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Playlists"
            value={metrics.totalPlaylists}
            hint={`${metrics.activeFeeds} active`}
            delayClass="dash-d-1"
          />
          <MetricCard
            label="Live streams"
            value={metrics.totalActive}
            hint={metrics.totalMax > 0 ? `of ${metrics.totalMax} slots` : "unlimited slots"}
            tone="accent"
            delayClass="dash-d-2"
          />
          <MetricCard
            label="Capacity used"
            value={`${metrics.utilization}%`}
            hint={metrics.utilization > 85 ? "Near limit" : metrics.utilization > 60 ? "Healthy" : "Plenty of room"}
            tone={metrics.utilization > 85 ? "warn" : metrics.utilization > 60 ? "default" : "good"}
            delayClass="dash-d-3"
          />
          <MetricCard
            label="Next expiry"
            value={metrics.nextExpiring ? `${metrics.nextExpiring._days}d` : "—"}
            hint={
              metrics.nextExpiring
                ? metrics.nextExpiring.name
                : "Nothing expiring soon"
            }
            tone={
              metrics.nextExpiring && metrics.nextExpiring._days <= 7 ? "warn" : "default"
            }
            delayClass="dash-d-4"
          />
        </div>

        {/* ================= Main grid ================= */}
        <div className="max-w-[1400px] mx-auto mt-10 grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Playlists column */}
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="dash-title"
                style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}
              >
                Your playlists
              </h2>
              {showSignalGrid && (
                <div className="dash-eyebrow">
                  {metrics.totalPlaylists} total
                </div>
              )}
            </div>

            {loadingPlaylists ? (
              <div className="dash-card-ghost p-10 text-center">
                <div className="dash-sub">Loading your playlists…</div>
              </div>
            ) : playlists.length === 0 ? (
              <div className="dash-card p-10 text-center">
                <ListMusic
                  className="h-6 w-6 mx-auto mb-4"
                  style={{ color: "var(--accent)" }}
                />
                <h3 className="dash-title" style={{ fontSize: 20, fontWeight: 600 }}>
                  No playlists yet
                </h3>
                <p className="dash-sub mt-2 max-w-sm mx-auto">
                  {user.role === "user"
                    ? "Your tenant hasn't added any playlists yet. Check back soon."
                    : "Add your first M3U playlist to get started."}
                </p>
                {user.role !== "user" && (
                  <button
                    onClick={() => navigate("/m3u")}
                    className="dash-action mt-6"
                    style={{ width: "auto", margin: "24px auto 0", padding: "12px 20px" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="dash-action-icon" style={{ width: 32, height: 32, borderRadius: 10 }}>
                        <ListMusic className="h-4 w-4" />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Add a playlist</span>
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {playlists.map((pl, i) => (
                  <PlaylistCard
                    key={pl.id}
                    playlist={pl}
                    delayClass={`dash-d-${Math.min(6, (i % 6) + 1)}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Side column */}
          <div className="space-y-6">
            {/* Notes */}
            {showNotes && (
              <div className="dash-rise dash-d-2">
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className="dash-title flex items-center gap-2"
                    style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}
                  >
                    <FileText className="h-4 w-4" style={{ color: "var(--accent)" }} />
                    Notes
                  </h2>
                </div>
                <div className="dash-card p-6">
                  <div
                    className="dash-memo"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(notes.content || "", NOTES_SANITIZE_CONFIG),
                    }}
                  />
                  {notes.updated_at && (
                    <div
                      className="mt-5 pt-4"
                      style={{
                        borderTop: "1px solid var(--line)",
                        color: "var(--dim)",
                        fontSize: 12,
                      }}
                    >
                      Updated by {notes.updated_by} ·{" "}
                      {new Date(notes.updated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="dash-rise dash-d-3">
              <h2
                className="dash-title mb-4"
                style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}
              >
                Quick actions
              </h2>
              <div className="space-y-3">
                {actions.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={i}
                      onClick={action.onClick}
                      data-testid={action.testId}
                      className="dash-action group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="dash-action-icon">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="truncate"
                            style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}
                          >
                            {action.title}
                          </div>
                          <div
                            className="truncate"
                            style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 400 }}
                          >
                            {action.sub}
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight
                        className="h-4 w-4 transition-all"
                        style={{ color: "var(--muted)" }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
