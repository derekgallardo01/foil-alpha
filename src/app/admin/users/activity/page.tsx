// src/app/admin/users/activity/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Chip,
    IconButton,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Card,
    CardContent,
    Avatar,
    Tooltip,
} from "@mui/material";
import {
    Refresh as RefreshIcon,
    Login as LoginIcon,
    PersonAdd as RegisterIcon,
    ShoppingCart as PurchaseIcon,
    Gavel as BidIcon,
    AccountBalanceWallet as WalletIcon,
    FilterList as FilterIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { toast } from "react-toastify";
import AppShell from "../../../components/AppShell";

interface ActivityLog {
    id: number;
    userId: number;
    action: string;
    timestamp: string;
    user?: {
        id: number;
        name: string;
        email: string;
    };
    details?: any;
}

interface ActivityStats {
    totalActivities: number;
    todayActivities: number;
    activeUsers: number;
    mostActiveUser: {
        name: string;
        activityCount: number;
    } | null;
}

const actionIcons: Record<string, React.ReactElement> = {
    LOGIN: <LoginIcon />,
    REGISTER: <RegisterIcon />,
    PURCHASE: <PurchaseIcon />,
    BID_PLACED: <BidIcon />,
    WALLET_DEPOSIT: <WalletIcon />,
};

const actionColors: Record<string, "primary" | "secondary" | "error" | "warning" | "info" | "success"> = {
    LOGIN: "primary",
    REGISTER: "success",
    PURCHASE: "info",
    BID_PLACED: "warning",
    WALLET_DEPOSIT: "secondary",
};

export default function UserActivityPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(true);
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [stats, setStats] = useState<ActivityStats>({
        totalActivities: 0,
        todayActivities: 0,
        activeUsers: 0,
        mostActiveUser: null,
    });
    const [filters, setFilters] = useState({
        userId: "",
        action: "all",
        dateFrom: "",
        dateTo: "",
    });

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "admin") {
            router.push("/unauthorized");
        } else if (status === "authenticated") {
            fetchActivities();
        }
    }, [status, session, router]);

    const fetchActivities = async () => {
        try {
            setLoading(true);

            // Build query params
            const params = new URLSearchParams();
            if (filters.userId) params.append("userId", filters.userId);
            if (filters.action !== "all") params.append("action", filters.action);
            if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
            if (filters.dateTo) params.append("dateTo", filters.dateTo);

            const response = await fetch(`/api/admin/users/activity?${params}`, {
                headers: {
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
            });

            if (!response.ok) throw new Error("Failed to fetch activities");

            const data = await response.json();
            setActivities(data.activities || []);
            setStats(data.stats || {
                totalActivities: 0,
                todayActivities: 0,
                activeUsers: 0,
                mostActiveUser: null,
            });

        } catch (error) {
            console.error("Error fetching activities:", error);
            toast.error("Failed to fetch user activities");
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleApplyFilters = () => {
        fetchActivities();
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <AppShell variant="admin">
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: '1px solid rgba(155, 92, 255, 0.2)' }}>
                <Typography variant="h5" sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>
                    User Activity
                </Typography>
                <Box sx={{ ml: 'auto' }}>
                    <IconButton onClick={fetchActivities} sx={{ color: '#9B5Cff' }}>
                        <RefreshIcon />
                    </IconButton>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                {/* Stats Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Total Activities
                                </Typography>
                                <Typography variant="h4" sx={{ color: '#9B5Cff' }}>
                                    {stats.totalActivities.toLocaleString()}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Today's Activities
                                </Typography>
                                <Typography variant="h4" sx={{ color: '#9B5Cff' }}>
                                    {stats.todayActivities.toLocaleString()}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Active Users
                                </Typography>
                                <Typography variant="h4" sx={{ color: '#9B5Cff' }}>
                                    {stats.activeUsers.toLocaleString()}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Most Active User
                                </Typography>
                                <Typography variant="h6" sx={{ color: '#9B5Cff' }}>
                                    {stats.mostActiveUser?.name || 'N/A'}
                                </Typography>
                                {stats.mostActiveUser && (
                                    <Typography variant="caption" color="text.secondary">
                                        {stats.mostActiveUser.activityCount} activities
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filters */}
                <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={2}>
                            <TextField
                                fullWidth
                                label="User ID"
                                value={filters.userId}
                                onChange={(e) => handleFilterChange('userId', e.target.value)}
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Action Type</InputLabel>
                                <Select
                                    value={filters.action}
                                    label="Action Type"
                                    onChange={(e) => handleFilterChange('action', e.target.value)}
                                >
                                    <MenuItem value="all">All Actions</MenuItem>
                                    <MenuItem value="LOGIN">Login</MenuItem>
                                    <MenuItem value="REGISTER">Register</MenuItem>
                                    <MenuItem value="PURCHASE">Purchase</MenuItem>
                                    <MenuItem value="BID_PLACED">Bid Placed</MenuItem>
                                    <MenuItem value="WALLET_DEPOSIT">Wallet Deposit</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Date From"
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Date To"
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <IconButton
                                onClick={handleApplyFilters}
                                sx={{
                                    bgcolor: '#9B5Cff',
                                    color: 'grey.900',
                                    '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                                }}
                            >
                                <FilterIcon />
                            </IconButton>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Activity Table */}
                <Paper sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ color: '#9B5Cff' }}>User</TableCell>
                                    <TableCell sx={{ color: '#9B5Cff' }}>Action</TableCell>
                                    <TableCell sx={{ color: '#9B5Cff' }}>Timestamp</TableCell>
                                    <TableCell sx={{ color: '#9B5Cff' }}>Details</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {activities.map((activity) => (
                                    <TableRow key={activity.id}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ width: 32, height: 32, bgcolor: '#9B5Cff', color: 'grey.900' }}>
                                                    {activity.user?.name?.charAt(0).toUpperCase() || '?'}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2">
                                                        {activity.user?.name || `User ${activity.userId}`}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {activity.user?.email || ''}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                icon={actionIcons[activity.action] || <></>}
                                                label={activity.action.replace('_', ' ')}
                                                color={actionColors[activity.action] || 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                                        </TableCell>
                                        <TableCell>
                                            {activity.details && (
                                                <Tooltip title={JSON.stringify(activity.details, null, 2)}>
                                                    <Typography variant="caption" sx={{ cursor: 'pointer' }}>
                                                        View Details
                                                    </Typography>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Container>
        </AppShell>
    );
}