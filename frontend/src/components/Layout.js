import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, ListMusic, Users, Building2, User, LogOut, Menu, X, Search, FolderTree, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout({ user, onLogout, children, currentPage }) {
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
      {
        name: "Tenants",
        icon: Building2,
        path: "/tenants",
        key: "tenants",
        roles: ["super_admin"],
      },
      {
        name: "Users",
        icon: Users,
        path: "/users",
        key: "users",
        roles: ["super_admin"],
      }
    );
  }

  if (user.role === "tenant_owner") {
    menuItems.push(
      {
        name: "Users",
        icon: Users,
        path: "/users",
        key: "users",
        roles: ["tenant_owner"],
      },
      {
        name: "M3U Playlists",
        icon: ListMusic,
        path: "/m3u",
        key: "m3u",
        roles: ["tenant_owner"],
      },
      {
        name: "Search Channels",
        icon: Search,
        path: "/channels",
        key: "channels",
        roles: ["tenant_owner"],
      },
      {
        name: "Categories",
        icon: FolderTree,
        path: "/categories",
        key: "categories",
        roles: ["tenant_owner"],
      },
      {
        name: "Events",
        icon: Calendar,
        path: "/events",
        key: "events",
        roles: ["tenant_owner"],
      }
    );
  }

  if (user.role === "user") {
    menuItems.push(
      {
        name: "Playlists",
        icon: ListMusic,
        path: "/m3u",
        key: "m3u",
        roles: ["user"],
      },
      {
        name: "Search Channels",
        icon: Search,
        path: "/channels",
        key: "channels",
        roles: ["user"],
      },
      {
        name: "Events",
        icon: Calendar,
        path: "/events",
        key: "events",
        roles: ["user"],
      }
    );
  }

  menuItems.push({
    name: "Profile",
    icon: User,
    path: "/profile",
    key: "profile",
    roles: ["super_admin", "tenant_owner", "user"],
  });

  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
        <h1 className="text-xl font-bold">M3U Manager</h1>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="mobile-menu-toggle">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-40 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-2">M3U Manager</h1>
          <p className="text-sm text-muted-foreground">{user.username}</p>
        </div>

        <nav className="px-3 space-y-1">
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <Button
            data-testid="logout-btn"
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              onLogout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} data-testid="sidebar-overlay" />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-8">{children}</main>
    </div>
  );
}