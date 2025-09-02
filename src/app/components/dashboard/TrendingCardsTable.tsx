"use client";

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Avatar,
    IconButton,
    ToggleButton,
    ToggleButtonGroup,
    CircularProgress,
    Tooltip,
    Skeleton
} from '@mui/material';
import {
    TrendingUp,
    TrendingDown,
    Refresh,
    Visibility,
    MonetizationOn,
    ShowChart
} from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip as ChartTooltip,
    Legend,
} from 'chart.js';
import { useRouter } from 'next/navigation';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    ChartTooltip,
    Legend
);

interface TrendingCard {
    id: number;
    name: string;
    set_name: string;
    rarity: string;
    image_url: string | null;
    market_price: number | null;
    price_change_7d: number | null;
    volume_24h: number | null;
    view_count: number;
    sparkline: Array<{ date: Date; price: number }>;
}

interface TrendingCardsTableProps {
    period?: string;
    limit?: number;
    height?: number;
}

export default function TrendingCardsTable({
    period: initialPeriod = '7d',
    limit = 10,
    height = 600
}: TrendingCardsTableProps) {
    const router = useRouter();
    const [cards, setCards] = useState<TrendingCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [trendType, setTrendType] = useState<'price' | 'volume' | 'popularity'>('price');
    const [period, setPeriod] = useState(initialPeriod);

    const fetchTrendingCards = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/dashboard/trending-cards?type=${trendType}&period=${period}&limit=${limit}`);
            const data = await response.json();

            if (data.success) {
                setCards(data.data);
            }
        } catch (error) {
            console.error('Error fetching trending cards:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrendingCards();
    }, [trendType, period]);

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${price.toFixed(2)}`;
    };

    const formatPercentage = (value: number | null) => {
        if (!value) return '0%';
        const formatted = value.toFixed(2);
        return value > 0 ? `+${formatted}%` : `${formatted}%`;
    };

    const getRarityColor = (rarity: string) => {
        const colors: Record<string, string> = {
            'Common': '#808080',
            'Uncommon': '#4CAF50',
            'Rare': '#2196F3',
            'Rare Holo': '#9C27B0',
            'Ultra Rare': '#FF9800',
            'Secret Rare': '#F44336',
        };
        return colors[rarity] || '#808080';
    };

    const getSparklineData = (sparkline: TrendingCard['sparkline']) => {
        return {
            labels: sparkline.map(() => ''),
            datasets: [{
                data: sparkline.map(s => s.price),
                borderColor: sparkline.length > 1 && sparkline[sparkline.length - 1].price > sparkline[0].price
                    ? '#4CAF50'
                    : '#F44336',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointRadius: 0,
            }]
        };
    };

    const sparklineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
        },
        scales: {
            x: { display: false },
            y: { display: false }
        }
    };

    return (
        <Paper sx={{ p: 3, height }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp sx={{ color: '#96ff9b' }} />
                    Trending Cards
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <ToggleButtonGroup
                        value={trendType}
                        exclusive
                        onChange={(e, value) => value && setTrendType(value)}
                        size="small"
                    >
                        <ToggleButton value="price">
                            <Tooltip title="Price Change">
                                <MonetizationOn />
                            </Tooltip>
                        </ToggleButton>
                        <ToggleButton value="volume">
                            <Tooltip title="Trading Volume">
                                <ShowChart />
                            </Tooltip>
                        </ToggleButton>
                        <ToggleButton value="popularity">
                            <Tooltip title="Popularity">
                                <Visibility />
                            </Tooltip>
                        </ToggleButton>
                    </ToggleButtonGroup>

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

                    <IconButton size="small" onClick={fetchTrendingCards}>
                        <Refresh />
                    </IconButton>
                </Box>
            </Box>

            <TableContainer sx={{ maxHeight: height - 120 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: 'background.paper', width: 50 }}>#</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper' }}>Card</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper' }}>Set</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper' }}>Rarity</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper' }}>Price</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper' }}>Change</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper', width: 100 }}>Trend</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper' }}>
                                {trendType === 'volume' ? 'Volume' : trendType === 'popularity' ? 'Views' : 'Vol 24h'}
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            [...Array(5)].map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell><Skeleton /></TableCell>
                                    <TableCell><Skeleton /></TableCell>
                                    <TableCell><Skeleton /></TableCell>
                                    <TableCell><Skeleton /></TableCell>
                                    <TableCell><Skeleton /></TableCell>
                                    <TableCell><Skeleton /></TableCell>
                                    <TableCell><Skeleton /></TableCell>
                                    <TableCell><Skeleton /></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            cards.map((card, index) => (
                                <TableRow
                                    key={card.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => router.push(`/marketplace?card=${card.id}`)}
                                >
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar
                                                src={card.image_url || ''}
                                                variant="rounded"
                                                sx={{ width: 40, height: 40 }}
                                            />
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {card.name}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {card.set_name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={card.rarity}
                                            size="small"
                                            sx={{
                                                bgcolor: getRarityColor(card.rarity),
                                                color: 'white',
                                                fontWeight: 500
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {formatPrice(card.market_price)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                            {card.price_change_7d && card.price_change_7d > 0 ? (
                                                <TrendingUp sx={{ fontSize: 16, color: '#4CAF50' }} />
                                            ) : (
                                                <TrendingDown sx={{ fontSize: 16, color: '#F44336' }} />
                                            )}
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: card.price_change_7d && card.price_change_7d > 0 ? '#4CAF50' : '#F44336',
                                                    fontWeight: 500
                                                }}
                                            >
                                                {formatPercentage(card.price_change_7d)}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center" sx={{ p: 1 }}>
                                        <Box sx={{ width: 80, height: 30 }}>
                                            <Line data={getSparklineData(card.sparkline)} options={sparklineOptions} />
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2">
                                            {trendType === 'volume' || trendType === 'price'
                                                ? formatPrice(card.volume_24h)
                                                : card.view_count.toLocaleString()
                                            }
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}