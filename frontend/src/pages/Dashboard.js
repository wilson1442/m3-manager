import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ListMusic, Building2, Activity, FileText, Wifi, WifiOff, Calendar } from "lucide-react";
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
                <h2 className="text-2xl font-bold mb-4">Playlist Status</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {playlists.map((playlist) => (
                    <Card key={playlist.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{playlist.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {playlist.player_api_url ? (
                          <>
                            {playlist.player_api_data ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Status</span>
                                  <Badge variant={playlist.player_api_data.status === "Active" ? "default" : "secondary"}>
                                    {playlist.player_api_data.status === "Active" ? (
                                      <><Wifi className="h-3 w-3 mr-1" />Active</>
                                    ) : (
                                      <><WifiOff className="h-3 w-3 mr-1" />Inactive</>
                                    )}
                                  </Badge>
                                </div>
                                
                                {playlist.player_api_data.active_cons !== undefined && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Connections</span>
                                    <span className="font-medium">
                                      {playlist.player_api_data.active_cons} / {playlist.player_api_data.max_connections}
                                    </span>
                                  </div>
                                )}
                                
                                {playlist.player_api_data.exp_date && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      Expires
                                    </span>
                                    <span className="font-medium text-sm">
                                      {new Date(playlist.player_api_data.exp_date * 1000).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                                
                                {playlist.player_api_data.created_at && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Created</span>
                                    <span className="text-sm">
                                      {new Date(playlist.player_api_data.created_at * 1000).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">No API data available</p>
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