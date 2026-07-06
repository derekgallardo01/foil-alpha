// src/app/collection/collection-client.tsx - Complete Enhanced Collection with Sidebar
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Typography,
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
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip
} from "@mui/material";
import Grid from '@mui/material/Grid2';
import {
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
    PriceCheck,
    Collections as CollectionsIcon,
    Inventory2,
    WorkspacePremium
} from "@mui/icons-material";
import { toast } from "react-toastify";
import AppShell from "../components/AppShell";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/StatCard";
import { formatPrice, formatDuration } from "../lib/format";
import { getRarityColor } from "../lib/rarity";
import { CardGridSkeleton } from "../components/ui/Skeletons";
import PendingPurchaseModal from "../components/PendingPurchaseModal";
import PriceChart from "../components/PriceChart";
import PriceHistoryModal from "../components/PriceHistoryModal";
import PendingPurchasesWidget from "../components/PendingPurchasesWidget";
import { useRequireAuth } from "../lib/useRequireAuth";

interface UserCard {
    id: number;
    condition: string;
    quantity: number;
    is_graded: boolean;
    grade_label: string | null;
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
        product_type?: string;
        tcg?: string | null;
        image_url: string | null;
        market_price?: number;
        price_trend?: 'up' | 'down' | 'stable';
        price_change_24h?: number;
        last_price_update?: string;
    };
}

interface CollectionSummary {
    totalLines: number;
    totalUnits: number;
    totalValue: number;
    cardCount: number;
    sealedCount: number;
    gradedCount: number;
}

type ItemTypeFilter = 'all' | 'cards' | 'sealed' | 'graded';

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

