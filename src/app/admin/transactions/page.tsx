// src/app/admin/transactions/page.tsx
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    InputAdornment
} from '@mui/material';
import {
    Receipt as TransactionIcon,
    Menu as MenuIcon,
    Refresh as RefreshIcon,
    Visibility as ViewIcon,
    CheckCircle as CompleteIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    Download as ExportIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AdminSidebar from '../../components/AdminSidebar';

interface Transaction {
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
    completed_at?: string;
    expires_at?: string;
}

const AdminTransactionsPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    // Pagination and filtering
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Redirect if not admin
    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role !== 'admin') {
            router.push('/unauthorized');
        }
    }, [status, session, router]);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (typeFilter) params.append('type', typeFilter);
            if (searchTerm) params.append('search', searchTerm);
            params.append('limit', '100');

            const response = await fetch(`/api/admin/transactions?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch transactions');

            const data = await response.json();
            setTransactions(data.transactions || data);

        } catch (err) {
            console.error('Error fetching transactions:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            toast.error('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role === 'admin') {
            fetchTransactions();
        }
    }, [status, session, statusFilter, typeFilter, searchTerm]);

    const formatPrice = (price: number) => {
        return `$${price.toFixed(2)}`;
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed': return 'success' as const;
            case 'pending': return 'warning' as const;
            case 'pending_buyer_confirmation': return 'warning' as const;
            case 'cancelled': return 'error' as const;
            case 'failed': return 'error' as const;
            case 'expired': return 'default' as const;
            default: return 'default' as const;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type.toLowerCase()) {
            case 'purchase': return 'primary' as const;
            case 'sale': return 'success' as const;
            case 'bid_accepted': return 'secondary' as const;
            case 'auction_win': return 'info' as const;
            case 'admin_force_completed': return 'warning' as const;
            default: return 'default' as const;
        }
    };

    const handleForceComplete = async (transactionId: number) => {
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
                fetchTransactions();
                setDetailsModalOpen(false);
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

    const showTransactionDetails = (transaction: Transaction) => {
        setSelectedTransaction(transaction);
        setDetailsModalOpen(true);
    };

    const exportTransactions = () => {
        const csvContent = [
            ['ID', 'Card', 'Buyer', 'Seller', 'Amount', 'Type', 'Status', 'Created', 'Completed'].join(','),
            ...transactions.map(t => [
                t.id,
                `"${t.userCard.card.name}"`,
                `"${t.buyer.name}"`,
                `"${t.seller.name}"`,
                t.amount,
                t.transaction_type,
                t.status,
                formatDateTime(t.created_at),
                t.completed_at ? formatDateTime(t.completed_at) : ''
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Transactions exported successfully');
    };

    const getFilteredTransactions = () => {
        let filtered = transactions;

        switch (activeTab) {
            case 0: // All
                break;
            case 1: // Pending
                filtered = transactions.filter(t =>
                    t.status.toLowerCase().includes('pending') ||
                    t.status.toLowerCase() === 'pending'
                );
                break;
            case 2: // Completed
                filtered = transactions.filter(t => t.status.toLowerCase() === 'completed');
                break;
            case 3: // Cancelled/Failed
                filtered = transactions.filter(t =>
                    t.status.toLowerCase() === 'cancelled' ||
                    t.status.toLowerCase() === 'failed' ||
                    t.status.toLowerCase() === 'expired'
                );
                break;
        }

        return filtered;
    };

    const filteredTransactions = getFilteredTransactions();
    const paginatedTransactions = filteredTransactions.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

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
                        <TransactionIcon />
                        Transaction Management
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<ExportIcon />}
                        onClick={exportTransactions}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        Export CSV
                    </Button>
                    <IconButton onClick={fetchTransactions} title="Refresh" sx={{ color: '#96ff9b' }}>
                        <RefreshIcon />
                    </IconButton>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                {/* Error State */}
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        Error: {error}
                    </Alert>
                )}

                {/* Statistics Cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: '#96ff9b' }}>
                                    {transactions.length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Total Transactions
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: 'warning.main' }}>
                                    {transactions.filter(t => t.status.toLowerCase().includes('pending')).length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Pending Transactions
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: 'success.main' }}>
                                    {transactions.filter(t => t.status.toLowerCase() === 'completed').length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Completed Transactions
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: '#96ff9b' }}>
                                    {formatPrice(transactions.filter(t => t.status.toLowerCase() === 'completed').reduce((sum, t) => sum + t.amount, 0))}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Total Volume
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Simple table for now */}
                <Paper sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)', p: 3 }}>
                    <Typography variant="h6" sx={{ color: '#96ff9b', mb: 2 }}>
                        Recent Transactions
                    </Typography>

                    {transactions.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" textAlign="center" py={4}>
                            No transactions found
                        </Typography>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>ID</TableCell>
                                        <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Card</TableCell>
                                        <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Amount</TableCell>
                                        <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Status</TableCell>
                                        <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Created</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {transactions.slice(0, 10).map((transaction) => (
                                        <TableRow key={transaction.id} hover>
                                            <TableCell sx={{ color: 'text.primary' }}>#{transaction.id}</TableCell>
                                            <TableCell sx={{ color: 'text.primary' }}>
                                                {transaction.userCard.card.name}
                                            </TableCell>
                                            <TableCell sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                {formatPrice(transaction.amount)}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={transaction.status}
                                                    color={getStatusColor(transaction.status)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell sx={{ color: 'text.secondary' }}>
                                                {formatDateTime(transaction.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>
            </Container>
        </Box>
    );
};

export default AdminTransactionsPage;