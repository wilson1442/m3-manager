import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Link as LinkIcon, RefreshCw, Clock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function M3UManagement({ user, onLogout }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [formData, setFormData] = useState({ name: "", url: "", content: "" });
  const [refreshStatus, setRefreshStatus] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchPlaylists();
    fetchRefreshStatus();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await axios.get(`${API}/m3u`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaylists(response.data);
    } catch (error) {
      toast.error("Failed to fetch playlists");
    } finally {
      setLoading(false);
    }
  };

  const fetchRefreshStatus = async () => {
    try {
      const response = await axios.get(`${API}/m3u/refresh/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRefreshStatus(response.data);
    } catch (error) {
      console.error("Failed to fetch refresh status");
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await axios.post(`${API}/m3u/refresh`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Playlist refresh triggered! Updates will appear shortly.");
      setTimeout(() => {
        fetchPlaylists();
        fetchRefreshStatus();
      }, 3000);
    } catch (error) {
      toast.error("Failed to trigger refresh");
    } finally {
      setRefreshing(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/m3u`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Playlist added successfully!");
      setIsAddDialogOpen(false);
      setFormData({ name: "", url: "", content: "" });
      fetchPlaylists();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add playlist");
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/m3u/${selectedPlaylist.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Playlist updated successfully!");
      setIsEditDialogOpen(false);
      setSelectedPlaylist(null);
      setFormData({ name: "", url: "", content: "" });
      fetchPlaylists();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update playlist");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/m3u/${selectedPlaylist.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Playlist deleted successfully!");
      setDeleteDialogOpen(false);
      setSelectedPlaylist(null);
      fetchPlaylists();
    } catch (error) {
      toast.error("Failed to delete playlist");
    }
  };

  const openEditDialog = (playlist) => {
    setSelectedPlaylist(playlist);
    setFormData({ name: playlist.name, url: playlist.url, content: playlist.content || "" });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (playlist) => {
    setSelectedPlaylist(playlist);
    setDeleteDialogOpen(true);
  };

  const formatRefreshTime = (timestamp) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60); // minutes
    
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return date.toLocaleString();
  };

  const canManage = user.role === "tenant_owner" || user.role === "super_admin";

  return (
    <Layout user={user} onLogout={onLogout} currentPage="m3u">
      <div className="space-y-6" data-testid="m3u-management-page">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">M3U Playlists</h1>
            <p className="text-base text-muted-foreground">{canManage ? "Manage your M3U playlists" : "View available playlists"}</p>
            {refreshStatus?.next_run && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Next auto-refresh: {new Date(refreshStatus.next_run).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {canManage && (
              <>
                <Button 
                  data-testid="refresh-playlists-btn" 
                  variant="outline"
                  className="gap-2"
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? "Refreshing..." : "Refresh Now"}
                </Button>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-playlist-btn" className="gap-2">
                      <Plus className="h-4 w-4" /> Add Playlist
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New M3U Playlist</DialogTitle>
                      <DialogDescription>Create a new M3U playlist for your tenant</DialogDescription>
                    </DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Playlist Name</Label>
                    <Input
                      id="name"
                      data-testid="playlist-name-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">Playlist URL</Label>
                    <Input
                      id="url"
                      data-testid="playlist-url-input"
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Content (Optional)</Label>
                    <Textarea
                      id="content"
                      data-testid="playlist-content-input"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <Button type="submit" data-testid="submit-add-playlist-btn" className="w-full">
                    Add Playlist
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </>
            )}
        </div>

        {loading ? (
          <div className="text-center py-12">Loading playlists...</div>
        ) : playlists.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No playlists found</p>
                {canManage && <p className="text-sm text-muted-foreground mt-2">Click "Add Playlist" to create your first playlist</p>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map((playlist) => (
              <Card key={playlist.id} data-testid={`playlist-card-${playlist.id}`} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-primary" />
                    {playlist.name}
                  </CardTitle>
                  <CardDescription className="break-all">{playlist.url}</CardDescription>
                  {playlist.last_refresh && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                      <Clock className="h-3 w-3" />
                      Last refreshed: {formatRefreshTime(playlist.last_refresh)}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {playlist.content && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground line-clamp-3">{playlist.content}</p>
                    </div>
                  )}
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        data-testid={`edit-playlist-${playlist.id}`}
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => openEditDialog(playlist)}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button
                        data-testid={`delete-playlist-${playlist.id}`}
                        variant="destructive"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => openDeleteDialog(playlist)}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit M3U Playlist</DialogTitle>
              <DialogDescription>Update playlist information</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Playlist Name</Label>
                <Input
                  id="edit-name"
                  data-testid="edit-playlist-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-url">Playlist URL</Label>
                <Input
                  id="edit-url"
                  data-testid="edit-playlist-url-input"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-content">Content (Optional)</Label>
                <Textarea
                  id="edit-content"
                  data-testid="edit-playlist-content-input"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                />
              </div>
              <Button type="submit" data-testid="submit-edit-playlist-btn" className="w-full">
                Update Playlist
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the playlist "{selectedPlaylist?.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="cancel-delete-playlist-btn">Cancel</AlertDialogCancel>
              <AlertDialogAction data-testid="confirm-delete-playlist-btn" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </Layout>
  );
}

function ListMusic({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15V6" />
      <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M12 12H3" />
      <path d="M16 6H3" />
      <path d="M12 18H3" />
    </svg>
  );
}