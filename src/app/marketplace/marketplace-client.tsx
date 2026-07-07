'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    IconButton,
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Slider,
    FormLabel,
    LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    Search as SearchIcon,
    AccessTime as ClockIcon,
    AttachMoney as DollarIcon,
    Gavel as GavelIcon,
    FilterList as FilterIcon,
    Notifications as NotificationIcon,
    Refresh as RefreshIcon,
    History,
    PriceCheck,
    Add as AddIcon,
    CurrencyExchange,
    Clear as ClearIcon,
    Storefront as StorefrontIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AppShell from '../components/AppShell';
import BiddingModal from '../components/BiddingModal';
import PriceChart from '../components/PriceChart';
import PriceHistoryModal from '../components/PriceHistoryModal';
import PriceDisplay, { LargePriceDisplay, PriceWithReference } from '../components/PriceDisplay';
import CurrencySelector from '../components/CurrencySelector';
import { useCurrencyContext } from '../lib/currency-context';
import { getRarityColor } from '../lib/rarity';
import { formatDuration } from '../lib/format';
import PurchaseConfirmationModal from '../components/PurchaseConfirmationModal';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import { CardGridSkeleton } from '../components/ui/Skeletons';
import { useRequireAuth } from '../lib/useRequireAuth';
import { PriceComparisonBox, MarketSummarySection, DailyDealsSection } from './MarketplaceSections';

export interface Card {
    id: number;
    name: string;
    set_name: string;
    set_number: string;
    rarity: string;
    card_type: string;
    image_url: string;
    small_image_url: string;
    market_price?: number;
    price_trend?: 'up' | 'down' | 'stable';
    price_change_24h?: number;
    last_price_update?: string;
    set?: any;
    rarity_info?: any;
    subtype_info?: any;
    supertype_info?: any;
}

export interface Listing {
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

export interface EnhancedListing extends Listing {
    market_price?: number;
    price_trend?: 'up' | 'down' | 'stable';
    price_change_24h?: number;
    last_price_update?: string;
    user_vs_market_diff?: number;
}

interface MarketplaceResponse {
    listings: Listing[];
    pagination: {
        showAll: any;
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

// FIXED: Debounced search hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default function MarketplacePage() {
    const { session, status } = useRequireAuth();
    const router = useRouter();
    const { selectedCurrency, isUSDFallback } = useCurrencyContext();
    const [cards, setCards] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // FIXED: Enhanced search and filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSet, setSelectedSet] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedRarity, setSelectedRarity] = useState(''); // FIXED: Added rarity state
    const [selectedSaleType, setSelectedSaleType] = useState('');
    const [priceStatusFilter, setPriceStatusFilter] = useState('');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]); // FIXED: Added price range
    const [sortBy, setSortBy] = useState('newest');

    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [availableSets, setAvailableSets] = useState<{ name: string; count: number }[]>([]);
    const [availableTypes, setAvailableTypes] = useState<{ name: string; count: number }[]>([]);
    const [availableRarities, setAvailableRarities] = useState<{ name: string; count: number }[]>([]); // FIXED: Added rarities
    const [priceRangeInfo, setPriceRangeInfo] = useState({ min: 0, max: 1000, avg: 50 }); // FIXED: Added price range info

    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [selectedListingForPurchase, setSelectedListingForPurchase] = useState<Listing | null>(null);

    // Price history modal state
    const [priceHistoryModalOpen, setPriceHistoryModalOpen] = useState(false);
    const [selectedCardForHistory, setSelectedCardForHistory] = useState<{
        cardId?: number;
        userCardId?: number;
        cardName: string;
    } | null>(null);

    // Bidding modal state
    const [biddingModalOpen, setBiddingModalOpen] = useState(false);
    const [selectedCardForBidding, setSelectedCardForBidding] = useState<BiddingUserCard | null>(null);

    // Individual loading states for each card
    const [purchasingCards, setPurchasingCards] = useState<Set<string>>(new Set());
    const [biddingCards, setBiddingCards] = useState<Set<string>>(new Set());

    const isAdmin = session?.user?.role === 'admin';

    // FIXED: Debounced search to prevent excessive API calls
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

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

