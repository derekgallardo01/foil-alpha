// src/app/admin/commission/wallet/page.tsx
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
    Alert,
    Divider,
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import {
    Menu as MenuIcon,
    AccountBalance,
    TrendingUp,
    MonetizationOn,
    Receipt,
    Download,
    Refresh,
    Add as AddIcon,
    Remove as RemoveIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import AdminSidebar from "../../../components/AdminSidebar";

interface AdminWallet {
    id: number;
    balance: number;
    total_commissions: number;
    total_marketplace_sales: number;
    created_at: string;
    updated_at: string;
}

interface AdminWalletTransaction {
    id: number;
    transaction_type: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    description: string;
    reference_type: string;
    reference_id: number;
    commission_rate: number;
    created_at: string;
}

interface WalletData {
    admin_wallet: AdminWallet;
    recent_transactions: AdminWalletTransaction[];
    stats: {
        total_transactions: number;
        monthly_commissions: number;
        monthly_marketplace_sales: number;
        daily_average: number;
    };
}

export default function AdminWalletManagement() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<WalletData | null>(null);
    const [adjustmentDialog, setAdjustmentDialog] = useState(false);
    const [adjustmentAmount, setAdjustmentAmount] = useState("");
    const [adjustmentDescription, setAdjustmentDescription] = useState("");
    const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Redirect if not admin
    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "admin") {
            router.push("/unauthorized");
        }
    }, [status, session, router]);

    // Fetch wallet data
    const fetchWalletData = async () => {
        try {
            setLoading(true);

            const response = await fetch("/api/admin/commission/wallet");
            if (!response.ok) throw new Error("Failed to fetch wallet data");

            const walletData: WalletData = await response.json();
            setData(walletData);

            toast.success("Wallet data loaded!");
        } catch (error) {
            console.error("Error fetching wallet data:", error);
            toast.error("Failed to load wallet data");
        } finally {
            setLoading(false);
        }
    };

    // Handle manual adjustment
    const handleAdjustment = async () => {
        try {
            const amount = parseFloat(adjustmentAmount);
            if (isNaN(amount) || amount <= 0) {
                toast.error("Please enter a valid amount");
                return;
            }

            if (!adjustmentDescription.trim()) {
                toast.error("Please enter a description");
                return;
            }

            const finalAmount = adjustmentType === "remove" ? -amount : amount;

            const response = await fetch("/api/admin/commission/wallet/adjust", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    amount: finalAmount,
                    description: adjustmentDescription.trim()
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to adjust wallet");
            }

            toast.success(`Wallet ${adjustmentType === "add" ? "credited" : "debited"} successfully!`);
            setAdjustmentDialog(false);
            setAdjustmentAmount("");
            setAdjustmentDescription("");
            await fetchWalletData(); // Refresh data
        } catch (error) {
            console.error("Error adjusting wallet:", error);
            toast.error(error instanceof Error ? error.message : "Failed to adjust wallet");
        }
    };

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role === "admin") {
            fetchWalletData();
        }
    }, [status, session]);

    const getTransactionTypeColor = (type: string) => {
        switch (type) {
            case 'COMMISSION': return 'success';
            case 'MARKETPLACE_SALE': return 'info';
            case 'WITHDRAWAL': return 'warning';
            case 'ADJUSTMENT': return 'secondary';
            default: return 'default';
        }
    };

    const formatCurrency = (amount: number | null | undefined) => {
        const numAmount = Number(amount) || 0;
        return `$${numAmount.toFixed(2)}`;
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!data) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <Alert severity="error">Failed to load wallet data</Alert>
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
                    Platform Wallet Management
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={fetchWalletData}
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
                        startIcon={<MonetizationOn />}
                        onClick={() => setAdjustmentDialog(true)}
                        sx={{
                            bgcolor: '#9B5Cff',
                            color: 'grey.900',
                            '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                        }}
                    >
                        Manual Adjustment
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Grid container spacing={3}>
                        {/* Wallet Overview */}
                        <Grid item xs={12}>
                            <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AccountBalance />
                                        Platform Wallet Overview
                                    </Typography>
                                    <Grid container spacing={3}>
                                        <Grid item xs={12} md={3}>
                                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 2 }}>
                                                <Typography variant="h3" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                                    {formatCurrency(data.admin_wallet.balance)}
                                                </Typography>
                                                <Typography variant="body1" color="text.primary" fontWeight="bold">
                                                    Current Balance
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Available funds
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(33, 150, 243, 0.1)', borderRadius: 2 }}>
                                                <Typography variant="h4" sx={{ color: 'info.main', fontWeight: 'bold' }}>
                                                    {formatCurrency(data.admin_wallet.total_commissions)}
                                                </Typography>
                                                <Typography variant="body1" color="text.primary" fontWeight="bold">
                                                    Total Commissions
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    All-time commission earnings
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255, 152, 0, 0.1)', borderRadius: 2 }}>
                                                <Typography variant="h4" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                                                    {formatCurrency(data.admin_wallet.total_marketplace_sales)}
                                                </Typography>
                                                <Typography variant="body1" color="text.primary" fontWeight="bold">
                                                    Marketplace Sales
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Direct platform sales
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(156, 39, 176, 0.1)', borderRadius: 2 }}>
                                                <Typography variant="h4" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>
                                                    {formatCurrency(data.admin_wallet.total_commissions + data.admin_wallet.total_marketplace_sales)}
                                                </Typography>
                                                <Typography variant="body1" color="text.primary" fontWeight="bold">
                                                    Total Revenue
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Commissions + Sales
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Monthly Stats */}
                        <Grid item xs={12} md={6}>
                            <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TrendingUp />
                                        Monthly Performance
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h5" color="success.main">
                                                    {formatCurrency(data.stats.monthly_commissions)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    This Month Commissions
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h5" color="info.main">
                                                    {formatCurrency(data.stats.monthly_marketplace_sales)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    This Month Sales
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                    <Divider sx={{ my: 2, borderColor: 'rgba(155, 92, 255, 0.2)' }} />
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h6" color="text.primary">
                                            {formatCurrency(data.stats.daily_average)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Daily Average Revenue
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Transaction Summary */}
                        <Grid item xs={12} md={6}>
                            <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Receipt />
                                        Transaction Summary
                                    </Typography>
                                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                                        <Typography variant="h4" color="text.primary">
                                            {data.stats.total_transactions}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Total Transactions
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2 }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Chip label="Commission" color="success" size="small" />
                                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }} color="text.secondary">
                                                User-to-user sales
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Chip label="Marketplace" color="info" size="small" />
                                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }} color="text.secondary">
                                                Direct sales
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Recent Transactions */}
                        <Grid item xs={12}>
                            <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="h6" sx={{ color: '#9B5Cff', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Receipt />
                                            Recent Transactions
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            startIcon={<Download />}
                                            size="small"
                                            sx={{
                                                borderColor: '#9B5Cff',
                                                color: '#9B5Cff',
                                                '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                                            }}
                                        >
                                            Export
                                        </Button>
                                    </Box>
                                    <TableContainer component={Paper} sx={{ bgcolor: 'grey.700', maxHeight: 400 }}>
                                        <Table stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Date</TableCell>
                                                    <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Type</TableCell>
                                                    <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Amount</TableCell>
                                                    <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Balance After</TableCell>
                                                    <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Description</TableCell>
                                                    <TableCell sx={{ color: '#9B5Cff', fontWeight: 'bold', bgcolor: 'grey.800' }}>Rate</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {data.recent_transactions.map((transaction) => (
                                                    <TableRow key={transaction.id}>
                                                        <TableCell sx={{ color: 'text.secondary' }}>
                                                            {new Date(transaction.created_at).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={transaction.transaction_type.replace('_', ' ')}
                                                                color={getTransactionTypeColor(transaction.transaction_type) as any}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{
                                                            color: transaction.amount >= 0 ? 'success.main' : 'error.main',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                                                        </TableCell>
                                                        <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                            {formatCurrency(transaction.balance_after)}
                                                        </TableCell>
                                                        <TableCell sx={{ color: 'text.primary', maxWidth: 300 }}>
                                                            {transaction.description}
                                                        </TableCell>
                                                        <TableCell sx={{ color: 'text.secondary' }}>
                                                            {transaction.commission_rate ? `${transaction.commission_rate}%` : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </motion.div>
            </Container>

            {/* Manual Adjustment Dialog */}
            <Dialog
                open={adjustmentDialog}
                onClose={() => setAdjustmentDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ color: '#9B5Cff' }}>
                    Manual Wallet Adjustment
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                    <Button
                                        variant={adjustmentType === 'add' ? 'contained' : 'outlined'}
                                        startIcon={<AddIcon />}
                                        onClick={() => setAdjustmentType('add')}
                                        sx={{
                                            bgcolor: adjustmentType === 'add' ? 'success.main' : 'transparent',
                                            borderColor: 'success.main',
                                            color: adjustmentType === 'add' ? 'white' : 'success.main'
                                        }}
                                    >
                                        Add Funds
                                    </Button>
                                    <Button
                                        variant={adjustmentType === 'remove' ? 'contained' : 'outlined'}
                                        startIcon={<RemoveIcon />}
                                        onClick={() => setAdjustmentType('remove')}
                                        sx={{
                                            bgcolor: adjustmentType === 'remove' ? 'error.main' : 'transparent',
                                            borderColor: 'error.main',
                                            color: adjustmentType === 'remove' ? 'white' : 'error.main'
                                        }}
                                    >
                                        Remove Funds
                                    </Button>
                                </Box>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Amount"
                                    value={adjustmentAmount}
                                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                                    type="number"
                                    inputProps={{ min: 0, step: 0.01 }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Description"
                                    value={adjustmentDescription}
                                    onChange={(e) => setAdjustmentDescription(e.target.value)}
                                    multiline
                                    rows={3}
                                    placeholder="Reason for this adjustment..."
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAdjustmentDialog(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAdjustment}
                        variant="contained"
                        color={adjustmentType === 'add' ? 'success' : 'error'}
                    >
                        {adjustmentType === 'add' ? 'Add' : 'Remove'} Funds
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}