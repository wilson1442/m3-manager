import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Categories({ user, onLogout }) {
  const [categories, setCategories] = useState([]);
  const [monitoredCategories, setMonitoredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [categoriesRes, monitoredRes] = await Promise.all([
        axios.get(`${API}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/categories/monitor`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      
      setCategories(categoriesRes.data);
      setMonitoredCategories(monitoredRes.data);
    } catch (error) {
      toast.error("Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMonitor = async (category) => {
    try {
      await axios.post(
        `${API}/categories/monitor`,
        { category },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success(`Now monitoring "${category}"`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add category");
    }
  };

  const handleRemoveMonitor = async () => {
    try {
      await axios.delete(`${API}/categories/monitor/${selectedCategory.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Category removed from monitoring");
      setDeleteDialogOpen(false);
      setSelectedCategory(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to remove category");
    }
  };

  const openDeleteDialog = (category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const isMonitored = (categoryName) => {
    return monitoredCategories.some(m => m.category === categoryName);
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="categories">
      <div className="space-y-6" data-testid="categories-page">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Categories</h1>
          <p className="text-base text-muted-foreground">Manage and monitor channel categories</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* All Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Available Categories</CardTitle>
              <CardDescription>All categories from your playlists</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No categories found</div>
              ) : (
                <div className="space-y-2">
                  {categories.map((category, index) => (
                    <div
                      key={index}
                      data-testid={`category-${index}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={isMonitored(category) ? "default" : "secondary"}>
                          {category}
                        </Badge>
                        {isMonitored(category) && (
                          <Eye className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      {!isMonitored(category) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddMonitor(category)}
                          data-testid={`monitor-${index}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Monitor
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monitored Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Monitored Categories</CardTitle>
              <CardDescription>Categories displayed on Events page</CardDescription>
            </CardHeader>
            <CardContent>
              {monitoredCategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No categories monitored yet
                </div>
              ) : (
                <div className="space-y-2">
                  {monitoredCategories.map((monitored, index) => (
                    <div
                      key={monitored.id}
                      data-testid={`monitored-${index}`}
                      className="flex items-center justify-between p-3 rounded-lg border bg-primary/5"
                    >
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        <Badge variant="default">{monitored.category}</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openDeleteDialog(monitored)}
                        data-testid={`remove-${index}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from monitoring?</AlertDialogTitle>
              <AlertDialogDescription>
                "{selectedCategory?.category}" will no longer appear on the Events page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveMonitor}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
