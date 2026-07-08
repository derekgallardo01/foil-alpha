'use client';
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Card,
    CardMedia,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText,
    Alert,
    CircularProgress,
    Paper,
    InputAdornment
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    AccessTime as ClockIcon,
    Gavel as GavelIcon,
    Person as PersonIcon,
    TrendingUp as TrendingIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { getRarityColor } from '../lib/rarity';
import WatchButton from './WatchButton';
import { formatDateTime, formatDuration, formatPriceNA as formatPrice } from '../lib/format';

interface Card {
    id: number;
    name: string;
    set_name: string;
    set_number: string;
    rarity: string;
    card_type: string;
    image_url: string;
    small_image_url: string;
}

interface UserCard {
    id: number;
    card: Card;
    owner: { id: number; name: string };
    condition: string;
    sale_type: 'FIXED' | 'AUCTION';
    reserve_price: number | null;
    buy_now_price: number | null;
    auction_end: string | null;
    current_price: number;
    current_highest_bid: number | null;
    bid_count: number;
    time_left_ms: number | null;
    is_auction_active: boolean;
    bids: Array<{
        id: number;
        amount: number;
        bidder: { id: number; name: string };
        created_at: string;
    }>;
}

interface BiddingModalProps {
    open: boolean;
    onClose: () => void;
    userCard: UserCard | null;
    onBidPlaced?: () => void;
}

