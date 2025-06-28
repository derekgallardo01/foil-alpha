// src/app/collection/collection-client.tsx - Enhanced with pricing analytics
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    IconButton,
    Alert,
    Paper,
    Tabs,
    Tab,
    Badge,
    CircularProgress,
    Divider
} from "@mui/material";
import {
    Menu as MenuIcon,
    Sell,
    Gavel,
    AttachMoney,
    Schedule,
    Visibility,
    Edit,
    CheckCircle,
    Warning,
    ShoppingCart,
    TrendingUp,
    TrendingDown,
    TrendingFlat,
    Timeline,
    Assessment,
    PriceCheck
} from "@mui/icons-material";
import Image from "next/image";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PendingPurchaseModal from "../components/PendingPurchaseModal";
import PriceChart from "../components/PriceChart";

interface UserCard {
    id: number;
    condition: string;
    is_for_sale: boolean;
    sale_type: string | null;
    fixed_price: number | null;
    reserve_price: number | null;
    auction_end: string | null;
    is_sold: boolean;
    acquired_date: string;
    original_purchase_price?: number;
    card: {
        id: number;
        name: string;
        set_name: string;
        rarity: string;
        image_url: string | null;
        market_price?: number;
        price_trend?: 'up' | 'down' | 'stable';
        price_change_24h?: number;
        last_price_update?: string;
    };
}

interface EnhancedUserCard extends UserCard {
    profit_loss?: number;
    profit_loss_percentage?: number;
}

interface SellDialogData {
    userCardId: number;
    cardName: string;
    saleType: 'FIXED' | 'AUCTION';
    fixedPrice: string;
    reservePrice: string;
    auctionDays: string;
}

interface PendingPurchase {
    transaction_id: number;
    card_name: string;
    card_image: string;
    amount: number;
    seller_name: string;
    expires_at: string;
    notification_id?: number;
}

