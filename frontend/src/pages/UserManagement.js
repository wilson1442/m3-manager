import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, UserCircle, Filter, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UserManagement({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState("");
  const [formData, setFormData] = useState({ 
    username: "", 
    password: "", 
    name: "",
    tenant_id: "",
    role: "user"
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    password: ""
  });

  const token = localStorage.getItem("token");
  const isSuperAdmin = user.role === "super_admin";

  useEffect(() => {
    if (isSuperAdmin) {
      fetchTenants();
    }
    fetchUsers();
  }, [selectedTenantFilter]);

  const fetchTenants = async () => {
    try {
      const response = await axios.get(`${API}/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTenants(response.data);
    } catch (error) {
      toast.error("Failed to fetch tenants");
    }
  };

  const fetchUsers = async () => {
    try {
      const url = selectedTenantFilter && selectedTenantFilter !== "all"
        ? `${API}/users?tenant_id=${selectedTenantFilter}`
        : `${API}/users`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    
    if (isSuperAdmin && !formData.tenant_id) {
      toast.error("Please select a tenant");
      return;
    }

    try {
      await axios.post(`${API}/users`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("User created successfully!");
      setIsAddDialogOpen(false);
      setFormData({ username: "", password: "", name: "", tenant_id: "", role: "user" });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create user");
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`${API}/users/${selectedUser.id}`, editFormData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("User updated successfully!");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      setEditFormData({ name: "", password: "" });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update user");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/users/${selectedUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("User deleted successfully!");
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const openDeleteDialog = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setEditFormData({ name: user.name || "", password: "" });
    setIsEditDialogOpen(true);
  };

  const getTenantName = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? tenant.name : tenantId;
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="users">
      <div className="space-y-6" data-testid="user-management-page">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">User Management</h1>
            <p className="text-base text-muted-foreground">
              {isSuperAdmin ? "Manage users across all tenants" : "Manage users in your tenant"}
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-user-btn" className="gap-2">
                <Plus className="h-4 w-4" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  {isSuperAdmin ? "Create a new user and assign to a tenant" : "Create a new user in your tenant"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    data-testid="user-username-input"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name (Optional)</Label>
                  <Input
                    id="name"
                    data-testid="user-name-input"
                    placeholder="Display name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    data-testid="user-password-input"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                {isSuperAdmin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="tenant">Tenant *</Label>
                      <Select
                        value={formData.tenant_id || undefined}
                        onValueChange={(value) => setFormData({ ...formData, tenant_id: value })}
                      >
                        <SelectTrigger id="tenant" data-testid="user-tenant-select">
                          <SelectValue placeholder="Select a tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger id="role" data-testid="user-role-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="tenant_owner">Tenant Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <Button type="submit" data-testid="submit-add-user-btn" className="w-full">
                  Create User
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isSuperAdmin && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor="tenant-filter" className="whitespace-nowrap">Filter by Tenant:</Label>
                <Select
                  value={selectedTenantFilter || undefined}
                  onValueChange={(value) => setSelectedTenantFilter(value || "")}
                >
                  <SelectTrigger id="tenant-filter" data-testid="tenant-filter-select" className="max-w-xs">
                    <SelectValue placeholder="All tenants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tenants</SelectItem>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">Loading users...</div>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No users found</p>
                <p className="text-sm text-muted-foreground mt-2">Click "Add User" to create your first user</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    {isSuperAdmin && <TableHead>Tenant</TableHead>}
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.name || "-"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {u.role.replace("_", " ").toUpperCase()}
                        </span>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-sm text-muted-foreground">
                          {u.tenant_id ? getTenantName(u.tenant_id) : "No tenant"}
                        </TableCell>
                      )}
                      <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            data-testid={`edit-user-${u.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(u)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            data-testid={`delete-user-${u.id}`}
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteDialog(u)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the user "{selectedUser?.username}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="cancel-delete-user-btn">Cancel</AlertDialogCancel>
              <AlertDialogAction data-testid="confirm-delete-user-btn" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}