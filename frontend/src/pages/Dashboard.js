import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ListMusic, Building2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const stats = [
    {
      title: "Role",
      value: user.role.replace("_", " ").toUpperCase(),
      icon: Activity,
      color: "text-blue-600 dark:text-blue-400",
    },
  ];

  const actions = [];

  if (user.role === "super_admin") {
    actions.push(
      {
        title: "Manage Tenants",
        description: "Create and manage tenant organizations",
        icon: Building2,
        onClick: () => navigate("/tenants"),
        testId: "manage-tenants-btn",
      },
      {
        title: "Manage Users",
        description: "Create and manage users across all tenants",
        icon: Users,
        onClick: () => navigate("/users"),
        testId: "manage-users-btn",
      }
    );
  }

  if (user.role === "tenant_owner") {
    actions.push(
      {
        title: "Manage Users",
        description: "Create and manage users in your tenant",
        icon: Users,
        onClick: () => navigate("/users"),
        testId: "manage-users-btn",
      },
      {
        title: "Manage M3U Playlists",
        description: "Add, edit, and delete M3U playlists",
        icon: ListMusic,
        onClick: () => navigate("/m3u"),
        testId: "manage-m3u-btn",
      }
    );
  }

  if (user.role === "user") {
    actions.push({
      title: "View Playlists",
      description: "Browse available M3U playlists",
      icon: ListMusic,
      onClick: () => navigate("/m3u"),
      testId: "view-playlists-btn",
    });
  }

  return (
    <Layout user={user} onLogout={onLogout} currentPage="dashboard">
      <div className="space-y-8" data-testid="dashboard-page">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Welcome back, {user.username}!</h1>
          <p className="text-base text-muted-foreground">Manage your M3U playlists and settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {actions.map((action, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={action.onClick}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <action.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button data-testid={action.testId} className="w-full" onClick={action.onClick}>
                    Go to {action.title}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}