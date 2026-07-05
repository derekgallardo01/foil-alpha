// src/app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Grid,
    Card,
    CardContent,
    Typography,
    IconButton,
    CircularProgress,
    Button,
    List,
    ListItem,
    ListItemText,
    Chip,
    Paper,
    Avatar,
} from "@mui/material";
import {
    Menu as MenuIcon,
    TrendingUp,
    People,
    Store,
    Gavel,
    Assessment,
    ArrowUpward,
    ArrowDownward,
    Refresh,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import Image from "next/image";
import AdminSidebar from "../../components/AdminSidebar";

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

interface DashboardStats {
    totalUsers: number;
    activeUsers: number;
    totalCards: number;
    activeListings: number;
    activeAuctions: number;
    totalSales: number;
    monthlyRevenue: number;
    pendingTransactions: number;
}

interface RecentActivity {
    id: string;
    type: 'user_registered' | 'card_sold' | 'auction_ended' | 'wallet_deposit';
    description: string;
    user: string;
    amount?: number;
    timestamp: string;
}

export default function AdminDashboard() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        activeUsers: 0,
        totalCards: 0,
        activeListings: 0,
        activeAuctions: 0,
        totalSales: 0,
        monthlyRevenue: 0,
        pendingTransactions: 0,
    });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Redirect if not admin
    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "admin") {
            router.push("/unauthorized");
        }
    }, [status, session, router]);

    // Fetch dashboard data
    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch users data
            const usersResponse = await fetch("/api/admin/users", {
                headers: {
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
            });

            if (!usersResponse.ok) throw new Error("Failed to fetch users");
            const users = await usersResponse.json();

            // Fetch cards data with all=true to get total count
            const cardsResponse = await fetch("/api/admin/cards?all=true", {
                headers: {
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
            });

            let totalCardsCount = 0;
            let activeListingsCount = 0;

            if (cardsResponse.ok) {
                const cardsData = await cardsResponse.json();
                totalCardsCount = cardsData.pagination?.total || 0;

                // Calculate active listings from the actual cards data
                activeListingsCount = cardsData.cards?.filter((card: any) =>
                    card.userCards?.some((uc: any) => uc.is_for_sale && !uc.is_sold)
                ).length || 0;
            }

            // Fetch auctions data
            let activeAuctionsCount = 0;
            try {
                const auctionsResponse = await fetch("/api/admin/auctions?status=active", {
                    headers: {
                        "Authorization": `Bearer ${session?.accessToken}`,
                    },
                });

                if (auctionsResponse.ok) {
                    const auctionsData = await auctionsResponse.json();
                    activeAuctionsCount = auctionsData.total || 0;
                }
            } catch (auctionError) {
                console.warn("Could not fetch auctions data:", auctionError);
            }

            // Fetch transactions data
            let totalSalesCount = 0;
            let pendingTransactionsCount = 0;
            let monthlyRevenueAmount = 0;

            try {
                // Get all transactions to calculate stats
                const transactionsResponse = await fetch("/api/admin/transactions?limit=1000", {
                    headers: {
                        "Authorization": `Bearer ${session?.accessToken}`,
                    },
                });

                if (transactionsResponse.ok) {
                    const transactionsData = await transactionsResponse.json();
                    const transactions = transactionsData.transactions || [];

                    // Calculate stats from actual transaction data
                    totalSalesCount = transactions.filter((t: any) => t.status === 'COMPLETED').length;
                    pendingTransactionsCount = transactions.filter((t: any) =>
                        ['PENDING_BUYER_CONFIRMATION', 'PENDING_SELLER_CONFIRMATION'].includes(t.status)
                    ).length;

                    // Calculate monthly revenue from completed transactions this month
                    const now = new Date();
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    monthlyRevenueAmount = transactions
                        .filter((t: any) =>
                            t.status === 'COMPLETED' &&
                            new Date(t.created_at) >= startOfMonth
                        )
                        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
                }
            } catch (transactionError) {
                console.warn("Could not fetch transactions data:", transactionError);
            }

            // Generate recent activity from actual data
            const recentActivities: RecentActivity[] = [];

            // Add recent user registrations
            const recentUsers = users
                .sort((a: any, b: any) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
                .slice(0, 3);

            recentUsers.forEach((user: any, index: number) => {
                recentActivities.push({
                    id: `user-${user.id}`,
                    type: 'user_registered',
                    description: 'New user registration',
                    user: user.name,
                    timestamp: user.registeredAt,
                });
            });

            // Add recent transactions if available
            try {
                const recentTransResponse = await fetch("/api/admin/transactions?limit=5", {
                    headers: {
                        "Authorization": `Bearer ${session?.accessToken}`,
                    },
                });

                if (recentTransResponse.ok) {
                    const recentTransData = await recentTransResponse.json();
                    const recentTrans = recentTransData.transactions || [];

                    recentTrans.forEach((trans: any) => {
                        if (trans.status === 'COMPLETED' && trans.transaction_type === 'AUCTION') {
                            recentActivities.push({
                                id: `trans-${trans.id}`,
                                type: 'auction_ended',
                                description: 'Auction completed successfully',
                                user: trans.buyer?.name || 'Unknown',
                                amount: parseFloat(trans.amount),
                                timestamp: trans.created_at,
                            });
                        } else if (trans.status === 'COMPLETED') {
                            recentActivities.push({
                                id: `trans-${trans.id}`,
                                type: 'card_sold',
                                description: 'Card sold via fixed price',
                                user: trans.buyer?.name || 'Unknown',
                                amount: parseFloat(trans.amount),
                                timestamp: trans.created_at,
                            });
                        }
                    });
                }
            } catch (error) {
                console.warn("Could not fetch recent transactions for activity:", error);
            }

            // Sort activities by timestamp
            recentActivities.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            // Update stats with actual data
            const newStats: DashboardStats = {
                totalUsers: users.length,
                activeUsers: users.filter((u: any) => u.subscriptionStatus === 'active').length,
                totalCards: totalCardsCount,
                activeListings: activeListingsCount,
                activeAuctions: activeAuctionsCount,
                totalSales: totalSalesCount,
                monthlyRevenue: monthlyRevenueAmount,
                pendingTransactions: pendingTransactionsCount,
            };

            setStats(newStats);
            setRecentActivity(recentActivities.slice(0, 10)); // Show only 10 most recent

            console.log("📊 Dashboard Stats Updated with Actual Data:", newStats);
            toast.success("Dashboard data loaded!");

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role === "admin") {
            fetchDashboardData();
        }
    }, [status, session]);

    // Updated stat cards with proper formatting
    const statCards = [
        {
            title: "Total Users",
            value: stats.totalUsers.toLocaleString(),
            icon: <People sx={{ fontSize: 40, color: '#9B5Cff' }} />,
            change: "+12%",
            changeType: "up" as const,
            link: "/admin/users"
        },
        {
            title: "Active Users",
            value: stats.activeUsers.toLocaleString(),
            icon: <People sx={{ fontSize: 40, color: '#9B5Cff' }} />,
            change: "+8%",
            changeType: "up" as const,
            link: "/admin/users"
        },
        {
            title: "Total Cards",
            value: stats.totalCards.toLocaleString(), // *** FIXED: Now shows actual count ***
            icon: <Store sx={{ fontSize: 40, color: '#9B5Cff' }} />,
            change: "+25%",
            changeType: "up" as const,
            link: "/admin/cards"
        },
        {
            title: "Active Auctions",
            value: stats.activeAuctions.toLocaleString(),
            icon: <Gavel sx={{ fontSize: 40, color: '#9B5Cff' }} />,
            change: "-5%",
            changeType: "down" as const,
            link: "/admin/auctions"
        },
        {
            title: "Total Sales",
            value: stats.totalSales.toLocaleString(),
            icon: <TrendingUp sx={{ fontSize: 40, color: '#9B5Cff' }} />,
            change: "+18%",
            changeType: "up" as const,
            link: "/admin/transactions"
        },
        {
            title: "Active Listings",
            value: stats.activeListings.toLocaleString(),
            icon: <Store sx={{ fontSize: 40, color: '#9B5Cff' }} />,
            change: "+10%",
            changeType: "up" as const,
            link: "/admin/listings"
        },
    ];

    const getActivityIcon = (type: RecentActivity['type']) => {
        const iconProps = { sx: { color: '#9B5Cff' } };
        switch (type) {
            case 'user_registered': return <People {...iconProps} />;
            case 'card_sold': return <Store {...iconProps} />;
            case 'auction_ended': return <Gavel {...iconProps} />;
            default: return <Assessment {...iconProps} />;
        }
    };

    const getActivityColor = (type: RecentActivity['type']) => {
        switch (type) {
            case 'user_registered': return 'primary';
            case 'card_sold': return 'info';
            case 'auction_ended': return 'warning';
            default: return 'default';
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                bgcolor: "grey.900",
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
            <AdminSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: '1px solid rgba(155, 92, 255, 0.2)' }}>
                <IconButton onClick={toggleSidebar} sx={{ color: '#9B5Cff' }}>
                    <MenuIcon />
                </IconButton>
                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="Foil Alpha" width={40} height={20} />
                    <Typography variant="h5" sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>
                        Admin Dashboard
                    </Typography>
                </Box>
                <Box sx={{ ml: 'auto' }}>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={fetchDashboardData}
                        sx={{
                            borderColor: '#9B5Cff',
                            color: '#9B5Cff',
                            '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                        }}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <motion.div initial="hidden" animate="visible" variants={containerVariants}>
                    {/* Stats Cards */}
                    <motion.div variants={itemVariants}>
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            {statCards.map((stat, index) => (
                                <Grid item xs={12} sm={6} md={4} lg={2} key={index}>
                                    <Card
                                        sx={{
                                            bgcolor: 'grey.800',
                                            border: '1px solid rgba(155, 92, 255, 0.2)',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s',
                                            '&:hover': { transform: 'translateY(-2px)' }
                                        }}
                                        onClick={() => router.push(stat.link)}
                                    >
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                {stat.icon}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    {stat.changeType === 'up' && <ArrowUpward sx={{ fontSize: 16, color: 'success.main' }} />}
                                                    {stat.changeType === 'down' && <ArrowDownward sx={{ fontSize: 16, color: 'error.main' }} />}
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: stat.changeType === 'up' ? 'success.main' :
                                                                stat.changeType === 'down' ? 'error.main' : 'text.secondary'
                                                        }}
                                                    >
                                                        {stat.change}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                {stat.value}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9B5Cff' }}>
                                                {stat.title}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </motion.div>

                    {/* Main Content Grid */}
                    <Grid container spacing={3}>
                        {/* Recent Activity */}
                        <Grid item xs={12} md={6}>
                            <motion.div variants={itemVariants}>
                                <Paper
                                    sx={{
                                        p: 3,
                                        bgcolor: 'grey.800',
                                        border: '1px solid rgba(155, 92, 255, 0.2)',
                                        height: '400px'
                                    }}
                                >
                                    <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2 }}>
                                        Recent Activity
                                    </Typography>
                                    <List sx={{ maxHeight: '300px', overflow: 'auto' }}>
                                        {recentActivity.map((activity) => (
                                            <ListItem key={activity.id} sx={{ px: 0 }}>
                                                <Avatar sx={{ bgcolor: 'rgba(155, 92, 255, 0.1)', mr: 2 }}>
                                                    {getActivityIcon(activity.type)}
                                                </Avatar>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Typography variant="body2" color="text.primary">
                                                                {activity.description}
                                                            </Typography>
                                                            <Chip
                                                                label={activity.type.replace('_', ' ')}
                                                                size="small"
                                                                color={getActivityColor(activity.type) as any}
                                                            />
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">
                                                                User: {activity.user}
                                                            </Typography>
                                                            {activity.amount && (
                                                                <Typography variant="caption" color="success.main" sx={{ ml: 2 }}>
                                                                    ${activity.amount.toFixed(2)}
                                                                </Typography>
                                                            )}
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                {new Date(activity.timestamp).toLocaleString()}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Paper>
                            </motion.div>
                        </Grid>

                        {/* Quick Actions */}
                        <Grid item xs={12} md={6}>
                            <motion.div variants={itemVariants}>
                                <Paper
                                    sx={{
                                        p: 3,
                                        bgcolor: 'grey.800',
                                        border: '1px solid rgba(155, 92, 255, 0.2)',
                                        height: '400px'
                                    }}
                                >
                                    <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2 }}>
                                        Quick Actions
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<People />}
                                                onClick={() => router.push('/admin/users')}
                                                sx={{
                                                    borderColor: '#9B5Cff',
                                                    color: '#9B5Cff',
                                                    '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                                                }}
                                            >
                                                Manage Users
                                            </Button>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<Store />}
                                                onClick={() => router.push('/admin/cards')}
                                                sx={{
                                                    borderColor: '#9B5Cff',
                                                    color: '#9B5Cff',
                                                    '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                                                }}
                                            >
                                                Manage Cards
                                            </Button>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<Gavel />}
                                                onClick={() => router.push('/admin/auctions')}
                                                sx={{
                                                    borderColor: '#9B5Cff',
                                                    color: '#9B5Cff',
                                                    '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                                                }}
                                            >
                                                Manage Auctions
                                            </Button>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<TrendingUp />}
                                                onClick={() => router.push('/admin/transactions')}
                                                sx={{
                                                    borderColor: '#9B5Cff',
                                                    color: '#9B5Cff',
                                                    '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                                                }}
                                            >
                                                View Transactions
                                            </Button>
                                        </Grid>
                                        {/* <Grid item xs={12}>
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={<Assessment />}
                                                onClick={() => router.push('/admin/analytics/dashboard')}
                                                sx={{
                                                    bgcolor: '#9B5Cff',
                                                    color: 'grey.900',
                                                    '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                                                }}
                                            >
                                                View Analytics
                                            </Button>
                                        </Grid> */}
                                    </Grid>
                                </Paper>
                            </motion.div>
                        </Grid>

                        {/* System Status
                        <Grid item xs={12}>
                            <motion.div variants={itemVariants}>
                                <Paper
                                    sx={{
                                        p: 3,
                                        bgcolor: 'grey.800',
                                        border: '1px solid rgba(155, 92, 255, 0.2)'
                                    }}
                                >
                                    <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2 }}>
                                        System Status
                                    </Typography>
                                    <Grid container spacing={3}>
                                        <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'success.main' }}>
                                                    ●
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    Database
                                                </Typography>
                                                <Typography variant="caption" color="success.main">
                                                    Online
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'success.main' }}>
                                                    ●
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    API Services
                                                </Typography>
                                                <Typography variant="caption" color="success.main">
                                                    Operational
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'success.main' }}>
                                                    ●
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    Marketplace
                                                </Typography>
                                                <Typography variant="caption" color="success.main">
                                                    Active
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'warning.main' }}>
                                                    ●
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    Email Service
                                                </Typography>
                                                <Typography variant="caption" color="warning.main">
                                                    Pending
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </motion.div>
                        </Grid> */}
                    </Grid>
                </motion.div>
            </Container>
        </Box>
    );
}