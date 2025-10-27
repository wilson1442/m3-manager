import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import axios from "axios";
import { toast } from "sonner";
import { Moon, Sun, User as UserIcon, Upload, Trash2 } from "lucide-react";
import { useState, useRef } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Profile({ user, onLogout, theme, updateTheme }) {
  const token = localStorage.getItem("token");
  const [profileImage, setProfileImage] = useState(user.profile_image || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'image/png') {
      toast.error("Only PNG images are allowed");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        
        // Update profile with image
        const response = await axios.put(
          `${API}/profile/update`,
          { profile_image: base64String },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        setProfileImage(base64String);
        toast.success("Profile image updated successfully!");
        
        // Update user object in parent
        window.location.reload(); // Simple way to refresh user data
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    setUploading(true);
    try {
      await axios.put(
        `${API}/profile/update`,
        { profile_image: null },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      setProfileImage(null);
      toast.success("Profile image removed successfully!");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to remove image");
    } finally {
      setUploading(false);
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
              {/* Profile Image Upload */}
              <div className="space-y-3">
                <Label>Profile Image</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {profileImage ? 'Change' : 'Upload'}
                    </Button>
                    {profileImage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveImage}
                        disabled={uploading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">PNG format only, max 2MB</p>
              </div>

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