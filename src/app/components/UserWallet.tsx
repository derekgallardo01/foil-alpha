// src/app/components/UserWallet.tsx - Updated with Currency Support
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    List,
    ListItem,
    ListItemText,
    Chip,
    CircularProgress,
    Divider,
    Alert,
    Tooltip,
} from "@mui/material";
import {
    AccountBalanceWallet,
    History,
    Refresh,
    TrendingUp,
    TrendingDown,
    AdminPanelSettings,
    CurrencyExchange,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import type { ChipProps } from "@mui/material";
import PriceDisplay, { LargePriceDisplay } from "./PriceDisplay";
import CurrencySelector from "./CurrencySelector";
import { useCurrencyContext } from "../lib/currency-context";

interface WalletData {
    balance: number;
    frozen_balance: number;
    available_balance: number;
    recent_transactions: WalletTransaction[];
}

interface WalletTransaction {
    id: number;
    type: string;
    amount: number;
    description: string;
    created_at: string;
    reference_type: string;
}

export default function UserWallet() {
    const { data: session, status } = useSession();
    const { selectedCurrency, isUSDFallback } = useCurrencyContext();
    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWalletData = useCallback(async () => {
        if (status !== "authenticated" || !session?.user?.id) {
            setLoading(false);
            return;
        }

        // Don't fetch wallet for admins
        if (session.user.role === 'admin') {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch("/api/user/wallet?include_transactions=true&limit=10");

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch wallet');
            }

            const data = await response.json();
            setWallet(data);

        } catch (error) {
            console.error("Error fetching wallet:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to load wallet data";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [session, status]);

    useEffect(() => {
        fetchWalletData();
    }, [fetchWalletData]);

    const handleRefresh = () => {
        fetchWalletData();
    };

    const getTransactionColor = (type: string): ChipProps['color'] => {
        switch (type) {
            case 'DEPOSIT':
            case 'ADD_MONEY':
            case 'SALE':
            case 'UNFREEZE_FUNDS':
                return 'success';
            case 'PURCHASE':
            case 'DEDUCT_MONEY':
                return 'error';
            case 'FREEZE_FUNDS':
                return 'warning';
            default:
                return 'default';
        }
    };

    const getTransactionIcon = (type: string, amount: number) => {
        if (type.includes('FREEZE')) {
            return null;
        }
        return amount >= 0 ? <TrendingUp sx={{ fontSize: 16 }} /> : <TrendingDown sx={{ fontSize: 16 }} />;
    };

    if (status === "loading" || loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress sx={{ color: 'primary.main' }} />
                <Typography sx={{ ml: 2, color: 'text.secondary' }}>
                    Loading wallet...
                </Typography>
            </Box>
        );
    }

    if (status === "unauthenticated") {
        return (
            <Card>
                <CardContent>
                    <Typography color="error">Please log in to view your wallet</Typography>
                </CardContent>
            </Card>
        );
    }

    // Show admin message instead of wallet
    if (session?.user?.role === 'admin') {
        return (
            <Card sx={{ mb: 3 }}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <AdminPanelSettings sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h5" sx={{ color: 'primary.main', mb: 2 }}>
                        Admin Account
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        Admins don't have personal wallets. Use the admin panel to manage user wallets.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        All prices shown in USD for administrative purposes.
                    </Typography>
                    <Button
                        variant="contained"
                        href="/admin/users"
                    >
                        Go to User Management
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleRefresh}
                    >
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!wallet) {
        return (
            <Card>
                <CardContent>
                    <Typography color="text.secondary">Wallet not found. Contact admin to create your wallet.</Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountBalanceWallet sx={{ color: 'primary.main', fontSize: 28 }} />
                        <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                            My Wallet
                        </Typography>
                        {isUSDFallback && (
                            <Tooltip title="Currency service unavailable, showing USD prices">
                                <Chip
                                    icon={<CurrencyExchange />}
                                    label="USD Fallback"
                                    size="small"
                                    color="warning"
                                />
                            </Tooltip>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ minWidth: 120 }}>
                            <CurrencySelector size="small" />
                        </Box>
                        <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            Refresh
                        </Button>
                    </Box>
                </Box>

                {/* Currency Info Banner */}
                {selectedCurrency !== 'USD' && !isUSDFallback && (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2">
                                Displaying prices in {selectedCurrency}. All transactions are processed in USD.
                            </Typography>
                        </Box>
                    </Alert>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 3, mb: 4 }}>
                    <Box sx={{
                        textAlign: 'center',
                        p: 3,
                        bgcolor: 'background.default',
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider'
                    }}>
                        <LargePriceDisplay
                            usdAmount={wallet.balance}
                            sx={{ color: 'primary.main', fontWeight: 'bold', mb: 1 }}
                        />
                        <Typography variant="body1" color="text.primary" fontWeight="bold">
                            Total Balance
                        </Typography>
                        {selectedCurrency !== 'USD' && !isUSDFallback && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                ${wallet.balance.toFixed(2)} USD
                            </Typography>
                        )}
                    </Box>

                    <Box sx={{
                        textAlign: 'center',
                        p: 3,
                        bgcolor: 'background.default',
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider'
                    }}>
                        <LargePriceDisplay
                            usdAmount={wallet.available_balance}
                            sx={{ color: 'primary.main', fontWeight: 'bold', mb: 1 }}
                        />
                        <Typography variant="body1" color="text.primary" fontWeight="bold">
                            Available to Spend
                        </Typography>
                        {selectedCurrency !== 'USD' && !isUSDFallback && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                ${wallet.available_balance.toFixed(2)} USD
                            </Typography>
                        )}
                    </Box>

                    {wallet.frozen_balance > 0 && (
                        <Box sx={{
                            textAlign: 'center',
                            p: 3,
                            bgcolor: 'background.default',
                            borderRadius: 2,
                            border: 1,
                            borderColor: 'divider'
                        }}>
                            <LargePriceDisplay
                                usdAmount={wallet.frozen_balance}
                                sx={{ color: 'warning.main', fontWeight: 'bold', mb: 1 }}
                            />
                            <Typography variant="body1" color="text.primary" fontWeight="bold">
                                Frozen (Active Bids)
                            </Typography>
                            {selectedCurrency !== 'USD' && !isUSDFallback && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    ${wallet.frozen_balance.toFixed(2)} USD
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>

                <Box sx={{
                    mb: 3,
                    p: 2,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                    textAlign: 'center'
                }}>
                    {wallet.available_balance > 50 ? (
                        <Typography variant="body2" sx={{ color: 'success.main' }}>
                            ✅ Your wallet is ready for purchases and bidding!
                        </Typography>
                    ) : wallet.available_balance > 0 ? (
                        <Typography variant="body2" sx={{ color: 'warning.main' }}>
                            ⚠️ Low balance - contact admin to add more funds.
                        </Typography>
                    ) : (
                        <Typography variant="body2" sx={{ color: 'error.main' }}>
                            ❌ No available balance - contact admin to add funds.
                        </Typography>
                    )}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <History sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                        Recent Transactions
                    </Typography>
                </Box>

                {wallet.recent_transactions && wallet.recent_transactions.length > 0 ? (
                    <List sx={{ maxHeight: 350, overflow: 'auto' }}>
                        {wallet.recent_transactions.map((transaction) => (
                            <ListItem
                                key={transaction.id}
                                sx={{
                                    px: 0,
                                    py: 1.5,
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    '&:last-child': { borderBottom: 'none' }
                                }}
                            >
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {getTransactionIcon(transaction.type, transaction.amount)}
                                                <Typography variant="body1" color="text.primary" fontWeight="medium">
                                                    {transaction.description}
                                                </Typography>
                                                <Chip
                                                    label={transaction.type.replace('_', ' ')}
                                                    size="small"
                                                    color={getTransactionColor(transaction.type)}
                                                />
                                            </Box>
                                            {transaction.amount !== 0 && (
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <PriceDisplay
                                                        usdAmount={Math.abs(transaction.amount)}
                                                        variant="h6"
                                                        color={transaction.amount >= 0 ? 'success.main' : 'error.main'}
                                                        sx={{ fontWeight: 'bold' }}
                                                    />
                                                    {selectedCurrency !== 'USD' && !isUSDFallback && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                            {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)} USD
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
                                        </Box>
                                    }
                                    secondary={
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {new Date(transaction.created_at).toLocaleString()}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                            No transactions yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Contact admin to add funds or start trading!
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}