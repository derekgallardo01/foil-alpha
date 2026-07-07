// src/app/bids/my-auctions/page.tsx - My Auctions management page
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
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
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    Gavel as GavelIcon,
    AccessTime as ClockIcon,
    Person as PersonIcon,
    Check as AcceptIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AppShell from '../../components/AppShell';
import { getRarityColor } from '../../lib/rarity';
import { formatDateTime, formatDuration } from '../../lib/format';
import { useRequireAuth } from '../../lib/useRequireAuth';

interface Card {
    id: number;
    name: string;
    set_name: string;
    set_number: string;
    rarity: string;
    image_url: string;
    small_image_url: string;
}

interface Bid {
    id: number;
    amount: number;
    bidder: { id: number; name: string; email: string };
    created_at: string;
    is_active: boolean;
}

interface MyAuction {
    id: number;
    card: Card;
    condition: string;
    reserve_price: number;
    auction_end: string;
    is_sold: boolean;
    is_for_sale: boolean;
    time_remaining: number | null;
    bids: Bid[];
    highest_bid: number | null;
    bid_count: number;
}

export default function MyAuctionsPage() {
    const { session, status } = useRequireAuth();
    const router = useRouter();
    const [auctions, setAuctions] = useState<MyAuction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAuction, setSelectedAuction] = useState<MyAuction | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [acceptingBid, setAcceptingBid] = useState<number | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        bidId: number | null;
        bidAmount: number;
        bidderName: string;
    }>({
        open: false,
        bidId: null,
        bidAmount: 0,
        bidderName: ''
    });

    const fetchMyAuctions = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/user-cards?my_auctions=true');
            if (!response.ok) {
                throw new Error('Failed to fetch auctions');
            }

            const data = await response.json();
            setAuctions(data.userCards || data);
        } catch (err) {
            console.error('Error fetching auctions:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchMyAuctions();
        }
    }, [status]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (status === 'authenticated') {
            const interval = setInterval(fetchMyAuctions, 30000);
            return () => clearInterval(interval);
        }
    }, [status]);

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${Number(price).toFixed(2)}`;
    };

    const getAuctionStatus = (auction: MyAuction) => {
        if (auction.is_sold) return { label: 'Sold', color: 'success' as const };
        if (!auction.is_for_sale) return { label: 'Ended', color: 'error' as const };
        if (auction.time_remaining && auction.time_remaining > 0) return { label: 'Active', color: 'primary' as const };
        return { label: 'Ended', color: 'error' as const };
    };

    const handleAcceptBid = (bid: Bid) => {
        setConfirmDialog({
            open: true,
            bidId: bid.id,
            bidAmount: bid.amount,
            bidderName: bid.bidder.name
        });
    };

    const confirmAcceptBid = async () => {
        if (!confirmDialog.bidId) return;

        setAcceptingBid(confirmDialog.bidId);

        try {
            const response = await fetch('/api/bids/accept', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bid_id: confirmDialog.bidId
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Bid accepted! ${data.transaction.card_name} sold to ${data.transaction.buyer_name} for ${formatPrice(data.transaction.amount)}`);
                fetchMyAuctions(); // Refresh auctions
                setDetailsModalOpen(false);
            } else {
                toast.error(data.error || 'Failed to accept bid');
            }
        } catch (error) {
            console.error('Error accepting bid:', error);
            toast.error('Failed to accept bid');
        } finally {
            setAcceptingBid(null);
            setConfirmDialog({
                open: false,
                bidId: null,
                bidAmount: 0,
                bidderName: ''
            });
        }
    };

    const showBidDetails = (auction: MyAuction) => {
        setSelectedAuction(auction);
        setDetailsModalOpen(true);
    };

    if (status === 'loading') {
        return (
            <Container>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (status === 'unauthenticated') {
        return null;
    }

    return (
        <AppShell>
            <Container sx={{ marginTop: 4, marginBottom: 4 }}>

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 3 }}>
                <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GavelIcon sx={{ color: 'primary.main' }} />
                    <Box
                        component="span"
                        sx={{
                            background: (t) => t.foil.gradient,
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        My Auctions
                    </Box>
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={fetchMyAuctions} title="Refresh">
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/marketplace')}
                        size="small"
                    >
                        Back to Marketplace
                    </Button>
                </Box>
            </Box>

            {/* Error State */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Error: {error}
                </Alert>
            )}

            {/* Loading State */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {/* Auctions Grid */}
                    {auctions.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <GavelIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No auctions found
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Start selling your cards by creating auctions in your collection
                            </Typography>
                            <Button
                                variant="contained"
                                onClick={() => router.push('/collection')}
                                sx={{ mt: 2 }}
                            >
                                Go to Collection
                            </Button>
                        </Paper>
                    ) : (
                        <Grid container spacing={3}>
                            {auctions.map((auction) => {
                                const status = getAuctionStatus(auction);
                                const isActive = status.label === 'Active';

                                return (
                                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={auction.id}>
                                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            {/* Card Image */}
                                            <Box sx={{ position: 'relative' }}>
                                                <CardMedia
                                                    component="img"
                                                    height="200"
                                                    image={auction.card.small_image_url || auction.card.image_url || '/placeholder-card.png'}
                                                    alt={auction.card.name}
                                                    sx={{ objectFit: 'contain', bgcolor: 'background.default' }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                    }}
                                                />

                                                {/* Status Badge */}
                                                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                    <Chip
                                                        label={status.label}
                                                        color={status.color}
                                                        size="small"
                                                        variant="filled"
                                                    />
                                                </Box>

                                                {/* Bid Count Badge */}
                                                {auction.bid_count > 0 && (
                                                    <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
                                                        <Chip
                                                            label={`${auction.bid_count} bid${auction.bid_count !== 1 ? 's' : ''}`}
                                                            color="secondary"
                                                            size="small"
                                                        />
                                                    </Box>
                                                )}
                                            </Box>

                                            {/* Card Content */}
                                            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                                <Typography variant="h6" component="h3" gutterBottom noWrap>
                                                    {auction.card.name}
                                                </Typography>

                                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                                    {auction.card.set_name}
                                                </Typography>

                                                <Chip
                                                    label={auction.card.rarity}
                                                    color={getRarityColor(auction.card.rarity)}
                                                    size="small"
                                                    sx={{ mb: 2, alignSelf: 'flex-start' }}
                                                />

                                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                                    Condition: {auction.condition}
                                                </Typography>

                                                <Divider sx={{ my: 1 }} />

                                                {/* Auction Info */}
                                                <Box sx={{ mt: 'auto' }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Reserve:
                                                        </Typography>
                                                        <Typography variant="mono" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                                            {formatPrice(auction.reserve_price)}
                                                        </Typography>
                                                    </Box>

                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Highest Bid:
                                                        </Typography>
                                                        <Typography
                                                            variant="mono"
                                                            sx={{ fontSize: '1.2rem', fontWeight: 700, color: auction.highest_bid ? 'text.primary' : 'text.secondary' }}
                                                        >
                                                            {formatPrice(auction.highest_bid)}
                                                        </Typography>
                                                    </Box>

                                                    {isActive && auction.time_remaining && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <ClockIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Time left:
                                                                </Typography>
                                                            </Box>
                                                            <Typography variant="body2" color="error.main">
                                                                {formatDuration(auction.time_remaining)}
                                                            </Typography>
                                                        </Box>
                                                    )}

                                                    {/* Action Buttons */}
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            fullWidth
                                                            onClick={() => showBidDetails(auction)}
                                                            disabled={auction.bid_count === 0}
                                                        >
                                                            View Bids ({auction.bid_count})
                                                        </Button>

                                                        {isActive && auction.highest_bid && (
                                                            <Tooltip title="Accept highest bid">
                                                                <IconButton
                                                                    color="success"
                                                                    onClick={() => handleAcceptBid(auction.bids[0])}
                                                                    disabled={acceptingBid === auction.bids[0]?.id}
                                                                >
                                                                    {acceptingBid === auction.bids[0]?.id ? (
                                                                        <CircularProgress size={20} />
                                                                    ) : (
                                                                        <AcceptIcon />
                                                                    )}
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    )}
                </>
            )}

            {/* Bid Details Modal */}
            <Dialog open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GavelIcon />
                        <Typography variant="h6">
                            Bids for {selectedAuction?.card.name}
                        </Typography>
                    </Box>
                </DialogTitle>

                <DialogContent>
                    {selectedAuction && (
                        <Box>
                            {/* Auction Summary */}
                            <Paper sx={{ p: 2, mb: 3 }}>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 4 }}>
                                        <img
                                            src={selectedAuction.card.small_image_url || selectedAuction.card.image_url || '/placeholder-card.png'}
                                            alt={selectedAuction.card.name}
                                            style={{ width: '100%', height: 'auto', maxHeight: '150px', objectFit: 'contain' }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 8 }}>
                                        <Typography variant="h6">{selectedAuction.card.name}</Typography>
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
                                            Ends: {formatDateTime(selectedAuction.auction_end)}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Bids List */}
                            {selectedAuction.bids.length === 0 ? (
                                <Paper sx={{ p: 3, textAlign: 'center' }}>
                                    <Typography variant="body1" color="text.secondary">
                                        No bids received yet
                                    </Typography>
                                </Paper>
                            ) : (
                                <List>
                                    {selectedAuction.bids
                                        .sort((a, b) => Number(b.amount) - Number(a.amount))
                                        .map((bid, index) => (
                                            <ListItem key={bid.id} divider>
                                                <ListItemIcon>
                                                    <PersonIcon />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Box>
                                                                <Typography variant="body1">
                                                                    {bid.bidder.name}
                                                                </Typography>
                                                                {index === 0 && (
                                                                    <Chip
                                                                        label="Highest"
                                                                        color="primary"
                                                                        size="small"
                                                                    />
                                                                )}
                                                            </Box>
                                                            <Typography variant="mono" sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'text.primary' }}>
                                                                {formatPrice(bid.amount)}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    secondary={formatDateTime(bid.created_at)}
                                                />
                                                {bid.is_active && getAuctionStatus(selectedAuction).label === 'Active' && (
                                                    <Button
                                                        variant="contained"
                                                        color="success"
                                                        size="small"
                                                        onClick={() => handleAcceptBid(bid)}
                                                        disabled={acceptingBid === bid.id}
                                                        startIcon={acceptingBid === bid.id ?
                                                            <CircularProgress size={16} /> :
                                                            <AcceptIcon />
                                                        }
                                                    >
                                                        Accept
                                                    </Button>
                                                )}
                                            </ListItem>
                                        ))}
                                </List>
                            )}
                        </Box>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setDetailsModalOpen(false)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Accept Bid Dialog */}
            <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
                <DialogTitle>Confirm Bid Acceptance</DialogTitle>
                <DialogContent>
                    <Typography variant="body1">
                        Are you sure you want to accept the bid of{' '}
                        <strong>{formatPrice(confirmDialog.bidAmount)}</strong> from{' '}
                        <strong>{confirmDialog.bidderName}</strong>?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        This action cannot be undone. The card will be sold immediately and ownership will be transferred.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
                        disabled={acceptingBid !== null}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmAcceptBid}
                        variant="contained"
                        color="success"
                        disabled={acceptingBid !== null}
                        startIcon={acceptingBid !== null ? <CircularProgress size={16} /> : <AcceptIcon />}
                    >
                        Accept Bid
                    </Button>
                </DialogActions>
            </Dialog>
            </Container>
        </AppShell>
    );
}