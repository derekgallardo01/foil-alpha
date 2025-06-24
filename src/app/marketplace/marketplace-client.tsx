// src/app/marketplace/marketplace-client.tsx - Fixed loading states
'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    IconButton,
    Grid,
    Card,
    CardContent,
    CardMedia,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Chip,
    Alert,
    CircularProgress,
    InputAdornment,
    Paper,
    Divider,
    Badge
} from '@mui/material';
import {
    Search as SearchIcon,
    Menu as MenuIcon,
    AccessTime as ClockIcon,
    AttachMoney as DollarIcon,
    Gavel as GavelIcon,
    FilterList as FilterIcon,
    Notifications as NotificationIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import Image from 'next/image';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import BiddingModal from '../components/BiddingModal';

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
    fixed_price: number | null;
    reserve_price: number | null;
    auction_end: string | null;
    current_price: number;
    highest_bid: number | null;
    bid_count: number;
    time_remaining: number | null;
    is_auction_expired?: boolean;
    notes: string | null;
}

interface MarketplaceResponse {
    listings: UserCard[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface BiddingUserCard {
    id: number;
    card: Card;
    owner: { id: number; name: string };
    condition: string;
    sale_type: 'FIXED' | 'AUCTION';
    reserve_price: number | null;
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

export default function MarketplacePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [cards, setCards] = useState<UserCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSet, setSelectedSet] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedSaleType, setSelectedSaleType] = useState('');
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    // Bidding modal state
    const [biddingModalOpen, setBiddingModalOpen] = useState(false);
    const [selectedCardForBidding, setSelectedCardForBidding] = useState<BiddingUserCard | null>(null);

    // FIXED: Individual loading states for each card
    const [purchasingCards, setPurchasingCards] = useState<Set<number>>(new Set());
    const [biddingCards, setBiddingCards] = useState<Set<number>>(new Set()); // New: track bidding loading per card

    // Extract unique sets and types from cards for filters
    const availableSets = Array.from(new Set(cards.map(card => card.card.set_name))).sort();
    const availableTypes = Array.from(new Set(cards.map(card => card.card.card_type))).sort();

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Fetch unread notifications count
    const fetchNotificationCount = async () => {
        try {
            const response = await fetch('/api/notifications?unread_only=true');
            if (response.ok) {
                const notifications = await response.json();
                setUnreadNotifications(notifications.length);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const fetchCards = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();

            if (searchTerm) params.append('search', searchTerm);
            if (selectedSet) params.append('set', selectedSet);
            if (selectedType) params.append('type', selectedType);
            if (selectedSaleType) params.append('sale_type', selectedSaleType);

            console.log('Fetching marketplace with params:', params.toString());

            const response = await fetch(`/api/marketplace?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch marketplace cards');
            }

            const data: MarketplaceResponse = await response.json();
            console.log('Marketplace data:', data);
            setCards(data.listings || []);
        } catch (err) {
            console.error('Marketplace fetch error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    // FIXED: Fetch detailed card data for bidding modal with individual loading
    const fetchCardForBidding = async (userCardId: number): Promise<BiddingUserCard | null> => {
        try {
            // Add this card to bidding loading state
            setBiddingCards(prev => new Set(prev).add(userCardId));

            // Get basic card info
            const cardResponse = await fetch(`/api/user-cards/${userCardId}`);
            if (!cardResponse.ok) throw new Error('Failed to fetch card details');
            const cardData = await cardResponse.json();

            // Get bid history
            const bidsResponse = await fetch(`/api/bids?user_card_id=${userCardId}`);
            const bidsData = bidsResponse.ok ? await bidsResponse.json() : [];

            // Transform to BiddingUserCard format
            const biddingCard: BiddingUserCard = {
                id: cardData.id,
                card: cardData.card,
                owner: cardData.owner,
                condition: cardData.condition,
                sale_type: cardData.sale_type,
                reserve_price: cardData.reserve_price,
                auction_end: cardData.auction_end,
                current_price: cardData.current_price || cardData.reserve_price || 0,
                current_highest_bid: bidsData.length > 0 ? Math.max(...bidsData.map((b: any) => Number(b.amount))) : null,
                bid_count: bidsData.length,
                time_left_ms: cardData.auction_end ? new Date(cardData.auction_end).getTime() - Date.now() : null,
                is_auction_active: cardData.auction_end ? new Date(cardData.auction_end) > new Date() : false,
                bids: bidsData.map((bid: any) => ({
                    id: bid.id,
                    amount: Number(bid.amount),
                    bidder: bid.bidder,
                    created_at: bid.created_at
                })).sort((a: any, b: any) => Number(b.amount) - Number(a.amount)) // Sort by amount descending
            };

            return biddingCard;
        } catch (error) {
            console.error('Error fetching card for bidding:', error);
            toast.error('Failed to load card details');
            return null;
        } finally {
            // Remove this card from bidding loading state
            setBiddingCards(prev => {
                const newSet = new Set(prev);
                newSet.delete(userCardId);
                return newSet;
            });
        }
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchCards();
            fetchNotificationCount();
        }
    }, [searchTerm, selectedSet, selectedType, selectedSaleType, status]);

    // Auto-refresh every 30 seconds for live auction updates
    useEffect(() => {
        if (status === 'authenticated') {
            const interval = setInterval(() => {
                fetchCards();
                fetchNotificationCount();
            }, 30000);

            return () => clearInterval(interval);
        }
    }, [status]);

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `${Number(price).toFixed(2)}`;
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

    const handlePurchase = async (userCard: UserCard) => {
        if (!session?.user?.id) {
            toast.error('Please login to purchase cards');
            return;
        }

        if (userCard.owner.id === parseInt(session.user.id)) {
            toast.error('You cannot buy your own card');
            return;
        }

        setPurchasingCards(prev => new Set(prev).add(userCard.id));

        try {
            const response = await fetch('/api/marketplace/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_card_id: userCard.id
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Successfully purchased ${data.card_name} for ${data.purchase_price}!`);
                fetchCards(); // Refresh the marketplace
                fetchNotificationCount(); // Refresh notifications
            } else {
                toast.error(data.error || 'Failed to purchase card');
            }
        } catch (error) {
            console.error('Purchase error:', error);
            toast.error('Failed to purchase card');
        } finally {
            setPurchasingCards(prev => {
                const newSet = new Set(prev);
                newSet.delete(userCard.id);
                return newSet;
            });
        }
    };

