// src/app/admin/commission/reports/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Card,
    CardContent,
    Typography,
    Grid,
    IconButton,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
} from "@mui/material";
import {
    Menu as MenuIcon,
    Assessment,
    TrendingUp,
    PieChart,
    BarChart,
    Download,
    DateRange,
    Refresh,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import AdminSidebar from "../../../components/AdminSidebar";

interface ReportData {
    commission_by_rarity: Array<{
        rarity: string;
        total_commission: number;
        transaction_count: number;
        avg_commission_rate: number;
    }>;
    monthly_breakdown: Array<{
        month: string;
        commissions: number;
        marketplace_sales: number;
        total_revenue: number;
        transaction_count: number;
    }>;
    top_cards: Array<{
        card_name: string;
        total_commission: number;
        transaction_count: number;
        avg_price: number;
    }>;
    summary: {
        total_revenue: number;
        total_commissions: number;
        total_marketplace_sales: number;
        avg_commission_rate: number;
        total_transactions: number;
    };
}

export default function CommissionReports() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [dateRange, setDateRange] = useState("30"); // days
    const [reportType, setReportType] = useState("overview");

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Redirect if not admin
    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "admin") {
            router.push("/unauthorized");
        }
    }, [status, session, router]);

    // Fetch report data
    const fetchReportData = async () => {
        try {
            setLoading(true);

            const response = await fetch(`/api/admin/commission/reports?days=${dateRange}&type=${reportType}`);
            if (!response.ok) throw new Error("Failed to fetch report data");

            const data: ReportData = await response.json();
            setReportData(data);

            toast.success("Report data loaded!");
        } catch (error) {
            console.error("Error fetching report data:", error);
            toast.error("Failed to load report data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role === "admin") {
            fetchReportData();
        }
    }, [status, session, dateRange, reportType]);

    const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

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
                <Typography variant="h5" sx={{ ml: 2, color: '#9B5Cff', fontWeight: 'bold' }}>
                    Commission Reports & Analytics
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ color: '#9B5Cff' }}>Period</InputLabel>
                        <Select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            sx={{
                                color: '#9B5Cff',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(155, 92, 255, 0.2)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9B5Cff' },
                            }}
                        >
                            <MenuItem value="7">Last 7 days</MenuItem>
                            <MenuItem value="30">Last 30 days</MenuItem>
                            <MenuItem value="90">Last 3 months</MenuItem>
                            <MenuItem value="365">Last year</MenuItem>
                        </Select>
                    </FormControl>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={fetchReportData}
                        sx={{
                            borderColor: '#9B5Cff',
                            color: '#9B5Cff',
                            '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                        }}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Download />}
                        sx={{
                            bgcolor: '#9B5Cff',
                            color: 'grey.900',
                            '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                        }}
                    >
                        Export
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {reportData && (
                        <Grid container spacing={3}>
                            {/* Summary Cards */}
                            <Grid item xs={12}>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={2.4}>
                                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                                    {formatCurrency(reportData.summary.total_revenue)}
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    Total Revenue
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Last {dateRange} days
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} md={2.4}>
                                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'info.main', fontWeight: 'bold' }}>
                                                    {formatCurrency(reportData.summary.total_commissions)}
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    Commissions
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {((reportData.summary.total_commissions / reportData.summary.total_revenue) * 100).toFixed(1)}% of revenue
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} md={2.4}>
                                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                                                    {formatCurrency(reportData.summary.total_marketplace_sales)}
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    Marketplace Sales
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Direct platform sales
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} md={2.4}>
                                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>
                                                    {reportData.summary.avg_commission_rate.toFixed(1)}%
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    Avg Commission Rate
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Across all transactions
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} md={2.4}>
                                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                    {reportData.summary.total_transactions}
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    Transactions
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Commission-generating
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>
                            </Grid>

                            {/* Commission by Rarity */}
                            <Grid item xs={12} md={6}>
                                <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <PieChart />
                                            Commission by Card Rarity
                                        </Typography>
                                        <TableContainer component={Paper} sx={{ bgcolor: 'grey.700' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Rarity</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Commission</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Transactions</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Avg Rate</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {reportData.commission_by_rarity.map((item) => (
                                                        <TableRow key={item.rarity}>
                                                            <TableCell sx={{ color: 'text.primary' }}>
                                                                {item.rarity}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                                                {formatCurrency(item.total_commission)}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'text.secondary' }}>
                                                                {item.transaction_count}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'info.main' }}>
                                                                {item.avg_commission_rate.toFixed(1)}%
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Top Performing Cards */}
                            <Grid item xs={12} md={6}>
                                <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <BarChart />
                                            Top Revenue Generating Cards
                                        </Typography>
                                        <TableContainer component={Paper} sx={{ bgcolor: 'grey.700', maxHeight: 300 }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Card</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Commission</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Sales</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Avg Price</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {reportData.top_cards.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell sx={{ color: 'text.primary', maxWidth: 150 }}>
                                                                {item.card_name}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                                                {formatCurrency(item.total_commission)}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'text.secondary' }}>
                                                                {item.transaction_count}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'info.main' }}>
                                                                {formatCurrency(item.avg_price)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Monthly Breakdown */}
                            <Grid item xs={12}>
                                <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TrendingUp />
                                            Monthly Revenue Breakdown
                                        </Typography>
                                        <TableContainer component={Paper} sx={{ bgcolor: 'grey.700' }}>
                                            <Table>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Month</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Commissions</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Marketplace Sales</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Total Revenue</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Transactions</TableCell>
                                                        <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>Growth</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {reportData.monthly_breakdown.map((item, index) => {
                                                        const prevMonth = reportData.monthly_breakdown[index + 1];
                                                        const growth = prevMonth ?
                                                            ((item.total_revenue - prevMonth.total_revenue) / prevMonth.total_revenue * 100) : 0;

                                                        return (
                                                            <TableRow key={item.month}>
                                                                <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                                    {item.month}
                                                                </TableCell>
                                                                <TableCell sx={{ color: 'success.main' }}>
                                                                    {formatCurrency(item.commissions)}
                                                                </TableCell>
                                                                <TableCell sx={{ color: 'info.main' }}>
                                                                    {formatCurrency(item.marketplace_sales)}
                                                                </TableCell>
                                                                <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                                    {formatCurrency(item.total_revenue)}
                                                                </TableCell>
                                                                <TableCell sx={{ color: 'text.secondary' }}>
                                                                    {item.transaction_count}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {index < reportData.monthly_breakdown.length - 1 && (
                                                                        <Chip
                                                                            label={`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`}
                                                                            color={growth >= 0 ? 'success' : 'error'}
                                                                            size="small"
                                                                        />
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}
                </motion.div>
            </Container>
        </Box>
    );
}