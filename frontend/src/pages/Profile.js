import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import axios from "axios";
import { toast } from "sonner";
import { Moon, Sun, User as UserIcon } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Profile({ user, onLogout, theme, updateTheme }) {
  const token = localStorage.getItem("token");

  const handleThemeToggle = async (isDark) => {
    const newTheme = isDark ? "dark" : "light";
    try {
      await axios.put(
        `${API}/profile/theme`,
        { theme: newTheme },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      updateTheme(newTheme);
      toast.success(`Theme changed to ${newTheme} mode`);
    } catch (error) {
      toast.error("Failed to update theme");
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="profile">
      <div className="space-y-6" data-testid="profile-page">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Profile Settings</h1>
          <p className="text-base text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Username</Label>
                <p className="text-lg font-medium" data-testid="profile-username">
                  {user.username}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Role</Label>
                <p className="text-lg font-medium" data-testid="profile-role">
                  {user.role.replace("_", " ").toUpperCase()}
                </p>
              </div>
              {user.tenant_id && (
                <div>
                  <Label className="text-muted-foreground">Tenant ID</Label>
                  <p className="text-sm font-mono text-muted-foreground" data-testid="profile-tenant-id">
                    {user.tenant_id}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Appearance
              </CardTitle>
              <CardDescription>Customize your interface theme</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="theme-toggle">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark theme</p>
                </div>
                <Switch
                  id="theme-toggle"
                  data-testid="theme-toggle"
                  checked={theme === "dark"}
                  onCheckedChange={handleThemeToggle}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}