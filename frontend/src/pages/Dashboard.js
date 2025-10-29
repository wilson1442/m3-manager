import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ListMusic, Building2, Activity, FileText, Wifi, WifiOff, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
      setPlaylists(response.data);
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
      setPlaylists(response.data);
    } catch (error) {
      console.error("Failed to refresh playlists:", error);
    } finally {
      setRefreshingPlaylists(false);
    }
  };

  // Helper function to check if playlist is active based on expiration date
  const isPlaylistActive = (expirationDate) => {
    if (!expirationDate) return true; // No expiration = active
    try {
      const expDate = new Date(expirationDate);
      const now = new Date();
      return expDate > now;
    } catch {
      return true; // If date parsing fails, assume active
    }
  };

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

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Notes */}
          <div className="lg:col-span-1">
            {!loadingNotes && notes && notes.content && (
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle>Administrator Notes</CardTitle>
                  </div>
                  {notes.updated_at && (
                    <CardDescription>
                      Last updated by {notes.updated_by} on {new Date(notes.updated_at).toLocaleString()}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: notes.content }}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Player API Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Player API Status Cards */}
            {!loadingPlaylists && playlists.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Playlist Status</h2>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRefreshPlaylists}
                    disabled={refreshingPlaylists}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshingPlaylists ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {playlists.map((playlist) => {
                    const isActive = isPlaylistActive(playlist.expiration_date);
                    return (
                      <Card key={playlist.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{playlist.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {playlist.player_api ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status</span>
                                <Badge variant={isActive ? "default" : "secondary"}>
                                  {isActive ? (
                                    <><Wifi className="h-3 w-3 mr-1" />Active</>
                                  ) : (
                                    <><WifiOff className="h-3 w-3 mr-1" />Expired</>
                                  )}
                                </Badge>
                              </div>
                            
                            {(playlist.active_connections !== undefined || playlist.max_connections !== undefined) && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Connections</span>
                                <span className="font-medium">
                                  {playlist.active_connections ?? 'N/A'} / {playlist.max_connections ?? 'N/A'}
                                </span>
                              </div>
                            )}
                            
                            {playlist.expiration_date && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Expires
                                </span>
                                <span className="font-medium text-sm">
                                  {new Date(playlist.expiration_date).toLocaleString()}
                                </span>
                              </div>
                            )}
                            
                            {playlist.username && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Username</span>
                                <span className="text-sm font-mono">
                                  {playlist.username}
                                </span>
                              </div>
                            )}

                            {playlist.api_last_checked && (
                              <div className="text-xs text-muted-foreground">
                                Last checked: {new Date(playlist.api_last_checked).toLocaleString()}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No Player API configured</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
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