import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Bug, Zap, Shield } from "lucide-react";

export default function ReleaseNotes({ user, onLogout }) {
  const releases = [
    {
      version: "1.1.2",
      date: "April 11, 2026",
      type: "production",
      sections: [
        {
          title: "Portability",
          icon: Zap,
          color: "text-primary",
          items: [
            "Frontend now calls the backend via relative /api paths instead of a hardcoded domain",
            "Same bundle works on any origin (LAN IP, Cloudflare tunnel, localhost) as long as nginx proxies /api/* to the backend",
            "No rebuild required when the backend domain changes — this would have prevented the 2026-04-11 login outage entirely",
          ],
        },
        {
          title: "Observability",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Failed login attempts are now logged with WARNING level, including the attempted username and client IP (X-Forwarded-For honored)",
            "Three distinct failure reasons are distinguished: unknown username, bad password, expired tenant",
            "Successful logins logged at INFO level so `journalctl | grep login` shows the full picture",
          ],
        },
        {
          title: "Housekeeping",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Removed 1,089 lines of dead code (Channels_old.js and Categories_new.js, neither imported anywhere)",
          ],
        },
      ],
    },
    {
      version: "1.1.1",
      date: "April 11, 2026",
      type: "production",
      sections: [
        {
          title: "Security Fixes",
          icon: Shield,
          color: "text-destructive",
          items: [
            "Path traversal vulnerability in backup download endpoint — super admins could previously read arbitrary server files via crafted filenames",
            "Stored XSS on the dashboard notes via dangerouslySetInnerHTML — admin notes now sanitized with DOMPurify on render and bleach on save (defense in depth)",
            "Hardcoded tenant expiration default caused every newly created tenant to be born already expired — now uses a rolling 1-year default",
            "Rotated the backend JWT signing secret and removed leaked .env files from git history",
          ],
        },
        {
          title: "Housekeeping",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Cleaned up a bloated .gitignore that had accumulated duplicate environment-file patterns",
            "Added backend/.env.example and frontend/.env.example to document required environment variables",
            "Started tracking frontend/yarn.lock for reproducible builds",
          ],
        },
        {
          title: "Dashboard Improvements (rolled up from 1.1.1-beta)",
          icon: Zap,
          color: "text-primary",
          items: [
            "Redesigned dashboard with two-column layout",
            "Release notes added to the left side bar",
            "Player API status cards added to right side (2/3 width)",
            "Player API status shows connections, expiration, and status for each playlist",
            "Dashboard refresh button for playlist status",
            "Status indicator shows Active for future/no expiration dates",
          ],
        },
        {
          title: "Enhanced Search & Probe (rolled up from 1.1.1-beta)",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Full stream URL now visible on search results",
            "Probe results show comprehensive details (format, resolution, codecs, bitrate, FPS)",
            "All probe information displayed inline on channel cards",
          ],
        },
        {
          title: "User Management (rolled up from 1.1.1-beta)",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Last login tracking added to Users page",
            "Shows login date/time or 'Never' for new users",
            "Helps administrators track user activity",
          ],
        },
        {
          title: "UI Cleanup (rolled up from 1.1.1-beta)",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Removed M3U content preview from playlist management page",
            "Cleaner playlist card display with focus on key information",
          ],
        },
      ],
    },
    {
      version: "1.1.0",
      date: "October 28, 2025",
      type: "production",
      sections: [
        {
          title: "New Features",
          icon: Zap,
          color: "text-primary",
          items: [
            "Dashboard Notes system with HTML support for super admins",
            "Rich text announcements visible to all users",
            "HTML textarea editor with live preview",
            "Enhanced search and filtering on Categories and Events pages",
            "Free-form text search with real-time filtering",
            "Tenant expiration date management with visual indicators",
            "Edit tenant expiration dates from admin panel",
          ],
        },
        {
          title: "UI/UX Improvements",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Collapsible category groups by source",
            "Dual filtering system (dropdown + text search)",
            "Result counters for filtered items",
            "Status badges for tenant expiration (Active/Expired)",
            "Logo size improvements (120x80px max)",
            "Improved channel result grouping by source",
          ],
        },
        {
          title: "Security",
          icon: Shield,
          color: "text-primary",
          items: [
            "Tenant expiration check at login",
            "Expired tenants blocked from obtaining new tokens",
            "Clear 403 error messages for expired accounts",
          ],
        },
        {
          title: "Bug Fixes",
          icon: Bug,
          color: "text-primary",
          items: [
            "Fixed channel search parameter mismatch",
            "Fixed search results showing only single playlist",
            "Fixed React rendering errors with validation messages",
            "Fixed super admin access to categories without tenant",
            "Fixed MongoDB ObjectId serialization issues",
          ],
        },
      ],
    },
    {
      version: "1.0.0",
      date: "January 27, 2025",
      type: "production",
      sections: [
        {
          title: "Core Features",
          icon: Zap,
          color: "text-primary",
          items: [
            "Multi-tenant architecture with role-based access control",
            "M3U playlist management with automatic hourly refresh",
            "Channel search and streaming capabilities",
            "FFmpeg-based stream probing",
            "Category management and monitoring",
            "Event tracking for monitored categories",
            "Profile image uploads (PNG, 2MB max)",
            "Dark/Light theme support",
          ],
        },
        {
          title: "Administration",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Full database and per-tenant backup/restore",
            "Scheduled backups with retention policies",
            "System update management (GitHub integration)",
            "User management with tenant assignment",
            "Create user + tenant in one action",
          ],
        },
        {
          title: "Infrastructure",
          icon: CheckCircle2,
          color: "text-[#7BC47F]",
          items: [
            "Cloudflare Tunnel support in installer",
            "Virtual environment for Python dependencies",
            "Systemd service integration",
            "MongoDB 7.0 with proper serialization",
          ],
        },
      ],
    },
  ];

  return (
    <Layout user={user} onLogout={onLogout} currentPage="release-notes">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Release Notes</h1>
          <p className="text-base text-muted-foreground">Version history and changelog</p>
        </div>

        <div className="space-y-8">
          {releases.map((release) => (
            <Card key={release.version}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl">Version {release.version}</CardTitle>
                    <Badge variant={release.type === "production" ? "default" : "secondary"}>
                      {release.type === "production" ? "Production" : "Beta"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">{release.date}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {release.sections.map((section, idx) => (
                    <div key={idx}>
                      <div className="flex items-center gap-2 mb-3">
                        <section.icon className={`h-5 w-5 ${section.color}`} />
                        <h3 className="text-lg font-semibold">{section.title}</h3>
                      </div>
                      <ul className="space-y-2 ml-7">
                        {section.items.map((item, itemIdx) => (
                          <li key={itemIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
