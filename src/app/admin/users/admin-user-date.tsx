"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  CircularProgress,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Backdrop,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  Checkbox,
  Toolbar,
  IconButton,
  TablePagination,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics } from "nextjs-google-analytics";

// Animation variants
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  registeredAt: string;
  lastLoginAt?: string;
  subscriptionStatus: string;
  auditTrail?: { action: string; by: string; at: string }[];
  password?: string;
}

interface ActivityLogEntry {
  id: number;
  userId: number;
  action: string;
  timestamp: string;
}

export default function AdminUsersClient() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof User | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [activityLogUser, setActivityLogUser] = useState<User | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [registeredAtStart, setRegisteredAtStart] = useState<string>("");
  const [registeredAtEnd, setRegisteredAtEnd] = useState<string>("");
  const currentAdmin = session?.user?.name || "AdminUser";

  const fetchUsers = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime < 1000 || !session) return;

    try {
      setLoading(true);
      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Fetch failed:", response.status, errorText);
        if (response.status === 403) {
          throw new Error("Unauthorized access. Admin privileges required.");
        }
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data);
      setLastFetchTime(now);
      toast.success("Users loaded successfully!", { autoClose: 2000, toastId: "fetch-success" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load users. Please try again.";
      console.error("Fetch error:", error);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [lastFetchTime, session]);

  const fetchActivityLog = useCallback(async (userId: number) => {
    if (!session) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}/activity`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch activity log");
      const data = await response.json();
      setActivityLog(data);
    } catch {
      toast.error("Error fetching activity log");
      setActivityLog([]);
    }
  }, [session]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    let result = [...users];
    if (searchQuery) {
      result = result.filter((user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (roleFilter) result = result.filter((user) => user.role === roleFilter);
    if (statusFilter) result = result.filter((user) => user.subscriptionStatus === statusFilter);
    if (registeredAtStart) result = result.filter((user) => new Date(user.registeredAt) >= new Date(registeredAtStart));
    if (registeredAtEnd) result = result.filter((user) => new Date(user.registeredAt) <= new Date(registeredAtEnd));
    if (sortField) {
      result.sort((a, b) => {
        const aValue = a[sortField] || "";
        const bValue = b[sortField] || "";
        return sortDirection === "asc" ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
      });
    }
    return result;
  }, [users, sortField, sortDirection, searchQuery, roleFilter, statusFilter, registeredAtStart, registeredAtEnd]);

  const paginatedUsers = useMemo(() =>
    filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredUsers, page, rowsPerPage]
  );

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelect = (userId: number) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) setSelected(paginatedUsers.map((user) => user.id));
    else setSelected([]);
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0 || !session) return;
    if (confirm(`Are you sure you want to delete ${selected.length} users?`)) {
      setActionLoading(true);
      try {
        await Promise.all(
          selected.map((userId) =>
            fetch(`/api/admin/users/${userId}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${session.accessToken}` },
            })
          )
        );
        const deletedUserIds = selected;
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            deletedUserIds.includes(user.id)
              ? { ...user, auditTrail: [...(user.auditTrail || []), { action: "Deleted", by: currentAdmin, at: new Date().toISOString() }] }
              : user
          ).filter((user) => !deletedUserIds.includes(user.id))
        );
        setSelected([]);
        toast.success("Selected users deleted successfully!");
      } catch {
        toast.error("Error deleting users");
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleBulkUpdateRole = async (role: string) => {
    if (selected.length === 0 || !session) return;
    if (confirm(`Are you sure you want to update ${selected.length} users to role "${role}"?`)) {
      setActionLoading(true);
      try {
        await Promise.all(
          selected.map((userId) => {
            const user = users.find((u) => u.id === userId);
            if (!user) return Promise.resolve();
            return fetch(`/api/admin/users/${userId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.accessToken}`,
              },
              body: JSON.stringify({ ...user, role }),
            });
          })
        );
        const updatedUserIds = selected;
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            updatedUserIds.includes(user.id)
              ? { ...user, role, auditTrail: [...(user.auditTrail || []), { action: `Role updated to ${role}`, by: currentAdmin, at: new Date().toISOString() }] }
              : user
          )
        );
        setSelected([]);
        toast.success("Selected users updated successfully!");
      } catch {
        toast.error("Error updating users");
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleEditUser = (user: User) => {
    setEditUser(user);
    setValidationErrors({});
  };

  const handleAddUser = () => {
    setEditUser({
      id: 0,
      name: "",
      email: "",
      role: "user",
      registeredAt: new Date().toISOString(),
      subscriptionStatus: "inactive",
      auditTrail: [],
      password: "",
    });
    setValidationErrors({});
  };

  const handleSaveUser = async () => {
    if (!editUser || !session) return;

    const errors: { [key: string]: string } = {};
    if (!editUser.name) errors.name = "Name is required";
    if (!editUser.email) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUser.email)) errors.email = "Invalid email format";
    if (!editUser.role) errors.role = "Role is required";
    if (!editUser.subscriptionStatus) errors.subscriptionStatus = "Subscription status is required";
    if (editUser.id === 0 && !editUser.password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fix the errors before saving");
      return;
    }

    if (confirm(`Are you sure you want to ${editUser.id === 0 ? "add" : "update"} this user?`)) {
      setActionLoading(true);
      try {
        const method = editUser.id === 0 ? "POST" : "PUT";
        const url = editUser.id === 0 ? "/api/admin/users" : `/api/admin/users/${editUser.id}`;
        const updatedUser = {
          ...editUser,
          auditTrail: [
            ...(editUser.auditTrail || []),
            { action: editUser.id === 0 ? "Created" : "Updated", by: currentAdmin, at: new Date().toISOString() },
          ],
        };
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify(updatedUser),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to ${method === "POST" ? "add" : "update"} user: ${errorText}`);
        }

        const result = await response.json();
        if (method === "POST") setUsers([...users, result]);
        else setUsers(users.map((u) => (u.id === result.id ? result : u)));
        setEditUser(null);
        setValidationErrors({});
        toast.success(`User ${method === "POST" ? "added" : "updated"} successfully!`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : `Error ${editUser.id === 0 ? "adding" : "updating"} user`;
        toast.error(message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!session) return;
    if (confirm("Are you sure you want to delete this user?")) {
      setActionLoading(true);
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${session.accessToken}` },
        });
        if (!response.ok) throw new Error("Failed to delete user");
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === userId
              ? { ...user, auditTrail: [...(user.auditTrail || []), { action: "Deleted", by: currentAdmin, at: new Date().toISOString() }] }
              : user
          ).filter((user) => user.id !== userId)
        );
        toast.success("User deleted successfully!");
      } catch {
        toast.error("Error deleting user");
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleViewActivityLog = (user: User) => {
    setActivityLogUser(user);
    fetchActivityLog(user.id);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    setSelected([]);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    setSelected([]);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "grey.900",
        p: 3,
        position: "relative",
        background: "linear-gradient(181deg, #000000bd, #031e04, #0000002b, #000000d4)",
        backgroundSize: "200% 200%",
        animation: "gradientShift 20s ease infinite",
        "@keyframes gradientShift": {
          "0%": { backgroundPosition: "0% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
          "100%": { backgroundPosition: "0% 0%" },
        },
      }}
    >
      <ToastContainer position="top-right" />
      <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <GoogleAnalytics trackPageViews debugMode={true} />

      <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.6 }}>
            <Paper elevation={6} sx={{ p: 4, bgcolor: "grey.900", backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))", borderRadius: 2, boxShadow: "0 0 10px rgba(155, 92, 255, 0.21)" }}>
              <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                  <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="Foil Alpha Logo" width={200} height={100} />
                </motion.div>
              </Box>
              <Box sx={{ width: "100%" }}>
                <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
                  Admin - Registered Users
                </Typography>
                <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center", color: "text.secondary" }}>
                  View all users registered to Foil Alpha
                </Typography>

                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                  <motion.div variants={itemVariants}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                      <Button variant="contained" sx={{ bgcolor: "#9B5Cff", color: "grey.900" }} onClick={handleAddUser} disabled={actionLoading}>
                        Add User
                      </Button>
                      <Button variant="contained" sx={{ bgcolor: "#9B5Cff", color: "grey.900" }} onClick={fetchUsers} disabled={loading || actionLoading}>
                        Refresh
                      </Button>
                    </Box>
                  </motion.div>

                  {error && (
                    <motion.div variants={itemVariants}>
                      <Typography color="error" sx={{ mb: 2, textAlign: "center" }}>
                        {error}
                      </Typography>
                    </motion.div>
                  )}

                  <motion.div variants={itemVariants}>
                    <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                      <TextField
                        label="Search Users"
                        variant="outlined"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        sx={{ flex: 1, minWidth: 200 }}
                        InputLabelProps={{ style: { color: "text.secondary" } }}
                        inputProps={{ style: { color: "text.primary" } }}
                      />
                      <Select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        displayEmpty
                        sx={{ minWidth: 120, color: "text.primary" }}
                        inputProps={{ style: { color: "text.primary" } }}
                      >
                        <MenuItem value="">All Roles</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="user">User</MenuItem>
                      </Select>
                      <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        displayEmpty
                        sx={{ minWidth: 150, color: "text.primary" }}
                        inputProps={{ style: { color: "text.primary" } }}
                      >
                        <MenuItem value="">All Statuses</MenuItem>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                      </Select>
                      <TextField
                        label="Registered At (Start)"
                        type="date"
                        value={registeredAtStart}
                        onChange={(e) => setRegisteredAtStart(e.target.value)}
                        InputLabelProps={{ shrink: true, style: { color: "text.secondary" } }}
                        inputProps={{ style: { color: "text.primary" } }}
                        sx={{ minWidth: 180 }}
                      />
                      <TextField
                        label="Registered At (End)"
                        type="date"
                        value={registeredAtEnd}
                        onChange={(e) => setRegisteredAtEnd(e.target.value)}
                        InputLabelProps={{ shrink: true, style: { color: "text.secondary" } }}
                        inputProps={{ style: { color: "text.primary" } }}
                        sx={{ minWidth: 180 }}
                      />
                    </Box>
                  </motion.div>

                  {selected.length > 0 && (
                    <motion.div variants={itemVariants}>
                      <Toolbar sx={{ bgcolor: "grey.800", mb: 2 }}>
                        <Typography sx={{ flex: "1 1 100%", color: "text.primary" }}>
                          {selected.length} selected
                        </Typography>
                        <Button variant="outlined" size="small" onClick={() => handleBulkUpdateRole("admin")} disabled={actionLoading} sx={{ mr: 1 }}>
                          Set Admin
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => handleBulkUpdateRole("user")} disabled={actionLoading} sx={{ mr: 1 }}>
                          Set User
                        </Button>
                        <IconButton color="error" onClick={handleBulkDelete} disabled={actionLoading}>
                          <DeleteIcon />
                        </IconButton>
                      </Toolbar>
                    </motion.div>
                  )}

                  <TableContainer sx={{ maxHeight: 400, overflowX: "auto" }}>
                    <Table sx={{ minWidth: 650 }} aria-label="users table">
                      <TableHead sx={{ position: "sticky", top: 0, bgcolor: "grey.800", zIndex: 1 }}>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selected.length === paginatedUsers.length && paginatedUsers.length > 0}
                              onChange={handleSelectAll}
                              sx={{ color: "text.secondary" }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: "text.primary", cursor: "pointer" }} onClick={() => handleSort("id")}>
                            ID {sortField === "id" && (sortDirection === "asc" ? "↑" : "↓")}
                          </TableCell>
                          <TableCell sx={{ color: "text.primary", cursor: "pointer" }} onClick={() => handleSort("name")}>
                            Name {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                          </TableCell>
                          <TableCell sx={{ color: "text.primary", cursor: "pointer" }} onClick={() => handleSort("email")}>
                            Email {sortField === "email" && (sortDirection === "asc" ? "↑" : "↓")}
                          </TableCell>
                          <TableCell sx={{ color: "text.primary", cursor: "pointer" }} onClick={() => handleSort("role")}>
                            Role {sortField === "role" && (sortDirection === "asc" ? "↑" : "↓")}
                          </TableCell>
                          <TableCell sx={{ color: "text.primary", cursor: "pointer" }} onClick={() => handleSort("registeredAt")}>
                            Registered At {sortField === "registeredAt" && (sortDirection === "asc" ? "↑" : "↓")}
                          </TableCell>
                          <TableCell sx={{ color: "text.primary", cursor: "pointer" }} onClick={() => handleSort("lastLoginAt")}>
                            Last Login {sortField === "lastLoginAt" && (sortDirection === "asc" ? "↑" : "↓")}
                          </TableCell>
                          <TableCell sx={{ color: "text.primary", cursor: "pointer" }} onClick={() => handleSort("subscriptionStatus")}>
                            Subscription {sortField === "subscriptionStatus" && (sortDirection === "asc" ? "↑" : "↓")}
                          </TableCell>
                          <TableCell sx={{ color: "text.primary" }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                      {paginatedUsers.map((user) => (
                        <TableRow
                          key={user.id}
                          sx={{
                            "&:hover": { bgcolor: "grey.800" },
                            ...(selected.includes(user.id) && { bgcolor: "grey.700" }),
                          }}
                          component={motion.tr}
                          variants={itemVariants}
                          style={{ display: "table-row" }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selected.includes(user.id)}
                              onChange={() => handleSelect(user.id)}
                              sx={{ color: "text.secondary" }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>{user.id}</TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>{user.name}</TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>{user.email}</TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>{user.role}</TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>
                            {new Date(user.registeredAt).toLocaleString()}
                          </TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>
                            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                          </TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>
                            {user.subscriptionStatus}
                          </TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleEditUser(user)}
                              sx={{ mr: 1 }}
                              disabled={actionLoading}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleViewActivityLog(user)}
                              sx={{ mr: 1 }}
                              disabled={actionLoading}
                            >
                              <VisibilityIcon />
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={actionLoading}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={filteredUsers.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{ color: "text.secondary" }}
                  />

                  {filteredUsers.length === 0 && !error && (
                    <motion.div variants={itemVariants}>
                      <Typography variant="body1" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
                        No users found.
                      </Typography>
                    </motion.div>
                  )}
                </motion.div>
              </Box>
            </Paper>
          </motion.div>
        </motion.div>
      </Container>

      <Dialog open={!!editUser} onClose={() => setEditUser(null)}>
        <DialogTitle>{editUser?.id === 0 ? "Add Prelim" : "Edit User"}</DialogTitle>
        <DialogContent>
          {editUser && (
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Name"
                fullWidth
                value={editUser.name}
                onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                sx={{ mb: "10px" }}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                inputProps={{ style: { color: "text.primary" } }}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
              />
              <TextField
                label="Email"
                fullWidth
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                sx={{ mb: "10px" }}
                InputLabelProps={{ style: { color: "text.secondary" } }}
                inputProps={{ style: { color: "text.primary" } }}
                error={!!validationErrors.email}
                helperText={validationErrors.email}
              />
              {editUser.id === 0 && (
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  value={editUser.password || ""}
                  onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                  sx={{ mb: "10px" }}
                  InputLabelProps={{ style: { color: "text.secondary" } }}
                  inputProps={{ style: { color: "text.primary" } }}
                  error={!!validationErrors.password}
                  helperText={validationErrors.password}
                />
              )}
              <Select
                label="Role"
                fullWidth
                value={editUser.role}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                sx={{ mb: "10px", color: "text.primary" }}
                inputProps={{ style: { color: "text.primary" } }}
                error={!!validationErrors.role}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
              {validationErrors.role && (
                <Typography color="error" variant="caption" sx={{ mb: "10px", display: "block" }}>
                  {validationErrors.role}
                </Typography>
              )}
              <Select
                label="Subscription Status"
                fullWidth
                value={editUser.subscriptionStatus}
                onChange={(e) => setEditUser({ ...editUser, subscriptionStatus: e.target.value })}
                sx={{ mb: "10px", color: "text.primary" }}
                inputProps={{ style: { color: "text.primary" } }}
                error={!!validationErrors.subscriptionStatus}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
              {validationErrors.subscriptionStatus && (
                <Typography color="error" variant="caption" sx={{ mb: "10px", display: "block" }}>
                  {validationErrors.subscriptionStatus}
                </Typography>
              )}
              {editUser.auditTrail && editUser.auditTrail.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
                    Audit Trail
                  </Typography>
                  {editUser.auditTrail.map((entry, index) => (
                    <Typography key={index} sx={{ color: "text.secondary", fontSize: "0.875rem" }}>
                      {entry.action} by {entry.by} at {new Date(entry.at).toLocaleString()}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button variant="contained" sx={{ bgcolor: "#9B5Cff", color: "grey.900" }} onClick={handleSaveUser} disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!activityLogUser} onClose={() => setActivityLogUser(null)}>
        <DialogTitle>{`Activity Log for ${activityLogUser?.name || "User"}`}</DialogTitle>
        <DialogContent>
          {activityLog.length > 0 ? (
            <Box>
              {activityLog.map((entry) => (
                <Typography key={entry.id} sx={{ color: "text.secondary", mb: 1 }}>
                  {entry.action} - {new Date(entry.timestamp).toLocaleString()}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography sx={{ color: "text.secondary" }}>No activity recorded.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivityLogUser(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}