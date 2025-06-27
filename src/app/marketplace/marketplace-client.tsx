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
    Badge,
} from '@mui/material';
import {
    Search as SearchIcon,
    Menu as MenuIcon,
    AccessTime as ClockIcon,
    AttachMoney as DollarIcon,
    Gavel as GavelIcon,
    FilterList as FilterIcon,
    Notifications as NotificationIcon,
    Refresh as RefreshIcon,
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
    set?: any;
    rarity_info?: any;
    subtype_info?: any;
    supertype_info?: any;
}

interface Listing {
    id: string; // e.g., "catalog-123" or "user-456"
    type: 'CATALOG' | 'USER_CARD';
    user_card_id?: number; // Only for USER_CARD
    card: Card;
    owner: { id: number | null; name: string; role?: string };
    condition: string;
    sale_type: 'FIXED' | 'AUCTION';
    fixed_price: number | null;
    reserve_price: number | null;
    auction_end: string | null;
    current_price: number;
    highest_bid: number | null;
    highest_bidder?: { id: number; name: string } | null;
    bid_count: number;
    time_remaining: number | null;
    is_auction_expired?: boolean;
    notes: string | null;
    availability: 'IN_STOCK' | 'FOR_SALE';
}

interface MarketplaceResponse {
    listings: Listing[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        catalog_cards: number;
        user_cards: number;
    };
    filters: {
        sets: Array<{ name: string; count: number }>;
        types: Array<{ name: string; count: number }>;
        rarities: Array<{ name: string; count: number }>;
        price_range: { min: number; max: number; avg: number };
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
    const [cards, setCards] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSet, setSelectedSet] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedSaleType, setSelectedSaleType] = useState('');
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [availableSets, setAvailableSets] = useState<string[]>([]);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);

    // Bidding modal state
    const [biddingModalOpen, setBiddingModalOpen] = useState(false);
    const [selectedCardForBidding, setSelectedCardForBidding] = useState<BiddingUserCard | null>(null);

    // Individual loading states for each card
    const [purchasingCards, setPurchasingCards] = useState<Set<string>>(new Set());
    const [biddingCards, setBiddingCards] = useState<Set<string>>(new Set());

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

            if (searchTerm.trim()) {
                params.append('search', encodeURIComponent(searchTerm.trim()));
            }
            if (selectedSet && availableSets.includes(selectedSet)) {
                params.append('set', encodeURIComponent(selectedSet));
            }
            if (selectedType && availableTypes.includes(selectedType)) {
                params.append('type', encodeURIComponent(selectedType));
            }
            if (selectedSaleType && ['FIXED', 'AUCTION'].includes(selectedSaleType)) {
                params.append('sale_type', selectedSaleType);
            }

            console.log('Fetching marketplace with params:', params.toString());

            const response = await fetch(`/api/marketplace?${params.toString()}`);

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let errorData;
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    errorData = { rawBody: await response.text() };
                }
                console.error('API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    contentType,
                    errorData,
                    url: response.url,
                });
                throw new Error(
                    errorData.details
                        ? `Failed to fetch marketplace cards: ${errorData.details}`
                        : `Failed to fetch marketplace cards: ${response.status} ${response.statusText}`
                );
            }

            const data: MarketplaceResponse = await response.json();
            console.log('Marketplace data:', data);
            setCards(data.listings || []);
            setAvailableSets(data.filters.sets.map((s) => s.name).sort());
            setAvailableTypes(data.filters.types.map((t) => t.name).sort());
        } catch (err) {
            console.error('Marketplace fetch error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const fetchCardForBidding = async (listingId: string): Promise<BiddingUserCard | null> => {
        if (!listingId.startsWith('user-')) {
            toast.error('Bidding is only available for user cards');
            return null;
        }
        const userCardId = parseInt(listingId.replace('user-', ''));
        try {
            setBiddingCards((prev) => new Set(prev).add(listingId));
            const cardResponse = await fetch(`/api/user-cards/${userCardId}`);
            if (!cardResponse.ok) throw new Error('Failed to fetch card details');
            const cardData = await cardResponse.json();

            const bidsResponse = await fetch(`/api/bids?user_card_id=${userCardId}`);
            const bidsData = bidsResponse.ok ? await bidsResponse.json() : [];

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
                bids: bidsData
                    .map((bid: any) => ({
                        id: bid.id,
                        amount: Number(bid.amount),
                        bidder: bid.bidder,
                        created_at: bid.created_at,
                    }))
                    .sort((a: any, b: any) => Number(b.amount) - Number(a.amount)),
            };

            return biddingCard;
        } catch (error) {
            console.error('Error fetching card for bidding:', error);
            toast.error('Failed to load card details');
            return null;
        } finally {
            setBiddingCards((prev) => {
                const newSet = new Set(prev);
                newSet.delete(listingId);
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
        return price != null ? `$${Number(price).toFixed(2)}` : 'N/A';
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

    const handlePurchase = async (listing: Listing) => {
        if (!session?.user?.id) {
            toast.error('Please login to purchase cards');
            return;
        }
        if (listing.owner.id && listing.owner.id === parseInt(session.user.id)) {
            toast.error('You cannot buy your own card');
            return;
        }
        if (listing.type === 'CATALOG') {
            setPurchasingCards((prev) => new Set(prev).add(listing.id));
            try {
                const response = await fetch('/api/marketplace/purchase-catalog', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ card_id: listing.card.id }),
                });
                const data = await response.json();
                if (response.ok) {
                    toast.success(`Successfully purchased ${data.card_name} for ${data.purchase_price}!`);
                    fetchCards();
                    fetchNotificationCount();
                } else {
                    toast.error(data.error || 'Failed to purchase catalog card');
                }
            } catch (error) {
                console.error('Catalog purchase error:', error);
                toast.error('Failed to purchase catalog card');
            } finally {
                setPurchasingCards((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(listing.id);
                    return newSet;
                });
            }
        } else {
            if (!listing.user_card_id) {
                toast.error('Invalid user card ID');
                return;
            }
            setPurchasingCards((prev) => new Set(prev).add(listing.id));
            try {
                const response = await fetch('/api/marketplace/purchase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_card_id: listing.user_card_id }),
                });
                const data = await response.json();
                if (response.ok) {
                    toast.success(`Successfully purchased ${data.card_name} for ${data.purchase_price}!`);
                    fetchCards();
                    fetchNotificationCount();
                } else {
                    toast.error(data.error || 'Failed to purchase card');
                }
            } catch (error) {
                console.error('Purchase error:', error);
                toast.error('Failed to purchase card');
            } finally {
                setPurchasingCards((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(listing.id);
                    return newSet;
                });
            }
        }
    };

    const handleBidClick = async (listing: Listing) => {
        if (!session?.user?.id) {
            toast.error('Please login to place bids');
            return;
        }
        if (listing.owner.id && listing.owner.id === parseInt(session.user.id)) {
            toast.error('You cannot bid on your own card');
            return;
        }
        if (listing.type !== 'USER_CARD' || !listing.user_card_id) {
            toast.error('Bidding is only available for user cards');
            return;
        }
        const biddingCard = await fetchCardForBidding(listing.id);
        if (biddingCard) {
            setSelectedCardForBidding(biddingCard);
            setBiddingModalOpen(true);
        }
    };

    const handleBidPlaced = () => {
        fetchCards();
        fetchNotificationCount();
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity.toLowerCase()) {
            case 'common':
                return 'default' as const;
            case 'uncommon':
                return 'success' as const;
            case 'rare':
                return 'primary' as const;
            case 'holo rare':
                return 'secondary' as const;
            case 'ultra rare':
                return 'error' as const;
            default:
                return 'default' as const;
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 3 }}>
                <IconButton onClick={toggleSidebar}>
                    <MenuIcon />
                </IconButton>
                <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="Logo" width={120} height={60} priority />
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
                    <Button variant="outlined" onClick={() => router.push('/wallet')} size="small">
                        My Wallet
                    </Button>
                    <Button variant="outlined" onClick={() => router.push('/collection')} size="small">
                        My Collection
                    </Button>
                    <Typography variant="body2">Welcome, {session?.user?.name}</Typography>
                </Box>
            </Box>
            <Box sx={{ my: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Card Marketplace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Discover and purchase Pokemon cards from other collectors
                </Typography>
            </Box>
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
                                {availableSets.map((set) => (
                                    <MenuItem key={set} value={set}>
                                        {set}
                                    </MenuItem>
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
                                {availableTypes.map((type) => (
                                    <MenuItem key={type} value={type}>
                                        {type}
                                    </MenuItem>
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
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error.includes('Failed to fetch marketplace cards')
                        ? `Unable to load marketplace cards. Please try again later or contact support. (${error})`
                        : `Error: ${error}`}
                </Alert>
            )}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : cards.length === 0 ? (
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
                    {cards.map((listing) => {
                        const isCardPurchasing = purchasingCards.has(listing.id);
                        const isCardBidding = biddingCards.has(listing.id);
                        const isOwnCard = listing.owner.id && listing.owner.id === parseInt(session?.user?.id || '0');
                        const isAuctionActive =
                            listing.sale_type === 'AUCTION' && listing.time_remaining && listing.time_remaining > 0;

                        return (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={listing.id}>
                                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ position: 'relative' }}>
                                        <CardMedia
                                            component="img"
                                            height="200"
                                            image={
                                                listing.card.small_image_url ||
                                                listing.card.image_url ||
                                                '/placeholder-card.png'
                                            }
                                            alt={listing.card.name}
                                            sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                            }}
                                        />
                                        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                            {listing.sale_type === 'AUCTION' ? (
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
                                        {listing.sale_type === 'AUCTION' && (
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
                                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                        <Typography variant="h6" component="h3" gutterBottom noWrap>
                                            {listing.card.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            {listing.card.set_name} • {listing.card.set_number}
                                        </Typography>
                                        <Chip
                                            label={listing.card.rarity}
                                            color={getRarityColor(listing.card.rarity)}
                                            size="small"
                                            sx={{ mb: 2, alignSelf: 'flex-start' }}
                                        />
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Condition: {listing.condition}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                by {listing.owner.name}
                                            </Typography>
                                        </Box>
                                        <Divider sx={{ my: 1 }} />
                                        <Box sx={{ mt: 'auto' }}>
                                            {listing.sale_type === 'FIXED' ? (
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <Typography variant="h6" color="primary.main">
                                                        {formatPrice(listing.fixed_price)}
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() => handlePurchase(listing)}
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
                                                    <Box
                                                        sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
                                                    >
                                                        <Typography variant="body2" color="text.secondary">
                                                            Current Bid:
                                                        </Typography>
                                                        <Typography variant="subtitle1" color="primary.main">
                                                            {formatPrice(listing.highest_bid || listing.reserve_price)}
                                                        </Typography>
                                                    </Box>
                                                    {isAuctionActive ? (
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                mb: 2,
                                                            }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <ClockIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Time left:
                                                                </Typography>
                                                            </Box>
                                                            <Typography variant="body2" color="error.main">
                                                                {formatTimeLeft(listing.time_remaining)}
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography
                                                            variant="body2"
                                                            color="error.main"
                                                            align="center"
                                                            sx={{ mb: 2 }}
                                                        >
                                                            Auction Ended
                                                        </Typography>
                                                    )}
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <Typography variant="caption" color="text.secondary">
                                                            {listing.bid_count} bid{listing.bid_count !== 1 ? 's' : ''}
                                                        </Typography>
                                                        <Button
                                                            variant="contained"
                                                            color="secondary"
                                                            size="small"
                                                            onClick={() => handleBidClick(listing)}
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