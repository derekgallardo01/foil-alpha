// src/app/admin/transactions/pending/page.tsx - Admin pending transactions
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    Card,
    CardContent,
    Button,
    Chip,
    Alert,
    CircularProgress,
    Paper,
    IconButton,
    Divider,
    LinearProgress
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    Payment as PaymentIcon,
    Refresh as RefreshIcon,
    CheckCircle as CompleteIcon,
    CheckCircle as CheckIcon,
    Cancel as CancelIcon,
    Warning as WarningIcon,
    AccessTime as TimeIcon,
    Person as PersonIcon,
    AttachMoney as MoneyIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AppShell from '../../../components/AppShell';
import PageHeader from '../../../components/ui/PageHeader';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import { formatDateTime } from '../../../lib/format';
import { useRequireAuth } from '../../../lib/useRequireAuth';

interface PendingTransaction {
    id: number;
    userCard: {
        card: {
            id: number;
            name: string;
            set_name: string;
            image_url: string;
        };
    };
    buyer: {
        id: number;
        name: string;
        email: string;
    };
    seller: {
        id: number;
        name: string;
        email: string;
    };
    amount: number;
    transaction_type: string;
    status: string;
    notes?: string;
    created_at: string;
    expires_at?: string;
}

export default function AdminPendingTransactionsPage() {
    const { session, status } = useRequireAuth({ admin: true });
    const router = useRouter();
    const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const fetchPendingTransactions = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/admin/transactions?status=PENDING_BUYER_CONFIRMATION');
            if (!response.ok) throw new Error('Failed to fetch pending transactions');

            const data = await response.json();
            setPendingTransactions(data.transactions || data);

        } catch (err) {
            console.error('Error fetching pending transactions:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            toast.error('Failed to load pending transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role === 'admin') {
            fetchPendingTransactions();
        }
    }, [status, session]);

    // Auto-refresh every 15 seconds for pending transactions
    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role === 'admin') {
            const interval = setInterval(fetchPendingTransactions, 15000);
            return () => clearInterval(interval);
        }
    }, [status, session]);

    const formatPrice = (price: number) => {
        const num = typeof price === 'number' ? price : Number(price) || 0;
        return `$${num.toFixed(2)}`;
    };

    const getTimeRemaining = (expiresAt: string) => {
        const now = new Date().getTime();
        const expiration = new Date(expiresAt).getTime();
        const difference = expiration - now;

        if (difference <= 0) return { text: 'Expired', color: 'error.main', percentage: 0 };

        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

        const totalMs = 24 * 60 * 60 * 1000; // 24 hours in ms
        const percentage = (difference / totalMs) * 100;

        let color = 'success.main';
        if (percentage < 25) color = 'error.main';
        else if (percentage < 50) color = 'warning.main';

        return {
            text: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            color,
            percentage: Math.max(0, Math.min(100, percentage))
        };
    };

    const handleForceComplete = async (transactionId: number) => {
        if (!confirm('Are you sure you want to force complete this transaction? This action cannot be undone.')) {
            return;
        }

        setActionLoading(transactionId);
        try {
            const response = await fetch('/api/admin/transactions/force-complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ transaction_id: transactionId })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Transaction completed successfully');
                fetchPendingTransactions(); // Refresh the list
            } else {
                toast.error(data.error || 'Failed to complete transaction');
            }
        } catch (error) {
            console.error('Error completing transaction:', error);
            toast.error('Failed to complete transaction');
        } finally {
            setActionLoading(null);
        }
    };

    if (status === 'loading' || (loading && pendingTransactions.length === 0)) {
        return (
            <Container>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (status === 'unauthenticated' || session?.user?.role !== 'admin') {
        return null;
    }

    return (
        <AppShell variant="admin">
            {/* Header */}
            <PageHeader
                title="Pending Transactions"
                icon={<PaymentIcon />}
                actions={
                    <>
                        <IconButton onClick={fetchPendingTransactions} title="Refresh" sx={{ color: 'primary.main' }}>
                            <RefreshIcon />
                        </IconButton>
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => router.push('/admin/transactions')}
                        >
                            All Transactions
                        </Button>
                    </>
                }
            />

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                {/* Error State */}
                {error && (
                    <Box sx={{ mb: 3 }}>
                        <ErrorState
                            variant="inline"
                            message="Couldn't load pending transactions."
                            onRetry={fetchPendingTransactions}
                        />
                    </Box>
                )}

                {/* Overview Card */}
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <WarningIcon sx={{ color: 'warning.main', fontSize: 32 }} />
                            <Box>
                                <Typography variant="h5" sx={{ color: 'text.primary' }}>
                                    <Typography component="span" variant="mono" sx={{ fontSize: 'inherit', fontWeight: 700 }}>{pendingTransactions.length}</Typography> Pending Confirmations
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Transactions waiting for buyer confirmation within 24 hours
                                </Typography>
                            </Box>
                        </Box>

                        {pendingTransactions.length > 0 && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                    These transactions require buyer confirmation within 24 hours.
                                    You can force complete them if buyers are unresponsive or if needed for dispute resolution.
                                </Typography>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Pending Transactions */}
                {pendingTransactions.length === 0 ? (
                    <EmptyState
                        icon={<CheckIcon />}
                        title="No pending transactions"
                        description="All transactions are up to date."
                    />
                ) : (
                    <Grid container spacing={3}>
                        {pendingTransactions.map((transaction) => {
                            const timeRemaining = transaction.expires_at ? getTimeRemaining(transaction.expires_at) : null;
                            const isExpired = timeRemaining ? timeRemaining.percentage === 0 : false;

                            return (
                                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={transaction.id}>
                                    <Card sx={{
                                        height: '100%',
                                        border: 1,
                                        borderColor: isExpired ? 'error.main' : 'warning.main',
                                        position: 'relative'
                                    }}>
                                        {/* Priority indicator */}
                                        {timeRemaining && timeRemaining.percentage < 25 && (
                                            <Box sx={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: 4,
                                                bgcolor: 'error.main',
                                                animation: 'pulse 2s infinite'
                                            }} />
                                        )}

                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <WarningIcon sx={{ color: 'warning.main', mr: 1 }} />
                                                <Typography variant="h6" sx={{ color: 'text.primary' }}>
                                                    Transaction <Typography component="span" variant="mono" sx={{ fontSize: 'inherit', fontWeight: 700 }}>#{transaction.id}</Typography>
                                                </Typography>
                                                {isExpired && (
                                                    <Chip
                                                        label="EXPIRED"
                                                        color="error"
                                                        size="small"
                                                        sx={{ ml: 'auto' }}
                                                    />
                                                )}
                                            </Box>

                                            {/* Card Info */}
                                            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                                <img
                                                    src={transaction.userCard.card.image_url || '/placeholder-card.png'}
                                                    alt={transaction.userCard.card.name}
                                                    style={{ width: 60, height: 60, objectFit: 'contain' }}
                                                />
                                                <Box sx={{ flexGrow: 1 }}>
                                                    <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                        {transaction.userCard.card.name}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {transaction.userCard.card.set_name}
                                                    </Typography>
                                                    <Typography variant="mono" component="div" sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', mt: 1 }}>
                                                        {formatPrice(transaction.amount)}
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Divider sx={{ my: 2 }} />

                                            {/* Transaction Details */}
                                            <Box sx={{ mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <PersonIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Buyer: {transaction.buyer.name}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <PersonIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Seller: {transaction.seller.name}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    Created: {formatDateTime(transaction.created_at)}
                                                </Typography>
                                            </Box>

                                            {/* Time Remaining */}
                                            {timeRemaining && (
                                                <Box sx={{ mb: 2 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <TimeIcon sx={{ fontSize: 16, mr: 1, color: timeRemaining.color }} />
                                                            <Typography variant="body2" sx={{ color: timeRemaining.color }}>
                                                                {isExpired ? 'Expired' : `${timeRemaining.text} remaining`}
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">
                                                            24h limit
                                                        </Typography>
                                                    </Box>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={timeRemaining.percentage}
                                                        sx={{
                                                            height: 6,
                                                            borderRadius: 3,
                                                            bgcolor: 'background.default',
                                                            '& .MuiLinearProgress-bar': {
                                                                bgcolor: timeRemaining.color,
                                                                borderRadius: 3,
                                                            },
                                                        }}
                                                    />
                                                </Box>
                                            )}

                                            {/* Action Button */}
                                            <Button
                                                variant="contained"
                                                fullWidth
                                                onClick={() => handleForceComplete(transaction.id)}
                                                disabled={actionLoading === transaction.id}
                                                startIcon={actionLoading === transaction.id ?
                                                    <CircularProgress size={16} /> :
                                                    <CompleteIcon />
                                                }
                                                sx={{
                                                    bgcolor: isExpired ? 'error.main' : 'primary.main',
                                                    color: isExpired ? 'error.contrastText' : 'primary.contrastText',
                                                    '&:hover': {
                                                        bgcolor: isExpired ? 'error.dark' : 'primary.dark'
                                                    }
                                                }}
                                            >
                                                {actionLoading === transaction.id ?
                                                    'Processing...' :
                                                    isExpired ?
                                                        'Force Complete (Expired)' :
                                                        'Force Complete Transaction'
                                                }
                                            </Button>

                                            {transaction.notes && (
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                    Note: {transaction.notes}
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}

                {/* Help Section */}
                <Paper variant="outlined" sx={{ p: 3, mt: 3, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 2 }}>
                        About Pending Confirmations
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        When a bid is accepted or an auction ends, the winner has 24 hours to confirm their purchase.
                        This system prevents unwanted purchases and gives buyers time to verify their decision.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        <strong>Force Complete:</strong> Use this option when buyers are unresponsive, for dispute resolution,
                        or when you need to override the confirmation system. The buyer's wallet will be checked for sufficient funds.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        <strong>Expired Transactions:</strong> After 24 hours, transactions expire automatically and the auction
                        is relisted for other bidders. You can still force complete expired transactions if needed.
                    </Typography>
                </Paper>
            </Container>
        </AppShell>
    );
}