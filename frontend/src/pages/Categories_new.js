import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Eye, Search, ChevronDown, ChevronRight } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Categories({ user, onLogout }) {
  const [categories, setCategories] = useState([]);
  const [monitoredCategories, setMonitoredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [collapsedSources, setCollapsedSources] = useState({});

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

  // Group categories by source playlist
  const groupCategoriesBySource = () => {
    const grouped = {};
    
    categories.forEach(categoryItem => {
      // If categoryItem is a string, use "Unknown Source"
      const category = typeof categoryItem === 'string' ? categoryItem : categoryItem.category;
      const source = typeof categoryItem === 'object' ? (categoryItem.playlist_name || "Unknown Source") : "Unknown Source";
      
      if (!grouped[source]) {
        grouped[source] = [];
      }
      if (!grouped[source].includes(category)) {
        grouped[source].push(category);
      }
    });
    
    return grouped;
  };

  const groupedCategories = groupCategoriesBySource();

  // Filter categories
  const filteredGroupedCategories = {};
  Object.entries(groupedCategories).forEach(([source, cats]) => {
    const filtered = cats.filter(cat => 
      cat.toLowerCase().includes(filterQuery.toLowerCase())
    );
    if (filtered.length > 0) {
      filteredGroupedCategories[source] = filtered;
    }
  });

  // Initialize all sources as collapsed
  useEffect(() => {
    const initialCollapsed = {};
    Object.keys(groupedCategories).forEach(source => {
      if (collapsedSources[source] === undefined) {
        initialCollapsed[source] = true;
      }
    });
    if (Object.keys(initialCollapsed).length > 0) {
      setCollapsedSources(prev => ({ ...prev, ...initialCollapsed }));
    }
  }, [categories]);

  const toggleSource = (source) => {
    setCollapsedSources(prev => ({ ...prev, [source]: !prev[source] }));
  };

  const handleToggle = async (category, isCurrentlyMonitored) => {
    if (isCurrentlyMonitored) {
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
          <p className="text-base text-muted-foreground">
            {monitoredCategories.length} of {categories.length} categories monitored
          </p>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter categories..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading categories...
            </CardContent>
          </Card>
        ) : Object.keys(filteredGroupedCategories).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {filterQuery ? "No categories match your search" : "No categories found"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(filteredGroupedCategories).map(([source, sourceCategories]) => (
              <Card key={source}>
                <Collapsible 
                  open={!collapsedSources[source]}
                  onOpenChange={() => toggleSource(source)}
                >
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {collapsedSources[source] ? (
                            <ChevronRight className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                          {source}
                          <Badge variant="secondary">{sourceCategories.length} categories</Badge>
                        </CardTitle>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sourceCategories.map((category, index) => {
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
                                <Label htmlFor={`toggle-${source}-${index}`} className="text-xs text-muted-foreground cursor-pointer">
                                  {monitored ? 'On' : 'Off'}
                                </Label>
                                <Switch
                                  id={`toggle-${source}-${index}`}
                                  checked={monitored}
                                  onCheckedChange={() => handleToggle(category, monitored)}
                                  data-testid={`toggle-${index}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
