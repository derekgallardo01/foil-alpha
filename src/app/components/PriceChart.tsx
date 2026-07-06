// src/app/components/PriceChart.tsx
"use client";

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    CircularProgress,
    Alert,
    Chip,
    Grid,
    Card,
    CardContent,
    Tooltip,
    IconButton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    TrendingUp,
    TrendingDown,
    TrendingFlat,
    Refresh,
    Timeline,
    ShowChart
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface PriceChartProps {
    cardId?: number;
    userCardId?: number;
    height?: number;
    showUserPrice?: boolean;
    autoRefresh?: boolean;
}

interface ChartData {
    date: string;
    market_price: number;
    user_price?: number;
    formatted_date: string;
}

interface PriceAnalytics {
    current: number;
    highest: number;
    lowest: number;
    average: number;
    trend: 'up' | 'down' | 'stable';
    change_percentage: number;
    volatility: number;
}

interface CardInfo {
    id: number;
    name: string;
    set_name: string;
    current_price: number | null;
    user_resell_price?: number | null;
}

export default function PriceChart({
    cardId,
    userCardId,
    height = 400,
    showUserPrice = true,
    autoRefresh = false
}: PriceChartProps) {
    const theme = useTheme();
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [analytics, setAnalytics] = useState<PriceAnalytics | null>(null);
    const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<string>('30');
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const fetchPriceHistory = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                days: timeRange,
                source: 'all'
            });

            if (cardId) {
                params.append('card_id', cardId.toString());
            } else if (userCardId) {
                params.append('user_card_id', userCardId.toString());
            } else {
                throw new Error('Either cardId or userCardId must be provided');
            }

            const response = await fetch(`/api/cards/price-history?${params}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch price history');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch price history');
            }

            const { card_info, chart_data, analytics: analyticsData } = data.data;

            // Format chart data
            const formattedChartData = chart_data.map((entry: any) => ({
                ...entry,
                formatted_date: new Date(entry.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                })
            }));

            setChartData(formattedChartData);
            setCardInfo(card_info);
            setAnalytics(analyticsData.price_stats ? {
                ...analyticsData.price_stats,
                ...analyticsData.trend_analysis
            } : null);
            setLastUpdate(new Date());

        } catch (err) {
            console.error('Error fetching price history:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPriceHistory();
    }, [cardId, userCardId, timeRange]);

    // Auto-refresh functionality
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchPriceHistory();
        }, 300000); // Refresh every 5 minutes

        return () => clearInterval(interval);
    }, [autoRefresh, cardId, userCardId, timeRange]);

    const formatPrice = (price: number | null | undefined) => {
        if (!price) return 'N/A';
        return `$${Number(price).toFixed(2)}`;
    };

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'up':
                return <TrendingUp sx={{ color: 'success.main' }} />;
            case 'down':
                return <TrendingDown sx={{ color: 'error.main' }} />;
            default:
                return <TrendingFlat sx={{ color: 'text.secondary' }} />;
        }
    };

    const getTrendColor = (trend: string) => {
        switch (trend) {
            case 'up':
                return 'success.main';
            case 'down':
                return 'error.main';
            default:
                return 'text.secondary';
        }
    };

    if (loading && chartData.length === 0) {
        return (
            <Paper sx={{ p: 3, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                        Loading price history...
                    </Typography>
                </Box>
            </Paper>
        );
    }

    if (error) {
        return (
            <Paper sx={{ p: 3, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Alert
                    severity="error"
                    action={
                        <IconButton size="small" onClick={fetchPriceHistory}>
                            <Refresh />
                        </IconButton>
                    }
                >
                    {error}
                </Alert>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Timeline />
                            Price History
                            {cardInfo && (
                                <Chip
                                    label={cardInfo.name}
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {cardInfo?.set_name} • Updated {lastUpdate.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                            })}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ToggleButtonGroup
                            value={timeRange}
                            exclusive
                            onChange={(e, newRange) => newRange && setTimeRange(newRange)}
                            size="small"
                        >
                            <ToggleButton value="7">7D</ToggleButton>
                            <ToggleButton value="30">30D</ToggleButton>
                            <ToggleButton value="90">90D</ToggleButton>
                            <ToggleButton value="365">1Y</ToggleButton>
                        </ToggleButtonGroup>

                        <Tooltip title="Refresh data">
                            <IconButton size="small" onClick={fetchPriceHistory} disabled={loading}>
                                <Refresh sx={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Price Analytics Cards */}
                {analytics && (
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} sm={3}>
                            <Card variant="outlined" sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Current Price
                                    </Typography>
                                    <Typography variant="mono" sx={{ color: 'text.primary', fontSize: 18, fontWeight: 700, display: 'block' }}>
                                        {formatPrice(analytics.current)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={6} sm={3}>
                            <Card variant="outlined" sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Trend
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getTrendIcon(analytics.trend)}
                                        <Typography
                                            variant="mono"
                                            sx={{ color: getTrendColor(analytics.trend), fontSize: 18, fontWeight: 700 }}
                                        >
                                            {analytics.change_percentage > 0 ? '+' : ''}{analytics.change_percentage.toFixed(1)}%
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={6} sm={3}>
                            <Card variant="outlined" sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Range
                                    </Typography>
                                    <Typography variant="mono" sx={{ color: 'text.primary', display: 'block' }}>
                                        {formatPrice(analytics.lowest)} - {formatPrice(analytics.highest)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={6} sm={3}>
                            <Card variant="outlined" sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Average
                                    </Typography>
                                    <Typography variant="mono" sx={{ color: 'text.primary', fontSize: 18, fontWeight: 700, display: 'block' }}>
                                        {formatPrice(analytics.average)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                )}
            </Box>

            {/* Chart */}
            {chartData.length > 0 ? (
                <Box sx={{ height: height - 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                            <XAxis
                                dataKey="formatted_date"
                                stroke={theme.palette.text.secondary}
                                fontSize={12}
                            />
                            <YAxis
                                stroke={theme.palette.text.secondary}
                                fontSize={12}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <RechartsTooltip
                                formatter={(value: any, name: string) => [
                                    `$${Number(value).toFixed(2)}`,
                                    name === 'market_price' ? 'Market Price' : 'Your Price'
                                ]}
                                labelFormatter={(label) => `Date: ${label}`}
                                contentStyle={{
                                    backgroundColor: theme.palette.background.paper,
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: '8px',
                                    color: theme.palette.text.primary
                                }}
                            />
                            <Legend />

                            {/* Market Price Line */}
                            <Line
                                type="monotone"
                                dataKey="market_price"
                                stroke={theme.palette.primary.main}
                                strokeWidth={2}
                                name="Market Price"
                                dot={{ fill: theme.palette.primary.main, strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: theme.palette.primary.main, strokeWidth: 2 }}
                            />

                            {/* User Price Line (if available and enabled) */}
                            {showUserPrice && chartData.some(d => d.user_price !== undefined) && (
                                <Line
                                    type="monotone"
                                    dataKey="user_price"
                                    stroke={theme.palette.secondary.main}
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    name="Your Price"
                                    dot={{ fill: theme.palette.secondary.main, strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, stroke: theme.palette.secondary.main, strokeWidth: 2 }}
                                    connectNulls={false}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
            ) : (
                <Box
                    sx={{
                        height: height - 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 2
                    }}
                >
                    <ShowChart sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="h6" color="text.secondary">
                        No price history available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Price data will appear here once the card has been tracked
                    </Typography>
                </Box>
            )}

            {/* User Price Info */}
            {showUserPrice && cardInfo?.user_resell_price && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Your current listing price: <Typography component="strong" variant="mono" sx={{ color: 'secondary.main', fontWeight: 700 }}>{formatPrice(cardInfo.user_resell_price)}</Typography>
                        {analytics && cardInfo.current_price && (
                            <>
                                {' • '}
                                {cardInfo.user_resell_price > cardInfo.current_price ? (
                                    <span style={{ color: theme.palette.error.main }}>
                                        {(((cardInfo.user_resell_price - cardInfo.current_price) / cardInfo.current_price) * 100).toFixed(1)}% above market
                                    </span>
                                ) : (
                                    <span style={{ color: theme.palette.success.main }}>
                                        {(((cardInfo.current_price - cardInfo.user_resell_price) / cardInfo.current_price) * 100).toFixed(1)}% below market
                                    </span>
                                )}
                            </>
                        )}
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}