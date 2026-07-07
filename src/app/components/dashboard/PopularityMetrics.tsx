"use client";

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Card,
    CardContent,
    Avatar,
    Chip,
    LinearProgress,
    ToggleButton,
    ToggleButtonGroup,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemSecondaryAction,
    CircularProgress
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useTheme } from '@mui/material/styles';
import {
    Whatshot,
    TrendingUp,
    Visibility,
    Star,
    LocalOffer
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getRarityHex } from '../../lib/rarity';
import { formatPriceNA as formatPrice } from '../../lib/format';
import WidgetHeader from '../ui/WidgetHeader';

interface PopularCard {
    id: number;
    name: string;
    set_name: string;
    rarity: string;
    image_url: string | null;
    market_price: number | null;
    price_change_7d: number | null;
    view_count: number;
    active_listings: number;
    recent_sales: number;
    popularity_score: number;
}

interface PopularityMetricsProps {
    limit?: number;
}

export default function PopularityMetrics({ limit = 5 }: PopularityMetricsProps) {
    const router = useRouter();
    const theme = useTheme();
    const [popularCards, setPopularCards] = useState<PopularCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState('7d');

    const fetchPopularCards = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log(`Fetching popular cards: period=${period}, limit=${limit}`);

            const response = await fetch(`/api/dashboard/popular-cards?period=${period}&limit=${limit}`);
            const data = await response.json();

            console.log('Popular cards response:', data);

            if (data.success && data.data) {
                setPopularCards(data.data);
                console.log(`Loaded ${data.data.length} popular cards`);
            } else {
                console.error('Failed to fetch popular cards:', data.error);
                setError(data.error || 'Failed to load popular cards');
                setPopularCards([]);
            }
        } catch (error) {
            console.error('Error fetching popular cards:', error);
            setError('Network error loading popular cards');
            setPopularCards([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPopularCards();
    }, [period]);


    const getPopularityColor = (score: number) => {
        if (score > 1000) return theme.palette.primary.main;
        if (score > 500) return theme.palette.signal.main;
        if (score > 100) return theme.palette.warning.main;
        return theme.palette.success.main;
    };

    const getPlaceholderImage = () => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='56' viewBox='0 0 40 56'%3E%3Crect width='40' height='56' fill='%23333' rx='4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' fill='%23666' font-size='10'%3E?%3C/text%3E%3C/svg%3E";

    const topCard = popularCards[0];

    // Neutral, themed toggle group — Holo violet reserved for the active state only.
    const toggleSx = {
        '& .MuiToggleButton-root': {
            color: 'text.secondary',
            borderColor: 'divider',
            '&.Mui-selected': {
                color: 'primary.contrastText',
                bgcolor: 'primary.main',
                borderColor: 'primary.main',
                '&:hover': { bgcolor: 'primary.main' }
            },
            '&:hover': {
                bgcolor: 'action.hover'
            }
        }
    } as const;

    if (loading) {
        return (
            <Paper variant="outlined" sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress color="primary" />
                </Box>
            </Paper>
        );
    }

    if (error) {
        return (
            <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Whatshot sx={{ color: 'primary.main' }} />
                    Most Popular Cards
                </Typography>
                <Typography color="error" align="center" sx={{ py: 2 }}>
                    {error}
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper variant="outlined" sx={{ p: 3 }}>
            <WidgetHeader
                icon={<Whatshot sx={{ color: 'primary.main' }} />}
                title="Most Popular Cards"
                actions={
                    <ToggleButtonGroup
                        value={period}
                        exclusive
                        onChange={(e, value) => value && setPeriod(value)}
                        size="small"
                        sx={toggleSx}
                    >
                        <ToggleButton value="24h">24H</ToggleButton>
                        <ToggleButton value="7d">7D</ToggleButton>
                        <ToggleButton value="30d">30D</ToggleButton>
                    </ToggleButtonGroup>
                }
            />

            {popularCards.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    No popular cards found. Check back later!
                </Typography>
            ) : (
                <>
                    {/* Featured Most Popular Card — neutral surface with a Holo accent hairline */}
                    {topCard && (
                        <Card
                            sx={{
                                mb: 3,
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s ease',
                                '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 3,
                                    background: theme.foil.gradient
                                },
                                '&:hover': {
                                    borderColor: 'primary.main'
                                }
                            }}
                            onClick={() => router.push(`/marketplace?search=${encodeURIComponent(topCard.name)}`)}
                        >
                            <CardContent>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, md: 3 }}>
                                        <Avatar
                                            src={topCard.image_url || getPlaceholderImage()}
                                            variant="rounded"
                                            sx={{ width: '100%', height: 150 }}
                                            onError={(e: any) => {
                                                e.target.src = getPlaceholderImage();
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 9 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box>
                                                <Typography variant="h5" gutterBottom sx={{ color: 'text.primary' }}>
                                                    {topCard.name}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {topCard.set_name}
                                                    </Typography>
                                                    <Chip
                                                        label={topCard.rarity}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: getRarityHex(topCard.rarity),
                                                            color: 'white',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                            <Chip
                                                icon={<Star />}
                                                label="#1 Most Popular"
                                                color="primary"
                                                sx={{ fontWeight: 600 }}
                                            />
                                        </Box>

                                        <Grid container spacing={2} sx={{ mt: 2 }}>
                                            <Grid size={{ xs: 6, sm: 3 }}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Visibility sx={{ color: 'text.disabled', mb: 0.5 }} />
                                                    <Typography variant="mono" component="div" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                        {topCard.view_count.toLocaleString()}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Views</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 6, sm: 3 }}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <LocalOffer sx={{ color: 'text.disabled', mb: 0.5 }} />
                                                    <Typography variant="mono" component="div" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                        {topCard.active_listings}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Listings</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 6, sm: 3 }}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <TrendingUp sx={{ color: 'text.disabled', mb: 0.5 }} />
                                                    <Typography variant="mono" component="div" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                        {topCard.recent_sales}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Recent Sales</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 6, sm: 3 }}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="mono" component="div" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                                        {formatPrice(topCard.market_price)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Market Price</Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    )}

                    {/* Rest of Popular Cards List */}
                    <List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
                        {popularCards.slice(1).map((card, index) => (
                            <ListItem
                                key={card.id}
                                component="div"
                                sx={{
                                    cursor: 'pointer',
                                    borderBottom: index < popularCards.length - 2 ? '1px solid' : 'none',
                                    borderColor: 'divider',
                                    px: 2,
                                    py: 1.5,
                                    transition: 'background-color 0.2s ease',
                                    '&:hover': {
                                        bgcolor: 'action.hover'
                                    }
                                }}
                                onClick={() => router.push(`/marketplace?search=${encodeURIComponent(card.name)}`)}
                            >
                                <ListItemAvatar>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="mono" sx={{ color: 'text.secondary', fontWeight: 700, minWidth: 24 }}>
                                            #{index + 2}
                                        </Typography>
                                        <Avatar
                                            src={card.image_url || getPlaceholderImage()}
                                            variant="rounded"
                                            sx={{ width: 50, height: 50 }}
                                            onError={(e: any) => {
                                                e.target.src = getPlaceholderImage();
                                            }}
                                        />
                                    </Box>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body1" sx={{ color: 'text.primary' }}>
                                                {card.name}
                                            </Typography>
                                            <Chip
                                                label={card.rarity}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    bgcolor: getRarityHex(card.rarity),
                                                    color: 'white',
                                                    fontSize: '0.7rem'
                                                }}
                                            />
                                        </Box>
                                    }
                                    secondary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {card.set_name}
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Visibility sx={{ fontSize: 14, color: 'text.disabled' }} />
                                                <Typography variant="mono" sx={{ fontSize: 12, color: 'text.secondary' }}>
                                                    {card.view_count.toLocaleString()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    }
                                />
                                <ListItemSecondaryAction>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="mono" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                            {formatPrice(card.market_price)}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={Math.min(100, (card.popularity_score / (topCard?.popularity_score || 1)) * 100)}
                                                sx={{
                                                    width: 60,
                                                    height: 4,
                                                    bgcolor: 'action.hover',
                                                    borderRadius: 2,
                                                    '& .MuiLinearProgress-bar': {
                                                        bgcolor: getPopularityColor(card.popularity_score),
                                                        borderRadius: 2
                                                    }
                                                }}
                                            />
                                            <Typography variant="caption" color="text.secondary">
                                                {card.active_listings} listings
                                            </Typography>
                                        </Box>
                                    </Box>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                </>
            )}
        </Paper>
    );
}