    // FIXED: Improved fetchCards function with stable dependencies
    const fetchCards = useCallback(async (forceFresh: boolean = false) => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();

            // Show all cards instead of limiting
            params.append('show_all', 'true');

            // Add cache buster for fresh data
            if (forceFresh) {
                params.append('_t', Date.now().toString());
            }

            // FIXED: Add all filter parameters to API call
            if (debouncedSearchTerm.trim()) {
                params.append('search', encodeURIComponent(debouncedSearchTerm.trim()));
            }
            if (selectedSet) {
                params.append('set', encodeURIComponent(selectedSet));
            }
            if (selectedType) {
                params.append('type', encodeURIComponent(selectedType));
            }
            // FIXED: Add rarity filter - this was missing!
            if (selectedRarity) {
                params.append('rarity', encodeURIComponent(selectedRarity));
            }
            if (selectedSaleType && ['FIXED', 'AUCTION'].includes(selectedSaleType)) {
                params.append('sale_type', selectedSaleType);
            }
            // FIXED: Add price range filters
            if (priceRange[0] > 0) {
                params.append('price_min', priceRange[0].toString());
            }
            if (priceRange[1] < 10000) { // Use a high number instead of priceRangeInfo.max
                params.append('price_max', priceRange[1].toString());
            }
            if (priceStatusFilter && ['below_market', 'at_market', 'above_market', 'good_deals'].includes(priceStatusFilter)) {
                params.append('price_status', priceStatusFilter);
            }
            if (sortBy) {
                params.append('sort_by', sortBy);
            }

            const response = await fetch(`/api/marketplace?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    console.error('Could not parse error response:', jsonError);
                    errorData = {
                        rawBody: await response.text(),
                        status: response.status,
                        statusText: response.statusText
                    };
                }

                console.error('Marketplace API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData,
                    url: response.url,
                });

                throw new Error(
                    errorData.details || errorData.error ||
                    `Failed to fetch marketplace cards: ${response.status} ${response.statusText}`
                );
            }

            const data: MarketplaceResponse = await response.json();
            setCards(data.listings || []);

            // FIXED: Update filter options with proper structure
            if (data.filters) {
                setAvailableSets(data.filters.sets || []);
                setAvailableTypes(data.filters.types || []);
                setAvailableRarities(data.filters.rarities || []);
                setPriceRangeInfo(data.filters.price_range || { min: 0, max: 1000, avg: 50 });

                // FIXED: Only update price range on first load or when explicitly cleared
                if ((priceRange[0] === 0 && priceRange[1] === 1000) || forceFresh) {
                    if (data.filters.price_range) {
                        setPriceRange([data.filters.price_range.min, data.filters.price_range.max]);
                    }
                }
            }
        } catch (err) {
            console.error('Marketplace fetch error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
        } finally {
            setLoading(false);
        }
    }, [
        // FIXED: Only include primitive values and simple state variables as dependencies
        debouncedSearchTerm,
        selectedSet,
        selectedType,
        selectedRarity,
        selectedSaleType,
        priceStatusFilter,
        sortBy,
        priceRange[0],
        priceRange[1]
        // REMOVED: availableSets, availableTypes, availableRarities, priceRangeInfo
        // These caused infinite loops because they're objects that change reference
    ]);

    // FIXED: Clear all filters function with stable price range reset
    const clearAllFilters = useCallback(() => {
        setSearchTerm('');
        setSelectedSet('');
        setSelectedType('');
        setSelectedRarity('');
        setSelectedSaleType('');
        setPriceStatusFilter('');
        setPriceRange([0, 1000]); // Use fixed values instead of priceRangeInfo
        setSortBy('newest');
    }, []); // No dependencies needed since we're using fixed values

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

    const showPriceHistory = (listing: Listing) => {
        setSelectedCardForHistory({
            cardId: listing.card.id,
            userCardId: listing.type === 'USER_CARD' ? listing.user_card_id : undefined,
            cardName: listing.card.name
        });
        setPriceHistoryModalOpen(true);
    };

    const handleMissingPriceData = (listing: Listing) => {
        toast.info(`Price data not available for ${listing.card.name}. Requesting update...`);

        // Call price sync for this specific card
        fetch('/api/cards/sync-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cardIds: [listing.card.id],
                force: true,
            }),
        }).then(response => response.json())
            .then(data => {
                if (data.success) {
                    toast.success('Price data updated! Refreshing...');
                    fetchCards(); // Refresh the marketplace
                }
            })
            .catch(() => {
                toast.error('Failed to update price data');
            });
    };

    // FIXED: Use debounced search term and callback in effect
    useEffect(() => {
        if (status === 'authenticated') {
            fetchCards();
        }
    }, [status, fetchCards]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchNotificationCount();
            const interval = setInterval(() => {
                fetchNotificationCount();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [status]);

    const handlePurchase = async (listing: Listing) => {
        if (!session?.user?.id) {
            toast.error('Please login to purchase cards');
            return;
        }

        if (listing.owner.id && listing.owner.id === parseInt(session.user.id)) {
            toast.error('You cannot buy your own card');
            return;
        }

        // Convert listing to the format expected by the purchase modal
        const listingData = {
            id: listing.id,
            type: listing.type,
            user_card_id: listing.user_card_id,
            card: {
                id: listing.card.id,
                name: listing.card.name,
                set_name: listing.card.set_name,
                set_number: listing.card.set_number || '',
                rarity: listing.card.rarity,
                image_url: listing.card.image_url || '',
                small_image_url: listing.card.small_image_url || ''
            },
            owner: {
                id: typeof listing.owner.id === 'number' ? listing.owner.id : 0,
                name: listing.owner.name,
                role: listing.owner.role || 'user'
            },
            condition: listing.condition,
            current_price: listing.fixed_price || listing.current_price || 0,
            availability: listing.availability
        };

        // Open the purchase confirmation modal
        setSelectedListingForPurchase(listingData as any);
        setPurchaseModalOpen(true);

        // Add a small delay to ensure DB transaction is committed
        setTimeout(() => {
            fetchCards();
            fetchNotificationCount();

            // Dispatch custom event for wallet refresh
            window.dispatchEvent(new CustomEvent('purchaseComplete', {
                detail: { timestamp: new Date().toISOString() }
            }));
        }, 500); // 500ms delay
    };

    const handlePurchaseComplete = () => {
        // Close the modal
        setPurchaseModalOpen(false);
        setSelectedListingForPurchase(null);

        // Refresh data with a delay to ensure DB transaction is committed
        setTimeout(() => {
            fetchCards(true); // Force fresh fetch
            fetchNotificationCount();

            // Dispatch custom event for wallet refresh
            window.dispatchEvent(new CustomEvent('purchaseComplete', {
                detail: { timestamp: new Date().toISOString() }
            }));
        }, 500); // 500ms delay
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
            <PageHeader
                title="Card Marketplace"
                icon={<StorefrontIcon />}
                actions={
                    <>
                        {!isAdmin && (
                            <Box sx={{ minWidth: 120 }}>
                                <CurrencySelector size="small" />
                            </Box>
                        )}
                        <IconButton
                            onClick={() => router.push('/notifications')}
                            color={unreadNotifications > 0 ? 'primary' : 'default'}
                            aria-label="Notifications"
                        >
                            <Badge badgeContent={unreadNotifications} color="error">
                                <NotificationIcon />
                            </Badge>
                        </IconButton>
                        <IconButton onClick={() => fetchCards(true)} title="Refresh" aria-label="Refresh listings">
                            <RefreshIcon />
                        </IconButton>
                        <Button variant="outlined" onClick={() => router.push('/wallet')} size="small">
                            Wallet
                        </Button>
                        <Button variant="outlined" onClick={() => router.push('/collection')} size="small">
                            Collection
                        </Button>
                    </>
                }
            />
        <Container maxWidth="xl" sx={{ pb: 4 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Discover and purchase Pokémon cards from other collectors
            </Typography>

            {/* Currency Info Banners */}
            {!isAdmin && selectedCurrency !== 'USD' && !isUSDFallback && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">
                            Displaying prices in {selectedCurrency}. All transactions are processed in USD.
                        </Typography>
                        <Chip
                            icon={<CurrencyExchange />}
                            label={`Viewing in ${selectedCurrency}`}
                            size="small"
                            color="primary"
                        />
                    </Box>
                </Alert>
            )}

            {isUSDFallback && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                        Currency service is currently unavailable. Showing USD prices.
                    </Typography>
                </Alert>
            )}

            {/* Market Summary */}
            <MarketSummarySection cards={cards as EnhancedListing[]} />


            {/* Daily Deals */}
            <DailyDealsSection cards={cards as EnhancedListing[]} />

            {/* FIXED: Enhanced Search & Filters Section */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <FilterIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6">Search & Filters</Typography>
                        <Chip
                            label={`${cards.length} results`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ ml: 2 }}
                        />
                    </Box>
                    <Button
                        onClick={clearAllFilters}
                        startIcon={<ClearIcon />}
                        size="small"
                        variant="outlined"
                    >
                        Clear All
                    </Button>
                </Box>

                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 3 }}>
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
                            helperText="Search by name, set, rarity, or card number"
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Set</InputLabel>
                            <Select
                                value={selectedSet}
                                label="Set"
                                onChange={(e) => setSelectedSet(e.target.value as string)}
                            >
                                <MenuItem value="">All Sets</MenuItem>
                                {availableSets.map((set) => (
                                    <MenuItem key={set.name} value={set.name}>
                                        {set.name} ({set.count})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Rarity</InputLabel>
                            <Select
                                value={selectedRarity}
                                label="Rarity"
                                onChange={(e) => setSelectedRarity(e.target.value as string)}
                            >
                                <MenuItem value="">All Rarities</MenuItem>
                                {availableRarities.map((rarity) => (
                                    <MenuItem key={rarity.name} value={rarity.name}>
                                        {rarity.name} ({rarity.count})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 1.5 }}>
                        <FormControl fullWidth>
                            <InputLabel>Sale Type</InputLabel>
                            <Select
                                value={selectedSaleType}
                                label="Sale Type"
                                onChange={(e) => setSelectedSaleType(e.target.value as string)}
                            >
                                <MenuItem value="">All Types</MenuItem>
                                <MenuItem value="FIXED">Fixed Price</MenuItem>
                                <MenuItem value="AUCTION">Auction</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 1.5 }}>
                        <FormControl fullWidth>
                            <InputLabel>Price Status</InputLabel>
                            <Select
                                value={priceStatusFilter}
                                label="Price Status"
                                onChange={(e) => setPriceStatusFilter(e.target.value as string)}
                            >
                                <MenuItem value="">All Prices</MenuItem>
                                <MenuItem value="below_market">Below Market</MenuItem>
                                <MenuItem value="at_market">At Market</MenuItem>
                                <MenuItem value="above_market">Above Market</MenuItem>
                                <MenuItem value="good_deals">Good Deals</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Sort By</InputLabel>
                            <Select
                                value={sortBy}
                                label="Sort By"
                                onChange={(e) => setSortBy(e.target.value as string)}
                            >
                                <MenuItem value="newest">Newest First</MenuItem>
                                <MenuItem value="price_low">Price: Low to High</MenuItem>
                                <MenuItem value="price_high">Price: High to Low</MenuItem>
                                <MenuItem value="market_value">Market Value</MenuItem>
                                <MenuItem value="best_deals">Best Deals</MenuItem>
                                <MenuItem value="ending_soon">Ending Soon</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>

                {/* FIXED: Price Range Slider */}
                <Box sx={{ mt: 3 }}>
                    <FormLabel component="legend">Price Range</FormLabel>
                    <Box sx={{ px: 2 }}>
                        <Slider
                            value={priceRange}
                            onChange={(event, newValue) => setPriceRange(newValue as [number, number])}
                            valueLabelDisplay="auto"
                            min={priceRangeInfo.min}
                            max={priceRangeInfo.max}
                            step={1}
                            color="primary"
                            marks={[
                                { value: priceRangeInfo.min, label: `${priceRangeInfo.min}` },
                                { value: priceRangeInfo.avg, label: `${priceRangeInfo.avg}` },
                                { value: priceRangeInfo.max, label: `${priceRangeInfo.max}` }
                            ]}
                            sx={{ mt: 1 }}
                        />
                        <Typography variant="mono" component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            ${priceRange[0]} - ${priceRange[1]}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {error && cards.length === 0 ? (
                <ErrorState
                    message="We couldn't load the marketplace right now."
                    onRetry={() => fetchCards(true)}
                />
            ) : loading && cards.length === 0 ? (
                <CardGridSkeleton count={8} />
            ) : cards.length === 0 ? (
                <EmptyState
                    icon={<StorefrontIcon />}
                    title="No cards match your filters"
                    description="Try adjusting your search or filters to see more listings."
                    action={
                        <Button onClick={clearAllFilters} variant="outlined" startIcon={<ClearIcon />}>
                            Clear all filters
                        </Button>
                    }
                />
            ) : (
                <Box sx={{ position: 'relative' }}>
                    {/* Keep results mounted during a refetch (filter/refresh) — just dim
                        them and show a thin progress bar instead of blanking the grid. */}
                    {loading && (
                        <LinearProgress sx={{ position: 'absolute', top: -10, left: 0, right: 0, borderRadius: 1, zIndex: 1 }} />
                    )}
                    {error && (
                        <Alert
                            severity="warning"
                            sx={{ mb: 2 }}
                            action={
                                <Button color="inherit" size="small" onClick={() => fetchCards(true)}>
                                    Retry
                                </Button>
                            }
                        >
                            Couldn't refresh listings — showing your last results.
                        </Alert>
                    )}
                    <Grid
                        container
                        spacing={3}
                        sx={{
                            opacity: loading ? 0.55 : 1,
                            transition: 'opacity 0.2s ease',
                            pointerEvents: loading ? 'none' : 'auto',
                        }}
                    >
                    {cards.map((listing) => {
                        const isCardPurchasing = purchasingCards.has(listing.id);
                        const isCardBidding = biddingCards.has(listing.id);
                        const isOwnCard = !!(listing.owner.id && listing.owner.id === parseInt(session?.user?.id || '0'));
                        const isAuctionActive = listing.sale_type === 'AUCTION' && listing.time_remaining && listing.time_remaining > 0;

                        // Read-only view for price comparison (no mutation during render).
                        const enhancedListing = listing as EnhancedListing;

                        return (
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={listing.id}>
                                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                    <Box sx={{ position: 'relative' }}>
                                        <CardMedia
                                            component="img"
                                            height="200"
                                            loading="lazy"
                                            image={listing.card.small_image_url || listing.card.image_url || '/placeholder-card.png'}
                                            alt={listing.card.name}
                                            sx={{ objectFit: 'contain', bgcolor: 'background.default' }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                            }}
                                        />

                                        {/* Sale type badge */}
                                        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                            {listing.sale_type === 'AUCTION' ? (
                                                <Chip icon={<GavelIcon />} label="Auction" color="secondary" size="small" />
                                            ) : (
                                                <Chip icon={<DollarIcon />} label="Fixed" color="primary" size="small" />
                                            )}
                                        </Box>

                                        {/* Auction status badge */}
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

                                        {/* Price history button */}
                                        <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
                                            <IconButton
                                                size="small"
                                                onClick={() => showPriceHistory(listing)}
                                                sx={{
                                                    bgcolor: 'background.paper',
                                                    color: 'text.primary',
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    '&:hover': { bgcolor: 'background.default' }
                                                }}
                                            >
                                                <History sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Box>
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

                                        {/* Price Comparison Box */}
                                        {enhancedListing.card.market_price ? (
                                            <PriceComparisonBox listing={enhancedListing} />
                                        ) : (
                                            <Box sx={{ textAlign: 'center', py: 1 }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => handleMissingPriceData(listing)}
                                                    startIcon={<PriceCheck />}
                                                >
                                                    Get Price Data
                                                </Button>
                                            </Box>
                                        )}

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
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Box>
                                                        <PriceDisplay
                                                            usdAmount={listing.fixed_price || 0}
                                                            variant="mono"
                                                            color="primary.main"
                                                            sx={{ fontSize: '1.25rem', fontWeight: 700 }}
                                                        />
                                                        {enhancedListing.card.market_price && (
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Market:
                                                                </Typography>
                                                                <PriceDisplay
                                                                    usdAmount={enhancedListing.card.market_price}
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                />
                                                            </Box>
                                                        )}
                                                    </Box>
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
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Current Bid:
                                                        </Typography>
                                                        <PriceDisplay
                                                            usdAmount={listing.highest_bid || listing.reserve_price || 0}
                                                            variant="mono"
                                                            color="primary.main"
                                                            sx={{ fontSize: '1rem', fontWeight: 700 }}
                                                        />
                                                    </Box>

                                                    {enhancedListing.card.market_price && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Market Price:
                                                            </Typography>
                                                            <PriceDisplay
                                                                usdAmount={enhancedListing.card.market_price}
                                                                variant="body2"
                                                                color="text.secondary"
                                                            />
                                                        </Box>
                                                    )}

                                                    {isAuctionActive ? (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <ClockIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Time left:
                                                                </Typography>
                                                            </Box>
                                                            <Typography variant="body2" color="error.main">
                                                                {formatDuration(listing.time_remaining)}
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
                </Box>
            )}

            {/* Price History Modal */}
            <PriceHistoryModal
                open={priceHistoryModalOpen}
                onClose={() => {
                    setPriceHistoryModalOpen(false);
                    setSelectedCardForHistory(null);
                }}
                cardId={selectedCardForHistory?.cardId}
                userCardId={selectedCardForHistory?.userCardId}
                cardName={selectedCardForHistory?.cardName || ''}
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
        </Container>
        </AppShell>
    );
}