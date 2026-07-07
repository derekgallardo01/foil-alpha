// src/app/admin/users/activity/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRequireAuth } from "../../../lib/useRequireAuth";
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
    Chip,
    IconButton,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Avatar,
    Tooltip,
} from "@mui/material";
import Grid from '@mui/material/Grid2';
import {
    Refresh as RefreshIcon,
    Login as LoginIcon,
    PersonAdd as RegisterIcon,
    ShoppingCart as PurchaseIcon,
    Gavel as BidIcon,
    AccountBalanceWallet as WalletIcon,
    FilterList as FilterIcon,
    History as HistoryIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { toast } from "react-toastify";
import AppShell from "../../../components/AppShell";
import PageHeader from "../../../components/ui/PageHeader";
import StatCard from "../../../components/StatCard";
import EmptyState from "../../../components/ui/EmptyState";
import ErrorState from "../../../components/ui/ErrorState";
import { StatRowSkeleton } from "../../../components/ui/Skeletons";
import { hideBelowMd } from "../../../lib/responsive";

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
    const { session, status } = useRequireAuth({ admin: true });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
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
        if (status === "authenticated" && session?.user?.role === "admin") {
            fetchActivities();
        }
    }, [status, session]);

    const fetchActivities = async () => {
        try {
            setLoading(true);
            setError(false);

            // Build query params
            const params = new URLSearchParams();
            if (filters.userId) params.append("userId", filters.userId);
            if (filters.action !== "all") params.append("action", filters.action);
            if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
            if (filters.dateTo) params.append("dateTo", filters.dateTo);

            const response = await fetch(`/api/admin/users/activity?${params}`, {
                headers: {
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
            setError(true);
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

    if (loading && activities.length === 0) {
        return (
            <AppShell variant="admin">
                <PageHeader title="User Activity" icon={<HistoryIcon />} />
                <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                    <StatRowSkeleton count={4} />
                </Container>
            </AppShell>
        );
    }

    return (
        <AppShell variant="admin">
            <PageHeader
                title="User Activity"
                icon={<HistoryIcon />}
                actions={
                    <IconButton onClick={fetchActivities} sx={{ color: 'primary.main' }}>
                        <RefreshIcon />
                    </IconButton>
                }
            />

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                {/* Error */}
                {error && (
                    <Box sx={{ mb: 3 }}>
                        <ErrorState
                            variant="inline"
                            message="Couldn't load activity."
                            onRetry={fetchActivities}
                        />
                    </Box>
                )}

                {/* Stats Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                            label="Total Activities"
                            value={stats.totalActivities.toLocaleString()}
                            accent
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                            label="Today's Activities"
                            value={stats.todayActivities.toLocaleString()}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                            label="Active Users"
                            value={stats.activeUsers.toLocaleString()}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard
                            label="Most Active User"
                            value={
                                stats.mostActiveUser
                                    ? `${stats.mostActiveUser.name} (${stats.mostActiveUser.activityCount})`
                                    : 'N/A'
                            }
                        />
                    </Grid>
                </Grid>

                {/* Filters */}
                <Paper variant="outlined" sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 2 }}>
                            <TextField
                                fullWidth
                                label="User ID"
                                value={filters.userId}
                                onChange={(e) => handleFilterChange('userId', e.target.value)}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 2 }}>
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
                        <Grid size={{ xs: 12, md: 3 }}>
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
                        <Grid size={{ xs: 12, md: 3 }}>
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
                        <Grid size={{ xs: 12, md: 2 }}>
                            <IconButton
                                onClick={handleApplyFilters}
                                sx={{
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    '&:hover': { bgcolor: 'primary.dark' }
                                }}
                            >
                                <FilterIcon />
                            </IconButton>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Activity Table */}
                {activities.length > 0 ? (
                <Paper variant="outlined" sx={{ border: 1, borderColor: 'divider' }}>
                    <TableContainer sx={{ bgcolor: 'background.default' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>User</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>Action</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', ...hideBelowMd }}>Timestamp</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', ...hideBelowMd }}>Details</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {activities.map((activity) => (
                                    <TableRow key={activity.id}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
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
                                        <TableCell sx={hideBelowMd}>
                                            <Typography variant="mono" color="text.secondary">
                                                {format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={hideBelowMd}>
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
                ) : !error ? (
                    <EmptyState icon={<HistoryIcon />} title="No activity found" />
                ) : null}
            </Container>
        </AppShell>
    );
}