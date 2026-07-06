// src/app/admin/auctions/page.tsx - Updated to show actual data correctly
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
    CardMedia,
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
    Tooltip,
    Tabs,
    Tab,
    List,
    ListItem,
    ListItemText,
    Divider,
    LinearProgress,
    Avatar
} from '@mui/material';
import {
    Gavel as GavelIcon,
    AccessTime as ClockIcon,
    Person as PersonIcon,
    AttachMoney as MoneyIcon,
    PlayArrow as StartIcon,
    Stop as EndIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Warning as WarningIcon,
    CheckCircle as CheckIcon,
    TrendingUp,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AppShell from '../../components/AppShell';

interface Card {
    id: number;
    name: string;
    set_name: string;
    image_url: string;
    small_image_url?: string;
}

interface Bid {
    id: number;
    amount: number;
    bidder: { id: number; name: string; email: string };
    created_at: string;
    is_active: boolean;
}

interface AuctionData {
    id: number;
    card: Card;
    owner: { id: number; name: string; email: string };
    condition: string;
    reserve_price: number;
    auction_end: string;
    is_sold: boolean;
    is_for_sale: boolean;
    time_remaining: number | null;
    bids: Bid[];
    highest_bid: number | null;
    bid_count: number;
    created_at: string;
}

interface PendingTransaction {
    id: number;
    buyer: { id: number; name: string; email: string };
    seller: { id: number; name: string; email: string };
    userCard: {
        card: Card;
    };
    amount: string | number;
    status: string;
    created_at: string;
    expires_at?: string;
    transaction_type?: string;
}

interface AuctionStats {
    activeAuctions: number;
    totalAuctions: number;
    activeAuctionsCount?: number;
}

export default function AdminAuctionManagement() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState(0);
    const [auctions, setAuctions] = useState<AuctionData[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
    const [stats, setStats] = useState<AuctionStats>({
        activeAuctions: 0,
        totalAuctions: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAuction, setSelectedAuction] = useState<AuctionData | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    // Redirect if not admin
    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role !== 'admin') {
            router.push('/unauthorized');
        }
    }, [status, session, router]);

    const fetchAuctions = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all auctions
            const auctionsResponse = await fetch('/api/admin/auctions?limit=100');
            if (!auctionsResponse.ok) throw new Error('Failed to fetch auctions');
            const auctionsData = await auctionsResponse.json();

            // Fetch pending transactions (specifically for auctions)
            const transactionsResponse = await fetch('/api/admin/transactions?status=PENDING_BUYER_CONFIRMATION&limit=100');
            let transactionsData = { transactions: [] };
            if (transactionsResponse.ok) {
                transactionsData = await transactionsResponse.json();
            }

            // Filter only auction-related pending transactions
            const auctionPendingTransactions = (transactionsData.transactions || []).filter((t: PendingTransaction) =>
                t.transaction_type === 'AUCTION' || t.transaction_type === 'BID_ACCEPTED'
            );

            // Set data
            setAuctions(auctionsData.auctions || []);
            setPendingTransactions(auctionPendingTransactions);
            setStats({
                activeAuctions: auctionsData.activeAuctions || 0,
                totalAuctions: auctionsData.total || 0,
                activeAuctionsCount: auctionsData.activeAuctions || 0
            });

            console.log('Fetched auction data:', {
                auctions: auctionsData.auctions?.length || 0,
                active: auctionsData.activeAuctions || 0,
                pendingTransactions: auctionPendingTransactions.length
            });

        } catch (err) {
            console.error('Error fetching auction data:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            toast.error('Failed to load auction data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role === 'admin') {
            fetchAuctions();
        }
    }, [status, session]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role === 'admin') {
            const interval = setInterval(fetchAuctions, 30000);
            return () => clearInterval(interval);
        }
    }, [status, session]);

    const formatPrice = (price: number | null) => {
        if (price === null || price === undefined) return 'No bids';
        return `$${Number(price).toFixed(2)}`;
    };

    const formatTimeLeft = (timeLeftMs: number | null) => {
        if (!timeLeftMs || timeLeftMs <= 0) return 'Ended';

        const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const getAuctionStatus = (auction: AuctionData) => {
        if (auction.is_sold) return { label: 'Sold', color: 'success' as const };
        if (!auction.is_for_sale) return { label: 'Ended', color: 'error' as const };
        if (auction.time_remaining && auction.time_remaining > 0) return { label: 'Active', color: 'primary' as const };
        return { label: 'Ended', color: 'error' as const };
    };

    const handleEndAuction = async (auctionId: number) => {
        if (!confirm('Are you sure you want to end this auction? This will process the highest bid if one exists.')) {
            return;
        }

        setActionLoading(auctionId);
        try {
            const response = await fetch('/api/admin/auctions/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ auction_id: auctionId })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Auction ended successfully');
                fetchAuctions();
                setDetailsModalOpen(false);
            } else {
                toast.error(data.error || 'Failed to end auction');
            }
        } catch (error) {
            console.error('Error ending auction:', error);
            toast.error('Failed to end auction');
        } finally {
            setActionLoading(null);
        }
    };

    const handleProcessAuctions = async () => {
        setActionLoading(-1); // Special loading state for process all
        try {
            const response = await fetch('/api/process-auctions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'admin-secret'}`,
                },
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Processed ${data.total_processed || 0} auctions/transactions`);
                fetchAuctions();
            } else {
                toast.error(data.error || 'Failed to process auctions');
            }
        } catch (error) {
            console.error('Error processing auctions:', error);
            toast.error('Failed to process auctions');
        } finally {
            setActionLoading(null);
        }
    };

    const handleForceCompleteTransaction = async (transactionId: number) => {
        if (!confirm('Are you sure you want to force complete this transaction?')) {
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
                fetchAuctions();
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

    const showAuctionDetails = (auction: AuctionData) => {
        setSelectedAuction(auction);
        setDetailsModalOpen(true);
    };

    // Get filtered auctions based on status
    const activeAuctions = auctions.filter(a => getAuctionStatus(a).label === 'Active');
    const endedAuctions = auctions.filter(a => ['Ended', 'Sold'].includes(getAuctionStatus(a).label));

    // Calculate total value of active auctions
    const totalActiveValue = activeAuctions.reduce((sum, auction) =>
        sum + (auction.highest_bid || auction.reserve_price || 0), 0
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
        <AppShell variant="admin">
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid rgba(155, 92, 255, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#9B5Cff' }}>
                        <GavelIcon />
                        Auction Management
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={actionLoading === -1 ? <CircularProgress size={16} /> : <SettingsIcon />}
                        onClick={handleProcessAuctions}
                        disabled={actionLoading !== null}
                        sx={{
                            bgcolor: '#9B5Cff',
                            color: 'grey.900',
                            '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                        }}
                    >
                        Process All Auctions
                    </Button>
                    <IconButton onClick={fetchAuctions} title="Refresh" sx={{ color: '#9B5Cff' }}>
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
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: '#9B5Cff' }}>
                                    {stats.activeAuctionsCount || activeAuctions.length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Active Auctions
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: 'warning.main' }}>
                                    {pendingTransactions.length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Pending Confirmations
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: 'success.main' }}>
                                    {endedAuctions.filter(a => a.is_sold).length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Sold Auctions
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                            <CardContent>
                                <Typography variant="h4" sx={{ color: '#9B5Cff' }}>
                                    ${totalActiveValue.toFixed(2)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Active Auction Value
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Tabs */}
                <Paper sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)', mb: 3 }}>
                    <Tabs
                        value={activeTab}
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        sx={{
                            '& .MuiTab-root': { color: 'text.secondary' },
                            '& .Mui-selected': { color: '#9B5Cff' },
                            '& .MuiTabs-indicator': { backgroundColor: '#9B5Cff' }
                        }}
                    >
                        <Tab
                            label={`Active Auctions (${activeAuctions.length})`}
                            icon={<GavelIcon />}
                        />
                        <Tab
                            label={`Ended Auctions (${endedAuctions.length})`}
                            icon={<ClockIcon />}
                        />
                        <Tab
                            label={`Pending Confirmations (${pendingTransactions.length})`}
                            icon={<WarningIcon />}
                        />
                    </Tabs>
                </Paper>

                {/* Tab Content */}
                {activeTab === 0 && (
                    /* Active Auctions */
                    <Grid container spacing={3}>
                        {activeAuctions.length === 0 ? (
                            <Grid item xs={12}>
                                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                    <GavelIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary">
                                        No active auctions
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        There are currently no auctions running
                                    </Typography>
                                </Paper>
                            </Grid>
                        ) : (
                            activeAuctions.map((auction) => (
                                <Grid item xs={12} sm={6} md={4} key={auction.id}>
                                    <Card sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        bgcolor: 'grey.800',
                                        border: '1px solid rgba(155, 92, 255, 0.2)',
                                        position: 'relative',
                                        overflow: 'visible'
                                    }}>
                                        {/* Time warning indicator */}
                                        {auction.time_remaining && auction.time_remaining < 3600000 && (
                                            <Box sx={{
                                                position: 'absolute',
                                                top: -1,
                                                left: -1,
                                                right: -1,
                                                height: 4,
                                                bgcolor: 'error.main',
                                                animation: 'pulse 2s infinite',
                                                zIndex: 1
                                            }} />
                                        )}

                                        <CardMedia
                                            component="img"
                                            height="200"
                                            image={auction.card?.image_url || '/placeholder-card.png'}
                                            alt={auction.card?.name || 'Card'}
                                            sx={{ objectFit: 'contain', bgcolor: 'grey.700', p: 1 }}
                                            onError={(e: any) => {
                                                e.target.src = '/placeholder-card.png';
                                            }}
                                        />
                                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                            <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 1 }}>
                                                {auction.card?.name || 'Unknown Card'}
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                {auction.card?.set_name || 'Unknown Set'}
                                            </Typography>

                                            <Box sx={{ mt: 'auto' }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Owner
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {auction.owner?.name || 'Unknown'}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Reserve
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {formatPrice(auction.reserve_price)}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Current Bid
                                                    </Typography>
                                                    <Typography variant="h6" color={auction.highest_bid ? 'primary.main' : 'text.secondary'}>
                                                        {formatPrice(auction.highest_bid)}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Bids
                                                    </Typography>
                                                    <Chip
                                                        label={auction.bid_count}
                                                        size="small"
                                                        color={auction.bid_count > 0 ? 'primary' : 'default'}
                                                    />
                                                </Box>

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Time Left
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: auction.time_remaining && auction.time_remaining < 3600000 ? 'error.main' : 'warning.main',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        {formatTimeLeft(auction.time_remaining)}
                                                    </Typography>
                                                </Box>

                                                {/* Progress bar for time remaining */}
                                                {auction.time_remaining && auction.auction_end && (
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={Math.max(0, Math.min(100, (auction.time_remaining / (7 * 24 * 60 * 60 * 1000)) * 100))}
                                                        sx={{
                                                            mb: 2,
                                                            height: 6,
                                                            borderRadius: 3,
                                                            bgcolor: 'grey.700',
                                                            '& .MuiLinearProgress-bar': {
                                                                bgcolor: auction.time_remaining < 3600000 ? 'error.main' : '#9B5Cff',
                                                                borderRadius: 3,
                                                            },
                                                        }}
                                                    />
                                                )}
                                            </Box>

                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    fullWidth
                                                    onClick={() => showAuctionDetails(auction)}
                                                    sx={{
                                                        borderColor: '#9B5Cff',
                                                        color: '#9B5Cff',
                                                        '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                                                    }}
                                                >
                                                    View Details
                                                </Button>

                                                <Tooltip title="End auction now">
                                                    <IconButton
                                                        color="error"
                                                        onClick={() => handleEndAuction(auction.id)}
                                                        disabled={actionLoading === auction.id}
                                                    >
                                                        {actionLoading === auction.id ? (
                                                            <CircularProgress size={20} />
                                                        ) : (
                                                            <EndIcon />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))
                        )}
                    </Grid>
                )}

                {activeTab === 1 && (
                    /* Ended Auctions */
                    <Grid container spacing={3}>
                        {endedAuctions.length === 0 ? (
                            <Grid item xs={12}>
                                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                    <ClockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary">
                                        No ended auctions
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        No auctions have ended yet
                                    </Typography>
                                </Paper>
                            </Grid>
                        ) : (
                            endedAuctions.map((auction) => (
                                <Grid item xs={12} sm={6} md={4} key={auction.id}>
                                    <Card sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        bgcolor: 'grey.800',
                                        border: `1px solid ${auction.is_sold ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)'}`
                                    }}>
                                        <CardMedia
                                            component="img"
                                            height="200"
                                            image={auction.card?.image_url || '/placeholder-card.png'}
                                            alt={auction.card?.name || 'Card'}
                                            sx={{ objectFit: 'contain', bgcolor: 'grey.700', p: 1 }}
                                            onError={(e: any) => {
                                                e.target.src = '/placeholder-card.png';
                                            }}
                                        />
                                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                                <Typography variant="h6" sx={{ color: '#9B5Cff' }}>
                                                    {auction.card?.name || 'Unknown Card'}
                                                </Typography>
                                                <Chip
                                                    label={auction.is_sold ? 'SOLD' : 'ENDED'}
                                                    color={auction.is_sold ? 'success' : 'error'}
                                                    size="small"
                                                />
                                            </Box>

                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                {auction.card?.set_name || 'Unknown Set'}
                                            </Typography>

                                            <Box sx={{ mt: 'auto' }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Owner:
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {auction.owner?.name || 'Unknown'}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Reserve:
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {formatPrice(auction.reserve_price)}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Final Bid:
                                                    </Typography>
                                                    <Typography variant="h6" sx={{ color: auction.highest_bid ? 'success.main' : 'text.secondary' }}>
                                                        {formatPrice(auction.highest_bid)}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Total Bids:
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {auction.bid_count}
                                                    </Typography>
                                                </Box>

                                                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                                                    Ended: {formatDateTime(auction.auction_end)}
                                                </Typography>

                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    fullWidth
                                                    onClick={() => showAuctionDetails(auction)}
                                                    sx={{
                                                        borderColor: '#9B5Cff',
                                                        color: '#9B5Cff',
                                                        '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                                                    }}
                                                >
                                                    View Details
                                                </Button>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))
                        )}
                    </Grid>
                )}

                {activeTab === 2 && (
                    /* Pending Confirmations */
                    <Grid container spacing={3}>
                        {pendingTransactions.length === 0 ? (
                            <Grid item xs={12}>
                                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                    <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary">
                                        No pending confirmations
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        All auction transactions are up to date
                                    </Typography>
                                </Paper>
                            </Grid>
                        ) : (
                            pendingTransactions.map((transaction) => {
                                const timeLeft = transaction.expires_at ?
                                    new Date(transaction.expires_at).getTime() - new Date().getTime() : null;
                                const isExpired = timeLeft !== null && timeLeft <= 0;

                                return (
                                    <Grid item xs={12} md={6} key={transaction.id}>
                                        <Card sx={{
                                            bgcolor: 'grey.800',
                                            border: `1px solid ${isExpired ? 'rgba(244, 67, 54, 0.5)' : 'rgba(255, 152, 0, 0.5)'}`,
                                            position: 'relative'
                                        }}>
                                            {isExpired && (
                                                <Box sx={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    height: 4,
                                                    bgcolor: 'error.main'
                                                }} />
                                            )}

                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <WarningIcon sx={{ color: isExpired ? 'error.main' : 'warning.main' }} />
                                                        <Typography variant="h6" sx={{ color: '#9B5Cff' }}>
                                                            Transaction #{transaction.id}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={isExpired ? 'EXPIRED' : 'PENDING'}
                                                        color={isExpired ? 'error' : 'warning'}
                                                        size="small"
                                                    />
                                                </Box>

                                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                                    <img
                                                        src={transaction.userCard?.card?.image_url || '/placeholder-card.png'}
                                                        alt={transaction.userCard?.card?.name || 'Card'}
                                                        style={{ width: 80, height: 80, objectFit: 'contain' }}
                                                        onError={(e: any) => {
                                                            e.target.src = '/placeholder-card.png';
                                                        }}
                                                    />
                                                    <Box sx={{ flexGrow: 1 }}>
                                                        <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                                                            {transaction.userCard?.card?.name || 'Unknown Card'}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {transaction.userCard?.card?.set_name || 'Unknown Set'}
                                                        </Typography>
                                                        <Typography variant="h6" sx={{ color: 'primary.main', mt: 1 }}>
                                                            {formatPrice(typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount)}
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                <Divider sx={{ my: 2 }} />

                                                <Grid container spacing={1}>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Buyer
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {transaction.buyer?.name || 'Unknown'}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Seller
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {transaction.seller?.name || 'Unknown'}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Created
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {formatDateTime(transaction.created_at)}
                                                        </Typography>
                                                    </Grid>
                                                    {timeLeft !== null && (
                                                        <Grid item xs={12}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Time Remaining
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ color: isExpired ? 'error.main' : 'warning.main', fontWeight: 'bold' }}>
                                                                {isExpired ? 'Expired' : formatTimeLeft(timeLeft)}
                                                            </Typography>
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={isExpired ? 0 : Math.max(0, Math.min(100, (timeLeft / (24 * 60 * 60 * 1000)) * 100))}
                                                                sx={{
                                                                    mt: 1,
                                                                    height: 6,
                                                                    borderRadius: 3,
                                                                    bgcolor: 'grey.700',
                                                                    '& .MuiLinearProgress-bar': {
                                                                        bgcolor: isExpired ? 'error.main' : 'warning.main',
                                                                        borderRadius: 3,
                                                                    },
                                                                }}
                                                            />
                                                        </Grid>
                                                    )}
                                                </Grid>

                                                <Button
                                                    variant="contained"
                                                    fullWidth
                                                    onClick={() => handleForceCompleteTransaction(transaction.id)}
                                                    disabled={actionLoading === transaction.id}
                                                    startIcon={actionLoading === transaction.id ?
                                                        <CircularProgress size={16} /> :
                                                        <CheckIcon />
                                                    }
                                                    sx={{
                                                        mt: 2,
                                                        bgcolor: isExpired ? 'error.main' : '#9B5Cff',
                                                        color: isExpired ? 'white' : 'grey.900',
                                                        '&:hover': {
                                                            bgcolor: isExpired ? 'error.dark' : 'rgba(155, 92, 255, 0.8)'
                                                        }
                                                    }}
                                                >
                                                    {actionLoading === transaction.id ?
                                                        'Processing...' :
                                                        'Force Complete Transaction'
                                                    }
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                );
                            })
                        )}
                    </Grid>
                )}
            </Container>

            {/* Auction Details Modal */}
            <Dialog
                open={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: 'grey.900',
                        border: '1px solid rgba(155, 92, 255, 0.2)',
                    }
                }}
            >
                <DialogTitle sx={{ bgcolor: 'grey.800', color: '#9B5Cff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GavelIcon />
                        <Typography variant="h6">
                            Auction Details: {selectedAuction?.card?.name || 'Unknown Card'}
                        </Typography>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ bgcolor: 'grey.800' }}>
                    {selectedAuction && (
                        <Box sx={{ pt: 2 }}>
                            {/* Auction Summary */}
                            <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.700' }}>
                                <Grid container spacing={2}>
                                    <Grid item xs={4}>
                                        <img
                                            src={selectedAuction.card?.image_url || '/placeholder-card.png'}
                                            alt={selectedAuction.card?.name || 'Card'}
                                            style={{ width: '100%', height: 'auto', maxHeight: '200px', objectFit: 'contain' }}
                                            onError={(e: any) => {
                                                e.target.src = '/placeholder-card.png';
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={8}>
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                                            <Box>
                                                <Typography variant="h6" sx={{ color: '#9B5Cff' }}>
                                                    {selectedAuction.card?.name || 'Unknown Card'}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {selectedAuction.card?.set_name || 'Unknown Set'}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={getAuctionStatus(selectedAuction).label}
                                                color={getAuctionStatus(selectedAuction).color}
                                                size="small"
                                            />
                                        </Box>

                                        <Grid container spacing={2} sx={{ mt: 1 }}>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Condition
                                                </Typography>
                                                <Typography variant="body2">
                                                    {selectedAuction.condition || 'N/A'}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Reserve Price
                                                </Typography>
                                                <Typography variant="body2">
                                                    {formatPrice(selectedAuction.reserve_price)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Owner
                                                </Typography>
                                                <Typography variant="body2">
                                                    {selectedAuction.owner?.name || 'Unknown'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {selectedAuction.owner?.email || ''}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Auction Ends
                                                </Typography>
                                                <Typography variant="body2">
                                                    {formatDateTime(selectedAuction.auction_end)}
                                                </Typography>
                                                {selectedAuction.time_remaining && selectedAuction.time_remaining > 0 && (
                                                    <Typography variant="caption" sx={{ color: 'warning.main' }}>
                                                        {formatTimeLeft(selectedAuction.time_remaining)} remaining
                                                    </Typography>
                                                )}
                                            </Grid>
                                        </Grid>

                                        <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.800', borderRadius: 1 }}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Current Bid
                                                    </Typography>
                                                    <Typography variant="h5" sx={{ color: 'primary.main' }}>
                                                        {formatPrice(selectedAuction.highest_bid)}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Total Bids
                                                    </Typography>
                                                    <Typography variant="h5">
                                                        {selectedAuction.bid_count}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Bids List */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="h6" gutterBottom sx={{ color: '#9B5Cff', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TrendingUp />
                                    Bid History ({selectedAuction.bid_count} bids)
                                </Typography>

                                {selectedAuction.bids.length === 0 ? (
                                    <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.700' }}>
                                        <Typography variant="body1" color="text.secondary">
                                            No bids received yet
                                        </Typography>
                                    </Paper>
                                ) : (
                                    <List sx={{ bgcolor: 'grey.700', borderRadius: 1, maxHeight: 300, overflow: 'auto' }}>
                                        {selectedAuction.bids
                                            .sort((a, b) => b.amount - a.amount)
                                            .map((bid, index) => (
                                                <React.Fragment key={bid.id}>
                                                    <ListItem>
                                                        <ListItemText
                                                            primary={
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Avatar sx={{ width: 32, height: 32, bgcolor: index === 0 ? 'primary.main' : 'grey.600' }}>
                                                                            {bid.bidder?.name?.charAt(0).toUpperCase() || '?'}
                                                                        </Avatar>
                                                                        <Box>
                                                                            <Typography variant="body1" sx={{ color: 'text.primary' }}>
                                                                                {bid.bidder?.name || 'Unknown'}
                                                                            </Typography>
                                                                            {index === 0 && (
                                                                                <Chip
                                                                                    label="Highest Bidder"
                                                                                    color="primary"
                                                                                    size="small"
                                                                                />
                                                                            )}
                                                                        </Box>
                                                                    </Box>
                                                                    <Typography variant="h6" color={index === 0 ? 'primary.main' : 'text.primary'}>
                                                                        {formatPrice(bid.amount)}
                                                                    </Typography>
                                                                </Box>
                                                            }
                                                            secondary={
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {bid.bidder?.email || 'No email'}
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {formatDateTime(bid.created_at)}
                                                                        </Typography>
                                                                        {!bid.is_active && (
                                                                            <Chip
                                                                                label="Inactive"
                                                                                size="small"
                                                                                sx={{ height: 16, fontSize: '0.7rem' }}
                                                                            />
                                                                        )}
                                                                    </Box>
                                                                </Box>
                                                            }
                                                        />
                                                    </ListItem>
                                                    {index < selectedAuction.bids.length - 1 && <Divider />}
                                                </React.Fragment>
                                            ))}
                                    </List>
                                )}
                            </Box>

                            {/* Additional Info */}
                            <Paper sx={{ p: 2, bgcolor: 'rgba(155, 92, 255, 0.05)', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Auction ID:</strong> #{selectedAuction.id}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Created:</strong> {formatDateTime(selectedAuction.created_at)}
                                </Typography>
                                {selectedAuction.highest_bid && selectedAuction.reserve_price && (
                                    <Typography variant="body2" sx={{
                                        mt: 1, color:
                                            selectedAuction.highest_bid >= selectedAuction.reserve_price ? 'success.main' : 'warning.main'
                                    }}>
                                        {selectedAuction.highest_bid >= selectedAuction.reserve_price ?
                                            '✓ Reserve price met' :
                                            '⚠ Reserve price not met'
                                        }
                                    </Typography>
                                )}
                            </Paper>
                        </Box>
                    )}
                </DialogContent>

                <DialogActions sx={{ bgcolor: 'grey.800', borderTop: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <Button onClick={() => setDetailsModalOpen(false)} sx={{ color: '#9B5Cff' }}>
                        Close
                    </Button>
                    {selectedAuction && getAuctionStatus(selectedAuction).label === 'Active' && (
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => {
                                handleEndAuction(selectedAuction.id);
                                setDetailsModalOpen(false);
                            }}
                            disabled={actionLoading === selectedAuction.id}
                            startIcon={actionLoading === selectedAuction.id ?
                                <CircularProgress size={16} /> :
                                <EndIcon />
                            }
                        >
                            End Auction Now
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </AppShell>
    );
}