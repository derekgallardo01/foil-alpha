// src/app/marketplace/marketplace-client.tsx - Enhanced with pagination and catalog cards
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
    Pagination,
    Stack,
    SelectChangeEvent
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
    Store as StoreIcon,
    Person as PersonIcon,
    Sort as SortIcon
} from '@mui/icons-material';
import Image from 'next/image';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import BiddingModal from '../components/BiddingModal';
import PurchaseConfirmationModal from '../components/PurchaseConfirmationModal';

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

interface MarketplaceListing {
    id: string;
    type: 'CATALOG' | 'USER_CARD';
    user_card_id?: number;
    card: Card;
    owner: { id: number; name: string; role: string };
    condition: string;
    sale_type: 'FIXED' | 'AUCTION';
    current_price: number;
    fixed_price: number | null;
    reserve_price: number | null;
    auction_end: string | null;
    highest_bid: number | null;
    highest_bidder?: { id: number; name: string } | null;
    bid_count: number;
    time_remaining: number | null;
    is_auction_expired: boolean;
    notes: string | null;
    availability: 'IN_STOCK' | 'FOR_SALE';
    created_at: string;
}

interface MarketplaceResponse {
    listings: MarketplaceListing[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        catalog_cards: number;
        user_cards: number;
        showing: number;
    };
    filters: {
        sets: Array<{ name: string; count: number }>;
        types: Array<{ name: string; count: number }>;
        rarities: Array<{ name: string; count: number }>;
        price_range: { min: number; max: number; avg: number };
        sort_options: Array<{ value: string; label: string }>;
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
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    // Search and filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSet, setSelectedSet] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedRarity, setSelectedRarity] = useState('');
    const [selectedSaleType, setSelectedSaleType] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [priceMin, setPriceMin] = useState('');
    const [priceMax, setPriceMax] = useState('');

    // Pagination states
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        catalog_cards: 0,
        user_cards: 0,
        showing: 0
    });

    // Available filter options
    const [filterOptions, setFilterOptions] = useState({
        sets: [] as Array<{ name: string; count: number }>,
        types: [] as Array<{ name: string; count: number }>,
        rarities: [] as Array<{ name: string; count: number }>,
        price_range: { min: 0, max: 1000, avg: 50 },
        sort_options: [] as Array<{ value: string; label: string }>
    });

    // Bidding modal state
    const [biddingModalOpen, setBiddingModalOpen] = useState(false);
    const [selectedCardForBidding, setSelectedCardForBidding] = useState<BiddingUserCard | null>(null);

    // Purchase confirmation modal state
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [selectedListingForPurchase, setSelectedListingForPurchase] = useState<MarketplaceListing | null>(null);

    // Loading states for individual cards
    const [purchasingCards, setPurchasingCards] = useState<Set<string>>(new Set());
    const [biddingCards, setBiddingCards] = useState<Set<number>>(new Set());

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

    const fetchMarketplace = async (resetPage = false) => {
        try {
            setLoading(true);
            setError(null);

            const currentPage = resetPage ? 1 : page;
            if (resetPage) setPage(1);

            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '20'
            });

            if (searchTerm) params.append('search', searchTerm);
            if (selectedSet) params.append('set', selectedSet);
            if (selectedType) params.append('type', selectedType);
            if (selectedRarity) params.append('rarity', selectedRarity);
            if (selectedSaleType) params.append('sale_type', selectedSaleType);
            if (sortBy) params.append('sort_by', sortBy);
            if (priceMin) params.append('price_min', priceMin);
            if (priceMax) params.append('price_max', priceMax);

            console.log('Fetching marketplace with params:', params.toString());

            const response = await fetch(`/api/marketplace?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch marketplace');
            }

            const data: MarketplaceResponse = await response.json();
            console.log('Marketplace data:', data);

            setListings(data.listings || []);
            setPagination(data.pagination);
            setFilterOptions(data.filters);
        } catch (err) {
            console.error('Marketplace fetch error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    // Fetch detailed card data for bidding modal
    const fetchCardForBidding = async (userCardId: number): Promise<BiddingUserCard | null> => {
        try {
            setBiddingCards(prev => new Set(prev).add(userCardId));

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
                bids: bidsData.map((bid: any) => ({
                    id: bid.id,
                    amount: Number(bid.amount),
                    bidder: bid.bidder,
                    created_at: bid.created_at
                })).sort((a: any, b: any) => Number(b.amount) - Number(a.amount))
            };

            return biddingCard;
        } catch (error) {
            console.error('Error fetching card for bidding:', error);
            toast.error('Failed to load card details');
            return null;
        } finally {
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
            fetchMarketplace();
            fetchNotificationCount();
        }
    }, [page, status]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchMarketplace(true); // Reset to page 1 when filters change
        }
    }, [searchTerm, selectedSet, selectedType, selectedRarity, selectedSaleType, sortBy, priceMin, priceMax, status]);

    // Auto-refresh every 30 seconds for live updates
    useEffect(() => {
        if (status === 'authenticated') {
            const interval = setInterval(() => {
                fetchMarketplace();
                fetchNotificationCount();
            }, 30000);

            return () => clearInterval(interval);
        }
    }, [status, page, searchTerm, selectedSet, selectedType, selectedRarity, selectedSaleType, sortBy, priceMin, priceMax]);

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

    const handlePurchase = async (listing: MarketplaceListing) => {
        if (!session?.user?.id) {
            toast.error('Please login to purchase cards');
            return;
        }

        if (listing.type === 'USER_CARD' && listing.owner.id === parseInt(session.user.id)) {
            toast.error('You cannot buy your own card');
            return;
        }

        // Show purchase confirmation modal instead of direct purchase
        setSelectedListingForPurchase(listing);
        setPurchaseModalOpen(true);
    };

    const handlePurchaseComplete = () => {
        fetchMarketplace(); // Refresh the marketplace
        fetchNotificationCount(); // Refresh notifications
        setPurchaseModalOpen(false);
        setSelectedListingForPurchase(null);
    };

    const handleBidClick = async (listing: MarketplaceListing) => {
        if (!session?.user?.id) {
            toast.error('Please login to place bids');
            return;
        }

        if (listing.owner.id === parseInt(session.user.id)) {
            toast.error('You cannot bid on your own card');
            return;
        }

        if (!listing.user_card_id) {
            toast.error('Invalid auction card');
            return;
        }

        const biddingCard = await fetchCardForBidding(listing.user_card_id);
        if (biddingCard) {
            setSelectedCardForBidding(biddingCard);
            setBiddingModalOpen(true);
        }
    };

    const handleBidPlaced = () => {
        fetchMarketplace();
        fetchNotificationCount();
    };

    const handlePageChange = (event: React.ChangeEvent<unknown>, newPage: number) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSortChange = (event: SelectChangeEvent) => {
        setSortBy(event.target.value);
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
                    <IconButton onClick={() => fetchMarketplace()} title="Refresh">
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

            {/* Page Title */}
            <Box sx={{ my: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Card Marketplace
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="body1" color="text.secondary">
                        Discover and purchase Pokemon cards from our catalog and other collectors
                    </Typography>
                    {pagination.total > 0 && (
                        <Chip
                            label={`${pagination.catalog_cards} Catalog • ${pagination.user_cards} User Cards`}
                            variant="outlined"
                            size="small"
                        />
                    )}
                </Box>
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

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Set</InputLabel>
                            <Select
                                value={selectedSet}
                                label="Set"
                                onChange={(e) => setSelectedSet(e.target.value)}
                            >
                                <MenuItem value="">All Sets</MenuItem>
                                {filterOptions.sets.map(set => (
                                    <MenuItem key={set.name} value={set.name}>
                                        {set.name} ({set.count})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select
                                value={selectedType}
                                label="Type"
                                onChange={(e) => setSelectedType(e.target.value)}
                            >
                                <MenuItem value="">All Types</MenuItem>
                                {filterOptions.types.map(type => (
                                    <MenuItem key={type.name} value={type.name}>
                                        {type.name} ({type.count})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Rarity</InputLabel>
                            <Select
                                value={selectedRarity}
                                label="Rarity"
                                onChange={(e) => setSelectedRarity(e.target.value)}
                            >
                                <MenuItem value="">All Rarities</MenuItem>
                                {filterOptions.rarities.map(rarity => (
                                    <MenuItem key={rarity.name} value={rarity.name}>
                                        {rarity.name} ({rarity.count})
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
                                onChange={(e) => setSelectedSaleType(e.target.value)}
                            >
                                <MenuItem value="">All Types</MenuItem>
                                <MenuItem value="CATALOG">
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <StoreIcon sx={{ mr: 1, fontSize: 16 }} />
                                        Catalog Cards
                                    </Box>
                                </MenuItem>
                                <MenuItem value="FIXED">
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <DollarIcon sx={{ mr: 1, fontSize: 16 }} />
                                        Fixed Price
                                    </Box>
                                </MenuItem>
                                <MenuItem value="AUCTION">
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <GavelIcon sx={{ mr: 1, fontSize: 16 }} />
                                        Auctions
                                    </Box>
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>

                {/* Second row - Price range and sorting */}
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={2}>
                        <TextField
                            fullWidth
                            label="Min Price"
                            type="number"
                            value={priceMin}
                            onChange={(e) => setPriceMin(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <TextField
                            fullWidth
                            label="Max Price"
                            type="number"
                            value={priceMax}
                            onChange={(e) => setPriceMax(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Sort By</InputLabel>
                            <Select
                                value={sortBy}
                                label="Sort By"
                                onChange={handleSortChange}
                                startAdornment={<SortIcon sx={{ mr: 1 }} />}
                            >
                                {filterOptions.sort_options.map(option => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedSet('');
                                setSelectedType('');
                                setSelectedRarity('');
                                setSelectedSaleType('');
                                setPriceMin('');
                                setPriceMax('');
                                setSortBy('newest');
                            }}
                            sx={{ height: '56px' }}
                        >
                            Reset Filters
                        </Button>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => fetchMarketplace(true)}
                            disabled={loading}
                            sx={{ height: '56px' }}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Apply Filters'}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Results Summary */}
            {pagination.total > 0 && (
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        Showing {pagination.showing} of {pagination.total} cards
                        ({pagination.catalog_cards} catalog, {pagination.user_cards} user cards)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Page {pagination.page} of {pagination.totalPages}
                    </Typography>
                </Box>
            )}

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
                    {listings.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="h6" color="text.secondary">
                                No cards found matching your criteria
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Try adjusting your search or filters
                            </Typography>
                        </Paper>
                    ) : (
                        <>
                            <Grid container spacing={3}>
                                {listings.map((listing) => {
                                    const isCardPurchasing = purchasingCards.has(listing.id);
                                    const isCardBidding = listing.user_card_id ? biddingCards.has(listing.user_card_id) : false;
                                    const isOwnCard = listing.owner.id === parseInt(session?.user?.id || '0');
                                    const isAuctionActive = listing.sale_type === 'AUCTION' &&
                                        listing.time_remaining && listing.time_remaining > 0;

                                    return (
                                        <Grid item xs={12} sm={6} md={4} lg={3} key={listing.id}>
                                            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                                {/* Card Image */}
                                                <Box sx={{ position: 'relative' }}>
                                                    <CardMedia
                                                        component="img"
                                                        height="200"
                                                        image={listing.card.small_image_url || listing.card.image_url || '/placeholder-card.png'}
                                                        alt={listing.card.name}
                                                        sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                        }}
                                                    />

                                                    {/* Listing Type Badge */}
                                                    <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                        {listing.type === 'CATALOG' ? (
                                                            <Chip
                                                                icon={<StoreIcon />}
                                                                label="Catalog"
                                                                color="info"
                                                                size="small"
                                                                variant="filled"
                                                            />
                                                        ) : listing.sale_type === 'AUCTION' ? (
                                                            <Chip
                                                                icon={<GavelIcon />}
                                                                label="Auction"
                                                                color="secondary"
                                                                size="small"
                                                            />
                                                        ) : (
                                                            <Chip
                                                                icon={<PersonIcon />}
                                                                label="User"
                                                                color="primary"
                                                                size="small"
                                                            />
                                                        )}
                                                    </Box>

                                                    {/* Auction Status Badge */}
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

                                                {/* Card Content */}
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

                                                    {/* Condition and Owner */}
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Condition: {listing.condition}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            by {listing.owner.name}
                                                        </Typography>
                                                    </Box>

                                                    <Divider sx={{ my: 1 }} />

                                                    {/* Price and Action */}
                                                    <Box sx={{ mt: 'auto' }}>
                                                        {listing.sale_type === 'FIXED' || listing.type === 'CATALOG' ? (
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Typography variant="h6" color="primary.main">
                                                                    {formatPrice(listing.current_price)}
                                                                </Typography>
                                                                <Button
                                                                    variant="contained"
                                                                    size="small"
                                                                    onClick={() => handlePurchase(listing)}
                                                                    disabled={isOwnCard}
                                                                >
                                                                    {isOwnCard ? (
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
                                                                    <Typography variant="subtitle1" color="primary.main">
                                                                        {formatPrice(listing.highest_bid || listing.reserve_price)}
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
                                                                            {formatTimeLeft(listing.time_remaining)}
                                                                        </Typography>
                                                                    </Box>
                                                                ) : (
                                                                    <Typography variant="body2" color="error.main" align="center" sx={{ mb: 2 }}>
                                                                        Auction Ended
                                                                    </Typography>
                                                                )}

                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                                    <Stack spacing={2}>
                                        <Pagination
                                            count={pagination.totalPages}
                                            page={pagination.page}
                                            onChange={handlePageChange}
                                            color="primary"
                                            size="large"
                                            showFirstButton
                                            showLastButton
                                        />
                                        <Typography variant="body2" color="text.secondary" align="center">
                                            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                            {pagination.total} cards
                                        </Typography>
                                    </Stack>
                                </Box>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Purchase Confirmation Modal */}
            <PurchaseConfirmationModal
                open={purchaseModalOpen}
                onClose={() => {
                    setPurchaseModalOpen(false);
                    setSelectedListingForPurchase(null);
                }}
                listingData={selectedListingForPurchase}
                onPurchaseComplete={handlePurchaseComplete}
            />

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