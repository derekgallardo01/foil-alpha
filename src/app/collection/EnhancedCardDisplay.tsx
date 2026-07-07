"use client";

import {
    Box,
    Typography,
    Card,
    CardContent,
    CardMedia,
    Button,
    Chip,
    IconButton,
    Tooltip
} from "@mui/material";
import {
    Sell,
    Gavel,
    AttachMoney,
    TrendingUp,
    TrendingDown,
    TrendingFlat,
    Timeline,
    PriceCheck,
    Inventory2,
    WorkspacePremium
} from "@mui/icons-material";
import { formatPrice } from "../lib/format";
import { getRarityColor } from "../lib/rarity";
import type { EnhancedUserCard } from './collection-client';

// Enhanced Card Display Component
export default function EnhancedCardDisplay({
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
                aria-label="Price history"
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
                    // Larger touch target on phones (≥44px), compact on desktop.
                    p: { xs: 1.25, sm: 0.75 },
                    '&:hover': { bgcolor: 'action.hover' }
                }}
            >
                <Timeline sx={{ fontSize: 18 }} />
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
