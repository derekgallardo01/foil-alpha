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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Divider,
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import {
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
import AppShell from "../../../components/AppShell";
import PageHeader from "../../../components/ui/PageHeader";
import StatCard from "../../../components/StatCard";
import { StatRowSkeleton } from "../../../components/ui/Skeletons";
import ErrorState from "../../../components/ui/ErrorState";
import { formatPrice } from "../../../lib/format";

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
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<WalletData | null>(null);
    const [adjustmentDialog, setAdjustmentDialog] = useState(false);
    const [adjustmentAmount, setAdjustmentAmount] = useState("");
    const [adjustmentDescription, setAdjustmentDescription] = useState("");
    const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");

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

    return (
        <AppShell variant="admin">
            <PageHeader
                title="Platform Wallet"
                icon={<AccountBalance />}
                actions={
                    <>
                        <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={fetchWalletData}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<MonetizationOn />}
                            onClick={() => setAdjustmentDialog(true)}
                        >
                            Manual Adjustment
                        </Button>
                    </>
                }
            />

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {loading ? (
                    <StatRowSkeleton count={4} />
                    ) : !data ? (
                    <ErrorState message="Couldn't load wallet data." onRetry={fetchWalletData} />
                    ) : (
                    <Grid container spacing={3}>
                        {/* Wallet Overview */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AccountBalance />
                                        Platform Wallet Overview
                                    </Typography>
                                    <Grid container spacing={3}>
                                        <Grid item xs={12} md={3}>
                                            <StatCard label="Current Balance" value={formatPrice(data.admin_wallet.balance)} accent />
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <StatCard label="Total Commissions" value={formatPrice(data.admin_wallet.total_commissions)} />
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <StatCard label="Marketplace Sales" value={formatPrice(data.admin_wallet.total_marketplace_sales)} />
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <StatCard label="Total Revenue" value={formatPrice(data.admin_wallet.total_commissions + data.admin_wallet.total_marketplace_sales)} />
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Monthly Stats */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TrendingUp />
                                        Monthly Performance
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="mono" component="div" sx={{ fontSize: 24, fontWeight: 700 }} color="success.main">
                                                    {formatPrice(data.stats.monthly_commissions)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    This Month Commissions
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="mono" component="div" sx={{ fontSize: 24, fontWeight: 700 }} color="info.main">
                                                    {formatPrice(data.stats.monthly_marketplace_sales)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    This Month Sales
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                    <Divider sx={{ my: 2 }} />
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="mono" component="div" sx={{ fontSize: 20, fontWeight: 700 }} color="text.primary">
                                            {formatPrice(data.stats.daily_average)}
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
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Receipt />
                                        Transaction Summary
                                    </Typography>
                                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                                        <Typography variant="mono" component="div" sx={{ fontSize: 30, fontWeight: 700 }} color="text.primary">
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
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="h6" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Receipt />
                                            Recent Transactions
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            startIcon={<Download />}
                                            size="small"
                                            disabled
                                            title="Export coming soon"
                                        >
                                            Export
                                        </Button>
                                    </Box>
                                    <TableContainer component={Paper} sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider', maxHeight: 400 }}>
                                        <Table stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Date</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Type</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Amount</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Balance After</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Description</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold', bgcolor: 'background.paper' }}>Rate</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {data.recent_transactions.map((transaction) => (
                                                    <TableRow key={transaction.id}>
                                                        <TableCell sx={{ color: 'text.secondary' }}>
                                                            <Typography variant="mono" component="span">{new Date(transaction.created_at).toLocaleDateString()}</Typography>
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
                                                            <Typography variant="mono" component="span" sx={{ fontWeight: 700 }}>{transaction.amount >= 0 ? '+' : ''}{formatPrice(transaction.amount)}</Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                            <Typography variant="mono" component="span" sx={{ fontWeight: 700 }}>{formatPrice(transaction.balance_after)}</Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ color: 'text.primary', maxWidth: 300 }}>
                                                            {transaction.description}
                                                        </TableCell>
                                                        <TableCell sx={{ color: 'text.secondary' }}>
                                                            <Typography variant="mono" component="span">{transaction.commission_rate ? `${transaction.commission_rate}%` : '-'}</Typography>
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
                    )}
                </motion.div>
            </Container>

            {/* Manual Adjustment Dialog */}
            <Dialog
                open={adjustmentDialog}
                onClose={() => setAdjustmentDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ color: 'primary.main' }}>
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
        </AppShell>
    );
}