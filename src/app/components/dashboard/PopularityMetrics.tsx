"use client";

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
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
import {
    Whatshot,
    TrendingUp,
    Visibility,
    Star,
    LocalOffer
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

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

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${price.toFixed(2)}`;
    };

    const getPopularityColor = (score: number) => {
        if (score > 1000) return '#96ff9b';
        if (score > 500) return '#FFD54F';
        if (score > 100) return '#FF7043';
        return '#66BB6A';
    };

    const getRarityColor = (rarity: string) => {
        const colors: Record<string, string> = {
            'Common': '#757575',
            'Uncommon': '#66BB6A',
            'Rare': '#42A5F5',
            'Rare Holo': '#AB47BC',
            'Ultra Rare': '#FF7043',
            'Secret Rare': '#EF5350',
            'VMAX': '#96ff9b',
            'VSTAR': '#FFD54F',
            'Promo': '#9C27B0'
        };
        return colors[rarity] || '#757575';
    };

    const getPlaceholderImage = () => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='56' viewBox='0 0 40 56'%3E%3Crect width='40' height='56' fill='%23333' rx='4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' fill='%23666' font-size='10'%3E?%3C/text%3E%3C/svg%3E";

    const topCard = popularCards[0];

    if (loading) {
        return (
            <Paper sx={{
                p: 3,
                bgcolor: 'grey.800',
                border: '1px solid rgba(150, 255, 155, 0.2)'
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: '#96ff9b' }} />
                </Box>
            </Paper>
        );
    }

    if (error) {
        return (
            <Paper sx={{
                p: 3,
                bgcolor: 'grey.800',
                border: '1px solid rgba(150, 255, 155, 0.2)'
            }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Whatshot sx={{ color: '#96ff9b' }} />
                    Most Popular Cards
                </Typography>
                <Typography color="error" align="center" sx={{ py: 2 }}>
                    {error}
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{
            p: 3,
            bgcolor: 'grey.800',
            border: '1px solid rgba(150, 255, 155, 0.2)'
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Whatshot sx={{ color: '#96ff9b' }} />
                    Most Popular Cards
                </Typography>

                <ToggleButtonGroup
                    value={period}
                    exclusive
                    onChange={(e, value) => value && setPeriod(value)}
                    size="small"
                    sx={{
                        '& .MuiToggleButton-root': {
                            color: 'text.secondary',
                            borderColor: 'rgba(150, 255, 155, 0.3)',
                            '&.Mui-selected': {
                                color: '#000',
                                bgcolor: '#96ff9b',
                                borderColor: '#96ff9b'
                            },
                            '&:hover': {
                                bgcolor: 'rgba(150, 255, 155, 0.1)'
                            }
                        }
                    }}
                >
                    <ToggleButton value="24h">24H</ToggleButton>
                    <ToggleButton value="7d">7D</ToggleButton>
                    <ToggleButton value="30d">30D</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {popularCards.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    No popular cards found. Check back later!
                </Typography>
            ) : (
                <>
                    {/* Featured Most Popular Card */}
                    {topCard && (
                        <Card
                            sx={{
                                mb: 3,
                                background: 'linear-gradient(135deg, rgba(150, 255, 155, 0.15) 0%, rgba(150, 255, 155, 0.05) 100%)',
                                border: '1px solid rgba(150, 255, 155, 0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 8px 24px rgba(150, 255, 155, 0.2)'
                                }
                            }}
                            onClick={() => router.push(`/marketplace?card=${topCard.id}`)}
                        >
                            <CardContent>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={3}>
                                        <Avatar
                                            src={topCard.image_url || getPlaceholderImage()}
                                            variant="rounded"
                                            sx={{ width: '100%', height: 150 }}
                                            onError={(e: any) => {
                                                e.target.src = getPlaceholderImage();
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={9}>
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
                                                            bgcolor: getRarityColor(topCard.rarity),
                                                            color: 'white',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                            <Chip
                                                icon={<Star />}
                                                label="#1 Most Popular"
                                                sx={{
                                                    bgcolor: '#96ff9b',
                                                    color: '#000',
                                                    fontWeight: 600
                                                }}
                                            />
                                        </Box>

                                        <Grid container spacing={2} sx={{ mt: 2 }}>
                                            <Grid item xs={6} sm={3}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Visibility sx={{ color: '#96ff9b', mb: 0.5 }} />
                                                    <Typography variant="h6" sx={{ color: 'text.primary' }}>
                                                        {topCard.view_count.toLocaleString()}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Views</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <LocalOffer sx={{ color: '#96ff9b', mb: 0.5 }} />
                                                    <Typography variant="h6" sx={{ color: 'text.primary' }}>
                                                        {topCard.active_listings}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Listings</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <TrendingUp sx={{ color: '#96ff9b', mb: 0.5 }} />
                                                    <Typography variant="h6" sx={{ color: 'text.primary' }}>
                                                        {topCard.recent_sales}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Recent Sales</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h6" sx={{ color: '#96ff9b', fontWeight: 600 }}>
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
                    <List sx={{ bgcolor: 'grey.900', borderRadius: 1 }}>
                        {popularCards.slice(1).map((card, index) => (
                            <ListItem
                                key={card.id}
                                component="div"
                                sx={{
                                    cursor: 'pointer',
                                    borderBottom: index < popularCards.length - 2 ? '1px solid rgba(150, 255, 155, 0.1)' : 'none',
                                    px: 2,
                                    py: 1.5,
                                    transition: 'background-color 0.2s ease',
                                    '&:hover': {
                                        bgcolor: 'rgba(150, 255, 155, 0.05)'
                                    }
                                }}
                                onClick={() => router.push(`/marketplace?card=${card.id}`)}
                            >
                                <ListItemAvatar>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="h6" sx={{ color: '#96ff9b', fontWeight: 600, minWidth: 24 }}>
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
                                                    bgcolor: getRarityColor(card.rarity),
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
                                                <Visibility sx={{ fontSize: 14, color: '#96ff9b' }} />
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                    {card.view_count.toLocaleString()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    }
                                />
                                <ListItemSecondaryAction>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#96ff9b' }}>
                                            {formatPrice(card.market_price)}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={Math.min(100, (card.popularity_score / (topCard?.popularity_score || 1)) * 100)}
                                                sx={{
                                                    width: 60,
                                                    height: 4,
                                                    bgcolor: 'rgba(150, 255, 155, 0.1)',
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