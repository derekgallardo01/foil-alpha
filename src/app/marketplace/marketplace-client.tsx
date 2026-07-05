'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Slider,
    FormLabel,
} from '@mui/material';
import {
    Search as SearchIcon,
    AccessTime as ClockIcon,
    AttachMoney as DollarIcon,
    Gavel as GavelIcon,
    FilterList as FilterIcon,
    Notifications as NotificationIcon,
    Refresh as RefreshIcon,
    TrendingUp,
    TrendingDown,
    TrendingFlat,
    History,
    PriceCheck,
    Timeline,
    LocalOffer as LocalOfferIcon,
    Add as AddIcon,
    CurrencyExchange,
    Clear as ClearIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AppShell from '../components/AppShell';
import BiddingModal from '../components/BiddingModal';
import PriceChart from '../components/PriceChart';
import PriceDisplay, { LargePriceDisplay, PriceWithReference } from '../components/PriceDisplay';
import CurrencySelector from '../components/CurrencySelector';
import { useCurrencyContext } from '../lib/currency-context';
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
    market_price?: number;
    price_trend?: 'up' | 'down' | 'stable';
    price_change_24h?: number;
    last_price_update?: string;
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

interface EnhancedListing extends Listing {
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

// Price Comparison Component with Currency Support
function PriceComparisonBox({ listing }: { listing: EnhancedListing }) {
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'admin';
    const marketPrice = listing.card.market_price || 0;
    const userPrice = listing.fixed_price || listing.reserve_price || 0;
    const priceDiff = userPrice > 0 && marketPrice > 0 ?
        ((userPrice - marketPrice) / marketPrice) * 100 : 0;

    const getPriceStatus = () => {
        if (Math.abs(priceDiff) < 5) return { color: 'success.main', label: 'Market Price' };
        if (priceDiff > 0) return { color: 'error.main', label: `${priceDiff.toFixed(1)}% Above Market` };
        return { color: 'warning.main', label: `${Math.abs(priceDiff).toFixed(1)}% Below Market` };
    };

    const priceStatus = getPriceStatus();

    return (
        <Box sx={{
            p: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 1,
            border: `1px solid ${priceStatus.color}`,
            mb: 1
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    Market Price
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {listing.card.price_trend === 'up' && <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />}
                    {listing.card.price_trend === 'down' && <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />}
                    {listing.card.price_trend === 'stable' && <TrendingFlat sx={{ fontSize: 16, color: 'text.secondary' }} />}
                    <PriceDisplay
                        usdAmount={marketPrice}
                        variant="body2"
                        sx={{ fontWeight: 'bold' }}
                    />
                </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    {listing.sale_type === 'FIXED' ? 'Asking Price' : 'Reserve Price'}
                </Typography>
                <PriceDisplay
                    usdAmount={userPrice}
                    variant="body2"
                    color="primary.main"
                    sx={{ fontWeight: 'bold' }}
                />
            </Box>

            <Box sx={{ textAlign: 'center' }}>
                <Chip
                    label={priceStatus.label}
                    size="small"
                    sx={{
                        color: 'white',
                        bgcolor: priceStatus.color,
                        fontWeight: 'bold',
                        fontSize: '0.7rem'
                    }}
                />
            </Box>

            {listing.card.price_change_24h !== undefined && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                    24h: {listing.card.price_change_24h > 0 ? '+' : ''}{listing.card.price_change_24h.toFixed(1)}%
                </Typography>
            )}
        </Box>
    );
}

// Price History Modal Component
function PriceHistoryModal({
    open,
    onClose,
    cardId,
    userCardId,
    cardName
}: {
    open: boolean;
    onClose: () => void;
    cardId?: number;
    userCardId?: number;
    cardName: string;
}) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <History />
                    Price History - {cardName}
                </Box>
            </DialogTitle>
            <DialogContent sx={{ height: 600 }}>
                <PriceChart
                    cardId={cardId}
                    userCardId={userCardId}
                    height={550}
                    showUserPrice={true}
                    autoRefresh={false}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

// Market Summary Component with Currency Support
function MarketSummarySection({ cards }: { cards: EnhancedListing[] }) {
    const { convertPrice, formatPrice, selectedCurrency } = useCurrencyContext();
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'admin';

    const marketStats = useMemo(() => {
        const cardsWithPrices = cards.filter(c => c.card.market_price && c.card.market_price > 0);
        const totalValue = cardsWithPrices.reduce((sum, card) => sum + (card.card.market_price || 0), 0);
        const avgPrice = cardsWithPrices.length > 0 ? totalValue / cardsWithPrices.length : 0;

        const priceRanges = {
            under_5: cardsWithPrices.filter(c => (c.card.market_price || 0) < 5).length,
            _5_to_25: cardsWithPrices.filter(c => (c.card.market_price || 0) >= 5 && (c.card.market_price || 0) < 25).length,
            _25_to_100: cardsWithPrices.filter(c => (c.card.market_price || 0) >= 25 && (c.card.market_price || 0) < 100).length,
            over_100: cardsWithPrices.filter(c => (c.card.market_price || 0) >= 100).length,
        };

        const trending = {
            up: cardsWithPrices.filter(c => c.card.price_trend === 'up').length,
            down: cardsWithPrices.filter(c => c.card.price_trend === 'down').length,
            stable: cardsWithPrices.filter(c => c.card.price_trend === 'stable').length,
        };

        return { totalValue, avgPrice, priceRanges, trending, totalCards: cardsWithPrices.length };
    }, [cards]);

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline />
                Market Summary
                {!isAdmin && selectedCurrency !== 'USD' && (
                    <Chip
                        label={`Prices in ${selectedCurrency}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                    />
                )}
            </Typography>

            <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                            {marketStats.totalCards}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Cards Listed
                        </Typography>
                    </Box>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                        <PriceDisplay
                            usdAmount={marketStats.avgPrice}
                            variant="h4"
                            color="success.main"
                        />
                        <Typography variant="body2" color="text.secondary">
                            Avg. Price
                        </Typography>
                    </Box>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                        <PriceDisplay
                            usdAmount={marketStats.totalValue}
                            variant="h4"
                            color="warning.main"
                        />
                        <Typography variant="body2" color="text.secondary">
                            Total Value
                        </Typography>
                    </Box>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
                            <Chip
                                icon={<TrendingUp />}
                                label={marketStats.trending.up}
                                size="small"
                                color="success"
                            />
                            <Chip
                                icon={<TrendingDown />}
                                label={marketStats.trending.down}
                                size="small"
                                color="error"
                            />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            Price Trends
                        </Typography>
                    </Box>
                </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Price Distribution</Typography>
            <Grid container spacing={1}>
                <Grid item xs={3}>
                    <Chip label={`Under $5: ${marketStats.priceRanges.under_5}`} size="small" variant="outlined" />
                </Grid>
                <Grid item xs={3}>
                    <Chip label={`$5-$25: ${marketStats.priceRanges._5_to_25}`} size="small" variant="outlined" />
                </Grid>
                <Grid item xs={3}>
                    <Chip label={`$25-$100: ${marketStats.priceRanges._25_to_100}`} size="small" variant="outlined" />
                </Grid>
                <Grid item xs={3}>
                    <Chip label={`$100+: ${marketStats.priceRanges.over_100}`} size="small" variant="outlined" />
                </Grid>
            </Grid>
        </Paper>
    );
}

// Daily Deals Component with Currency Support
function DailyDealsSection({ cards }: { cards: EnhancedListing[] }) {
    const deals = useMemo(() => {
        return cards
            .filter(card => {
                const marketPrice = card.card.market_price || 0;
                const userPrice = card.fixed_price || card.reserve_price || 0;
                return marketPrice > 0 && userPrice > 0 && ((marketPrice - userPrice) / marketPrice) > 0.15; // 15%+ below market
            })
            .sort((a, b) => {
                const aDiff = ((a.card.market_price || 0) - (a.fixed_price || a.reserve_price || 0)) / (a.card.market_price || 1);
                const bDiff = ((b.card.market_price || 0) - (b.fixed_price || b.reserve_price || 0)) / (b.card.market_price || 1);
                return bDiff - aDiff; // Sort by biggest discount first
            })
            .slice(0, 6); // Top 6 deals
    }, [cards]);

    if (deals.length === 0) return null;

    return (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalOfferIcon />
                Daily Deals - Cards Below Market Price
            </Typography>

            <Grid container spacing={2}>
                {deals.map((deal) => {
                    const marketPrice = deal.card.market_price || 0;
                    const userPrice = deal.fixed_price || deal.reserve_price || 0;
                    const discount = ((marketPrice - userPrice) / marketPrice) * 100;

                    return (
                        <Grid item xs={12} sm={6} md={4} key={deal.id}>
                            <Box sx={{
                                p: 2,
                                border: '1px solid rgba(76, 175, 80, 0.5)',
                                borderRadius: 1,
                                bgcolor: 'background.paper'
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <img
                                        src={deal.card.small_image_url || '/placeholder-card.png'}
                                        alt={deal.card.name}
                                        style={{ width: 40, height: 56, objectFit: 'contain' }}
                                    />
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="subtitle2" noWrap>
                                            {deal.card.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {deal.card.set_name}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <PriceDisplay
                                            usdAmount={userPrice}
                                            variant="h6"
                                            color="success.main"
                                        />
                                        <Box sx={{ textDecoration: 'line-through' }}>
                                            <PriceDisplay
                                                usdAmount={marketPrice}
                                                variant="caption"
                                                color="text.secondary"
                                            />
                                        </Box>
                                    </Box>
                                    <Chip
                                        label={`${discount.toFixed(0)}% OFF`}
                                        color="success"
                                        size="small"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                </Box>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>
        </Paper>
    );
}

// Price Alerts Component
function PriceAlertsSection() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [newAlertOpen, setNewAlertOpen] = useState(false);

    return (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.3)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PriceCheck />
                    <Typography variant="h6">Price Alerts</Typography>
                    <Chip label={alerts.length} size="small" />
                </Box>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setNewAlertOpen(true)}
                    startIcon={<AddIcon />}
                >
                    Set Alert
                </Button>
            </Box>

            {alerts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Set price alerts to be notified when cards reach your target price
                </Typography>
            ) : (
                <Grid container spacing={1}>
                    {alerts.map((alert, index) => (
                        <Grid item xs={12} sm={6} md={4} key={index}>
                            <Chip
                                label={`${alert.card_name}: $${alert.target_price}`}
                                onDelete={() => {
                                    // Remove alert logic
                                }}
                                color="primary"
                                variant="outlined"
                            />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Paper>
    );
}

export default function MarketplacePage() {
    const { data: session, status } = useSession();
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

            // FIXED: Add debug logging to see what parameters are being sent
            console.log('Client sending parameters:', {
                search: debouncedSearchTerm,
                set: selectedSet,
                rarity: selectedRarity,
                type: selectedType,
                sale_type: selectedSaleType,
                price_status: priceStatusFilter,
                sort_by: sortBy,
                price_min: priceRange[0] > 0 ? priceRange[0] : null,
                price_max: priceRange[1] < 10000 ? priceRange[1] : null
            });

            console.log('Fetching marketplace with params:', params.toString());

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
            console.log('Marketplace data received:', {
                listingsCount: data.listings?.length || 0,
                pagination: data.pagination,
                hasFilters: !!data.filters,
                showingAll: data.pagination?.showAll
            });

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

            // Debug the data
            if (data.listings?.length > 0) {
                console.log('Sample listing:', data.listings[0]);
                console.log(`📊 Total cards shown: ${data.listings.length} (Total available: ${data.pagination?.total})`);
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

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

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
        <AppShell>
        <Container sx={{ marginTop: 4, marginBottom: 4 }}>
            {/* Header with Currency Selector */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', my: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Currency Selector - Only for non-admin users */}
                    {!isAdmin && (
                        <Box sx={{ minWidth: 120 }}>
                            <CurrencySelector size="small" />
                        </Box>
                    )}
                    <IconButton
                        onClick={() => router.push('/notifications')}
                        color={unreadNotifications > 0 ? 'primary' : 'default'}
                    >
                        <Badge badgeContent={unreadNotifications} color="error">
                            <NotificationIcon />
                        </Badge>
                    </IconButton>
                    <IconButton onClick={() => fetchCards(true)} title="Refresh">
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
                    Discover and purchase Pokémon cards from other collectors
                </Typography>
            </Box>

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

            {/* Price Alerts */}
            <PriceAlertsSection />

            {/* Daily Deals */}
            <DailyDealsSection cards={cards as EnhancedListing[]} />

            {/* FIXED: Enhanced Search & Filters Section */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <FilterIcon sx={{ mr: 1 }} />
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
                            helperText="Search by name, set, rarity, or card number"
                        />
                    </Grid>

                    <Grid item xs={12} md={2}>
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

                    <Grid item xs={12} md={2}>
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

                    <Grid item xs={12} md={1.5}>
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

                    <Grid item xs={12} md={1.5}>
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

                    <Grid item xs={12} md={2}>
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
                            marks={[
                                { value: priceRangeInfo.min, label: `${priceRangeInfo.min}` },
                                { value: priceRangeInfo.avg, label: `${priceRangeInfo.avg}` },
                                { value: priceRangeInfo.max, label: `${priceRangeInfo.max}` }
                            ]}
                            sx={{ mt: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            ${priceRange[0]} - ${priceRange[1]}
                        </Typography>
                    </Box>
                </Box>
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
                    <Button
                        onClick={clearAllFilters}
                        sx={{ mt: 2 }}
                        variant="outlined"
                        startIcon={<ClearIcon />}
                    >
                        Clear All Filters
                    </Button>
                </Paper>
            ) : (
                <Grid container spacing={3}>
                    {cards.map((listing) => {
                        const isCardPurchasing = purchasingCards.has(listing.id);
                        const isCardBidding = biddingCards.has(listing.id);
                        const isOwnCard = !!(listing.owner.id && listing.owner.id === parseInt(session?.user?.id || '0'));
                        const isAuctionActive = listing.sale_type === 'AUCTION' && listing.time_remaining && listing.time_remaining > 0;

                        // Cast to enhanced listing for price comparison
                        const enhancedListing = listing as EnhancedListing;
                        enhancedListing.card.market_price = listing.card.market_price;
                        enhancedListing.card.price_trend = listing.card.price_trend;
                        enhancedListing.card.price_change_24h = listing.card.price_change_24h;

                        return (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={listing.id}>
                                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
                                                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                                                    color: 'white',
                                                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.9)' }
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
                                                            variant="h6"
                                                            color="primary.main"
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
                                                            variant="subtitle1"
                                                            color="primary.main"
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