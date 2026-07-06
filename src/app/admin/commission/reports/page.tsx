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
import AppShell from "../../../components/AppShell";

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
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [dateRange, setDateRange] = useState("30"); // days
    const [reportType, setReportType] = useState("overview");

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
        <AppShell variant="admin">
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 800,
                        background: (theme) => theme.foil.gradient,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}
                >
                    Commission Reports & Analytics
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Period</InputLabel>
                        <Select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
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
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Download />}
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
                                        <Card>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="mono" component="div" sx={{ fontSize: 30, color: 'success.main', fontWeight: 700 }}>
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
                                        <Card>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="mono" component="div" sx={{ fontSize: 30, color: 'success.main', fontWeight: 700 }}>
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
                                        <Card>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="mono" component="div" sx={{ fontSize: 30, color: 'success.main', fontWeight: 700 }}>
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
                                        <Card>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="mono" component="div" sx={{ fontSize: 30, color: 'text.primary', fontWeight: 700 }}>
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
                                        <Card>
                                            <CardContent sx={{ textAlign: 'center' }}>
                                                <Typography variant="mono" component="div" sx={{ fontSize: 30, color: 'text.primary', fontWeight: 700 }}>
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
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <PieChart />
                                            Commission by Card Rarity
                                        </Typography>
                                        <TableContainer component={Paper} sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Rarity</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Commission</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Transactions</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Avg Rate</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {reportData.commission_by_rarity.map((item) => (
                                                        <TableRow key={item.rarity}>
                                                            <TableCell sx={{ color: 'text.primary' }}>
                                                                {item.rarity}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                                                <Typography variant="mono" component="span">{formatCurrency(item.total_commission)}</Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'text.secondary' }}>
                                                                <Typography variant="mono" component="span">{item.transaction_count}</Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'info.main' }}>
                                                                <Typography variant="mono" component="span">{item.avg_commission_rate.toFixed(1)}%</Typography>
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
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <BarChart />
                                            Top Revenue Generating Cards
                                        </Typography>
                                        <TableContainer component={Paper} sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider', maxHeight: 300 }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Card</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Commission</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Sales</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Avg Price</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {reportData.top_cards.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell sx={{ color: 'text.primary', maxWidth: 150 }}>
                                                                {item.card_name}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                                                <Typography variant="mono" component="span">{formatCurrency(item.total_commission)}</Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'text.secondary' }}>
                                                                <Typography variant="mono" component="span">{item.transaction_count}</Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'info.main' }}>
                                                                <Typography variant="mono" component="span">{formatCurrency(item.avg_price)}</Typography>
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
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TrendingUp />
                                            Monthly Revenue Breakdown
                                        </Typography>
                                        <TableContainer component={Paper} sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                                            <Table>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Month</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Commissions</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Marketplace Sales</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Total Revenue</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Transactions</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Growth</TableCell>
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
                                                                    <Typography variant="mono" component="span">{formatCurrency(item.commissions)}</Typography>
                                                                </TableCell>
                                                                <TableCell sx={{ color: 'info.main' }}>
                                                                    <Typography variant="mono" component="span">{formatCurrency(item.marketplace_sales)}</Typography>
                                                                </TableCell>
                                                                <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                                    <Typography variant="mono" component="span">{formatCurrency(item.total_revenue)}</Typography>
                                                                </TableCell>
                                                                <TableCell sx={{ color: 'text.secondary' }}>
                                                                    <Typography variant="mono" component="span">{item.transaction_count}</Typography>
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
        </AppShell>
    );
}