// Collection Analytics Component
function CollectionAnalytics({ userCards }: { userCards: EnhancedUserCard[] }) {
    const analytics = useMemo(() => {
        const cardsWithPrices = userCards.filter(card => card.card.market_price && card.card.market_price > 0);
        const totalMarketValue = cardsWithPrices.reduce((sum, card) => sum + (card.card.market_price || 0), 0);
        const totalInvestment = userCards.reduce((sum, card) => sum + (card.original_purchase_price || 0), 0);

        const profitLoss = totalMarketValue - totalInvestment;
        const profitLossPercentage = totalInvestment > 0 ? (profitLoss / totalInvestment) * 100 : 0;

        const trending = {
            up: cardsWithPrices.filter(c => c.card.price_trend === 'up').length,
            down: cardsWithPrices.filter(c => c.card.price_trend === 'down').length,
            stable: cardsWithPrices.filter(c => c.card.price_trend === 'stable').length,
        };

        const topPerformers = cardsWithPrices
            .filter(card => card.profit_loss && card.profit_loss > 0)
            .sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0))
            .slice(0, 3);

        const worstPerformers = cardsWithPrices
            .filter(card => card.profit_loss && card.profit_loss < 0)
            .sort((a, b) => (a.profit_loss || 0) - (b.profit_loss || 0))
            .slice(0, 3);

        return {
            totalCards: userCards.length,
            cardsWithPrices: cardsWithPrices.length,
            totalMarketValue,
            totalInvestment,
            profitLoss,
            profitLossPercentage,
            trending,
            topPerformers,
            worstPerformers,
            avgCardValue: cardsWithPrices.length > 0 ? totalMarketValue / cardsWithPrices.length : 0,
        };
    }, [userCards]);

    return (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
            <Typography variant="h6" sx={{ color: '#96ff9b', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assessment />
                Collection Analytics
            </Typography>

            <Grid container spacing={3}>
                {/* Summary Cards */}
                <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: 'grey.700', textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="primary">
                            {analytics.totalCards}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Total Cards
                        </Typography>
                    </Card>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: 'grey.700', textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="success.main">
                            ${analytics.totalMarketValue.toFixed(0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Market Value
                        </Typography>
                    </Card>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: 'grey.700', textAlign: 'center', p: 2 }}>
                        <Typography
                            variant="h4"
                            color={analytics.profitLoss >= 0 ? 'success.main' : 'error.main'}
                        >
                            {analytics.profitLoss >= 0 ? '+' : ''}${analytics.profitLoss.toFixed(0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            P&L
                        </Typography>
                    </Card>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Card sx={{ bgcolor: 'grey.700', textAlign: 'center', p: 2 }}>
                        <Typography
                            variant="h4"
                            color={analytics.profitLossPercentage >= 0 ? 'success.main' : 'error.main'}
                        >
                            {analytics.profitLossPercentage >= 0 ? '+' : ''}{analytics.profitLossPercentage.toFixed(1)}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Return
                        </Typography>
                    </Card>
                </Grid>

                {/* Price Trends */}
                <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Chip
                            icon={<TrendingUp />}
                            label={`${analytics.trending.up} Trending Up`}
                            color="success"
                            variant="outlined"
                        />
                        <Chip
                            icon={<TrendingDown />}
                            label={`${analytics.trending.down} Trending Down`}
                            color="error"
                            variant="outlined"
                        />
                        <Chip
                            icon={<TrendingFlat />}
                            label={`${analytics.trending.stable} Stable`}
                            color="default"
                            variant="outlined"
                        />
                    </Box>
                </Grid>

                {/* Top/Worst Performers */}
                {(analytics.topPerformers.length > 0 || analytics.worstPerformers.length > 0) && (
                    <Grid item xs={12}>
                        <Grid container spacing={2}>
                            {analytics.topPerformers.length > 0 && (
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ color: 'success.main', mb: 1 }}>
                                        Top Performers
                                    </Typography>
                                    {analytics.topPerformers.map((card, index) => (
                                        <Box key={card.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2" noWrap sx={{ flex: 1, mr: 1 }}>
                                                {card.card.name}
                                            </Typography>
                                            <Typography variant="body2" color="success.main">
                                                +${card.profit_loss?.toFixed(2)}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Grid>
                            )}

                            {analytics.worstPerformers.length > 0 && (
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ color: 'error.main', mb: 1 }}>
                                        Worst Performers
                                    </Typography>
                                    {analytics.worstPerformers.map((card, index) => (
                                        <Box key={card.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2" noWrap sx={{ flex: 1, mr: 1 }}>
                                                {card.card.name}
                                            </Typography>
                                            <Typography variant="body2" color="error.main">
                                                ${card.profit_loss?.toFixed(2)}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Grid>
                            )}
                        </Grid>
                    </Grid>
                )}
            </Grid>
        </Paper>
    );
}

// Enhanced Card Display Component
function EnhancedCardDisplay({
    userCard,
    onSellCard,
    onRemoveFromSale,
    onShowPriceHistory,
    onUpdatePrice
}: {
    userCard: EnhancedUserCard;
    onSellCard: (card: EnhancedUserCard) => void;
    onRemoveFromSale: (cardId: number, cardName: string) => void;
    onShowPriceHistory: (card: EnhancedUserCard) => void;
    onUpdatePrice: (cardId: number) => void;
}) {
    const marketPrice = userCard.card.market_price || 0;
    const purchasePrice = userCard.original_purchase_price || 0;
    const currentListingPrice = userCard.fixed_price || userCard.reserve_price || 0;

    const profitLoss = marketPrice > 0 && purchasePrice > 0 ? marketPrice - purchasePrice : 0;
    const profitLossPercentage = purchasePrice > 0 ? (profitLoss / purchasePrice) * 100 : 0;

    const getProfitLossColor = () => {
        if (profitLoss > 0) return 'success.main';
        if (profitLoss < 0) return 'error.main';
        return 'text.secondary';
    };

    const getTrendIcon = () => {
        switch (userCard.card.price_trend) {
            case 'up':
                return <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />;
            case 'down':
                return <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />;
            default:
                return <TrendingFlat sx={{ fontSize: 16, color: 'text.secondary' }} />;
        }
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity.toLowerCase()) {
            case 'common': return 'default';
            case 'uncommon': return 'primary';
            case 'rare': return 'secondary';
            case 'rare holo': return 'warning';
            default: return 'default';
        }
    };

    return (
        <Card sx={{
            bgcolor: 'grey.800',
            border: '1px solid rgba(150, 255, 155, 0.2)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
        }}>
            {/* Price History Button */}
            <IconButton
                size="small"
                onClick={() => onShowPriceHistory(userCard)}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    zIndex: 1,
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.9)' }
                }}
            >
                <Timeline sx={{ fontSize: 16 }} />
            </IconButton>

            <CardMedia
                component="img"
                height="200"
                image={userCard.card.image_url || '/placeholder-card.png'}
                alt={userCard.card.name}
                sx={{ objectFit: 'contain', bgcolor: 'grey.700' }}
            />

            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ color: '#96ff9b', mb: 1 }}>
                    {userCard.card.name}
                </Typography>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {userCard.card.set_name}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                        label={userCard.card.rarity}
                        size="small"
                        color={getRarityColor(userCard.card.rarity) as any}
                    />
                    <Chip
                        label={userCard.condition}
                        size="small"
                        variant="outlined"
                    />
                </Box>

                {/* Price Information */}
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(150, 255, 155, 0.05)', borderRadius: 1 }}>
                    {/* Market Price */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Market Price
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {getTrendIcon()}
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                ${marketPrice.toFixed(2)}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Purchase Price */}
                    {purchasePrice > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Purchase Price
                            </Typography>
                            <Typography variant="body2">
                                ${purchasePrice.toFixed(2)}
                            </Typography>
                        </Box>
                    )}

                    {/* Profit/Loss */}
                    {purchasePrice > 0 && marketPrice > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                P&L
                            </Typography>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2" sx={{ color: getProfitLossColor(), fontWeight: 'bold' }}>
                                    {profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}
                                </Typography>
                                <Typography variant="caption" sx={{ color: getProfitLossColor() }}>
                                    ({profitLossPercentage >= 0 ? '+' : ''}{profitLossPercentage.toFixed(1)}%)
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* 24h Change */}
                    {userCard.card.price_change_24h !== undefined && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                24h Change
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: userCard.card.price_change_24h >= 0 ? 'success.main' : 'error.main',
                                    fontWeight: 'bold'
                                }}
                            >
                                {userCard.card.price_change_24h >= 0 ? '+' : ''}{userCard.card.price_change_24h.toFixed(1)}%
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Current Listing Status */}
                {userCard.is_for_sale && (
                    <Box sx={{ mb: 2 }}>
                        <Chip
                            label={`FOR ${userCard.sale_type === 'FIXED' ? 'SALE' : 'AUCTION'}`}
                            color="success"
                            size="small"
                            icon={userCard.sale_type === 'FIXED' ? <AttachMoney /> : <Gavel />}
                        />

                        <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                            {userCard.sale_type === 'FIXED' && userCard.fixed_price && (
                                <Box>
                                    <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                        Listed: ${userCard.fixed_price.toFixed(2)}
                                    </Typography>
                                    {marketPrice > 0 && (
                                        <Typography variant="caption" color="text.secondary">
                                            {currentListingPrice > marketPrice ? (
                                                <>+{(((currentListingPrice - marketPrice) / marketPrice) * 100).toFixed(1)}% above market</>
                                            ) : currentListingPrice < marketPrice ? (
                                                <>{(((marketPrice - currentListingPrice) / marketPrice) * 100).toFixed(1)}% below market</>
                                            ) : (
                                                <>At market price</>
                                            )}
                                        </Typography>
                                    )}
                                </Box>
                            )}

                            {userCard.sale_type === 'AUCTION' && (
                                <Box>
                                    <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                                        Reserve: ${userCard.reserve_price?.toFixed(2) || '0.00'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Ends: {userCard.auction_end ? new Date(userCard.auction_end).toLocaleDateString() : 'N/A'}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}

                {/* Action Buttons */}
                <Box sx={{ mt: 'auto', display: 'flex', gap: 1, flexDirection: 'column' }}>
                    {!userCard.is_for_sale ? (
                        <Button
                            variant="contained"
                            startIcon={<Sell />}
                            onClick={() => onSellCard(userCard)}
                            sx={{
                                bgcolor: '#96ff9b',
                                color: 'grey.900',
                                '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                            }}
                        >
                            List for Sale
                        </Button>
                    ) : (
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => onRemoveFromSale(userCard.id, userCard.card.name)}
                            sx={{ borderColor: 'error.main', color: 'error.main' }}
                        >
                            Remove from Sale
                        </Button>
                    )}

                    {/* Price Update Button */}
                    {marketPrice === 0 && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PriceCheck />}
                            onClick={() => onUpdatePrice(userCard.card.id)}
                            sx={{ borderColor: '#96ff9b', color: '#96ff9b' }}
                        >
                            Get Price Data
                        </Button>
                    )}
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                    Acquired: {new Date(userCard.acquired_date).toLocaleDateString()}
                    {userCard.card.last_price_update && (
                        <> • Price updated: {new Date(userCard.card.last_price_update).toLocaleDateString()}</>
                    )}
                </Typography>
            </CardContent>
        </Card>
    );
}

// Price History Modal Component
function CollectionPriceHistoryModal({
    open,
    onClose,
    userCard
}: {
    open: boolean;
    onClose: () => void;
    userCard: EnhancedUserCard | null;
}) {
    if (!userCard) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline />
                    Price History - {userCard.card.name}
                </Box>
            </DialogTitle>
            <DialogContent sx={{ height: 600 }}>
                <PriceChart
                    cardId={userCard.card.id}
                    userCardId={userCard.id}
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

// Bulk Price Update Modal Component
function BulkPriceUpdateModal({
    open,
    onClose,
    selectedCards,
    onUpdateComplete
}: {
    open: boolean;
    onClose: () => void;
    selectedCards: number[];
    onUpdateComplete: () => void;
}) {
    const [updating, setUpdating] = useState(false);
    const [results, setResults] = useState<any>(null);

    const handleBulkUpdate = async () => {
        try {
            setUpdating(true);
            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardIds: selectedCards,
                    force: true,
                    batchSize: 10,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setResults(data.result);
                onUpdateComplete();
                toast.success(`Updated prices for ${data.result.successful_updates} cards`);
            } else {
                toast.error(data.error || 'Failed to update prices');
            }
        } catch (error) {
            toast.error('Failed to update prices');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Bulk Price Update</DialogTitle>
            <DialogContent>
                {!results ? (
                    <Box>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Update market prices for {selectedCards.length} selected cards using the latest pricing data.
                        </Typography>
                        <Alert severity="info">
                            This will fetch the latest market prices from Pokemon Price Tracker API.
                        </Alert>
                    </Box>
                ) : (
                    <Box>
                        <Alert severity="success" sx={{ mb: 2 }}>
                            Price update completed!
                        </Alert>
                        <Grid container spacing={2}>
                            <Grid item xs={4}>
                                <Typography variant="h4" color="primary" align="center">
                                    {results.successful_updates}
                                </Typography>
                                <Typography variant="body2" align="center">Updated</Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Typography variant="h4" color="warning.main" align="center">
                                    {results.skipped_cards}
                                </Typography>
                                <Typography variant="body2" align="center">Skipped</Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Typography variant="h4" color="error.main" align="center">
                                    {results.failed_updates}
                                </Typography>
                                <Typography variant="body2" align="center">Failed</Typography>
                            </Grid>
                        </Grid>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>
                    {results ? 'Close' : 'Cancel'}
                </Button>
                {!results && (
                    <Button
                        variant="contained"
                        onClick={handleBulkUpdate}
                        disabled={updating}
                        sx={{
                            bgcolor: '#96ff9b',
                            color: 'grey.900',
                            '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                        }}
                    >
                        {updating ? <CircularProgress size={20} /> : 'Update Prices'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default function CollectionPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [userCards, setUserCards] = useState<UserCard[]>([]);
    const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState(0);
    const [sellDialogOpen, setSellDialogOpen] = useState(false);
    const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<PendingPurchase | null>(null);
    const [priceHistoryModalOpen, setPriceHistoryModalOpen] = useState(false);
    const [selectedCardForHistory, setSelectedCardForHistory] = useState<EnhancedUserCard | null>(null);
    const [bulkPriceUpdateOpen, setBulkPriceUpdateOpen] = useState(false);
    const [selectedCardsForUpdate, setSelectedCardsForUpdate] = useState<number[]>([]);
    const [collectionSortBy, setCollectionSortBy] = useState('newest');
    const [sellData, setSellData] = useState<SellDialogData>({
        userCardId: 0,
        cardName: '',
        saleType: 'FIXED',
        fixedPrice: '',
        reservePrice: '',
        auctionDays: '7'
    });
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (status === "authenticated") {
            fetchUserCards();
            fetchPendingPurchases();
        } else if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    // Auto-refresh pending purchases every 30 seconds
    useEffect(() => {
        if (status === 'authenticated') {
            const interval = setInterval(() => {
                fetchPendingPurchases();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [status]);

    const fetchUserCards = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/user/collection", {
                headers: {
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
            });

            if (!response.ok) throw new Error("Failed to fetch collection");

            const data = await response.json();
            setUserCards(data);

        } catch (error) {
            console.error("Error fetching collection:", error);
            toast.error("Failed to load collection");
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingPurchases = async () => {
        try {
            const response = await fetch('/api/notifications?unread_only=true', {
                headers: {
                    Authorization: `Bearer ${session?.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.statusText}`);
            }

            const notifications = await response.json();

            // Check if notifications is an array
            if (!Array.isArray(notifications)) {
                console.error('Notifications is not an array:', notifications);
                setPendingPurchases([]);
                return;
            }

            // Filter for purchase confirmation notifications
            const purchaseNotifications = notifications.filter((notif: any) =>
                (notif.type === 'bid_accepted' || notif.type === 'auction_won') &&
                notif.data?.action_required === true
            );

            const purchaseData = purchaseNotifications.map((notif: any) => ({
                transaction_id: notif.reference_id,
                card_name: notif.data?.card_name || 'Unknown Card',
                card_image: notif.data?.card_image || '/placeholder-card.png',
                amount: notif.data?.winning_amount || notif.data?.amount || 0,
                seller_name: notif.data?.seller_name || 'Unknown Seller',
                expires_at: notif.data?.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                notification_id: notif.id,
            }));

            setPendingPurchases(purchaseData);
        } catch (error) {
            console.error('Error fetching pending purchases:', error);
            setPendingPurchases([]);
            toast.error('Failed to load pending purchases');
        }
    };

    const handleSellCard = (userCard: EnhancedUserCard) => {
        setSellData({
            userCardId: userCard.id,
            cardName: userCard.card.name,
            saleType: 'FIXED',
            fixedPrice: '',
            reservePrice: '',
            auctionDays: '7'
        });
        setSellDialogOpen(true);
    };

    const handleConfirmSale = async () => {
        try {
            setActionLoading(true);

            const requestBody: any = {
                sale_type: sellData.saleType,
            };

            if (sellData.saleType === 'FIXED') {
                requestBody.fixed_price = parseFloat(sellData.fixedPrice);
            } else {
                requestBody.reserve_price = parseFloat(sellData.reservePrice);
                requestBody.auction_duration_hours = parseInt(sellData.auctionDays) * 24;
            }

            const response = await fetch(`/api/user/collection/${sellData.userCardId}/sell`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to list card');
            }

            toast.success(`${sellData.cardName} listed for ${sellData.saleType === 'FIXED' ? 'sale' : 'auction'}!`);
            setSellDialogOpen(false);
            fetchUserCards();

        } catch (error) {
            console.error("Error listing card:", error);
            toast.error(error instanceof Error ? error.message : "Failed to list card");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFromSale = async (userCardId: number, cardName: string) => {
        try {
            const response = await fetch(`/api/user/collection/${userCardId}/sell`, {
                method: 'DELETE',
                headers: {
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
            });

            if (!response.ok) throw new Error('Failed to remove from sale');

            toast.success(`${cardName} removed from sale`);
            fetchUserCards();

        } catch (error) {
            console.error("Error removing from sale:", error);
            toast.error("Failed to remove from sale");
        }
    };

    const handleConfirmPurchase = (purchase: PendingPurchase) => {
        setSelectedPurchase(purchase);
        setConfirmationModalOpen(true);
    };

    const handleConfirmationComplete = () => {
        fetchPendingPurchases();
        fetchUserCards();
    };

    const handleShowPriceHistory = (userCard: EnhancedUserCard) => {
        setSelectedCardForHistory(userCard);
        setPriceHistoryModalOpen(true);
    };

    const handleUpdateCardPrice = async (cardId: number) => {
        try {
            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardIds: [cardId],
                    force: true,
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Price updated successfully!');
                fetchUserCards(); // Refresh collection
            } else {
                toast.error('Failed to update price');
            }
        } catch (error) {
            toast.error('Failed to update price');
        }
    };

    const handleBulkPriceUpdate = () => {
        if (selectedCardsForUpdate.length === 0) {
            toast.error('Please select cards to update');
            return;
        }
        setBulkPriceUpdateOpen(true);
    };

    const handlePriceUpdateComplete = () => {
        fetchUserCards();
        setSelectedCardsForUpdate([]);
    };

    // Enhanced user cards with profit/loss calculations
    const enhancedUserCards = useMemo(() => {
        return userCards.map(card => {
            const marketPrice = card.card.market_price || 0;
            const purchasePrice = card.original_purchase_price || 0;

            const enhancedCard: EnhancedUserCard = {
                ...card,
                profit_loss: marketPrice > 0 && purchasePrice > 0 ? marketPrice - purchasePrice : undefined,
                profit_loss_percentage: purchasePrice > 0 && marketPrice > 0 ?
                    ((marketPrice - purchasePrice) / purchasePrice) * 100 : undefined,
            };

            return enhancedCard;
        });
    }, [userCards]);

    // Sorting function for collection
    const sortedUserCards = useMemo(() => {
        const sorted = [...enhancedUserCards];

        switch (collectionSortBy) {
            case 'value_high':
                return sorted.sort((a, b) => (b.card.market_price || 0) - (a.card.market_price || 0));
            case 'value_low':
                return sorted.sort((a, b) => (a.card.market_price || 0) - (b.card.market_price || 0));
            case 'profit_loss':
                return sorted.sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0));
            case 'trending':
                return sorted.sort((a, b) => {
                    const trendOrder = { up: 3, stable: 2, down: 1 };
                    return (trendOrder[b.card.price_trend as keyof typeof trendOrder] || 0) -
                        (trendOrder[a.card.price_trend as keyof typeof trendOrder] || 0);
                });
            case 'newest':
            default:
                return sorted.sort((a, b) => new Date(b.acquired_date).getTime() - new Date(a.acquired_date).getTime());
        }
    }, [enhancedUserCards, collectionSortBy]);

    const formatPrice = (price: number) => {
        return `${price.toFixed(2)}`;
    };

    const formatTimeLeft = (expiresAt: string) => {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diffMs = expires.getTime() - now.getTime();

        if (diffMs <= 0) return 'Expired';

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading your collection...</Typography>
            </Box>
        );
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
            <ToastContainer position="top-right" />

            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: '1px solid rgba(150, 255, 155, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market" width={40} height={20} />
                    <Typography variant="h5" sx={{ color: '#96ff9b', fontWeight: 'bold' }}>
                        My Collection
                    </Typography>
                </Box>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/wallet')}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        My Wallet
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/marketplace')}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        Marketplace
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <Typography variant="h4" sx={{ color: '#96ff9b', mb: 3, textAlign: 'center' }}>
                    {session?.user?.name}'s Card Collection
                </Typography>

                {/* Pending Purchase Alerts */}
                {pendingPurchases.length > 0 && (
                    <Alert
                        severity="warning"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => setCurrentTab(1)}
                            >
                                View All
                            </Button>
                        }
                        sx={{ mb: 3 }}
                    >
                        You have {pendingPurchases.length} pending purchase confirmation{pendingPurchases.length > 1 ? 's' : ''} that require your attention!
                    </Alert>
                )}

                {/* Collection Analytics */}
                <CollectionAnalytics userCards={enhancedUserCards} />

                {/* Tabs */}
                <Paper sx={{ mb: 3, bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                    <Tabs
                        value={currentTab}
                        onChange={(e, newValue) => setCurrentTab(newValue)}
                        sx={{
                            '& .MuiTab-root': { color: 'text.secondary' },
                            '& .Mui-selected': { color: '#96ff9b' },
                            '& .MuiTabs-indicator': { backgroundColor: '#96ff9b' }
                        }}
                    >
                        <Tab
                            label={`My Cards (${userCards.length})`}
                            icon={<ShoppingCart />}
                        />
                        <Tab
                            label={
                                <Badge badgeContent={pendingPurchases.length} color="error">
                                    Pending Purchases
                                </Badge>
                            }
                            icon={<Warning />}
                        />
                    </Tabs>
                </Paper>

                {/* Tab Content */}
                {currentTab === 0 && (
                    /* My Cards Tab */
                    <>
                        {userCards.length === 0 ? (
                            <Box sx={{ textAlign: 'center', mt: 10 }}>
                                <Typography variant="h6" sx={{ color: 'text.secondary', mb: 3 }}>
                                    Your collection is empty
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={() => router.push('/marketplace')}
                                    sx={{
                                        bgcolor: '#96ff9b',
                                        color: 'grey.900',
                                        '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                                    }}
                                >
                                    Browse Marketplace
                                </Button>
                            </Box>
                        ) : (
                            <>
                                {/* Sorting and Bulk Actions */}
                                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <FormControl sx={{ minWidth: 200 }}>
                                        <InputLabel sx={{ color: 'text.secondary' }}>Sort By</InputLabel>
                                        <Select
                                            value={collectionSortBy}
                                            onChange={(e) => setCollectionSortBy(e.target.value)}
                                            label="Sort By"
                                            sx={{ color: 'text.primary' }}
                                        >
                                            <MenuItem value="newest">Newest First</MenuItem>
                                            <MenuItem value="value_high">Highest Value</MenuItem>
                                            <MenuItem value="value_low">Lowest Value</MenuItem>
                                            <MenuItem value="profit_loss">Best Performers</MenuItem>
                                            <MenuItem value="trending">Trending Up</MenuItem>
                                        </Select>
                                    </FormControl>

                                    {selectedCardsForUpdate.length > 0 && (
                                        <Button
                                            variant="outlined"
                                            onClick={handleBulkPriceUpdate}
                                            startIcon={<PriceCheck />}
                                            sx={{
                                                borderColor: '#96ff9b',
                                                color: '#96ff9b',
                                                '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                                            }}
                                        >
                                            Update Prices ({selectedCardsForUpdate.length})
                                        </Button>
                                    )}
                                </Box>

                                <Grid container spacing={3}>
                                    {sortedUserCards.map((userCard) => (
                                        <Grid item xs={12} sm={6} md={4} lg={3} key={userCard.id}>
                                            <EnhancedCardDisplay
                                                userCard={userCard}
                                                onSellCard={handleSellCard}
                                                onRemoveFromSale={handleRemoveFromSale}
                                                onShowPriceHistory={handleShowPriceHistory}
                                                onUpdatePrice={handleUpdateCardPrice}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            </>
                        )}
                    </>
                )}

                {currentTab === 1 && (
                    /* Pending Purchases Tab */
                    <>
                        {pendingPurchases.length === 0 ? (
                            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                                <Typography variant="h6" color="text.secondary">
                                    No pending purchases
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    All your auction wins and accepted bids are up to date
                                </Typography>
                            </Paper>
                        ) : (
                            <Grid container spacing={3}>
                                {pendingPurchases.map((purchase, index) => {
                                    const timeLeft = formatTimeLeft(purchase.expires_at);
                                    const isExpired = timeLeft === 'Expired';

                                    return (
                                        <Grid item xs={12} md={6} key={index}>
                                            <Card sx={{
                                                bgcolor: 'grey.800',
                                                border: isExpired ? '1px solid rgba(244, 67, 54, 0.5)' : '1px solid rgba(255, 152, 0, 0.5)'
                                            }}>
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                        <Warning sx={{ color: isExpired ? 'error.main' : 'warning.main', mr: 1 }} />
                                                        <Typography variant="h6" sx={{ color: '#96ff9b' }}>
                                                            {isExpired ? 'Purchase Expired' : 'Confirm Purchase'}
                                                        </Typography>
                                                        <Chip
                                                            label={timeLeft}
                                                            color={isExpired ? 'error' : 'warning'}
                                                            size="small"
                                                            sx={{ ml: 'auto' }}
                                                        />
                                                    </Box>

                                                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                                        <img
                                                            src={purchase.card_image}
                                                            alt={purchase.card_name}
                                                            style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 4 }}
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                            }}
                                                        />
                                                        <Box sx={{ flexGrow: 1 }}>
                                                            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
                                                                {purchase.card_name}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Seller: {purchase.seller_name}
                                                            </Typography>
                                                            <Typography variant="h6" color="primary.main">
                                                                {formatPrice(purchase.amount)}
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    {!isExpired && (
                                                        <Button
                                                            variant="contained"
                                                            fullWidth
                                                            onClick={() => handleConfirmPurchase(purchase)}
                                                            startIcon={<CheckCircle />}
                                                            sx={{
                                                                bgcolor: '#96ff9b',
                                                                color: 'grey.900',
                                                                '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                                                            }}
                                                        >
                                                            Confirm Purchase
                                                        </Button>
                                                    )}

                                                    {isExpired && (
                                                        <Alert severity="error" sx={{ mt: 1 }}>
                                                            This purchase opportunity has expired. The auction may be relisted.
                                                        </Alert>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        )}
                    </>
                )}
            </Container>

            {/* Sell Dialog */}
            <Dialog open={sellDialogOpen} onClose={() => setSellDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>List {sellData.cardName} for Sale</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Sale Type</InputLabel>
                            <Select
                                value={sellData.saleType}
                                onChange={(e) => setSellData(prev => ({ ...prev, saleType: e.target.value as 'FIXED' | 'AUCTION' }))}
                            >
                                <MenuItem value="FIXED">Fixed Price Sale</MenuItem>
                                <MenuItem value="AUCTION">Auction</MenuItem>
                            </Select>
                        </FormControl>

                        {sellData.saleType === 'FIXED' ? (
                            <TextField
                                label="Sale Price ($)"
                                type="number"
                                fullWidth
                                value={sellData.fixedPrice}
                                onChange={(e) => setSellData(prev => ({ ...prev, fixedPrice: e.target.value }))}
                                inputProps={{ min: 0, step: 0.01 }}
                            />
                        ) : (
                            <>
                                <TextField
                                    label="Reserve Price ($)"
                                    type="number"
                                    fullWidth
                                    value={sellData.reservePrice}
                                    onChange={(e) => setSellData(prev => ({ ...prev, reservePrice: e.target.value }))}
                                    inputProps={{ min: 0, step: 0.01 }}
                                    sx={{ mb: 2 }}
                                    helperText="Minimum price for the auction"
                                />
                                <FormControl fullWidth>
                                    <InputLabel>Auction Duration</InputLabel>
                                    <Select
                                        value={sellData.auctionDays}
                                        onChange={(e) => setSellData(prev => ({ ...prev, auctionDays: e.target.value }))}
                                    >
                                        <MenuItem value="1">1 Day</MenuItem>
                                        <MenuItem value="3">3 Days</MenuItem>
                                        <MenuItem value="7">7 Days</MenuItem>
                                        <MenuItem value="14">14 Days</MenuItem>
                                    </Select>
                                </FormControl>
                            </>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSellDialogOpen(false)} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmSale}
                        disabled={actionLoading || (!sellData.fixedPrice && sellData.saleType === 'FIXED') || (!sellData.reservePrice && sellData.saleType === 'AUCTION')}
                        sx={{
                            bgcolor: '#96ff9b',
                            color: 'grey.900',
                            '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                        }}
                    >
                        {actionLoading ? 'Listing...' : `List for ${sellData.saleType === 'FIXED' ? 'Sale' : 'Auction'}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Price History Modal */}
            <CollectionPriceHistoryModal
                open={priceHistoryModalOpen}
                onClose={() => {
                    setPriceHistoryModalOpen(false);
                    setSelectedCardForHistory(null);
                }}
                userCard={selectedCardForHistory}
            />

            {/* Bulk Price Update Modal */}
            <BulkPriceUpdateModal
                open={bulkPriceUpdateOpen}
                onClose={() => setBulkPriceUpdateOpen(false)}
                selectedCards={selectedCardsForUpdate}
                onUpdateComplete={handlePriceUpdateComplete}
            />

            {/* Purchase Confirmation Modal */}
            <PendingPurchaseModal
                open={confirmationModalOpen}
                onClose={() => setConfirmationModalOpen(false)}
                purchaseData={selectedPurchase}
                onConfirmationComplete={handleConfirmationComplete}
            />
        </Box>
    );
}