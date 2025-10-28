import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Building2, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TenantManagement({ user, onLogout }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    owner_username: "", 
    owner_password: "",
    expiration_date: "2025-12-01" // Default to 12/1/2025
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    expiration_date: ""
  });

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await axios.get(`${API}/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTenants(response.data);
    } catch (error) {
      toast.error("Failed to fetch tenants");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/tenants`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Tenant created successfully!");
      setIsAddDialogOpen(false);
      setFormData({ 
        name: "", 
        owner_username: "", 
        owner_password: "",
        expiration_date: "2025-12-01"
      });
      fetchTenants();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create tenant");
    }
  };

  const handleEdit = (tenant) => {
    setEditingTenant(tenant);
    setEditFormData({
      name: tenant.name,
      expiration_date: tenant.expiration_date ? new Date(tenant.expiration_date).toISOString().split('T')[0] : ""
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/tenants/${editingTenant.id}`, editFormData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Tenant updated successfully!");
      setIsEditDialogOpen(false);
      setEditingTenant(null);
      fetchTenants();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update tenant");
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="tenants">
      <div className="space-y-6" data-testid="tenant-management-page">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Tenant Management</h1>
            <p className="text-base text-muted-foreground">Manage tenant organizations</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-tenant-btn" className="gap-2">
                <Plus className="h-4 w-4" /> Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Tenant</DialogTitle>
                <DialogDescription>Create a new tenant with an owner account</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tenant Name</Label>
                  <Input
                    id="name"
                    data-testid="tenant-name-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner_username">Owner Username</Label>
                  <Input
                    id="owner_username"
                    data-testid="tenant-owner-username-input"
                    value={formData.owner_username}
                    onChange={(e) => setFormData({ ...formData, owner_username: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner_password">Owner Password</Label>
                  <Input
                    id="owner_password"
                    data-testid="tenant-owner-password-input"
                    type="password"
                    value={formData.owner_password}
                    onChange={(e) => setFormData({ ...formData, owner_password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiration_date">Expiration Date</Label>
                  <Input
                    id="expiration_date"
                    data-testid="tenant-expiration-date-input"
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Tenant access will expire on this date</p>
                </div>
                <Button type="submit" data-testid="submit-add-tenant-btn" className="w-full">
                  Create Tenant
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Tenant Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tenant</DialogTitle>
              <DialogDescription>Update tenant information and expiration date</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_name">Tenant Name</Label>
                <Input
                  id="edit_name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_expiration_date">Expiration Date</Label>
                <Input
                  id="edit_expiration_date"
                  type="date"
                  value={editFormData.expiration_date}
                  onChange={(e) => setEditFormData({ ...editFormData, expiration_date: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">Tenant access will expire on this date</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Update Tenant
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>


        {loading ? (
          <div className="text-center py-12">Loading tenants...</div>
        ) : tenants.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tenants found</p>
                <p className="text-sm text-muted-foreground mt-2">Click "Add Tenant" to create your first tenant</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant Name</TableHead>
                    <TableHead>Owner ID</TableHead>
                    <TableHead>Expiration Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => {
                    const expirationDate = tenant.expiration_date ? new Date(tenant.expiration_date) : null;
                    const isExpired = expirationDate && expirationDate < new Date();
                    
                    return (
                      <TableRow key={tenant.id} data-testid={`tenant-row-${tenant.id}`}>
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{tenant.owner_id}</TableCell>
                        <TableCell>
                          {expirationDate ? (
                            <span className={isExpired ? "text-red-600 font-medium" : ""}>
                              {expirationDate.toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No expiration</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isExpired ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                              Expired
                            </span>
                          ) : expirationDate ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                              No Expiration
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tenant)}
                            className="gap-1"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}