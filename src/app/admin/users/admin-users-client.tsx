"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Typography,
  CircularProgress,
  Container,
  Paper,
  Backdrop,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  Toolbar,
  IconButton,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics } from "nextjs-google-analytics";
import sanitizeHtml from "sanitize-html";
import { debounce } from "lodash";
import Sidebar from "../../components/Sidebar";

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
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [rowLoading, setRowLoading] = useState<{ [key: number]: boolean }>({});
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [fetchAttempts, setFetchAttempts] = useState<number>(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [activityLogUser, setActivityLogUser] = useState<User | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState<boolean>(false);
  const [registeredAtStart, setRegisteredAtStart] = useState<string>("");
  const [registeredAtEnd, setRegisteredAtEnd] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<{ action: string; callback: () => void } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    email: true,
    role: true,
    registeredAt: true,
    lastLoginAt: true,
    subscriptionStatus: true,
  });
  const currentAdmin = session?.user?.name || "AdminUser";
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const hasFetchedRef = useRef(false);

  // Role-Based Access Control (RBAC)
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/unauthorized");
    }
  }, [status, session, router]);

  // Fetch users with debugging
  const maxAttempts = 5;
  const cooldown = 5000;
  const fetchUsers = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime < 1000 || !session || fetchAttempts >= maxAttempts) {
      if (fetchAttempts >= maxAttempts) toast.error("Too many refresh attempts. Please wait.");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      console.log("Fetched users:", data);
      setUsers(data || []);
      setLastFetchTime(now);
      setFetchAttempts((prev) => prev + 1);
      setTimeout(() => setFetchAttempts(0), cooldown);
      toast.success("Users loaded successfully!", { autoClose: 2000 });
    } catch (err: any) {
      setError(err.message || "Failed to load users.");
      toast.error(err.message || "Failed to load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [session, lastFetchTime, fetchAttempts]);

  // Initial fetch only when status becomes authenticated
  useEffect(() => {
    if (status === "authenticated" && !hasFetchedRef.current) {
      fetchUsers();
      hasFetchedRef.current = true;
    }
  }, [status, fetchUsers]);

  // Lazy Loading Activity Log
  const fetchActivityLog = useCallback(async (userId: number) => {
    if (!session) return;
    setActivityLogLoading(true);
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
    } catch (err) {
      toast.error("Error fetching activity log");
      setActivityLog([]);
    } finally {
      setActivityLogLoading(false);
    }
  }, [session]);

  // User Stats Dashboard
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.subscriptionStatus === "active").length,
    admins: users.filter((u) => u.role === "admin").length,
  }), [users]);

  // Debounced Search
  const debouncedSetSearchQuery = useCallback(debounce((value: string) => setSearchQuery(value), 300), []);

  const filteredUsers = useMemo(() => {
    let result = [...users];
    console.log("Filtered users before filtering:", result);
    if (searchQuery) {
      result = result.filter(
        (user) =>
          user &&
          (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    if (roleFilter) result = result.filter((user) => user && user.role === roleFilter);
    if (statusFilter) result = result.filter((user) => user && user.subscriptionStatus === statusFilter);
    if (registeredAtStart) result = result.filter((user) => user && new Date(user.registeredAt) >= new Date(registeredAtStart));
    if (registeredAtEnd) result = result.filter((user) => user && new Date(user.registeredAt) <= new Date(registeredAtEnd));
    console.log("Filtered users after filtering:", result);
    return result.filter(Boolean);
  }, [users, searchQuery, roleFilter, statusFilter, registeredAtStart, registeredAtEnd]);

  // Export Functionality
  const exportToCSV = () => {
    const headers = Object.keys(visibleColumns)
      .filter((key) => visibleColumns[key as keyof typeof visibleColumns])
      .map((key) => key.charAt(0).toUpperCase() + key.slice(1))
      .join(",");
    const rows = filteredUsers.map((user) =>
      Object.keys(visibleColumns)
        .filter((key) => visibleColumns[key as keyof typeof visibleColumns])
        .map((key) => {
          if (key === "registeredAt") return user.registeredAt ? new Date(user.registeredAt).toLocaleString() : "Never";
          if (key === "lastLoginAt") return user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never";
          return user[key as keyof User] || "";
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
  };

  // Virtualized Table Columns with Direct Rendering
  const columns: GridColDef[] = [
    ...(visibleColumns.id ? [{ field: "id", headerName: "ID", width: 70, sortable: true }] : []),
    ...(visibleColumns.name ? [{ field: "name", headerName: "Name", width: 130, sortable: true }] : []),
    ...(visibleColumns.email ? [{ field: "email", headerName: "Email", width: 200, sortable: true }] : []),
    ...(visibleColumns.role ? [{ field: "role", headerName: "Role", width: 100, sortable: true }] : []),
    ...(visibleColumns.registeredAt
      ? [
          {
            field: "registeredAt",
            headerName: "Registered At",
            width: 180,
            sortable: true,
            renderCell: (params) => (
              <Typography>
                {params.row.registeredAt ? new Date(params.row.registeredAt).toLocaleString() : "Never"}
              </Typography>
            ),
          },
        ]
      : []),
    ...(visibleColumns.lastLoginAt
      ? [
          {
            field: "lastLoginAt",
            headerName: "Last Login",
            width: 180,
            sortable: true,
            renderCell: (params) => (
              <Typography>
                {params.row.lastLoginAt ? new Date(params.row.lastLoginAt).toLocaleString() : "Never"}
              </Typography>
            ),
          },
        ]
      : []),
    ...(visibleColumns.subscriptionStatus ? [{ field: "subscriptionStatus", headerName: "Subscription", width: 120, sortable: true }] : []),
    {
      field: "actions",
      headerName: "Actions",
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleEditUser(params.row)}
            sx={{ mr: 1 }}
            disabled={rowLoading[params.id] || actionLoading}
            aria-label={`Edit user ${params.row.name}`}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleViewActivityLog(params.row)}
            sx={{ mr: 1 }}
            disabled={rowLoading[params.id] || actionLoading}
            aria-label={`View activity log for ${params.row.name}`}
          >
            <VisibilityIcon />
          </Button>
          <IconButton
            color="error"
            onClick={() => handleDeleteUser(params.id as number)}
            disabled={rowLoading[params.id] || actionLoading}
            sx={{
              border: "1px solid red",
              borderRadius: "4px",
              padding: "4px",
              "&:hover": { backgroundColor: "rgba(110, 39, 39, 0.1)" },
            }}
            title="Delete User"
            aria-label={`Delete user ${params.row.name}`}
          >
            {rowLoading[params.id] ? <CircularProgress size={20} /> : <DeleteIcon />}
          </IconButton>
        </>
      ),
    },
  ];

  // Bulk Delete
  const handleBulkDelete = () => {
    setConfirmAction({
      action: `delete ${selected.length} users`,
      callback: async () => {
        setActionLoading(true);
        try {
          await Promise.all(
            selected.map((userId) =>
              fetch(`/api/admin/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${session?.accessToken}` },
              })
            )
          );
          const deletedUserIds = selected;
          setUsers((prev) =>
            prev
              .map((user) =>
                deletedUserIds.includes(user.id)
                  ? { ...user, auditTrail: [...(user.auditTrail || []), { action: "Deleted", by: currentAdmin, at: new Date().toISOString() }] }
                  : user
              )
              .filter((user) => !deletedUserIds.includes(user.id))
          );
          setSelected([]);
          toast.success("Selected users deleted successfully!");
        } catch (err) {
          toast.error("Error deleting users");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Bulk Update Role
  const handleBulkUpdateRole = (role: string) => {
    setConfirmAction({
      action: `update ${selected.length} users to role "${role}"`,
      callback: async () => {
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
                  "Authorization": `Bearer ${session?.accessToken}`,
                },
                body: JSON.stringify({ ...user, role }),
              });
            })
          );
          const updatedUserIds = selected;
          setUsers((prev) =>
            prev.map((user) =>
              updatedUserIds.includes(user.id)
                ? { ...user, role, auditTrail: [...(user.auditTrail || []), { action: `Role updated to ${role}`, by: currentAdmin, at: new Date().toISOString() }] }
                : user
            )
          );
          setSelected([]);
          toast.success("Selected users updated successfully!");
        } catch (err) {
          toast.error("Error updating users");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Bulk Edit (e.g., Subscription Status)
  const handleBulkEditSubscription = (status: string) => {
    setConfirmAction({
      action: `update ${selected.length} users to subscription status "${status}"`,
      callback: async () => {
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
                  "Authorization": `Bearer ${session?.accessToken}`,
                },
                body: JSON.stringify({ ...user, subscriptionStatus: status }),
              });
            })
          );
          const updatedUserIds = selected;
          setUsers((prev) =>
            prev.map((user) =>
              updatedUserIds.includes(user.id)
                ? {
                    ...user,
                    subscriptionStatus: status,
                    auditTrail: [...(user.auditTrail || []), { action: `Subscription updated to ${status}`, by: currentAdmin, at: new Date().toISOString() }],
                  }
                : user
            )
          );
          setSelected([]);
          toast.success("Selected users' subscription status updated successfully!");
        } catch (err) {
          toast.error("Error updating subscription status");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleEditUser = (user: User) => {
    setEditUser(user);
    setValidationErrors({});
    setTimeout(() => editDialogRef.current?.focus(), 0);
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
    setTimeout(() => editDialogRef.current?.focus(), 0);
  };

  // Input Validation
  const isValidDate = (date: string) => !isNaN(new Date(date).getTime());
  const handleSaveUser = async () => {
    if (!editUser || !session) return;

    const sanitizedUser = {
      ...editUser,
      name: sanitizeHtml(editUser.name),
      email: sanitizeHtml(editUser.email),
    };

    const errors: { [key: string]: string } = {};
    if (!sanitizedUser.name) errors.name = "Name is required";
    if (!sanitizedUser.email) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedUser.email)) errors.email = "Invalid email format";
    if (!sanitizedUser.role) errors.role = "Role is required";
    if (!sanitizedUser.subscriptionStatus) errors.subscriptionStatus = "Subscription status is required";
    if (sanitizedUser.id === 0 && !sanitizedUser.password) errors.password = "Password is required";
    if (!isValidDate(sanitizedUser.registeredAt)) errors.registeredAt = "Invalid registration date";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fix the errors before saving");
      return;
    }

    setConfirmAction({
      action: `${sanitizedUser.id === 0 ? "add" : "update"} user "${sanitizedUser.name}"`,
      callback: async () => {
        setActionLoading(true);
        try {
          const method = sanitizedUser.id === 0 ? "POST" : "PUT";
          const url = sanitizedUser.id === 0 ? "/api/admin/users" : `/api/admin/users/${sanitizedUser.id}`;
          const updatedUser = {
            ...sanitizedUser,
            auditTrail: [
              ...(sanitizedUser.auditTrail || []),
              { action: sanitizedUser.id === 0 ? "Created" : "Updated", by: currentAdmin, at: new Date().toISOString() },
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

          if (!response.ok) throw new Error(`Failed to ${method === "POST" ? "add" : "update"} user`);
          const result = await response.json();
          if (method === "POST") setUsers((prev) => [...prev, result]);
          else setUsers((prev) => prev.map((u) => (u.id === result.id ? result : u)));
          setEditUser(null);
          setValidationErrors({});
          toast.success(`User ${method === "POST" ? "added" : "updated"} successfully!`);
        } catch (err: any) {
          toast.error(err.message || `Error ${sanitizedUser.id === 0 ? "adding" : "updating"} user`);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleDeleteUser = async (userId: number) => {
    if (!session) return;
    setConfirmAction({
      action: `delete user with ID ${userId}`,
      callback: async () => {
        setRowLoading((prev) => ({ ...prev, [userId]: true }));
        try {
          const response = await fetch(`/api/admin/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${session.accessToken}` },
          });
          if (!response.ok) throw new Error("Failed to delete user");
          setUsers((prev) =>
            prev
              .map((user) =>
                user.id === userId
                  ? { ...user, auditTrail: [...(user.auditTrail || []), { action: "Deleted", by: currentAdmin, at: new Date().toISOString() }] }
                  : user
              )
              .filter((user) => user.id !== userId)
          );
          setSelected((prev) => prev.filter((id) => id !== userId));
          toast.success("User deleted successfully!");
        } catch (err) {
          toast.error("Error deleting user");
        } finally {
          setRowLoading((prev) => ({ ...prev, [userId]: false }));
        }
      },
    });
  };

  const handleViewActivityLog = (user: User) => {
    setActivityLogUser(user);
    fetchActivityLog(user.id);
  };

  // Reset Filters
  const resetFilters = () => {
    setSearchQuery("");
    setRoleFilter("");
    setStatusFilter("");
    setRegisteredAtStart("");
    setRegisteredAtEnd("");
  };

  console.log("Rendering DataGrid with rows:", filteredUsers);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        bgcolor: "grey.900",
        p: 3,
        background: "linear-gradient(181deg,rgba(0, 0, 0, 0.74), #031e04,rgba(0, 0, 0, 0.17), #000000d4)",
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

      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", my: 3 }}>
        <IconButton onClick={toggleSidebar}>
          <MenuIcon />
        </IconButton>
      </Box>

      <GoogleAnalytics trackPageViews debugMode={true} />

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <Paper
            elevation={6}
            sx={{
              p: 4,
              bgcolor: "grey.900",
              backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
              borderRadius: 2,
              boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)",
              overflow: "visible",
            }}
          >
            <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market Logo" width={200} height={100} />
              </motion.div>
            </Box>
            <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
              Admin - Registered Users
            </Typography>

            {/* User Stats Dashboard */}
            <motion.div variants={itemVariants}>
              <Box sx={{ mb: 2, display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 2 }}>
                <Typography sx={{ color: "text.secondary" }}>Total Users: {stats.total}</Typography>
                <Typography sx={{ color: "text.secondary" }}>Active: {stats.active}</Typography>
                <Typography sx={{ color: "text.secondary" }}>Admins: {stats.admins}</Typography>
              </Box>
            </motion.div>

            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <motion.div variants={itemVariants}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
                  <Button variant="contained" sx={{ bgcolor: "#96ff9b", color: "grey.900" }} onClick={handleAddUser} disabled={actionLoading}>
                    Add User
                  </Button>
                  <Button variant="contained" sx={{ bgcolor: "#96ff9b", color: "grey.900" }} onClick={fetchUsers} disabled={loading || actionLoading}>
                    Refresh
                  </Button>
                  <Button variant="contained" sx={{ bgcolor: "#96ff9b", color: "grey.900" }} onClick={exportToCSV} disabled={actionLoading}>
                    Export to CSV
                  </Button>
                </Box>
              </motion.div>

              {/* Column Visibility Toggle */}
              <motion.div variants={itemVariants}>
                <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {Object.keys(visibleColumns).map((col) => (
                    <FormControlLabel
                      key={col}
                      control={
                        <Checkbox
                          checked={visibleColumns[col as keyof typeof visibleColumns]}
                          onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [col]: e.target.checked }))}
                          sx={{ color: "text.secondary" }}
                        />
                      }
                      label={col.charAt(0).toUpperCase() + col.slice(1)}
                      sx={{ color: "text.secondary" }}
                    />
                  ))}
                </Box>
              </motion.div>

              {/* Responsive Filters with Reset Button */}
              <motion.div variants={itemVariants}>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, mb: 2, alignItems: "center" }}>
                  <TextField
                    label="Search Users"
                    variant="outlined"
                    value={searchQuery}
                    onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                    sx={{ flex: 1, minWidth: { xs: "100%", md: 200 } }}
                    InputLabelProps={{ style: { color: "text.secondary" } }}
                    inputProps={{ style: { color: "text.primary" }, "aria-label": "Search users by name or email" }}
                  />
                  <Select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    displayEmpty
                    sx={{ minWidth: { xs: "100%", md: 120 }, color: "text.primary" }}
                    aria-label="Filter by role"
                  >
                    <MenuItem value="">All Roles</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="user">User</MenuItem>
                  </Select>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    displayEmpty
                    sx={{ minWidth: { xs: "100%", md: 150 }, color: "text.primary" }}
                    aria-label="Filter by subscription status"
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
                    sx={{ minWidth: { xs: "100%", md: 180 } }}
                    inputProps={{ "aria-label": "Filter by registration start date" }}
                  />
                  <TextField
                    label="Registered At (End)"
                    type="date"
                    value={registeredAtEnd}
                    onChange={(e) => setRegisteredAtEnd(e.target.value)}
                    InputLabelProps={{ shrink: true, style: { color: "text.secondary" } }}
                    sx={{ minWidth: { xs: "100%", md: 180 } }}
                    inputProps={{ "aria-label": "Filter by registration end date" }}
                  />
                  <Button variant="outlined" onClick={resetFilters} sx={{ mt: { xs: 2, md: 0 } }} aria-label="Reset all filters">
                    Reset Filters
                  </Button>
                </Box>
              </motion.div>

              {/* Sticky Toolbar */}
              {selected.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Toolbar
                    sx={{
                      bgcolor: "grey.800",
                      mb: 2,
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      borderBottom: "2px solid #96ff9b",
                    }}
                  >
                    <Typography sx={{ flex: "1 1 100%", color: "text.primary" }}>{selected.length} selected</Typography>
                    <Button variant="outlined" size="small" onClick={() => handleBulkUpdateRole("admin")} disabled={actionLoading} sx={{ mr: 1 }}>
                      Set Admin
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => handleBulkUpdateRole("user")} disabled={actionLoading} sx={{ mr: 1 }}>
                      Set User
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => handleBulkEditSubscription("active")} disabled={actionLoading} sx={{ mr: 1 }}>
                      Set Active
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => handleBulkEditSubscription("inactive")} disabled={actionLoading} sx={{ mr: 1 }}>
                      Set Inactive
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => handleBulkEditSubscription("pending")} disabled={actionLoading} sx={{ mr: 1 }}>
                      Set Pending
                    </Button>
                    <IconButton color="error" onClick={handleBulkDelete} disabled={actionLoading} aria-label="Bulk delete selected users">
                      <DeleteIcon />
                    </IconButton>
                  </Toolbar>
                </motion.div>
              )}

              {/* Virtualized Table */}
              <motion.div variants={itemVariants}>
                <Box sx={{ height: 400, width: "100%", overflow: "auto" }}>
                  <DataGrid
                    rows={filteredUsers}
                    columns={columns}
                    pageSize={rowsPerPage}
                    rowsPerPageOptions={[5, 10, 25]}
                    checkboxSelection
                    onSelectionModelChange={(newSelection) => {
                      const selectedIds = newSelection.map((id) => Number(id));
                      console.log("Selected IDs:", selectedIds);
                      setSelected(selectedIds);
                    }}
                    pagination
                    page={page}
                    onPageChange={(newPage) => {
                      setPage(newPage);
                      setSelected([]);
                    }}
                    onPageSizeChange={(newPageSize) => {
                      setRowsPerPage(newPageSize);
                      setPage(0);
                      setSelected([]);
                    }}
                    disableSelectionOnClick
                    sx={{
                      color: "text.secondary",
                      "& .MuiDataGrid-columnHeaders": { bgcolor: "grey.800" },
                      "& .MuiDataGrid-virtualScroller": { bgcolor: "grey.900" },
                      "& .MuiDataGrid-footerContainer": { bgcolor: "grey.900" },
                      "& .MuiDataGrid-row": { "&:hover": { bgcolor: "grey.800" } },
                      "& .MuiDataGrid-cell": { borderColor: "grey.800" },
                      backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                    }}
                  />
                </Box>
              </motion.div>

              {filteredUsers.length === 0 && !error && (
                <Typography variant="body1" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
                  No users found.
                </Typography>
              )}
            </motion.div>
          </Paper>
        </motion.div>
      </Container>

      {/* Edit/Add User Dialog with Focus Management */}
      <Dialog
        open={!!editUser}
        onClose={() => setEditUser(null)}
        aria-labelledby="edit-user-dialog-title"
        ref={editDialogRef}
        tabIndex={-1}
      >
        <DialogTitle id="edit-user-dialog-title">{editUser?.id === 0 ? "Add User" : "Edit User"}</DialogTitle>
        <DialogContent>
          {editUser && (
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Name"
                fullWidth
                value={editUser.name}
                onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                sx={{ mb: "10px" }}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
                inputProps={{ "aria-label": "User name" }}
              />
              <TextField
                label="Email"
                fullWidth
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                sx={{ mb: "10px" }}
                error={!!validationErrors.email}
                helperText={validationErrors.email}
                inputProps={{ "aria-label": "User email" }}
              />
              {editUser.id === 0 && (
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  value={editUser.password || ""}
                  onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                  sx={{ mb: "10px" }}
                  error={!!validationErrors.password}
                  helperText={validationErrors.password}
                  inputProps={{ "aria-label": "User password" }}
                />
              )}
              <Select
                fullWidth
                value={editUser.role}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                sx={{ mb: "10px" }}
                error={!!validationErrors.role}
                aria-label="User role"
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
              {validationErrors.role && <Typography color="error">{validationErrors.role}</Typography>}
              <Select
                fullWidth
                value={editUser.subscriptionStatus}
                onChange={(e) => setEditUser({ ...editUser, subscriptionStatus: e.target.value })}
                sx={{ mb: "10px" }}
                error={!!validationErrors.subscriptionStatus}
                aria-label="User subscription status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
              {validationErrors.subscriptionStatus && <Typography color="error">{validationErrors.subscriptionStatus}</Typography>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)} disabled={actionLoading} aria-label="Cancel edit">
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
            onClick={handleSaveUser}
            disabled={actionLoading}
            aria-label="Save user"
          >
            {actionLoading ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activity Log Dialog */}
      <Dialog open={!!activityLogUser} onClose={() => setActivityLogUser(null)} aria-labelledby="activity-log-dialog-title">
        <DialogTitle id="activity-log-dialog-title">{`Activity Log for ${activityLogUser?.name || "User"}`}</DialogTitle>
        <DialogContent>
          {activityLogLoading ? (
            <CircularProgress aria-label="Loading activity log" />
          ) : activityLog.length > 0 ? (
            activityLog.map((entry) => (
              <Typography key={entry.id} sx={{ color: "text.secondary", mb: 1 }}>
                {entry.action} - {new Date(entry.timestamp).toLocaleString()}
              </Typography>
            ))
          ) : (
            <Typography sx={{ color: "text.secondary" }}>No activity recorded.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivityLogUser(null)} aria-label="Close activity log">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} aria-labelledby="confirm-action-dialog-title">
        <DialogTitle id="confirm-action-dialog-title">Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to {confirmAction?.action}?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} disabled={actionLoading} aria-label="Cancel action">
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
            onClick={() => {
              confirmAction?.callback();
              setConfirmAction(null);
            }}
            disabled={actionLoading}
            aria-label="Confirm action"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}