    const handleBidClick = async (userCard: UserCard) => {
        if (!session?.user?.id) {
            toast.error('Please login to place bids');
            return;
        }

        if (userCard.owner.id === parseInt(session.user.id)) {
            toast.error('You cannot bid on your own card');
            return;
        }

        const biddingCard = await fetchCardForBidding(userCard.id);
        if (biddingCard) {
            setSelectedCardForBidding(biddingCard);
            setBiddingModalOpen(true);
        }
    };

    const handleBidPlaced = () => {
        // Refresh marketplace and notifications after successful bid
        fetchCards();
        fetchNotificationCount();
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity.toLowerCase()) {
            case 'common': return 'default' as const;
            case 'uncommon': return 'success' as const;
            case 'rare': return 'primary' as const;
            case 'holo rare': return 'secondary' as const;
            case 'ultra rare': return 'error' as const;
            default: return 'default' as const;
        }
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
        <Container sx={{ marginTop: 4, marginBottom: 4 }}>
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 3 }}>
                <IconButton onClick={toggleSidebar}>
                    <MenuIcon />
                </IconButton>
                <Image
                    src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
                    alt="Logo"
                    width={120}
                    height={60}
                    priority
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton
                        onClick={() => router.push('/notifications')}
                        color={unreadNotifications > 0 ? 'primary' : 'default'}
                    >
                        <Badge badgeContent={unreadNotifications} color="error">
                            <NotificationIcon />
                        </Badge>
                    </IconButton>
                    <IconButton onClick={fetchCards} title="Refresh">
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/wallet')}
                        size="small"
                    >
                        My Wallet
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/collection')}
                        size="small"
                    >
                        My Collection
                    </Button>
                    <Typography variant="body2">
                        Welcome, {session?.user?.name}
                    </Typography>
                </Box>
            </Box>

            {/* Page Title */}
            <Box sx={{ my: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Card Marketplace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Discover and purchase Pokemon cards from other collectors
                </Typography>
            </Box>

            {/* Search and Filters */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FilterIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Search & Filters</Typography>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                        <TextField
                            fullWidth
                            label="Search cards"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Set</InputLabel>
                            <Select
                                value={selectedSet}
                                label="Set"
                                onChange={(e) => setSelectedSet(e.target.value as string)}
                            >
                                <MenuItem value="">All Sets</MenuItem>
                                {availableSets.map(set => (
                                    <MenuItem key={set} value={set}>{set}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select
                                value={selectedType}
                                label="Type"
                                onChange={(e) => setSelectedType(e.target.value as string)}
                            >
                                <MenuItem value="">All Types</MenuItem>
                                {availableTypes.map(type => (
                                    <MenuItem key={type} value={type}>{type}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Sale Type</InputLabel>
                            <Select
                                value={selectedSaleType}
                                label="Sale Type"
                                onChange={(e) => setSelectedSaleType(e.target.value as string)}
                            >
                                <MenuItem value="">All Sale Types</MenuItem>
                                <MenuItem value="FIXED">Fixed Price</MenuItem>
                                <MenuItem value="AUCTION">Auction</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

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
                    {/* Cards Grid */}
                    {cards.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="h6" color="text.secondary">
                                No cards found matching your criteria
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Try adjusting your search or filters
                            </Typography>
                        </Paper>
                    ) : (
                        <Grid container spacing={3}>
                            {cards.map((userCard) => {
                                const isCardPurchasing = purchasingCards.has(userCard.id);
                                const isCardBidding = biddingCards.has(userCard.id); // FIXED: Individual bidding state
                                const isOwnCard = userCard.owner.id === parseInt(session?.user?.id || '0');
                                const isAuctionActive = userCard.sale_type === 'AUCTION' &&
                                    userCard.time_remaining && userCard.time_remaining > 0;

                                return (
                                    <Grid item xs={12} sm={6} md={4} lg={3} key={userCard.id}>
                                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            {/* Card Image */}
                                            <Box sx={{ position: 'relative' }}>
                                                <CardMedia
                                                    component="img"
                                                    height="200"
                                                    image={userCard.card.small_image_url || userCard.card.image_url || '/placeholder-card.png'}
                                                    alt={userCard.card.name}
                                                    sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                    }}
                                                />

                                                {/* Sale Type Badge */}
                                                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                    {userCard.sale_type === 'AUCTION' ? (
                                                        <Chip
                                                            icon={<GavelIcon />}
                                                            label="Auction"
                                                            color="secondary"
                                                            size="small"
                                                        />
                                                    ) : (
                                                        <Chip
                                                            icon={<DollarIcon />}
                                                            label="Fixed"
                                                            color="primary"
                                                            size="small"
                                                        />
                                                    )}
                                                </Box>

                                                {/* Auction Status Badge */}
                                                {userCard.sale_type === 'AUCTION' && (
                                                    <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
                                                        <Chip
                                                            label={isAuctionActive ? 'Live' : 'Ended'}
                                                            color={isAuctionActive ? 'success' : 'error'}
                                                            size="small"
                                                            variant="filled"
                                                        />
                                                    </Box>
                                                )}
                                            </Box>

                                            {/* Card Content */}
                                            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                                <Typography variant="h6" component="h3" gutterBottom noWrap>
                                                    {userCard.card.name}
                                                </Typography>

                                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                                    {userCard.card.set_name} • {userCard.card.set_number}
                                                </Typography>

                                                <Chip
                                                    label={userCard.card.rarity}
                                                    color={getRarityColor(userCard.card.rarity)}
                                                    size="small"
                                                    sx={{ mb: 2, alignSelf: 'flex-start' }}
                                                />

                                                {/* Condition and Owner */}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Condition: {userCard.condition}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        by {userCard.owner.name}
                                                    </Typography>
                                                </Box>

                                                <Divider sx={{ my: 1 }} />

                                                {/* Price and Action */}
                                                <Box sx={{ mt: 'auto' }}>
                                                    {userCard.sale_type === 'FIXED' ? (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Typography variant="h6" color="primary.main">
                                                                ${formatPrice(userCard.fixed_price)}
                                                            </Typography>
                                                            <Button
                                                                variant="contained"
                                                                size="small"
                                                                onClick={() => handlePurchase(userCard)}
                                                                disabled={isCardPurchasing || isOwnCard}
                                                            >
                                                                {isCardPurchasing ? (
                                                                    <CircularProgress size={20} />
                                                                ) : isOwnCard ? (
                                                                    'Your Card'
                                                                ) : (
                                                                    'Buy Now'
                                                                )}
                                                            </Button>
                                                        </Box>
                                                    ) : (
                                                        <Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Current Bid:
                                                                </Typography>
                                                                <Typography
                                                                    variant="subtitle1"
                                                                    color="primary.main"
                                                                >
                                                                    ${formatPrice(userCard.highest_bid || userCard.reserve_price)}
                                                                </Typography>
                                                            </Box>

                                                            {isAuctionActive ? (
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                        <ClockIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            Time left:
                                                                        </Typography>
                                                                    </Box>
                                                                    <Typography variant="body2" color="error.main">
                                                                        {formatTimeLeft(userCard.time_remaining)}
                                                                    </Typography>
                                                                </Box>
                                                            ) : (
                                                                <Typography variant="body2" color="error.main" align="center" sx={{ mb: 2 }}>
                                                                    Auction Ended
                                                                </Typography>
                                                            )}

                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {userCard.bid_count} bid{userCard.bid_count !== 1 ? 's' : ''}
                                                                </Typography>
                                                                <Button
                                                                    variant="contained"
                                                                    color="secondary"
                                                                    size="small"
                                                                    onClick={() => handleBidClick(userCard)}
                                                                    disabled={!isAuctionActive || isOwnCard || isCardBidding}
                                                                >
                                                                    {isCardBidding ? (
                                                                        <CircularProgress size={20} />
                                                                    ) : isOwnCard ? (
                                                                        'Your Auction'
                                                                    ) : !isAuctionActive ? (
                                                                        'Auction Ended'
                                                                    ) : (
                                                                        'Place Bid'
                                                                    )}
                                                                </Button>
                                                            </Box>
                                                        </Box>
                                                    )}
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

            {/* Bidding Modal */}
            <BiddingModal
                open={biddingModalOpen}
                onClose={() => {
                    setBiddingModalOpen(false);
                    setSelectedCardForBidding(null);
                }}
                userCard={selectedCardForBidding}
                onBidPlaced={handleBidPlaced}
            />
        </Container>
    );
}