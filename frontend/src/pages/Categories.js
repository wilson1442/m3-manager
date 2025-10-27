import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Categories({ user, onLogout }) {
  const [categories, setCategories] = useState([]);
  const [monitoredCategories, setMonitoredCategories] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleToggle = async (category, isCurrentlyMonitored) => {
    if (isCurrentlyMonitored) {
      // Remove from monitoring
      const monitored = monitoredCategories.find(m => m.category === category);
      try {
        await axios.delete(`${API}/categories/monitor/${monitored.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success(`Stopped monitoring "${category}"`);
        fetchData();
      } catch (error) {
        toast.error("Failed to remove category");
      }
    } else {
      // Add to monitoring
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
    }
  };

  const isMonitored = (categoryName) => {
    return monitoredCategories.some(m => m.category === categoryName);
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="categories">
      <div className="space-y-6" data-testid="categories-page">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Categories</h1>
          <p className="text-base text-muted-foreground">Toggle categories to monitor on Events page</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Categories</CardTitle>
            <CardDescription>
              {monitoredCategories.length} of {categories.length} categories monitored
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No categories found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category, index) => {
                  const monitored = isMonitored(category);
                  return (
                    <div
                      key={index}
                      data-testid={`category-${index}`}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        monitored ? 'bg-primary/5 border-primary/20' : 'hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {monitored && <Eye className="h-4 w-4 text-primary" />}
                        <Badge variant={monitored ? "default" : "secondary"} className="text-sm">
                          {category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`toggle-${index}`} className="text-xs text-muted-foreground cursor-pointer">
                          {monitored ? 'On' : 'Off'}
                        </Label>
                        <Switch
                          id={`toggle-${index}`}
                          checked={monitored}
                          onCheckedChange={() => handleToggle(category, monitored)}
                          data-testid={`toggle-${index}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
