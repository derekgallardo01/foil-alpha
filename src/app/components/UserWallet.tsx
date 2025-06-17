// src/app/components/UserWallet.tsx
"use client";

import { useState, useEffect } from "react";
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
} from "@mui/material";
import {
    AccountBalanceWallet,
    History,
    Refresh,
    TrendingUp,
    TrendingDown,
} from "@mui/icons-material";
import { toast } from "react-toastify";

interface WalletData {
    balance: number;
    frozen_balance: number;
    available_balance: number;
    recent_transactions?: WalletTransaction[];
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
    const { data: session } = useSession();
    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchWalletData = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/user/wallet?include_transactions=true&limit=10", {
                headers: {
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
            });

            if (!response.ok) throw new Error("Failed to fetch wallet data");

            const data = await response.json();
            setWallet(data);

        } catch (error) {
            console.error("Error fetching wallet:", error);
            toast.error("Failed to load wallet data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session?.user?.id) {
            fetchWalletData();
        }
    }, [session]);

    const getTransactionColor = (type: string) => {
        switch (type) {
            case 'DEPOSIT':
            case 'INITIAL_SETUP':
            case 'INITIAL_DEPOSIT':
            case 'SALE':
            case 'AUCTION_SALE':
                return 'success';
            case 'PURCHASE':
            case 'AUCTION_PAYMENT':
                return 'error';
            case 'FREEZE_FUNDS':
            case 'UNFREEZE_FUNDS':
                return 'warning';
            default:
                return 'default';
        }
    };

    const getTransactionIcon = (type: string, amount: number) => {
        if (type.includes('FREEZE') || type.includes('UNFREEZE')) {
            return null; // No icon for freeze/unfreeze
        }
        return amount >= 0 ? <TrendingUp sx={{ fontSize: 16 }} /> : <TrendingDown sx={{ fontSize: 16 }} />;
    };

    const getTransactionPrefix = (amount: number, type: string) => {
        if (type.includes('UNFREEZE') || type.includes('FREEZE')) {
            return ''; // No prefix for freeze/unfreeze as they don't change balance
        }
        return amount >= 0 ? '+' : '';
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress sx={{ color: '#96ff9b' }} />
            </Box>
        );
    }

    if (!wallet) {
        return (
            <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                <CardContent>
                    <Typography color="error">Failed to load wallet data</Typography>
                    <Button
                        variant="outlined"
                        onClick={fetchWalletData}
                        sx={{
                            mt: 2,
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)', mb: 3 }}>
            <CardContent>
                {/* Wallet Balance Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountBalanceWallet sx={{ color: '#96ff9b', fontSize: 28 }} />
                        <Typography variant="h5" sx={{ color: '#96ff9b', fontWeight: 'bold' }}>
                            My Wallet
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Refresh />}
                        onClick={fetchWalletData}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        Refresh
                    </Button>
                </Box>

                {/* Balance Information */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 3, mb: 4 }}>
                    <Box sx={{
                        textAlign: 'center',
                        p: 3,
                        bgcolor: 'grey.700',
                        borderRadius: 2,
                        border: '1px solid rgba(150, 255, 155, 0.3)'
                    }}>
                        <Typography variant="h3" sx={{ color: '#96ff9b', fontWeight: 'bold', mb: 1 }}>
                            ${wallet.balance.toFixed(2)}
                        </Typography>
                        <Typography variant="body1" color="text.primary" fontWeight="bold">
                            Total Balance
                        </Typography>
                    </Box>

                    <Box sx={{
                        textAlign: 'center',
                        p: 3,
                        bgcolor: 'grey.700',
                        borderRadius: 2,
                        border: `1px solid ${wallet.available_balance > 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(158, 158, 158, 0.3)'}`
                    }}>
                        <Typography variant="h3" sx={{
                            color: wallet.available_balance > 0 ? 'success.main' : 'text.secondary',
                            fontWeight: 'bold',
                            mb: 1
                        }}>
                            ${wallet.available_balance.toFixed(2)}
                        </Typography>
                        <Typography variant="body1" color="text.primary" fontWeight="bold">
                            Available to Spend
                        </Typography>
                    </Box>

                    {wallet.frozen_balance > 0 && (
                        <Box sx={{
                            textAlign: 'center',
                            p: 3,
                            bgcolor: 'grey.700',
                            borderRadius: 2,
                            border: '1px solid rgba(255, 152, 0, 0.3)'
                        }}>
                            <Typography variant="h3" sx={{ color: 'warning.main', fontWeight: 'bold', mb: 1 }}>
                                ${wallet.frozen_balance.toFixed(2)}
                            </Typography>
                            <Typography variant="body1" color="text.primary" fontWeight="bold">
                                Frozen (Active Bids)
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Balance Status Message */}
                <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(150, 255, 155, 0.05)', borderRadius: 1 }}>
                    {wallet.available_balance > 50 ? (
                        <Typography variant="body2" sx={{ color: 'success.main' }}>
                            ✅ Your wallet is ready for purchases and bidding!
                        </Typography>
                    ) : wallet.available_balance > 0 ? (
                        <Typography variant="body2" sx={{ color: 'warning.main' }}>
                            ⚠️ Low balance - consider adding funds for larger purchases.
                        </Typography>
                    ) : (
                        <Typography variant="body2" sx={{ color: 'error.main' }}>
                            ❌ No available balance - contact admin to add funds.
                        </Typography>
                    )}
                </Box>

                <Divider sx={{ my: 3, borderColor: 'rgba(150, 255, 155, 0.2)' }} />

                {/* Recent Transactions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <History sx={{ color: '#96ff9b' }} />
                    <Typography variant="h6" sx={{ color: '#96ff9b', fontWeight: 'bold' }}>
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
                                    borderBottom: '1px solid rgba(150, 255, 155, 0.1)',
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
                                                    color={getTransactionColor(transaction.type) as any}
                                                />
                                            </Box>
                                            {!transaction.type.includes('FREEZE') && (
                                                <Typography
                                                    variant="h6"
                                                    sx={{
                                                        color: transaction.amount >= 0 ? 'success.main' : 'error.main',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {getTransactionPrefix(transaction.amount, transaction.type)}${Math.abs(transaction.amount).toFixed(2)}
                                                </Typography>
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
                            Start by browsing the marketplace or managing your card collection!
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}