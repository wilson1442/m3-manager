import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ListMusic,
  Users,
  Building2,
  User,
  LogOut,
  Menu,
  X,
  Search,
  Compass,
  FolderTree,
  Calendar,
  Settings as SettingsIcon,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ImpersonationBanner from "@/components/ImpersonationBanner";

export default function Layout({ user, onLogout, onRestoreAdmin, children, currentPage }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      key: "dashboard",
      roles: ["super_admin", "tenant_owner", "user"],
    },
  ];

  if (user.role === "super_admin") {
    menuItems.push(
      { name: "Tenants", icon: Building2, path: "/tenants", key: "tenants", roles: ["super_admin"] },
      { name: "Users", icon: Users, path: "/users", key: "users", roles: ["super_admin"] },
      { name: "Settings", icon: SettingsIcon, path: "/settings", key: "settings", roles: ["super_admin"] }
    );
  }

  if (user.role === "tenant_owner") {
    menuItems.push(
      { name: "Users", icon: Users, path: "/users", key: "users", roles: ["tenant_owner"] },
      { name: "M3U Playlists", icon: ListMusic, path: "/m3u", key: "m3u", roles: ["tenant_owner"] },
      { name: "Search Channels", icon: Search, path: "/channels", key: "channels", roles: ["tenant_owner"] },
      { name: "Browse Channels", icon: Compass, path: "/browse", key: "browse", roles: ["tenant_owner"] },
      { name: "Categories", icon: FolderTree, path: "/categories", key: "categories", roles: ["tenant_owner"] },
      { name: "Events", icon: Calendar, path: "/events", key: "events", roles: ["tenant_owner"] }
    );
  }

  if (user.role === "user") {
    menuItems.push(
      { name: "Playlists", icon: ListMusic, path: "/m3u", key: "m3u", roles: ["user"] },
      { name: "Search Channels", icon: Search, path: "/channels", key: "channels", roles: ["user"] },
      { name: "Browse Channels", icon: Compass, path: "/browse", key: "browse", roles: ["user"] },
      { name: "Events", icon: Calendar, path: "/events", key: "events", roles: ["user"] }
    );
  }

  menuItems.push(
    { name: "Profile", icon: User, path: "/profile", key: "profile", roles: ["super_admin", "tenant_owner", "user"] },
    { name: "Release Notes", icon: FileText, path: "/release-notes", key: "release-notes", roles: ["super_admin", "tenant_owner", "user"] }
  );

  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(user.role));
  const roleLabel = user.role.replace("_", " ");

  return (
    <div className="min-h-screen bg-background transition-colors">
      <style>{`
        .qp-sidebar {
          background: hsl(var(--card));
          border-right: 1px solid hsl(var(--border));
        }
        .qp-brand-dot {
          width: 8px; height: 8px; border-radius: 999px;
          background: hsl(var(--primary));
          box-shadow: 0 0 12px hsla(38, 91%, 55%, 0.55);
        }
        .qp-nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.005em;
          color: hsl(var(--muted-foreground));
          transition: color 180ms ease, background 180ms ease;
          width: 100%;
          text-align: left;
          position: relative;
        }
        .qp-nav-item:hover {
          background: hsl(var(--muted));
          color: hsl(var(--foreground));
        }
        .qp-nav-item.active {
          background: linear-gradient(180deg, hsla(38, 91%, 55%, 0.14), hsla(38, 91%, 55%, 0.08));
          color: hsl(var(--foreground));
        }
        .qp-nav-item.active::before {
          content: "";
          position: absolute;
          left: 0; top: 8px; bottom: 8px;
          width: 2px;
          background: hsl(var(--primary));
          border-radius: 2px;
        }
        .qp-nav-item.active svg { color: hsl(var(--primary)); }

        .qp-mobile-header {
          background: hsl(var(--card) / 0.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid hsl(var(--border));
        }

        .qp-user-chip {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          background: hsl(var(--muted) / 0.5);
          border: 1px solid hsl(var(--border));
          border-radius: 12px;
        }
      `}</style>

      {/* Mobile Header */}
      <div className="qp-mobile-header lg:hidden fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2.5">
          <span className="qp-brand-dot" />
          <h1 className="text-lg font-bold tracking-tight">M3U Manager</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="mobile-menu-toggle">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`qp-sidebar fixed top-0 left-0 h-full w-64 z-40 transition-transform duration-300 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        {/* Brand */}
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="qp-brand-dot" />
            <h1 className="text-xl font-bold tracking-tight">M3U Manager</h1>
          </div>

          <div className="qp-user-chip">
            {user.profile_image ? (
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-border">
                <img src={user.profile_image} alt={user.username} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold"
                style={{
                  background: "hsl(var(--primary) / 0.15)",
                  color: "hsl(var(--primary))",
                }}
              >
                {user.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate leading-tight">{user.username}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
                {roleLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.key;
            return (
              <button
                key={item.key}
                data-testid={`nav-${item.key}`}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`qp-nav-item ${isActive ? "active" : ""}`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 space-y-2 border-t border-border">
          <Button
            data-testid="logout-btn"
            variant="outline"
            className="w-full gap-2 h-10 font-medium"
            onClick={() => {
              onLogout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              v1.1.2
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-20 lg:pt-10 pb-10">
        <ImpersonationBanner currentUser={user} onRestored={onRestoreAdmin} />
        <div className="px-4 sm:px-6 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
