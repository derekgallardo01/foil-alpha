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
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics } from "nextjs-google-analytics";
import sanitizeHtml from "sanitize-html";
import { debounce } from "lodash";
import AdminSidebar from "../../components/AdminSidebar";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

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
  balance?: number;
  frozen_balance?: number;
  available_balance?: number;
  cardCount?: number;
  purchaseCount?: number;
  saleCount?: number;
  auditTrail?: { action: string; by: string; at: string }[];
  password?: string;
}

interface WalletTransaction {
  id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  performed_by_admin: boolean;
}

interface ActivityLogEntry {
  id: number;
  userId: number;
  action: string;
  timestamp: string;
}

interface WalletOperationData {
  user_id: number;
  operation: 'ADD_MONEY' | 'DEDUCT_MONEY' | 'FREEZE_FUNDS' | 'UNFREEZE_FUNDS';
  amount: number;
  description: string;
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
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [activityLogUser, setActivityLogUser] = useState<User | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState<boolean>(false);
  const [registeredAtStart, setRegisteredAtStart] = useState<string>("");
  const [registeredAtEnd, setRegisteredAtEnd] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<{ action: string; callback: () => void } | null>(null);

  // Wallet Management States
  const [walletDialogOpen, setWalletDialogOpen] = useState<boolean>(false);
  const [selectedUserForWallet, setSelectedUserForWallet] = useState<User | null>(null);
  const [walletOperation, setWalletOperation] = useState<WalletOperationData>({
    user_id: 0,
    operation: 'ADD_MONEY',
    amount: 0,
    description: ''
  });
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);

  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    email: true,
    role: true,
    balance: true,
    available_balance: true,
    registeredAt: true,
    lastLoginAt: false,
    subscriptionStatus: true,
  });
  const currentAdmin = session?.user?.name || "AdminUser";
  const editDialogRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);

  // Role-Based Access Control (RBAC)
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/unauthorized");
    }
  }, [status, session, router]);

  // Fetch users with wallet info
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
      console.log("Fetched users with wallet info:", data);
      setUsers(data || []);
      setLastFetchTime(now);
      setFetchAttempts((prev) => prev + 1);
      setTimeout(() => setFetchAttempts(0), cooldown);
      toast.success("Users loaded successfully!", { autoClose: 2000 });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load users.";
      setError(errorMessage);
      toast.error(errorMessage);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [session, lastFetchTime, fetchAttempts]);

  // Initial fetch
  useEffect(() => {
    if (status === "authenticated" && !hasFetchedRef.current) {
      fetchUsers();
      hasFetchedRef.current = true;
    }
  }, [status, fetchUsers]);

  // Wallet Operations
  const handleWalletOperation = async () => {
    if (!selectedUserForWallet || !session) return;

    const { operation, amount, description } = walletOperation;

    if (amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    setWalletLoading(true);
    try {
      const response = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          user_id: selectedUserForWallet.id,
          operation,
          amount,
          description: description || `Admin ${operation.toLowerCase().replace('_', ' ')}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Wallet operation failed");
      }

      const result = await response.json();

      // Update user in the list
      setUsers(prev => prev.map(user =>
        user.id === selectedUserForWallet.id
          ? {
            ...user,
            balance: result.wallet.balance,
            frozen_balance: result.wallet.frozen_balance,
            available_balance: result.wallet.available_balance
          }
          : user
      ));

      // Update selected user
      setSelectedUserForWallet(prev => prev ? {
        ...prev,
        balance: result.wallet.balance,
        frozen_balance: result.wallet.frozen_balance,
        available_balance: result.wallet.available_balance
      } : null);

      // Reset form
      setWalletOperation({
        user_id: selectedUserForWallet.id,
        operation: 'ADD_MONEY',
        amount: 0,
        description: ''
      });

      // Refresh wallet transactions
      fetchWalletTransactions(selectedUserForWallet.id);

      toast.success(`${operation.replace('_', ' ').toLowerCase()} completed successfully!`);

    } catch (error) {
      console.error("Wallet operation error:", error);
      toast.error(error instanceof Error ? error.message : "Wallet operation failed");
    } finally {
      setWalletLoading(false);
    }
  };

  // Fetch wallet transactions
  const fetchWalletTransactions = async (userId: number) => {
    if (!session) return;

    try {
      const response = await fetch(`/api/admin/wallet?user_id=${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch wallet transactions");

      const data = await response.json();
      setWalletTransactions(data.recent_transactions || []);

    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      setWalletTransactions([]);
    }
  };

  // Open wallet management dialog
  const handleOpenWalletDialog = (user: User) => {
    setSelectedUserForWallet(user);
    setWalletOperation({
      user_id: user.id,
      operation: 'ADD_MONEY',
      amount: 0,
      description: ''
    });
    setWalletDialogOpen(true);
    fetchWalletTransactions(user.id);
  };

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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error fetching activity log";
      toast.error(errorMessage);
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
    totalBalance: users.reduce((sum, u) => sum + (u.balance || 0), 0),
    totalFrozen: users.reduce((sum, u) => sum + (u.frozen_balance || 0), 0),
  }), [users]);

  // Debounced Search
  const debouncedSetSearchQuery = debounce((value: string) => setSearchQuery(value), 300);

  const filteredUsers = useMemo(() => {
    let result = [...users];
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
          if (key === "balance") return `$${user.balance?.toFixed(2) || '0.00'}`;
          if (key === "available_balance") return `$${user.available_balance?.toFixed(2) || '0.00'}`;
          return user[key as keyof User] || "";
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users_with_wallets.csv";
    a.click();
  };

  // Table Columns with Wallet Info
  const columns: GridColDef[] = [
    ...(visibleColumns.id ? [{ field: "id", headerName: "ID", width: 70, sortable: true }] : []),
    ...(visibleColumns.name ? [{ field: "name", headerName: "Name", width: 130, sortable: true }] : []),
    ...(visibleColumns.email ? [{ field: "email", headerName: "Email", width: 200, sortable: true }] : []),
    ...(visibleColumns.role ? [{ field: "role", headerName: "Role", width: 100, sortable: true }] : []),
    ...(visibleColumns.balance ? [{
      field: "balance",
      headerName: "Balance",
      width: 120,
      sortable: true,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Chip
          label={`$${params.row.balance?.toFixed(2) || '0.00'}`}
          color={Number(params.row.balance) > 0 ? "success" : "default"}
          size="small"
        />
      ),
    }] : []),
    ...(visibleColumns.available_balance ? [{
      field: "available_balance",
      headerName: "Available",
      width: 120,
      sortable: true,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Chip
          label={`$${params.row.available_balance?.toFixed(2) || '0.00'}`}
          color={Number(params.row.available_balance) > 0 ? "primary" : "default"}
          size="small"
        />
      ),
    }] : []),
    ...(visibleColumns.registeredAt
      ? [
        {
          field: "registeredAt",
          headerName: "Registered At",
          width: 180,
          sortable: true,
          renderCell: (params: GridRenderCellParams<User>) => (
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
          renderCell: (params: GridRenderCellParams<User>) => (
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
      width: 280,
      sortable: false,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleEditUser(params.row)}
            disabled={rowLoading[Number(params.id)] || actionLoading}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenWalletDialog(params.row)}
            disabled={rowLoading[Number(params.id)] || actionLoading}
            startIcon={<AccountBalanceWalletIcon />}
            sx={{
              borderColor: "#96ff9b",
              color: "#96ff9b",
              "&:hover": {
                borderColor: "#96ff9b",
                backgroundColor: "rgba(150, 255, 155, 0.1)"
              }
            }}
          >
            Wallet
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleViewActivityLog(params.row)}
            disabled={rowLoading[Number(params.id)] || actionLoading}
          >
            <VisibilityIcon />
          </Button>
          <IconButton
            color="error"
            onClick={() => handleDeleteUser(params.id as number)}
            disabled={rowLoading[Number(params.id)] || actionLoading}
            size="small"
          >
            {rowLoading[Number(params.id)] ? <CircularProgress size={16} /> : <DeleteIcon />}
          </IconButton>
        </Box>
      ),
    },
  ];

  // Rest of your existing functions (handleEditUser, handleSaveUser, etc.)
  // I'll include the key ones and you can keep your existing implementations

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

  const handleViewActivityLog = (user: User) => {
    setActivityLogUser(user);
    fetchActivityLog(user.id);
  };

  const handleDeleteUser = async (userId: number) => {
    // Your existing delete logic
  };

  const handleSaveUser = async () => {
    // Your existing save logic
  };

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

      <AdminSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
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
              Admin - Users & Wallets
            </Typography>

            {/* Enhanced Stats Dashboard with Wallet Info */}
            <motion.div variants={itemVariants}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={2.4}>
                  <Card sx={{ bgcolor: "grey.800", border: "1px solid rgba(150, 255, 155, 0.2)" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: "#96ff9b" }}>Total Users</Typography>
                      <Typography variant="h4" color="text.primary">{stats.total}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={2.4}>
                  <Card sx={{ bgcolor: "grey.800", border: "1px solid rgba(150, 255, 155, 0.2)" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: "#96ff9b" }}>Active</Typography>
                      <Typography variant="h4" color="text.primary">{stats.active}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={2.4}>
                  <Card sx={{ bgcolor: "grey.800", border: "1px solid rgba(150, 255, 155, 0.2)" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: "#96ff9b" }}>Admins</Typography>
                      <Typography variant="h4" color="text.primary">{stats.admins}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={2.4}>
                  <Card sx={{ bgcolor: "grey.800", border: "1px solid rgba(150, 255, 155, 0.2)" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: "#96ff9b" }}>Total Balance</Typography>
                      <Typography variant="h4" color="text.primary">${stats.totalBalance.toFixed(2)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={2.4}>
                  <Card sx={{ bgcolor: "grey.800", border: "1px solid rgba(150, 255, 155, 0.2)" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: "#96ff9b" }}>Frozen</Typography>
                      <Typography variant="h4" color="text.primary">${stats.totalFrozen.toFixed(2)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </motion.div>

            {/* Your existing controls and filters */}
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

              {/* Enhanced Column Visibility Toggle */}
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
                      label={col.charAt(0).toUpperCase() + col.slice(1).replace('_', ' ')}
                      sx={{ color: "text.secondary" }}
                    />
                  ))}
                </Box>
              </motion.div>

              {/* Your existing filters */}

              {/* Enhanced DataGrid */}
              <motion.div variants={itemVariants}>
                <Box sx={{ height: 600, width: "100%", overflow: "auto" }}>
                  <DataGrid
                    rows={filteredUsers}
                    columns={columns}
                    paginationModel={paginationModel}
                    onPaginationModelChange={(newModel) => {
                      setPaginationModel(newModel);
                      setSelected([]);
                    }}
                    pageSizeOptions={[5, 10, 25, 50]}
                    checkboxSelection
                    onRowSelectionModelChange={(newSelection) => {
                      const selectedIds = newSelection.map((id) => Number(id));
                      setSelected(selectedIds);
                    }}
                    disableRowSelectionOnClick
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
            </motion.div>
          </Paper>
        </motion.div>
      </Container>

      {/* Wallet Management Dialog */}
      <Dialog
        open={walletDialogOpen}
        onClose={() => setWalletDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "grey.900",
            backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
            borderRadius: 2,
            boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)",
          }
        }}
      >
        <DialogTitle>
          Wallet Management - {selectedUserForWallet?.name}
          <Typography variant="body2" color="text.secondary">
            Balance: ${selectedUserForWallet?.balance?.toFixed(2) || '0.00'} |
            Available: ${selectedUserForWallet?.available_balance?.toFixed(2) || '0.00'} |
            Frozen: ${selectedUserForWallet?.frozen_balance?.toFixed(2) || '0.00'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Wallet Operations */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Wallet Operations</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Select
                  value={walletOperation.operation}
                  onChange={(e) => setWalletOperation(prev => ({
                    ...prev,
                    operation: e.target.value as WalletOperationData['operation']
                  }))}
                  fullWidth
                >
                  <MenuItem value="ADD_MONEY">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon color="success" />
                      Add Money
                    </Box>
                  </MenuItem>
                  <MenuItem value="DEDUCT_MONEY">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RemoveIcon color="error" />
                      Deduct Money
                    </Box>
                  </MenuItem>
                  <MenuItem value="FREEZE_FUNDS">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LockIcon color="warning" />
                      Freeze Funds
                    </Box>
                  </MenuItem>
                  <MenuItem value="UNFREEZE_FUNDS">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LockOpenIcon color="info" />
                      Unfreeze Funds
                    </Box>
                  </MenuItem>
                </Select>

                <TextField
                  label="Amount ($)"
                  type="number"
                  value={walletOperation.amount}
                  onChange={(e) => setWalletOperation(prev => ({
                    ...prev,
                    amount: Number(e.target.value)
                  }))}
                  fullWidth
                  inputProps={{ min: 0, step: 0.01 }}
                />

                <TextField
                  label="Description (Optional)"
                  value={walletOperation.description}
                  onChange={(e) => setWalletOperation(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  fullWidth
                  multiline
                  rows={2}
                />

                <Button
                  variant="contained"
                  onClick={handleWalletOperation}
                  disabled={walletLoading || walletOperation.amount <= 0}
                  startIcon={walletLoading ? <CircularProgress size={20} /> : <AccountBalanceWalletIcon />}
                  sx={{
                    bgcolor: "#96ff9b",
                    color: "grey.900",
                    "&:hover": { bgcolor: "rgba(150, 255, 155, 0.8)" }
                  }}
                >
                  {walletLoading ? 'Processing...' : walletOperation.operation.replace('_', ' ')}
                </Button>
              </Box>
            </Grid>

            {/* Transaction History */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Recent Transactions</Typography>
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {walletTransactions.length > 0 ? (
                  <List>
                    {walletTransactions.map((transaction) => (
                      <ListItem key={transaction.id} sx={{ bgcolor: 'grey.800', mb: 1, borderRadius: 1 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2">
                                {transaction.type.replace('_', ' ')}
                                {transaction.performed_by_admin && (
                                  <Chip label="Admin" size="small" color="warning" sx={{ ml: 1 }} />
                                )}
                              </Typography>
                              <Typography
                                variant="body2"
                                color={transaction.amount >= 0 ? 'success.main' : 'error.main'}
                                fontWeight="bold"
                              >
                                ${transaction.amount >= 0 ? '+' : ''}${transaction.amount.toFixed(2)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {transaction.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Balance: ${transaction.balance_before.toFixed(2)} → ${transaction.balance_after.toFixed(2)}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                {new Date(transaction.created_at).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography color="text.secondary" textAlign="center">
                    No transactions found
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWalletDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Your existing dialogs (Edit User, Activity Log, Confirmation) */}
      {/* Edit/Add User Dialog */}
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
                sx={{ mb: 2 }}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
              />
              <TextField
                label="Email"
                fullWidth
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                sx={{ mb: 2 }}
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
                  sx={{ mb: 2 }}
                  error={!!validationErrors.password}
                  helperText={validationErrors.password}
                />
              )}
              <Select
                fullWidth
                value={editUser.role}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                sx={{ mb: 2 }}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
              <Select
                fullWidth
                value={editUser.subscriptionStatus}
                onChange={(e) => setEditUser({ ...editUser, subscriptionStatus: e.target.value })}
                sx={{ mb: 2 }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>

              {/* Initial Balance for new users */}
              {editUser.id === 0 && (
                <TextField
                  label="Initial Balance ($)"
                  type="number"
                  fullWidth
                  value={editUser.balance || 0}
                  onChange={(e) => setEditUser({ ...editUser, balance: Number(e.target.value) })}
                  sx={{ mb: 2 }}
                  inputProps={{ min: 0, step: 0.01 }}
                  helperText="Optional: Set initial wallet balance"
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
            onClick={handleSaveUser}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activity Log Dialog */}
      <Dialog open={!!activityLogUser} onClose={() => setActivityLogUser(null)}>
        <DialogTitle>{`Activity Log for ${activityLogUser?.name || "User"}`}</DialogTitle>
        <DialogContent>
          {activityLogLoading ? (
            <CircularProgress />
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
          <Button onClick={() => setActivityLogUser(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to {confirmAction?.action}?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} disabled={actionLoading}>
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
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}