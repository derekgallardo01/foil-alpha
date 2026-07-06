// src/app/admin/transactions/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    Button,
    Chip,
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
import Grid from '@mui/material/Grid2';
import {
    Receipt as TransactionIcon,
    Refresh as RefreshIcon,
    Visibility as ViewIcon,
    CheckCircle as CompleteIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    Download as ExportIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AppShell from '../../components/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/StatCard';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { StatRowSkeleton } from '../../components/ui/Skeletons';
import { formatPrice } from '../../lib/format';

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
            <Container maxWidth="xl" sx={{ py: 3 }}>
                <StatRowSkeleton count={4} />
            </Container>
        );
    }

    if (status === 'unauthenticated' || session?.user?.role !== 'admin') {
        return null;
    }

    return (
        <AppShell variant="admin">
            <PageHeader
                title="Transactions"
                icon={<TransactionIcon />}
                actions={
                    <>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<ExportIcon />}
                            onClick={exportTransactions}
                        >
                            Export CSV
                        </Button>
                        <IconButton onClick={fetchTransactions} title="Refresh" sx={{ color: 'primary.main' }}>
                            <RefreshIcon />
                        </IconButton>
                    </>
                }
            />

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                {/* Error State */}
                {error && (
                    <Box sx={{ mb: 3 }}>
                        <ErrorState
                            variant="inline"
                            message="Couldn't load transactions."
                            onRetry={fetchTransactions}
                        />
                    </Box>
                )}

                {/* Statistics Cards - Using actual data from API */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard label="Total Sales" value={stats.totalSales.toLocaleString()} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard label="Pending Transactions" value={stats.pendingTransactions.toLocaleString()} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard label="Recent Transactions" value={transactions.length.toLocaleString()} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <StatCard label="Monthly Revenue" value={formatPrice(stats.monthlyRevenue)} accent />
                    </Grid>
                </Grid>

                {/* Filters */}
                <Paper variant="outlined" sx={{ p: 2, mb: 3, border: 1, borderColor: 'divider' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 3 }}>
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
                        <Grid size={{ xs: 12, md: 3 }}>
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
                        <Grid size={{ xs: 12, md: 3 }}>
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
                            '&.Mui-selected': { color: 'primary.main' }
                        },
                        '& .MuiTabs-indicator': { backgroundColor: 'primary.main' }
                    }}
                >
                    <Tab label={`All (${transactions.length})`} />
                    <Tab label={`Pending (${transactions.filter(t => t.status.includes('PENDING')).length})`} />
                    <Tab label={`Completed (${transactions.filter(t => t.status === 'COMPLETED').length})`} />
                    <Tab label={`Failed/Cancelled (${transactions.filter(t => ['CANCELLED', 'FAILED', 'EXPIRED'].includes(t.status)).length})`} />
                </Tabs>

                {/* Transactions Table */}
                <Paper variant="outlined" sx={{ border: 1, borderColor: 'divider' }}>
                    <TableContainer sx={{ bgcolor: 'background.default' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>ID</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>Card</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>Buyer</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>Seller</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>Amount</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>Type</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>Status</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>Date</TableCell>
                                    <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', fontWeight: 'bold' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} sx={{ border: 0 }}>
                                            <EmptyState
                                                icon={<TransactionIcon />}
                                                title="No transactions"
                                                minHeight={200}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedTransactions.map((transaction) => (
                                        <TableRow key={transaction.id} hover>
                                            <TableCell sx={{ color: 'text.primary' }}>
                                                <Typography variant="mono">#{transaction.id}</Typography>
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
                                            <TableCell>
                                                <Typography variant="mono" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                                                    {formatPrice(transaction.amount)}
                                                </Typography>
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
                                                <Typography variant="mono" sx={{ fontSize: 12 }} color="text.secondary">
                                                    {formatDateTime(transaction.created_at)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => showTransactionDetails(transaction)}
                                                    sx={{ color: 'primary.main' }}
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
                            borderTop: 1,
                            borderColor: 'divider',
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
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                    }
                }}
            >
                {selectedTransaction && (
                    <>
                        <DialogTitle sx={{ color: 'primary.main' }}>
                            Transaction #{selectedTransaction.id}
                        </DialogTitle>
                        <DialogContent>
                            <Box sx={{ pt: 2 }}>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                                        <Chip
                                            label={selectedTransaction.status}
                                            color={getStatusColor(selectedTransaction.status)}
                                            size="small"
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="subtitle2" color="text.secondary">Type</Typography>
                                        <Chip
                                            label={selectedTransaction.transaction_type}
                                            color={getTypeColor(selectedTransaction.transaction_type)}
                                            size="small"
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
                                        <Typography variant="mono" component="div" sx={{ fontSize: 24, fontWeight: 700, color: 'text.primary' }}>
                                            {formatPrice(selectedTransaction.amount)}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="subtitle2" color="text.secondary">Buyer</Typography>
                                        <Typography>{selectedTransaction.buyer?.name || 'Unknown'}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedTransaction.buyer?.email || ''}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="subtitle2" color="text.secondary">Seller</Typography>
                                        <Typography>{selectedTransaction.seller?.name || 'Unknown'}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedTransaction.seller?.email || ''}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Typography variant="subtitle2" color="text.secondary">Created</Typography>
                                        <Typography variant="mono" sx={{ fontSize: 13 }}>{formatDateTime(selectedTransaction.created_at)}</Typography>
                                    </Grid>
                                    {selectedTransaction.notes && (
                                        <Grid size={{ xs: 12 }}>
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
        </AppShell>
    );
};

export default AdminTransactionsPage;