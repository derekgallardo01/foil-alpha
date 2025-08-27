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
    user_card_id: number;
    userCard?: {
        id: number;
        card?: {
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
    amount: string | number;
    transaction_type: string;
    status: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    expires_at?: string;
}

interface TransactionStats {
    totalSales: number;
    pendingTransactions: number;
    monthlyRevenue: number;
}

const AdminTransactionsPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<TransactionStats>({
        totalSales: 0,
        pendingTransactions: 0,
        monthlyRevenue: 0
    });
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

            // Set transactions and stats from API response
            setTransactions(data.transactions || []);
            setStats({
                totalSales: data.totalSales || 0,
                pendingTransactions: data.pendingTransactions || 0,
                monthlyRevenue: data.monthlyRevenue || 0
            });

            console.log('Fetched data:', data);

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

    const formatPrice = (price: number | string) => {
        const num = typeof price === 'string' ? parseFloat(price) : price;
        return `$${(num || 0).toFixed(2)}`;
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
            case 'auction': return 'info' as const;
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
            ['ID', 'Card', 'Buyer', 'Seller', 'Amount', 'Type', 'Status', 'Created', 'Updated'].join(','),
            ...transactions.map(t => [
                t.id,
                `"${t.userCard?.card?.name || 'N/A'}"`,
                `"${t.buyer?.name || 'Unknown'}"`,
                `"${t.seller?.name || 'Unknown'}"`,
                t.amount,
                t.transaction_type,
                t.status,
                formatDateTime(t.created_at),
                formatDateTime(t.updated_at)
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

    // Calculate total volume from completed transactions
    const totalVolume = transactions
        .filter(t => t.status.toLowerCase() === 'completed')
        .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);

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

                {/* Statistics Cards - Using actual data from API */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: '#96ff9b' }}>
                                    {stats.totalSales.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Total Sales
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: 'warning.main' }}>
                                    {stats.pendingTransactions.toLocaleString()}
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
                                    {transactions.length.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Recent Transactions
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: '#96ff9b' }}>
                                    {formatPrice(stats.monthlyRevenue)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Monthly Revenue
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filters */}
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                size="small"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: 'text.secondary' }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={statusFilter}
                                    label="Status"
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <MenuItem value="">All Status</MenuItem>
                                    <MenuItem value="COMPLETED">Completed</MenuItem>
                                    <MenuItem value="PENDING_BUYER_CONFIRMATION">Pending Buyer</MenuItem>
                                    <MenuItem value="PENDING_SELLER_CONFIRMATION">Pending Seller</MenuItem>
                                    <MenuItem value="CANCELLED">Cancelled</MenuItem>
                                    <MenuItem value="FAILED">Failed</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Type</InputLabel>
                                <Select
                                    value={typeFilter}
                                    label="Type"
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                >
                                    <MenuItem value="">All Types</MenuItem>
                                    <MenuItem value="PURCHASE">Purchase</MenuItem>
                                    <MenuItem value="SALE">Sale</MenuItem>
                                    <MenuItem value="AUCTION">Auction</MenuItem>
                                    <MenuItem value="BID_ACCEPTED">Bid Accepted</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Tabs */}
                <Tabs
                    value={activeTab}
                    onChange={(_, newValue) => setActiveTab(newValue)}
                    sx={{
                        mb: 3,
                        '& .MuiTab-root': {
                            color: 'text.secondary',
                            '&.Mui-selected': { color: '#96ff9b' }
                        },
                        '& .MuiTabs-indicator': { backgroundColor: '#96ff9b' }
                    }}
                >
                    <Tab label={`All (${transactions.length})`} />
                    <Tab label={`Pending (${transactions.filter(t => t.status.includes('PENDING')).length})`} />
                    <Tab label={`Completed (${transactions.filter(t => t.status === 'COMPLETED').length})`} />
                    <Tab label={`Failed/Cancelled (${transactions.filter(t => ['CANCELLED', 'FAILED', 'EXPIRED'].includes(t.status)).length})`} />
                </Tabs>

                {/* Transactions Table */}
                <Paper sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>ID</TableCell>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Card</TableCell>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Buyer</TableCell>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Seller</TableCell>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Amount</TableCell>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Type</TableCell>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Status</TableCell>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Date</TableCell>
                                    <TableCell sx={{ color: '#96ff9b', fontWeight: 'bold' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                No transactions found
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedTransactions.map((transaction) => (
                                        <TableRow key={transaction.id} hover>
                                            <TableCell sx={{ color: 'text.primary' }}>
                                                #{transaction.id}
                                            </TableCell>
                                            <TableCell sx={{ color: 'text.primary' }}>
                                                {transaction.userCard?.card ? (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {transaction.userCard.card.image_url && (
                                                            <img
                                                                src={transaction.userCard.card.image_url}
                                                                alt={transaction.userCard.card.name}
                                                                style={{ width: 30, height: 30, objectFit: 'contain' }}
                                                            />
                                                        )}
                                                        <Box>
                                                            <Typography variant="body2">{transaction.userCard.card.name}</Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {transaction.userCard.card.set_name}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">N/A</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{transaction.buyer?.name || 'Unknown'}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {transaction.buyer?.email || ''}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{transaction.seller?.name || 'Unknown'}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {transaction.seller?.email || ''}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                                                {formatPrice(transaction.amount)}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={transaction.transaction_type.replace('_', ' ')}
                                                    color={getTypeColor(transaction.transaction_type)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={transaction.status.replace('_', ' ')}
                                                    color={getStatusColor(transaction.status)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell sx={{ color: 'text.secondary' }}>
                                                <Typography variant="caption">
                                                    {formatDateTime(transaction.created_at)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => showTransactionDetails(transaction)}
                                                    sx={{ color: '#96ff9b' }}
                                                >
                                                    <ViewIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredTransactions.length}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(parseInt(event.target.value, 10));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        sx={{
                            borderTop: '1px solid rgba(150, 255, 155, 0.2)',
                            '.MuiTablePagination-toolbar': { color: 'text.secondary' },
                            '.MuiTablePagination-selectLabel': { color: 'text.secondary' },
                            '.MuiTablePagination-displayedRows': { color: 'text.secondary' },
                        }}
                    />
                </Paper>
            </Container>

            {/* Transaction Details Modal */}
            <Dialog
                open={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: 'grey.900',
                        border: '1px solid rgba(150, 255, 155, 0.2)',
                    }
                }}
            >
                {selectedTransaction && (
                    <>
                        <DialogTitle sx={{ color: '#96ff9b' }}>
                            Transaction #{selectedTransaction.id}
                        </DialogTitle>
                        <DialogContent>
                            <Box sx={{ pt: 2 }}>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                                        <Chip
                                            label={selectedTransaction.status}
                                            color={getStatusColor(selectedTransaction.status)}
                                            size="small"
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="subtitle2" color="text.secondary">Type</Typography>
                                        <Chip
                                            label={selectedTransaction.transaction_type}
                                            color={getTypeColor(selectedTransaction.transaction_type)}
                                            size="small"
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
                                        <Typography variant="h5" sx={{ color: 'primary.main' }}>
                                            {formatPrice(selectedTransaction.amount)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="subtitle2" color="text.secondary">Buyer</Typography>
                                        <Typography>{selectedTransaction.buyer?.name || 'Unknown'}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedTransaction.buyer?.email || ''}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="subtitle2" color="text.secondary">Seller</Typography>
                                        <Typography>{selectedTransaction.seller?.name || 'Unknown'}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedTransaction.seller?.email || ''}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" color="text.secondary">Created</Typography>
                                        <Typography>{formatDateTime(selectedTransaction.created_at)}</Typography>
                                    </Grid>
                                    {selectedTransaction.notes && (
                                        <Grid item xs={12}>
                                            <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                                            <Typography>{selectedTransaction.notes}</Typography>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            {selectedTransaction.status.includes('PENDING') && (
                                <Button
                                    onClick={() => handleForceComplete(selectedTransaction.id)}
                                    color="primary"
                                    variant="contained"
                                    disabled={actionLoading === selectedTransaction.id}
                                    startIcon={actionLoading === selectedTransaction.id ?
                                        <CircularProgress size={16} /> :
                                        <CompleteIcon />
                                    }
                                >
                                    Force Complete
                                </Button>
                            )}
                            <Button onClick={() => setDetailsModalOpen(false)}>
                                Close
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Box>
    );
};

export default AdminTransactionsPage;