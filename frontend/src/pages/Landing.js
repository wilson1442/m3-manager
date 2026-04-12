import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Users,
  ListMusic,
  Activity,
  Search,
  FolderTree,
  Calendar,
  ShieldCheck,
  Database,
  Radio,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Info,
} from "lucide-react";

/**
 * Public landing page for M3U Manager.
 *
 * Routing contract:
 * - Rendered at "/" for both anonymous and authenticated visitors.
 * - The hero CTA adapts based on `isAuthenticated` (Sign in vs Go to dashboard).
 */
export default function Landing({ isAuthenticated = false }) {
  const navigate = useNavigate();

  const goPrimary = () => navigate(isAuthenticated ? "/dashboard" : "/login");

  const features = [
    {
      icon: ListMusic,
      title: "M3U playlist ingestion",
      body:
        "Import playlists by URL, parse channel metadata, and keep content fresh with scheduled automatic refresh. Every feed, always current.",
    },
    {
      icon: Activity,
      title: "Live capacity tracking",
      body:
        "Integrate the Player API and watch real-time stream counts, connection limits, and utilization light up across your entire fleet.",
    },
    {
      icon: Building2,
      title: "Multi-tenant isolation",
      body:
        "Each tenant organization gets a fully isolated workspace — users, playlists, categories, and data never cross boundaries.",
    },
    {
      icon: Search,
      title: "Channel search & probing",
      body:
        "Search across every feed in your tenant. Probe streams with FFmpeg to validate health, codec, bitrate, and resolution on demand.",
    },
    {
      icon: FolderTree,
      title: "Category monitoring",
      body:
        "Subscribe to specific categories — sports, movies, news — and get a live roll-up of what's currently on air from your chosen groups.",
    },
    {
      icon: Database,
      title: "Backup & restore",
      body:
        "One-click snapshots of your entire configuration. Restore from any point, roll back with confidence, audit every change.",
    },
  ];

  const roles = [
    {
      tag: "Super Admin",
      title: "Run the whole platform",
      body:
        "Manage every tenant, every user, every setting. Global visibility across the entire deployment with full administrative control.",
      bullets: [
        "Create and manage tenant organizations",
        "Configure global settings & integrations",
        "Snapshot and restore the entire platform",
      ],
    },
    {
      tag: "Tenant Owner",
      title: "Run your organization",
      body:
        "Own your tenant's streams, users, and configuration. Invite team members, manage playlists, and monitor what's live in your space.",
      bullets: [
        "Add and refresh M3U playlists",
        "Invite users with scoped permissions",
        "Monitor categories and stream health",
      ],
    },
    {
      tag: "Operator",
      title: "Find and watch what you need",
      body:
        "Browse available playlists, search the channel catalog, and see what's happening right now across your tenant's monitored feeds.",
      bullets: [
        "Browse playlists available to your tenant",
        "Search and discover any channel instantly",
        "Check live events from monitored categories",
      ],
    },
  ];

  return (
    <div className="landing min-h-screen">
      <style>{`
        .landing {
          background:
            radial-gradient(1200px 600px at 75% -10%, hsla(38, 91%, 55%, 0.1), transparent 60%),
            radial-gradient(900px 500px at -10% 50%, hsla(38, 91%, 55%, 0.04), transparent 60%),
            hsl(var(--background));
          color: hsl(var(--foreground));
          overflow-x: hidden;
        }

        .brand-dot {
          width: 10px; height: 10px; border-radius: 999px;
          background: hsl(var(--primary));
          box-shadow: 0 0 18px hsla(38, 91%, 55%, 0.6);
        }

        /* Nav */
        .nav {
          position: sticky;
          top: 0;
          z-index: 40;
          backdrop-filter: blur(14px);
          background: hsla(var(--background) / 0.7);
          border-bottom: 1px solid hsl(var(--border));
        }

        /* Hero section */
        .hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(ellipse 90% 70% at 50% 30%, black 40%, transparent 80%);
          pointer-events: none;
          opacity: 0.35;
        }

        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          background: hsla(38, 91%, 55%, 0.1);
          border: 1px solid hsla(38, 91%, 55%, 0.25);
          color: hsl(var(--primary));
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .hero-title {
          font-size: clamp(44px, 7vw, 96px);
          line-height: 0.98;
          letter-spacing: -0.04em;
          font-weight: 800;
        }

        .hero-title .amber { color: hsl(var(--primary)); }

        .hero-sub {
          font-size: clamp(16px, 1.4vw, 20px);
          color: hsl(var(--muted-foreground));
          line-height: 1.5;
          max-width: 640px;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 26px;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-radius: 14px;
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.01em;
          transition: transform 180ms ease, filter 180ms ease, box-shadow 180ms ease;
          box-shadow: 0 10px 40px -12px hsla(38, 91%, 55%, 0.5);
          border: none;
          cursor: pointer;
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
        }
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 24px;
          background: transparent;
          color: hsl(var(--foreground));
          border-radius: 14px;
          font-weight: 600;
          font-size: 15px;
          border: 1px solid hsl(var(--border));
          transition: border-color 180ms ease, background 180ms ease;
          cursor: pointer;
        }
        .btn-ghost:hover {
          border-color: hsl(var(--primary) / 0.4);
          background: hsl(var(--muted) / 0.5);
        }

        /* Product preview card (hero visual) */
        .preview {
          position: relative;
          background: linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%);
          border: 1px solid hsl(var(--border));
          border-radius: 20px;
          padding: 22px;
          box-shadow:
            0 1px 0 hsl(var(--foreground) / 0.05) inset,
            0 40px 80px -30px hsla(38, 91%, 55%, 0.3),
            0 30px 60px -25px hsl(var(--foreground) / 0.35);
          transform: perspective(1600px) rotateY(-6deg) rotateX(3deg);
          transform-origin: top right;
        }
        .preview::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(180deg, hsla(38, 91%, 55%, 0.35), transparent 45%);
          mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .preview-dot {
          width: 10px; height: 10px; border-radius: 999px;
          background: hsl(var(--muted-foreground) / 0.5);
        }
        .preview-metric {
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 14px;
          padding: 14px 16px;
        }
        .preview-bar {
          height: 6px;
          border-radius: 999px;
          background: hsl(var(--muted));
          overflow: hidden;
          position: relative;
        }
        .preview-bar > span {
          position: absolute;
          inset: 0;
          transform-origin: left;
          transform: scaleX(var(--fill, 0));
          border-radius: 999px;
          background: linear-gradient(90deg, hsl(var(--primary)), #FFCB73);
        }

        /* Section heading */
        .sec-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: hsl(var(--primary));
        }
        .sec-title {
          font-size: clamp(30px, 3.6vw, 48px);
          line-height: 1.05;
          letter-spacing: -0.03em;
          font-weight: 800;
        }
        .sec-sub {
          color: hsl(var(--muted-foreground));
          font-size: 17px;
          line-height: 1.6;
          max-width: 640px;
        }

        /* Feature card */
        .feat {
          position: relative;
          background: linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%);
          border: 1px solid hsl(var(--border));
          border-radius: 18px;
          padding: 28px;
          transition: border-color 220ms ease, transform 220ms ease;
        }
        .feat:hover {
          border-color: hsl(var(--primary) / 0.4);
          transform: translateY(-2px);
        }
        .feat-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: hsl(var(--primary) / 0.12);
          color: hsl(var(--primary));
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
        }
        .feat-title {
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.015em;
          margin-bottom: 8px;
        }
        .feat-body {
          color: hsl(var(--muted-foreground));
          font-size: 14.5px;
          line-height: 1.6;
        }

        /* Tenant visual */
        .tenant-viz {
          background: linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%);
          border: 1px solid hsl(var(--border));
          border-radius: 24px;
          padding: 36px;
          position: relative;
          overflow: hidden;
        }
        .tenant-viz::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 80% 70% at 70% 30%, black 30%, transparent 75%);
          opacity: 0.25;
          pointer-events: none;
        }
        .tnode {
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 14px;
          padding: 14px 18px;
          position: relative;
          z-index: 1;
        }
        .tnode-primary {
          border-color: hsl(var(--primary) / 0.4);
          background: linear-gradient(180deg, hsl(var(--primary) / 0.08), hsl(var(--card)));
        }

        /* Role card */
        .role {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 20px;
          padding: 32px;
          transition: border-color 220ms ease, transform 220ms ease;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .role:hover {
          border-color: hsl(var(--primary) / 0.4);
          transform: translateY(-2px);
        }
        .role-tag {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          background: hsl(var(--primary) / 0.12);
          color: hsl(var(--primary));
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 18px;
          width: fit-content;
        }
        .role-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 10px;
        }
        .role-body {
          color: hsl(var(--muted-foreground));
          font-size: 14.5px;
          line-height: 1.6;
          margin-bottom: 18px;
          flex: 1;
        }
        .role-bullet {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 14px;
          color: hsl(var(--foreground) / 0.9);
          padding: 7px 0;
        }
        .role-bullet svg {
          flex-shrink: 0;
          color: hsl(var(--primary));
          margin-top: 2px;
        }

        /* Final CTA */
        .cta-card {
          position: relative;
          background:
            radial-gradient(600px 300px at 20% 20%, hsla(38, 91%, 55%, 0.12), transparent 60%),
            radial-gradient(500px 300px at 80% 80%, hsla(38, 91%, 55%, 0.08), transparent 60%),
            linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)));
          border: 1px solid hsl(var(--border));
          border-radius: 28px;
          padding: clamp(40px, 6vw, 80px);
          overflow: hidden;
        }
        .cta-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 100% 100% at 50% 50%, black 20%, transparent 75%);
          opacity: 0.25;
          pointer-events: none;
        }

        .foot-link {
          color: hsl(var(--muted-foreground));
          font-size: 13.5px;
          transition: color 160ms ease;
        }
        .foot-link:hover { color: hsl(var(--foreground)); }

        /* Disclaimer card */
        .disclaimer {
          position: relative;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 20px;
          padding: clamp(28px, 4vw, 44px);
          display: flex;
          gap: 22px;
          align-items: flex-start;
        }
        .disclaimer::before {
          content: "";
          position: absolute;
          left: 0; top: 20px; bottom: 20px;
          width: 3px;
          border-radius: 3px;
          background: hsl(var(--primary));
          opacity: 0.6;
        }
        .disclaimer-icon {
          flex-shrink: 0;
          width: 44px; height: 44px;
          border-radius: 12px;
          background: hsl(var(--primary) / 0.12);
          color: hsl(var(--primary));
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .disclaimer-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: hsl(var(--primary));
          margin-bottom: 8px;
        }
        .disclaimer-title {
          font-size: clamp(22px, 2.4vw, 28px);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          margin-bottom: 14px;
        }
        .disclaimer-body {
          color: hsl(var(--muted-foreground));
          font-size: 15px;
          line-height: 1.65;
        }
        .disclaimer-body strong {
          color: hsl(var(--foreground));
          font-weight: 700;
        }

        /* Subtle rise-on-load */
        @keyframes rise {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rise { animation: rise 0.8s cubic-bezier(.25,.85,.4,1) both; }
        .rise-1 { animation-delay: 0.05s; }
        .rise-2 { animation-delay: 0.14s; }
        .rise-3 { animation-delay: 0.22s; }
        .rise-4 { animation-delay: 0.3s; }
      `}</style>

      {/* ================= NAV ================= */}
      <nav className="nav">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="brand-dot" />
            <span className="text-lg font-bold tracking-tight">M3U Manager</span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#roles" className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Roles
            </a>
            <button onClick={goPrimary} className="btn-ghost" style={{ padding: "10px 18px", fontSize: 14 }}>
              {isAuthenticated ? "Go to dashboard" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section className="relative">
        <div className="hero-grid" />
        <div className="max-w-[1280px] mx-auto px-6 pt-20 lg:pt-28 pb-24 lg:pb-32 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="rise rise-1">
                <span className="hero-eyebrow">
                  <Sparkles className="h-3.5 w-3.5" />
                  Multi-tenant IPTV control panel
                </span>
              </div>

              <h1 className="hero-title mt-7 rise rise-2">
                Every stream,
                <br />
                every tenant,
                <br />
                <span className="amber">in one place.</span>
              </h1>

              <p className="hero-sub mt-7 rise rise-3">
                M3U Manager is the control center for multi-tenant IPTV operations.
                Ingest playlists, track live stream capacity, search any channel,
                and monitor exactly what's on the air — with full role-based access
                across every organization you operate.
              </p>

              <div className="flex flex-wrap gap-3 mt-10 rise rise-4">
                <button onClick={goPrimary} className="btn-primary">
                  {isAuthenticated ? "Go to dashboard" : "Sign in to continue"}
                  <ArrowRight className="h-5 w-5" />
                </button>
                <a href="#features" className="btn-ghost">
                  See features
                </a>
              </div>
            </div>

            {/* Hero visual — stylized preview */}
            <div className="lg:col-span-5 rise rise-3">
              <div className="preview">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="preview-dot" />
                    <span className="preview-dot" />
                    <span className="preview-dot" />
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                    dashboard
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-bold">Playlist</div>
                  <div className="text-lg font-bold tracking-tight mt-1">Prime Sports HD</div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="preview-metric">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-bold">Streams</div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-bold tabular-nums">142</span>
                      <span className="text-xs text-muted-foreground">/ 200</span>
                    </div>
                  </div>
                  <div className="preview-metric">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-bold">Load</div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-bold tabular-nums" style={{ color: "hsl(var(--primary))" }}>71</span>
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>

                <div className="preview-bar mb-5">
                  <span style={{ "--fill": 0.71 }} />
                </div>

                <div className="space-y-2">
                  {[
                    { name: "Cinema Europe", load: 0.42 },
                    { name: "News 24/7", load: 0.88 },
                    { name: "Kids Zone", load: 0.23 },
                  ].map((p) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-semibold">{p.name}</div>
                        <div className="preview-bar mt-1.5" style={{ height: 4 }}>
                          <span style={{ "--fill": p.load }} />
                        </div>
                      </div>
                      <div className="text-[11px] tabular-nums text-muted-foreground font-mono">
                        {Math.round(p.load * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Hero stat strip */}
          <div className="mt-24 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10 max-w-4xl rise rise-4">
            {[
              { k: "Multi-tenant", v: "Isolated workspaces" },
              { k: "Real-time", v: "Live capacity data" },
              { k: "FFmpeg", v: "Stream validation" },
              { k: "Role-based", v: "Three access tiers" },
            ].map((s) => (
              <div key={s.k}>
                <div className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: "hsl(var(--primary))" }}>
                  {s.k}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="relative">
        <div className="max-w-[1280px] mx-auto px-6 py-24 lg:py-32">
          <div className="max-w-2xl mb-14 lg:mb-20">
            <div className="sec-eyebrow mb-4">What it does</div>
            <h2 className="sec-title mb-5">
              Built for the operators<br />who run the signal.
            </h2>
            <p className="sec-sub">
              A complete toolkit for the full M3U lifecycle — from playlist
              intake to live monitoring, from tenant administration to ground-level
              channel browsing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="feat">
                  <div className="feat-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="feat-title">{f.title}</div>
                  <div className="feat-body">{f.body}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= MULTI-TENANT VISUAL ================= */}
      <section className="relative">
        <div className="max-w-[1280px] mx-auto px-6 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="sec-eyebrow mb-4">How it scales</div>
              <h2 className="sec-title mb-6">
                One deployment.<br />
                <span style={{ color: "hsl(var(--primary))" }}>Any number</span> of tenants.
              </h2>
              <p className="sec-sub mb-8">
                Every tenant runs inside a fully isolated workspace. Users, playlists,
                monitored categories, and data can't leak across boundaries. Super
                admins see the whole picture; tenant owners run their own show.
              </p>
              <ul className="space-y-3">
                {[
                  "Tenant-scoped playlists, users, and settings",
                  "Tenant expiration and lifecycle management",
                  "Per-tenant capacity and usage metrics",
                  "Full audit trail across every action",
                ].map((s) => (
                  <li key={s} className="role-bullet">
                    <CheckCircle2 className="h-4 w-4" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7">
              <div className="tenant-viz">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: "hsl(var(--primary) / 0.15)",
                        color: "hsl(var(--primary))",
                      }}
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-bold">
                        Platform root
                      </div>
                      <div className="text-base font-bold tracking-tight">Super admin workspace</div>
                    </div>
                  </div>

                  {/* Tenant branches */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { name: "Broadcaster Alpha", users: 24, feeds: 8, load: 0.62 },
                      { name: "Network Bravo", users: 11, feeds: 4, load: 0.41 },
                      { name: "Studio Charlie", users: 37, feeds: 12, load: 0.83 },
                    ].map((t, i) => (
                      <div key={t.name} className={`tnode ${i === 0 ? "tnode-primary" : ""}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-3.5 w-3.5" style={{ color: "hsl(var(--primary))" }} />
                          <div className="text-xs font-bold tracking-tight truncate">{t.name}</div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                          <span>{t.users} users</span>
                          <span>{t.feeds} feeds</span>
                        </div>
                        <div className="preview-bar" style={{ height: 4 }}>
                          <span style={{ "--fill": t.load }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sub-data */}
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="tnode flex items-center gap-3">
                      <Users className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-bold">Total operators</div>
                        <div className="text-lg font-bold tabular-nums">72</div>
                      </div>
                    </div>
                    <div className="tnode flex items-center gap-3">
                      <Radio className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-bold">Live streams</div>
                        <div className="text-lg font-bold tabular-nums">418</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= ROLES ================= */}
      <section id="roles" className="relative">
        <div className="max-w-[1280px] mx-auto px-6 py-24 lg:py-32">
          <div className="max-w-2xl mb-14">
            <div className="sec-eyebrow mb-4">Who it's for</div>
            <h2 className="sec-title mb-5">Three tiers. Clear boundaries.</h2>
            <p className="sec-sub">
              Role-based access means everyone sees exactly what they need, and
              nothing they don't. Permissions are enforced top to bottom.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {roles.map((r) => (
              <div key={r.tag} className="role">
                <span className="role-tag">{r.tag}</span>
                <h3 className="role-title">{r.title}</h3>
                <p className="role-body">{r.body}</p>
                <ul className="space-y-1 border-t border-border pt-4">
                  {r.bullets.map((b) => (
                    <li key={b} className="role-bullet">
                      <CheckCircle2 className="h-4 w-4" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= DISCLAIMER ================= */}
      <section className="relative">
        <div className="max-w-[1280px] mx-auto px-6 pb-16 lg:pb-20">
          <div className="disclaimer">
            <div className="disclaimer-icon">
              <Info className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="disclaimer-label">Important notice</div>
              <h3 className="disclaimer-title">
                M3U Manager does not provide any stream content.
              </h3>
              <p className="disclaimer-body">
                This is purely an <strong>organizational tool</strong> — a control
                panel that helps you manage and keep track of M3U playlists you
                already own or subscribe to, all in one place. M3U Manager does
                not host, stream, distribute, or provide access to any
                video, audio, or media content of any kind. Users are solely
                responsible for the playlists they import and must ensure their
                use complies with all applicable laws and the terms of service
                of their content providers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative">
        <div className="max-w-[1280px] mx-auto px-6 pb-24 lg:pb-32">
          <div className="cta-card">
            <div className="relative z-10 max-w-2xl">
              <div className="sec-eyebrow mb-4">Ready when you are</div>
              <h2 className="sec-title mb-5">
                Take control of your<br />broadcast operation.
              </h2>
              <p className="sec-sub mb-9">
                Sign in to access your dashboard. Monitor every stream,
                manage every tenant, and see exactly what's on the air.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={goPrimary} className="btn-primary">
                  {isAuthenticated ? "Go to dashboard" : "Sign in"}
                  <ArrowRight className="h-5 w-5" />
                </button>
                <a href="#features" className="btn-ghost">
                  Review features
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="relative border-t border-border">
        <div className="max-w-[1280px] mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <span className="brand-dot" />
              <span className="text-sm font-bold tracking-tight">M3U Manager</span>
              <span className="text-xs text-muted-foreground ml-2">v1.1.2</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#features" className="foot-link">Features</a>
              <a href="#roles" className="foot-link">Roles</a>
              <Link to="/release-notes" className="foot-link">Release notes</Link>
              <button onClick={goPrimary} className="foot-link">
                {isAuthenticated ? "Dashboard" : "Sign in"}
              </button>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center sm:text-left leading-relaxed max-w-3xl">
              <strong className="text-foreground font-semibold">Disclaimer:</strong>{" "}
              M3U Manager is an organizational tool only. It does not host,
              stream, distribute, or provide access to any media content. Users
              are solely responsible for the playlists they import and their
              compliance with applicable laws and third-party terms of service.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
