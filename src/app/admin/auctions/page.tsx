// src/app/admin/auctions/page.tsx - Complete Admin auction management
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
    Divider
} from '@mui/material';
import {
    Gavel as GavelIcon,
    AccessTime as ClockIcon,
    Person as PersonIcon,
    AttachMoney as MoneyIcon,
    PlayArrow as StartIcon,
    Stop as EndIcon,
    Menu as MenuIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Warning as WarningIcon,
    CheckCircle as CheckIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AdminSidebar from '../../components/AdminSidebar';

interface Card {
    id: number;
    name: string;
    set_name: string;
    image_url: string;
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
    amount: number;
    status: string;
    created_at: string;
    expires_at?: string;
}

export default function AdminAuctionManagement() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [auctions, setAuctions] = useState<AuctionData[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAuction, setSelectedAuction] = useState<AuctionData | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

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

            // Fetch active auctions
            const auctionsResponse = await fetch('/api/admin/auctions');
            if (!auctionsResponse.ok) throw new Error('Failed to fetch auctions');
            const auctionsData = await auctionsResponse.json();

            // Fetch pending transactions
            const transactionsResponse = await fetch('/api/admin/transactions?status=PENDING_BUYER_CONFIRMATION');
            const transactionsData = transactionsResponse.ok ? await transactionsResponse.json() : [];

            setAuctions(auctionsData.auctions || auctionsData);
            setPendingTransactions(transactionsData.transactions || transactionsData);

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
        if (!price) return 'N/A';
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
                toast.success(`Processed ${data.total_processed} auctions/transactions`);
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
                            bgcolor: '#96ff9b',
                            color: 'grey.900',
                            '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                        }}
                    >
                        Process All Auctions
                    </Button>
                    <IconButton onClick={fetchAuctions} title="Refresh" sx={{ color: '#96ff9b' }}>
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

                {/* Tabs */}
                <Paper sx={{ bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)', mb: 3 }}>
                    <Tabs
                        value={activeTab}
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        sx={{
                            '& .MuiTab-root': { color: 'text.secondary' },
                            '& .Mui-selected': { color: '#96ff9b' },
                            '& .MuiTabs-indicator': { backgroundColor: '#96ff9b' }
                        }}
                    >
                        <Tab
                            label={`Active Auctions (${auctions.filter(a => getAuctionStatus(a).label === 'Active').length})`}
                            icon={<GavelIcon />}
                        />
                        <Tab
                            label={`Ended Auctions (${auctions.filter(a => getAuctionStatus(a).label === 'Ended').length})`}
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
                        {auctions.filter(auction => getAuctionStatus(auction).label === 'Active').map((auction) => (
                            <Grid item xs={12} sm={6} md={4} key={auction.id}>
                                <Card sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    bgcolor: 'grey.800',
                                    border: '1px solid rgba(150, 255, 155, 0.2)'
                                }}>
                                    <CardMedia
                                        component="img"
                                        height="200"
                                        image={auction.card.image_url || '/placeholder-card.png'}
                                        alt={auction.card.name}
                                        sx={{ objectFit: 'contain', bgcolor: 'grey.700' }}
                                    />
                                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                        <Typography variant="h6" sx={{ color: '#96ff9b', mb: 1 }}>
                                            {auction.card.name}
                                        </Typography>

                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            Owner: {auction.owner.name}
                                        </Typography>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Reserve:
                                            </Typography>
                                            <Typography variant="body1">
                                                {formatPrice(auction.reserve_price)}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Highest Bid:
                                            </Typography>
                                            <Typography variant="h6" color="primary.main">
                                                {formatPrice(auction.highest_bid)}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Time Left:
                                            </Typography>
                                            <Typography variant="body2" color="error.main">
                                                {formatTimeLeft(auction.time_remaining)}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                                onClick={() => showAuctionDetails(auction)}
                                                sx={{
                                                    borderColor: '#96ff9b',
                                                    color: '#96ff9b',
                                                    '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                                                }}
                                            >
                                                View Details ({auction.bid_count})
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
                        ))}

                        {auctions.filter(auction => getAuctionStatus(auction).label === 'Active').length === 0 && (
                            <Grid item xs={12}>
                                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                                    <GavelIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary">
                                        No active auctions
                                    </Typography>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>
                )}

                {activeTab === 1 && (
                    /* Ended Auctions */
                    <Grid container spacing={3}>
                        {auctions.filter(auction => getAuctionStatus(auction).label === 'Ended' || getAuctionStatus(auction).label === 'Sold').map((auction) => (
                            <Grid item xs={12} sm={6} md={4} key={auction.id}>
                                <Card sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    bgcolor: 'grey.800',
                                    border: '1px solid rgba(150, 255, 155, 0.2)'
                                }}>
                                    <CardMedia
                                        component="img"
                                        height="200"
                                        image={auction.card.image_url || '/placeholder-card.png'}
                                        alt={auction.card.name}
                                        sx={{ objectFit: 'contain', bgcolor: 'grey.700' }}
                                    />
                                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                        <Typography variant="h6" sx={{ color: '#96ff9b', mb: 1 }}>
                                            {auction.card.name}
                                        </Typography>

                                        <Chip
                                            label={getAuctionStatus(auction).label}
                                            color={getAuctionStatus(auction).color}
                                            size="small"
                                            sx={{ mb: 2, alignSelf: 'flex-start' }}
                                        />

                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            Owner: {auction.owner.name}
                                        </Typography>

                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            Final Bid: {formatPrice(auction.highest_bid)}
                                        </Typography>

                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            Ended: {formatDateTime(auction.auction_end)}
                                        </Typography>

                                        <Button
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            onClick={() => showAuctionDetails(auction)}
                                            sx={{
                                                mt: 'auto',
                                                borderColor: '#96ff9b',
                                                color: '#96ff9b',
                                                '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                                            }}
                                        >
                                            View Details
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}

                        {auctions.filter(auction => getAuctionStatus(auction).label === 'Ended' || getAuctionStatus(auction).label === 'Sold').length === 0 && (
                            <Grid item xs={12}>
                                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                                    <ClockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary">
                                        No ended auctions
                                    </Typography>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>
                )}

                {activeTab === 2 && (
                    /* Pending Confirmations */
                    <Grid container spacing={3}>
                        {pendingTransactions.map((transaction) => (
                            <Grid item xs={12} md={6} key={transaction.id}>
                                <Card sx={{
                                    bgcolor: 'grey.800',
                                    border: '1px solid rgba(255, 152, 0, 0.5)' // Warning color
                                }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <WarningIcon sx={{ color: 'warning.main', mr: 1 }} />
                                            <Typography variant="h6" sx={{ color: '#96ff9b' }}>
                                                Pending Purchase Confirmation
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                            <img
                                                src={transaction.userCard.card.image_url || '/placeholder-card.png'}
                                                alt={transaction.userCard.card.name}
                                                style={{ width: 60, height: 60, objectFit: 'contain' }}
                                            />
                                            <Box sx={{ flexGrow: 1 }}>
                                                <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
                                                    {transaction.userCard.card.name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Amount: {formatPrice(transaction.amount)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Created: {formatDateTime(transaction.created_at)}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Divider sx={{ my: 2 }} />

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Buyer:
                                            </Typography>
                                            <Typography variant="body2">
                                                {transaction.buyer.name}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Seller:
                                            </Typography>
                                            <Typography variant="body2">
                                                {transaction.seller.name}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Status:
                                            </Typography>
                                            <Chip
                                                label={transaction.status}
                                                color="warning"
                                                size="small"
                                            />
                                        </Box>

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
                                                bgcolor: '#96ff9b',
                                                color: 'grey.900',
                                                '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                                            }}
                                        >
                                            Force Complete Transaction
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}

                        {pendingTransactions.length === 0 && (
                            <Grid item xs={12}>
                                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                                    <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary">
                                        No pending confirmations
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        All transactions are up to date
                                    </Typography>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>
                )}
            </Container>

            {/* Auction Details Modal */}
            <Dialog open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ bgcolor: 'grey.800', color: '#96ff9b' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GavelIcon />
                        <Typography variant="h6">
                            Auction Details: {selectedAuction?.card.name}
                        </Typography>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ bgcolor: 'grey.800' }}>
                    {selectedAuction && (
                        <Box>
                            {/* Auction Summary */}
                            <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.700' }}>
                                <Grid container spacing={2}>
                                    <Grid item xs={4}>
                                        <img
                                            src={selectedAuction.card.image_url || '/placeholder-card.png'}
                                            alt={selectedAuction.card.name}
                                            style={{ width: '100%', height: 'auto', maxHeight: '150px', objectFit: 'contain' }}
                                        />
                                    </Grid>
                                    <Grid item xs={8}>
                                        <Typography variant="h6" sx={{ color: '#96ff9b' }}>
                                            {selectedAuction.card.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {selectedAuction.card.set_name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            Condition: {selectedAuction.condition}
                                        </Typography>
                                        <Typography variant="body2">
                                            Reserve Price: {formatPrice(selectedAuction.reserve_price)}
                                        </Typography>
                                        <Typography variant="body2">
                                            Owner: {selectedAuction.owner.name} ({selectedAuction.owner.email})
                                        </Typography>
                                        <Typography variant="body2">
                                            Ends: {formatDateTime(selectedAuction.auction_end)}
                                        </Typography>
                                        <Chip
                                            label={getAuctionStatus(selectedAuction).label}
                                            color={getAuctionStatus(selectedAuction).color}
                                            size="small"
                                            sx={{ mt: 1 }}
                                        />
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Bids List */}
                            <Typography variant="h6" gutterBottom sx={{ color: '#96ff9b' }}>
                                Bid History ({selectedAuction.bid_count} bids)
                            </Typography>

                            {selectedAuction.bids.length === 0 ? (
                                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.700' }}>
                                    <Typography variant="body1" color="text.secondary">
                                        No bids received
                                    </Typography>
                                </Paper>
                            ) : (
                                <List sx={{ bgcolor: 'grey.700', borderRadius: 1 }}>
                                    {selectedAuction.bids
                                        .sort((a, b) => Number(b.amount) - Number(a.amount))
                                        .map((bid, index) => (
                                            <React.Fragment key={bid.id}>
                                                <ListItem>
                                                    <ListItemText
                                                        primary={
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Box>
                                                                    <Typography variant="body1" sx={{ color: 'text.primary' }}>
                                                                        {bid.bidder.name} ({bid.bidder.email})
                                                                    </Typography>
                                                                    {index === 0 && (
                                                                        <Chip
                                                                            label="Highest Bidder"
                                                                            color="primary"
                                                                            size="small"
                                                                        />
                                                                    )}
                                                                </Box>
                                                                <Typography variant="h6" color="primary.main">
                                                                    {formatPrice(bid.amount)}
                                                                </Typography>
                                                            </Box>
                                                        }
                                                        secondary={
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {formatDateTime(bid.created_at)}
                                                                </Typography>
                                                                <Chip
                                                                    label={bid.is_active ? 'Active' : 'Inactive'}
                                                                    color={bid.is_active ? 'success' : 'default'}
                                                                    size="small"
                                                                    sx={{ ml: 1 }}
                                                                />
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
                    )}
                </DialogContent>

                <DialogActions sx={{ bgcolor: 'grey.800' }}>
                    <Button onClick={() => setDetailsModalOpen(false)} sx={{ color: '#96ff9b' }}>
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
        </Box>
    );
}