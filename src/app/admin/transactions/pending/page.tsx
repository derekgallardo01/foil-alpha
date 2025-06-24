// src/app/admin/transactions/pending/page.tsx - Admin pending transactions
'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    Grid,
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
import {
    Payment as PaymentIcon,
    Menu as MenuIcon,
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
import AdminSidebar from '../../../components/AdminSidebar';

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
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Redirect if not admin
    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role !== 'admin') {
            router.push('/unauthorized');
        }
    }, [status, session, router]);

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
        return `$${price.toFixed(2)}`;
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString();
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

    if (status === 'loading' || loading) {
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid rgba(150, 255, 155, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={toggleSidebar} sx={{ color: '#96ff9b' }}>
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h4" sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#96ff9b' }}>
                        <PaymentIcon />
                        Pending Purchase Confirmations
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={fetchPendingTransactions} title="Refresh" sx={{ color: '#96ff9b' }}>
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/admin/transactions')}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        All Transactions
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                {/* Error State */}
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        Error: {error}
                    </Alert>
                )}

                {/* Overview Card */}
                <Card sx={{ mb: 3, bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <WarningIcon sx={{ color: 'warning.main', fontSize: 32 }} />
                            <Box>
                                <Typography variant="h5" sx={{ color: '#96ff9b' }}>
                                    {pendingTransactions.length} Pending Confirmations
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
                    <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                        <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            No pending confirmations
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            All transactions are up to date!
                        </Typography>
                    </Paper>
                ) : (
                    <Grid container spacing={3}>
                        {pendingTransactions.map((transaction) => {
                            const timeRemaining = transaction.expires_at ? getTimeRemaining(transaction.expires_at) : null;
                            const isExpired = timeRemaining ? timeRemaining.percentage === 0 : false;

                            return (
                                <Grid item xs={12} md={6} lg={4} key={transaction.id}>
                                    <Card sx={{
                                        height: '100%',
                                        bgcolor: 'grey.800',
                                        border: `1px solid ${isExpired ? 'rgba(244, 67, 54, 0.5)' : 'rgba(255, 152, 0, 0.5)'}`,
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
                                                <Typography variant="h6" sx={{ color: '#96ff9b' }}>
                                                    Transaction #{transaction.id}
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
                                                    <Typography variant="h6" sx={{ color: 'primary.main', mt: 1 }}>
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
                                                            bgcolor: 'grey.700',
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
                                                    bgcolor: isExpired ? 'error.main' : '#96ff9b',
                                                    color: isExpired ? 'white' : 'grey.900',
                                                    '&:hover': {
                                                        bgcolor: isExpired ? 'error.dark' : 'rgba(150, 255, 155, 0.8)'
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
                <Paper sx={{ p: 3, mt: 3, bgcolor: 'rgba(150, 255, 155, 0.05)', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                    <Typography variant="h6" sx={{ color: '#96ff9b', mb: 2 }}>
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
        </Box>
    );
}