export default function BiddingModal({ open, onClose, userCard, onBidPlaced }: BiddingModalProps) {
    const [bidAmount, setBidAmount] = useState('');
    const [maxBid, setMaxBid] = useState('');
    const [loading, setLoading] = useState(false);
    const [buying, setBuying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    // Update countdown timer
    useEffect(() => {
        if (!userCard?.time_left_ms) return;

        setTimeLeft(userCard.time_left_ms);

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev === null || prev <= 0) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [userCard?.time_left_ms]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (open) {
            setBidAmount('');
            setMaxBid('');
            setError(null);
            setSuccess(null);

            // Set suggested bid amount
            if (userCard) {
                const currentHighest = Number(userCard.current_highest_bid) || 0;
                const reservePrice = Number(userCard.reserve_price) || 0;
                const minimumBid = currentHighest > 0
                    ? currentHighest + 0.50
                    : reservePrice + 0.01;

                setBidAmount(Number(minimumBid).toFixed(2));
            }
        }
    }, [open, userCard]);


    const getMinimumBid = () => {
        if (!userCard) return 0;
        const currentHighest = Number(userCard.current_highest_bid) || 0;
        const reservePrice = Number(userCard.reserve_price) || 0;

        return currentHighest > 0
            ? currentHighest + 0.50
            : reservePrice + 0.01;
    };

    const validateBid = () => {
        const amount = parseFloat(bidAmount);
        const minimum = getMinimumBid();

        if (isNaN(amount) || amount <= 0) {
            setError('Please enter a valid bid amount');
            return false;
        }

        if (amount < minimum) {
            setError(`Bid must be at least ${formatPrice(minimum)}`);
            return false;
        }

        if (maxBid.trim() !== '') {
            const max = parseFloat(maxBid);
            if (isNaN(max) || max < amount) {
                setError('Your maximum bid must be at least your bid amount.');
                return false;
            }
        }

        return true;
    };

    const handleBuyNow = async () => {
        if (!userCard || userCard.buy_now_price == null) return;
        if (!window.confirm(`Buy this card now for ${formatPrice(userCard.buy_now_price)}?`)) return;
        setBuying(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch('/api/marketplace/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_card_id: userCard.id, buy_now: true }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.details || 'Purchase failed');
            setSuccess(`Purchased ${userCard.card.name} for ${formatPrice(userCard.buy_now_price)}!`);
            if (onBidPlaced) onBidPlaced();
            setTimeout(() => onClose(), 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setBuying(false);
        }
    };

    const handlePlaceBid = async () => {
        if (!userCard || !validateBid()) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/bids', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_card_id: userCard.id,
                    amount: parseFloat(bidAmount),
                    ...(maxBid.trim() !== '' ? { max_amount: parseFloat(maxBid) } : {}),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to place bid');
            }

            setSuccess(data.message || 'Bid placed successfully!');
            setBidAmount('');
            setMaxBid('');

            // Call the callback to refresh the parent component
            if (onBidPlaced) {
                onBidPlaced();
            }

            // Close modal after short delay
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (!userCard) return null;

    const isAuctionEnded = !userCard.is_auction_active || (timeLeft !== null && timeLeft <= 0);
    const minimumBid = getMinimumBid();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GavelIcon color="secondary" />
                    <Typography variant="h6">Place Bid</Typography>
                    <Box sx={{ ml: 'auto' }}>
                        <WatchButton userCardId={userCard.id} />
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Grid container spacing={3}>
                    {/* Card Information */}
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Card>
                            <CardMedia
                                component="img"
                                height="250"
                                image={userCard.card.image_url || userCard.card.small_image_url || '/placeholder-card.png'}
                                alt={userCard.card.name}
                                sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                }}
                            />
                            <Box sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom>
                                    {userCard.card.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    {userCard.card.set_name} • {userCard.card.set_number}
                                </Typography>
                                <Chip
                                    label={userCard.card.rarity}
                                    color={getRarityColor(userCard.card.rarity)}
                                    size="small"
                                    sx={{ mb: 1 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    Condition: {userCard.condition}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Seller: {userCard.owner.name}
                                </Typography>
                            </Box>
                        </Card>
                    </Grid>

                    {/* Auction Information */}
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Paper sx={{ p: 3, mb: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                Auction Details
                            </Typography>

                            <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Reserve Price:
                                    </Typography>
                                    <Typography variant="mono" color="text.primary">
                                        {formatPrice(userCard.reserve_price)}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Current Highest Bid:
                                    </Typography>
                                    <Typography variant="mono" sx={{ color: 'success.main', fontSize: 18, fontWeight: 700 }}>
                                        {formatPrice(userCard.current_highest_bid || userCard.reserve_price)}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Total Bids:
                                    </Typography>
                                    <Typography variant="mono" color="text.primary">
                                        {userCard.bid_count}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* New Flow Information */}
                            <Alert
                                severity="info"
                                icon={<InfoIcon />}
                                sx={{ mb: 2 }}
                            >
                                <Typography variant="body2">
                                    <strong>New Bidding Process:</strong> Funds are not reserved when bidding.
                                    If you win, you'll have 24 hours to confirm your purchase.
                                    The seller can also accept your bid before the auction ends.
                                </Typography>
                            </Alert>

                            {/* Countdown Timer */}
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                p: 2,
                                bgcolor: isAuctionEnded ? 'error.light' : 'warning.light',
                                borderRadius: 1,
                                mb: 2
                            }}>
                                <ClockIcon />
                                <Typography variant="body1" fontWeight="bold">
                                    {isAuctionEnded ? 'Auction Ended' : `Time Left: ${formatDuration(timeLeft)}`}
                                </Typography>
                            </Box>

                            {/* Bid Placement */}
                            {!isAuctionEnded && (
                                <Box>
                                    <Typography variant="subtitle1" gutterBottom>
                                        Place Your Bid
                                    </Typography>

                                    <TextField
                                        fullWidth
                                        label="Bid Amount"
                                        type="number"
                                        value={bidAmount}
                                        onChange={(e) => setBidAmount(e.target.value)}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                        }}
                                        helperText={`Minimum bid: ${formatPrice(minimumBid)} • your bid is held in escrow until the auction ends`}
                                        sx={{ mb: 2 }}
                                        disabled={loading}
                                    />

                                    <TextField
                                        fullWidth
                                        label="Maximum bid (optional)"
                                        type="number"
                                        value={maxBid}
                                        onChange={(e) => setMaxBid(e.target.value)}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                        }}
                                        helperText="Set a max and we'll auto-bid for you up to it, only as much as needed to stay ahead. Your max is reserved while you're the top bidder."
                                        sx={{ mb: 2 }}
                                        disabled={loading}
                                    />

                                    {error && (
                                        <Alert severity="error" sx={{ mb: 2 }}>
                                            {error}
                                        </Alert>
                                    )}

                                    {success && (
                                        <Alert severity="success" sx={{ mb: 2 }}>
                                            {success}
                                        </Alert>
                                    )}

                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        fullWidth
                                        onClick={handlePlaceBid}
                                        disabled={loading || isAuctionEnded}
                                        startIcon={loading ? <CircularProgress size={20} /> : <TrendingIcon />}
                                    >
                                        {loading ? 'Placing Bid...' : `Place Bid - ${formatPrice(parseFloat(bidAmount) || 0)}`}
                                    </Button>

                                    {userCard.buy_now_price != null && !isAuctionEnded && (
                                        <Button
                                            variant="outlined"
                                            color="primary"
                                            fullWidth
                                            onClick={handleBuyNow}
                                            disabled={buying || loading}
                                            sx={{ mt: 1 }}
                                        >
                                            {buying ? 'Buying…' : `Buy It Now - ${formatPrice(userCard.buy_now_price)}`}
                                        </Button>
                                    )}

                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                                        By placing a bid, you agree to purchase if you win or if the seller accepts your bid
                                    </Typography>
                                </Box>
                            )}
                        </Paper>

                        {/* Bid History */}
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Bid History
                            </Typography>

                            {userCard.bids.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                                    No bids yet. Be the first to bid!
                                </Typography>
                            ) : (
                                <List sx={{ maxHeight: 200, overflow: 'auto' }}>
                                    {userCard.bids.map((bid, index) => (
                                        <React.Fragment key={bid.id}>
                                            <ListItem sx={{ px: 0 }}>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <PersonIcon fontSize="small" />
                                                                <Typography variant="body1">
                                                                    {bid.bidder.name}
                                                                </Typography>
                                                                {index === 0 && (
                                                                    <Chip label="Highest" color="primary" size="small" />
                                                                )}
                                                            </Box>
                                                            <Typography variant="mono" sx={{ color: 'text.primary', fontSize: 16, fontWeight: 700 }}>
                                                                {formatPrice(bid.amount)}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    secondary={formatDateTime(bid.created_at)}
                                                />
                                            </ListItem>
                                            {index < userCard.bids.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}