// Collection Analytics — real holdings breakdown on the shared StatCard tiles.
function CollectionAnalytics({ summary }: { summary: CollectionSummary | null }) {
    if (!summary) return null;

    const tiles = [
        { label: 'Collection Value', value: formatPrice(summary.totalValue), accent: true, icon: <AttachMoney fontSize="small" /> },
        { label: 'Total Items', value: summary.totalUnits.toLocaleString(), icon: <Inventory2 fontSize="small" /> },
        { label: 'Unique Cards', value: summary.cardCount.toLocaleString(), icon: <CollectionsIcon fontSize="small" /> },
        { label: 'Sealed Products', value: summary.sealedCount.toLocaleString(), icon: <Inventory2 fontSize="small" /> },
    ];

    return (
        <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
                {tiles.map((t) => (
                    <Grid size={{ xs: 6, md: 3 }} key={t.label}>
                        <StatCard label={t.label} value={t.value} accent={t.accent} icon={t.icon} />
                    </Grid>
                ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
                <Chip icon={<WorkspacePremium />} label={`${summary.gradedCount} Graded`} color="secondary" variant="outlined" />
                <Chip label={`${summary.cardCount} Cards`} variant="outlined" />
                <Chip label={`${summary.sealedCount} Sealed`} variant="outlined" />
            </Box>
        </Box>
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
    const displayPrice = purchasePrice > 0 ? purchasePrice : marketPrice;

    const isSealed = userCard.card.product_type === 'SEALED';
    // Grade codes are stored raw (e.g. "Collectr#12") until decoded to real labels
    // (PSA 10, etc.); show a clean "Graded" pill for un-decoded codes, the real
    // label once available. Full value is always in the tooltip.
    const gradeDisplay =
        userCard.grade_label && !userCard.grade_label.startsWith('Collectr#')
            ? userCard.grade_label
            : 'Graded';

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

    return (
        <Card sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
        }}>
            <IconButton
                size="small"
                onClick={() => onShowPriceHistory(userCard)}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    border: 1,
                    borderColor: 'divider',
                    zIndex: 1,
                    '&:hover': { bgcolor: 'action.hover' }
                }}
            >
                <Timeline sx={{ fontSize: 16 }} />
            </IconButton>

            {userCard.quantity > 1 && (
                <Chip
                    label={`×${userCard.quantity}`}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 1,
                        fontWeight: 700,
                        bgcolor: 'background.default',
                        border: 1,
                        borderColor: 'divider',
                    }}
                />
            )}

            <CardMedia
                component="img"
                height="200"
                loading="lazy"
                image={userCard.card.image_url || '/placeholder-card.png'}
                alt={userCard.card.name}
                sx={{ objectFit: 'contain', bgcolor: 'background.default' }}
            />

            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ color: 'primary.main', mb: 1 }}>
                    {userCard.card.name}
                </Typography>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {userCard.card.set_name}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {isSealed ? (
                        <Chip label="Sealed" size="small" color="info" icon={<Inventory2 sx={{ fontSize: 14 }} />} />
                    ) : (
                        userCard.card.rarity && (
                            <Chip
                                label={userCard.card.rarity}
                                size="small"
                                color={getRarityColor(userCard.card.rarity) as any}
                            />
                        )
                    )}
                    {userCard.is_graded && (
                        <Tooltip title={userCard.grade_label || 'Graded'} arrow>
                            <Chip
                                label={gradeDisplay}
                                size="small"
                                color="secondary"
                                icon={<WorkspacePremium sx={{ fontSize: 14 }} />}
                            />
                        </Tooltip>
                    )}
                    {!isSealed && !userCard.is_graded && (
                        <Chip label={userCard.condition} size="small" variant="outlined" />
                    )}
                    {userCard.card.tcg && userCard.card.tcg !== 'Pokemon' && (
                        <Chip label={userCard.card.tcg} size="small" variant="outlined" />
                    )}
                </Box>

                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {purchasePrice > 0 ? 'Purchase Price' : 'Market Price'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {purchasePrice === 0 && getTrendIcon()}
                            <Typography variant="mono" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                {formatPrice(displayPrice)}
                            </Typography>
                        </Box>
                    </Box>

                    {purchasePrice > 0 && marketPrice > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Current Market Price
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {getTrendIcon()}
                                <Typography variant="mono" sx={{ color: 'text.primary' }}>
                                    {formatPrice(marketPrice)}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {purchasePrice > 0 && marketPrice > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                P&L
                            </Typography>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="mono" component="div" sx={{ color: getProfitLossColor(), fontWeight: 700 }}>
                                    {profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}
                                </Typography>
                                <Typography variant="mono" component="div" sx={{ fontSize: 12, color: getProfitLossColor() }}>
                                    ({profitLossPercentage >= 0 ? '+' : ''}{profitLossPercentage.toFixed(1)}%)
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {userCard.card.price_change_24h !== undefined && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                24h Change
                            </Typography>
                            <Typography
                                variant="mono"
                                sx={{
                                    color: userCard.card.price_change_24h >= 0 ? 'success.main' : 'error.main',
                                    fontWeight: 700
                                }}
                            >
                                {userCard.card.price_change_24h >= 0 ? '+' : ''}{userCard.card.price_change_24h.toFixed(1)}%
                            </Typography>
                        </Box>
                    )}
                </Box>

                {userCard.is_for_sale && (
                    <Box sx={{ mb: 2 }}>
                        <Chip
                            label={`FOR ${userCard.sale_type === 'FIXED' ? 'SALE' : 'AUCTION'}`}
                            color="success"
                            size="small"
                            icon={userCard.sale_type === 'FIXED' ? <AttachMoney /> : <Gavel />}
                        />

                        <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                            {userCard.sale_type === 'FIXED' && userCard.fixed_price && (
                                <Box>
                                    <Typography variant="mono" component="div" sx={{ color: 'success.main', fontWeight: 700 }}>
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
                                    <Typography variant="mono" component="div" sx={{ color: 'warning.main', fontWeight: 700 }}>
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

                <Box sx={{ mt: 'auto', display: 'flex', gap: 1, flexDirection: 'column' }}>
                    {!userCard.is_for_sale ? (
                        <Button
                            variant="contained"
                            startIcon={<Sell />}
                            onClick={() => onSellCard(userCard)}
                        >
                            List for Sale
                        </Button>
                    ) : (
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => onRemoveFromSale(userCard.id, userCard.card.name)}
                        >
                            Remove from Sale
                        </Button>
                    )}

                    {marketPrice === 0 && (
                        <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={<PriceCheck />}
                            onClick={() => onUpdatePrice(userCard.card.id)}
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
                            <Grid size={{ xs: 4 }}>
                                <Typography variant="mono" component="div" align="center" sx={{ fontSize: 30, fontWeight: 700, color: 'success.main' }}>
                                    {results.successful_updates}
                                </Typography>
                                <Typography variant="body2" align="center">Updated</Typography>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <Typography variant="mono" component="div" align="center" sx={{ fontSize: 30, fontWeight: 700, color: 'warning.main' }}>
                                    {results.skipped_cards}
                                </Typography>
                                <Typography variant="body2" align="center">Skipped</Typography>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <Typography variant="mono" component="div" align="center" sx={{ fontSize: 30, fontWeight: 700, color: 'error.main' }}>
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
    const { session, status } = useRequireAuth();
    const [userCards, setUserCards] = useState<UserCard[]>([]);
    const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [currentTab, setCurrentTab] = useState(0);
    const [sellDialogOpen, setSellDialogOpen] = useState(false);
    const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<PendingPurchase | null>(null);
    const [priceHistoryModalOpen, setPriceHistoryModalOpen] = useState(false);
    const [selectedCardForHistory, setSelectedCardForHistory] = useState<EnhancedUserCard | null>(null);
    const [bulkPriceUpdateOpen, setBulkPriceUpdateOpen] = useState(false);
    const [selectedCardsForUpdate, setSelectedCardsForUpdate] = useState<number[]>([]);
    const [collectionSortBy, setCollectionSortBy] = useState('newest');
    const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('all');
    const [summary, setSummary] = useState<CollectionSummary | null>(null);
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
        }
    }, [status]);

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
            setError(false);
            const response = await fetch("/api/user/collection?limit=1000", {
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch collection");
            }

            const data = await response.json();
            const cards = data.cards || data;

            if (Array.isArray(cards)) {
                setUserCards(cards);
                setSummary(data.summary ?? null);
            } else {
                console.error('Invalid response format:', data);
                setUserCards([]);
            }
        } catch (error) {
            console.error("Error fetching collection:", error);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingPurchases = async () => {
        try {
            const response = await fetch('/api/notifications?unread_only=true');

            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.statusText}`);
            }

            const notifications = await response.json();

            if (!Array.isArray(notifications)) {
                setPendingPurchases([]);
                return;
            }

            const purchaseNotifications = notifications.filter((notif: any) =>
                (notif.type === 'bid_accepted' || notif.type === 'auction_won') &&
                notif.data?.action_required === true
            );

            const purchaseData = purchaseNotifications.map((notif: any) => ({
                transaction_id: notif.data?.reference_id,
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
                headers: {},
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
        setConfirmationModalOpen(false);
        setSelectedPurchase(null);
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
                fetchUserCards();
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

    const visibleCards = useMemo(() => {
        switch (typeFilter) {
            case 'cards':
                return sortedUserCards.filter((c) => c.card.product_type !== 'SEALED' && !c.is_graded);
            case 'sealed':
                return sortedUserCards.filter((c) => c.card.product_type === 'SEALED');
            case 'graded':
                return sortedUserCards.filter((c) => c.is_graded);
            case 'all':
            default:
                return sortedUserCards;
        }
    }, [sortedUserCards, typeFilter]);

    if (loading) {
        return (
            <AppShell>
                <Container sx={{ marginTop: 4, marginBottom: 4 }}>
                    <CardGridSkeleton count={8} />
                </Container>
            </AppShell>
        );
    }

    return (
        <AppShell>
        <PageHeader
            title={`${session?.user?.name ?? 'My'}'s Collection`}
            icon={<CollectionsIcon />}
            actions={
                <>
                    <Button variant="outlined" color="primary" onClick={() => router.push('/wallet')}>
                        Wallet
                    </Button>
                    <Button variant="outlined" color="primary" onClick={() => router.push('/marketplace')}>
                        Marketplace
                    </Button>
                </>
            }
        />
        <Container maxWidth="xl" sx={{ pb: 4 }}>

            <Paper
                component="section"
                variant="outlined"
                sx={{
                    width: "100%",
                    p: { xs: 2, md: 3 },
                    mt: 2,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                }}
            >
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

                <PendingPurchasesWidget
                    onPurchaseComplete={() => {
                        fetchPendingPurchases();
                        fetchUserCards();
                    }}
                />

                <CollectionAnalytics summary={summary} />

                <Paper variant="outlined" sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={currentTab}
                        onChange={(e, newValue) => setCurrentTab(newValue)}
                        sx={{
                            '& .MuiTab-root': { color: 'text.secondary' },
                            '& .Mui-selected': { color: 'primary.main' },
                            '& .MuiTabs-indicator': { backgroundColor: 'primary.main' }
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

                {currentTab === 0 && (
                    <>
                        {error ? (
                            <ErrorState message="Couldn't load your collection." onRetry={fetchUserCards} />
                        ) : userCards.length === 0 ? (
                            <EmptyState
                                icon={<CollectionsIcon />}
                                title="Your collection is empty"
                                description="Buy cards from the marketplace to start building your collection."
                                action={
                                    <Button variant="contained" onClick={() => router.push('/marketplace')}>
                                        Browse Marketplace
                                    </Button>
                                }
                            />
                        ) : (
                            <>
                                <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <ToggleButtonGroup
                                        value={typeFilter}
                                        exclusive
                                        size="small"
                                        onChange={(_e, v) => v && setTypeFilter(v as ItemTypeFilter)}
                                        aria-label="Filter by item type"
                                    >
                                        <ToggleButton value="all">All ({summary?.totalLines ?? userCards.length})</ToggleButton>
                                        <ToggleButton value="cards">Cards ({summary ? summary.cardCount - summary.gradedCount : 0})</ToggleButton>
                                        <ToggleButton value="graded">Graded ({summary?.gradedCount ?? 0})</ToggleButton>
                                        <ToggleButton value="sealed">Sealed ({summary?.sealedCount ?? 0})</ToggleButton>
                                    </ToggleButtonGroup>

                                    <FormControl size="small" sx={{ minWidth: 180, ml: { sm: 'auto' } }}>
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
                                            color="primary"
                                            onClick={handleBulkPriceUpdate}
                                            startIcon={<PriceCheck />}
                                        >
                                            Update Prices ({selectedCardsForUpdate.length})
                                        </Button>
                                    )}
                                </Box>

                                {visibleCards.length === 0 ? (
                                    <EmptyState
                                        icon={<CollectionsIcon />}
                                        title={
                                            typeFilter === 'cards' ? 'No raw cards'
                                                : typeFilter === 'sealed' ? 'No sealed products'
                                                : typeFilter === 'graded' ? 'No graded cards'
                                                : 'No items'
                                        }
                                        description="Try a different filter to see the rest of your collection."
                                        action={<Button variant="outlined" onClick={() => setTypeFilter('all')}>Show all</Button>}
                                    />
                                ) : (
                                    <Grid container spacing={3}>
                                        {visibleCards.map((userCard) => (
                                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={userCard.id}>
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
                                )}
                            </>
                        )}
                    </>
                )}

                {currentTab === 1 && (
                    <>
                        {pendingPurchases.length === 0 ? (
                            <EmptyState
                                icon={<CheckCircle />}
                                title="No pending purchases"
                                description="All your auction wins and accepted bids are up to date."
                            />
                        ) : (
                            <Grid container spacing={3}>
                                {pendingPurchases.map((purchase, index) => {
                                    const timeLeft = formatDuration(new Date(purchase.expires_at).getTime() - Date.now());
                                    const isExpired = timeLeft === 'Ended';

                                    return (
                                        <Grid size={{ xs: 12, md: 6 }} key={index}>
                                            <Card sx={{
                                                border: 1,
                                                borderColor: isExpired ? 'error.main' : 'warning.main'
                                            }}>
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                        <Warning sx={{ color: isExpired ? 'error.main' : 'warning.main', mr: 1 }} />
                                                        <Typography variant="h6" sx={{ color: 'primary.main' }}>
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
                                                            <Typography variant="mono" sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>
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
            </Paper>

            {/* Modals */}
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
                    >
                        {actionLoading ? 'Listing...' : `List for ${sellData.saleType === 'FIXED' ? 'Sale' : 'Auction'}`}
                    </Button>
                </DialogActions>
            </Dialog>

            <PriceHistoryModal
                open={priceHistoryModalOpen}
                onClose={() => {
                    setPriceHistoryModalOpen(false);
                    setSelectedCardForHistory(null);
                }}
                cardId={selectedCardForHistory?.card.id}
                userCardId={selectedCardForHistory?.id}
                cardName={selectedCardForHistory?.card.name || ''}
            />

            <BulkPriceUpdateModal
                open={bulkPriceUpdateOpen}
                onClose={() => setBulkPriceUpdateOpen(false)}
                selectedCards={selectedCardsForUpdate}
                onUpdateComplete={handlePriceUpdateComplete}
            />

            <PendingPurchaseModal
                open={confirmationModalOpen}
                onClose={() => setConfirmationModalOpen(false)}
                purchaseData={selectedPurchase}
                onConfirmationComplete={handleConfirmationComplete}
            />
        </Container>
        </AppShell>
    );
}