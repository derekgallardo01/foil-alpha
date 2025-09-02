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
    ListItemSecondaryAction
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
    const [period, setPeriod] = useState('7d');

    const fetchPopularCards = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/dashboard/popular-cards?period=${period}&limit=${limit}`);
            const data = await response.json();

            if (data.success) {
                setPopularCards(data.data);
            }
        } catch (error) {
            console.error('Error fetching popular cards:', error);
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
        if (score > 1000) return '#F44336';
        if (score > 500) return '#FF9800';
        if (score > 100) return '#FFC107';
        return '#4CAF50';
    };

    const topCard = popularCards[0];

    return (
        <Paper sx={{ p: 3 }}>
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
                >
                    <ToggleButton value="24h">24H</ToggleButton>
                    <ToggleButton value="7d">7D</ToggleButton>
                    <ToggleButton value="30d">30D</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {loading ? (
                <Box sx={{ py: 4 }}>
                    <LinearProgress />
                </Box>
            ) : (
                <>
                    {/* Featured Most Popular Card */}
                    {topCard && (
                        <Card
                            sx={{
                                mb: 3,
                                background: 'linear-gradient(135deg, rgba(150, 255, 155, 0.1) 0%, rgba(150, 255, 155, 0.05) 100%)',
                                border: '1px solid rgba(150, 255, 155, 0.3)',
                                cursor: 'pointer'
                            }}
                            onClick={() => router.push(`/marketplace?card=${topCard.id}`)}
                        >
                            <CardContent>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={3}>
                                        <Avatar
                                            src={topCard.image_url || ''}
                                            variant="rounded"
                                            sx={{ width: '100%', height: 150 }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={9}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box>
                                                <Typography variant="h5" gutterBottom>
                                                    {topCard.name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                                    {topCard.set_name} • {topCard.rarity}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                icon={<Star />}
                                                label="#1 Most Popular"
                                                color="warning"
                                            />
                                        </Box>

                                        <Grid container spacing={2} sx={{ mt: 2 }}>
                                            <Grid item xs={6} sm={3}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Visibility sx={{ color: 'text.secondary' }} />
                                                    <Typography variant="h6">{topCard.view_count.toLocaleString()}</Typography>
                                                    <Typography variant="caption" color="text.secondary">Views</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <LocalOffer sx={{ color: 'text.secondary' }} />
                                                    <Typography variant="h6">{topCard.active_listings}</Typography>
                                                    <Typography variant="caption" color="text.secondary">Listings</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <TrendingUp sx={{ color: 'text.secondary' }} />
                                                    <Typography variant="h6">{topCard.recent_sales}</Typography>
                                                    <Typography variant="caption" color="text.secondary">Recent Sales</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h6">{formatPrice(topCard.market_price)}</Typography>
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
                    <List>
                        {popularCards.slice(1).map((card, index) => (
                            <ListItem
                                key={card.id}
                                component="button"
                                onClick={() => router.push(`/marketplace?card=${card.id}`)}
                                sx={{
                                    borderBottom: index < popularCards.length - 2 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                                    px: 0,
                                    width: '100%',
                                    textAlign: 'left'
                                }}
                            >
                                <ListItemAvatar>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="h6" color="text.secondary">
                                            #{index + 2}
                                        </Typography>
                                        <Avatar
                                            src={card.image_url || ''}
                                            variant="rounded"
                                            sx={{ width: 50, height: 50 }}
                                        />
                                    </Box>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body1">{card.name}</Typography>
                                            <Chip
                                                label={card.rarity}
                                                size="small"
                                                sx={{ height: 20 }}
                                            />
                                        </Box>
                                    }
                                    secondary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {card.set_name}
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Visibility fontSize="small" sx={{ fontSize: 14 }} />
                                                <Typography variant="caption">
                                                    {card.view_count.toLocaleString()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    }
                                />
                                <ListItemSecondaryAction>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                            {formatPrice(card.market_price)}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={Math.min(100, (card.popularity_score / popularCards[0].popularity_score) * 100)}
                                                sx={{
                                                    width: 60,
                                                    height: 4,
                                                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                                                    '& .MuiLinearProgress-bar': {
                                                        bgcolor: getPopularityColor(card.popularity_score)
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