'use client';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
    Typography,
    Box,
    Chip,
    Paper,
    Divider,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    TrendingUp,
    TrendingDown,
    TrendingFlat,
    Timeline,
    LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';
import PriceDisplay from '../components/PriceDisplay';
import { useCurrencyContext } from '../lib/currency-context';
import type { Card, Listing, EnhancedListing } from './marketplace-client';

// Price Comparison Component with Currency Support
export function PriceComparisonBox({ listing }: { listing: EnhancedListing }) {
    const marketPrice = listing.card.market_price || 0;
    const userPrice = listing.fixed_price || listing.reserve_price || 0;
    const priceDiff = userPrice > 0 && marketPrice > 0 ?
        ((userPrice - marketPrice) / marketPrice) * 100 : 0;

    const getPriceStatus = () => {
        if (Math.abs(priceDiff) < 5) return { color: 'text.secondary', label: 'Market Price' };
        if (priceDiff > 0) return { color: 'error.main', label: `${priceDiff.toFixed(1)}% Above Market` };
        return { color: 'success.main', label: `${Math.abs(priceDiff).toFixed(1)}% Below Market` };
    };

    const priceStatus = getPriceStatus();

    return (
        <Box sx={{
            p: 1.5,
            bgcolor: 'background.default',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
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
                        variant="mono"
                        sx={{ fontWeight: 700, fontSize: '0.875rem' }}
                    />
                </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    {listing.sale_type === 'FIXED' ? 'Asking Price' : 'Reserve Price'}
                </Typography>
                <PriceDisplay
                    usdAmount={userPrice}
                    variant="mono"
                    color="primary.main"
                    sx={{ fontWeight: 700, fontSize: '0.875rem' }}
                />
            </Box>

            <Box sx={{ textAlign: 'center' }}>
                <Chip
                    label={priceStatus.label}
                    size="small"
                    sx={{
                        color: priceStatus.color,
                        borderColor: priceStatus.color,
                        fontWeight: 700,
                        fontSize: '0.7rem'
                    }}
                    variant="outlined"
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

// Market Summary Component with Currency Support
export function MarketSummarySection({ cards }: { cards: EnhancedListing[] }) {
    const { selectedCurrency } = useCurrencyContext();
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
        <Paper variant="outlined" sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline sx={{ color: 'primary.main' }} />
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
                <Grid size={{ xs: 6, md: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="mono" component="div" sx={{ fontSize: 30, fontWeight: 700, color: 'primary.main' }}>
                            {marketStats.totalCards}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Cards Listed
                        </Typography>
                    </Box>
                </Grid>

                <Grid size={{ xs: 6, md: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <PriceDisplay
                            usdAmount={marketStats.avgPrice}
                            variant="mono"
                            color="text.primary"
                            sx={{ fontSize: 30, fontWeight: 700 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            Avg. Price
                        </Typography>
                    </Box>
                </Grid>

                <Grid size={{ xs: 6, md: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <PriceDisplay
                            usdAmount={marketStats.totalValue}
                            variant="mono"
                            color="text.primary"
                            sx={{ fontSize: 30, fontWeight: 700 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            Total Value
                        </Typography>
                    </Box>
                </Grid>

                <Grid size={{ xs: 6, md: 3 }}>
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
                <Grid size={{ xs: 3 }}>
                    <Chip label={`Under $5: ${marketStats.priceRanges.under_5}`} size="small" variant="outlined" />
                </Grid>
                <Grid size={{ xs: 3 }}>
                    <Chip label={`$5-$25: ${marketStats.priceRanges._5_to_25}`} size="small" variant="outlined" />
                </Grid>
                <Grid size={{ xs: 3 }}>
                    <Chip label={`$25-$100: ${marketStats.priceRanges._25_to_100}`} size="small" variant="outlined" />
                </Grid>
                <Grid size={{ xs: 3 }}>
                    <Chip label={`$100+: ${marketStats.priceRanges.over_100}`} size="small" variant="outlined" />
                </Grid>
            </Grid>
        </Paper>
    );
}

// Daily Deals Component with Currency Support
export function DailyDealsSection({ cards }: { cards: EnhancedListing[] }) {
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
        <Paper variant="outlined" sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalOfferIcon sx={{ color: 'success.main' }} />
                Daily Deals - Cards Below Market Price
            </Typography>

            <Grid container spacing={2}>
                {deals.map((deal) => {
                    const marketPrice = deal.card.market_price || 0;
                    const userPrice = deal.fixed_price || deal.reserve_price || 0;
                    const discount = ((marketPrice - userPrice) / marketPrice) * 100;

                    return (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={deal.id}>
                            <Box sx={{
                                p: 2,
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                bgcolor: 'background.default'
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
                                            variant="mono"
                                            color="success.main"
                                            sx={{ fontSize: '1.15rem', fontWeight: 700 }}
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
