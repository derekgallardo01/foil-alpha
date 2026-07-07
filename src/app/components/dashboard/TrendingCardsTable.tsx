"use client";

import React, { useState } from 'react';
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
import { useTheme } from '@mui/material/styles';
import { hideBelowMd, hideBelowSm } from "../../lib/responsive";
import { formatPriceNA as formatPrice } from "../../lib/format";
import { useDashboardResource } from "../../lib/useDashboardResource";
import { getRarityHex } from "../../lib/rarity";
import WidgetHeader from "../ui/WidgetHeader";

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
    const theme = useTheme();
    const [trendType, setTrendType] = useState<'price' | 'volume' | 'popularity'>('price');
    const [period, setPeriod] = useState(initialPeriod);

    const { data: cards, loading, error, refetch } = useDashboardResource<TrendingCard>(
        `/api/dashboard/trending-cards?type=${trendType}&period=${period}&limit=${limit}`,
        { deps: [trendType, period, limit] }
    );


    const formatPercentage = (value: number | null) => {
        if (value === null || value === undefined) return '0%';
        const formatted = Math.abs(value).toFixed(2);
        return value > 0 ? `+${formatted}%` : `-${formatted}%`;
    };

    const getSparklineData = (sparkline: TrendingCard['sparkline']) => {
        if (!sparkline || sparkline.length === 0) {
            return {
                labels: ['', '', '', '', ''],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    borderColor: theme.palette.text.disabled,
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0,
                }]
            };
        }

        const isIncreasing = sparkline.length > 1 &&
            sparkline[sparkline.length - 1].price > sparkline[0].price;

        return {
            labels: sparkline.map(() => ''),
            datasets: [{
                data: sparkline.map(s => s.price),
                borderColor: isIncreasing ? theme.palette.success.main : theme.palette.error.main,
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
        },
        elements: {
            point: { radius: 0 }
        }
    };

    const getPlaceholderImage = () => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='56' viewBox='0 0 40 56'%3E%3Crect width='40' height='56' fill='%23333' rx='4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' fill='%23666' font-size='10'%3E?%3C/text%3E%3C/svg%3E";

    return (
        <Paper variant="outlined" sx={{
            p: 3,
            height,
            border: 1,
            borderColor: 'divider'
        }}>
            <WidgetHeader
                icon={<TrendingUp sx={{ color: 'primary.main' }} />}
                title="Trending Cards"
                actions={
                    <>
                        <ToggleButtonGroup
                            value={trendType}
                            exclusive
                            onChange={(e, value) => value && setTrendType(value)}
                            size="small"
                            sx={{
                                '& .MuiToggleButton-root': {
                                    color: 'text.secondary',
                                    borderColor: 'divider',
                                    '&.Mui-selected': {
                                        color: 'primary.contrastText',
                                        bgcolor: 'primary.main',
                                        borderColor: 'primary.main',
                                        '&:hover': {
                                            bgcolor: 'primary.main'
                                        }
                                    },
                                    '&:hover': {
                                        bgcolor: 'action.hover'
                                    }
                                }
                            }}
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
                            sx={{
                                '& .MuiToggleButton-root': {
                                    color: 'text.secondary',
                                    borderColor: 'divider',
                                    '&.Mui-selected': {
                                        color: 'primary.contrastText',
                                        bgcolor: 'primary.main',
                                        borderColor: 'primary.main',
                                        '&:hover': {
                                            bgcolor: 'primary.main'
                                        }
                                    },
                                    '&:hover': {
                                        bgcolor: 'action.hover'
                                    }
                                }
                            }}
                        >
                            <ToggleButton value="24h">24H</ToggleButton>
                            <ToggleButton value="7d">7D</ToggleButton>
                            <ToggleButton value="30d">30D</ToggleButton>
                        </ToggleButtonGroup>

                        <IconButton
                            size="small"
                            onClick={refetch}
                            sx={{ color: 'primary.main' }}
                        >
                            <Refresh />
                        </IconButton>
                    </>
                }
            />

            <TableContainer sx={{
                maxHeight: height - 120,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: 1,
                borderColor: 'divider'
            }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', width: 50 }}>#</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>Card</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', ...hideBelowMd }}>Set</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper', color: 'text.primary', ...hideBelowSm }}>Rarity</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>Price</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>Change</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper', color: 'text.primary', width: 100, ...hideBelowMd }}>Trend</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
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
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Box sx={{ py: 3 }}>
                                        <Typography color="error" gutterBottom>
                                            {error}
                                        </Typography>
                                        <IconButton onClick={refetch} sx={{ color: 'primary.main' }}>
                                            <Refresh />
                                        </IconButton>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : cards.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                                        No trending cards found. Try changing the filter options or refresh the data.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            cards.map((card, index) => (
                                <TableRow
                                    key={card.id}
                                    hover
                                    sx={{
                                        cursor: 'pointer',
                                        bgcolor: 'background.default',
                                        '&:hover': {
                                            bgcolor: 'action.hover'
                                        }
                                    }}
                                    onClick={() => router.push(`/marketplace?search=${encodeURIComponent(card.name)}`)}
                                >
                                    <TableCell sx={{ color: 'text.primary' }}>{index + 1}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar
                                                src={card.image_url || getPlaceholderImage()}
                                                variant="rounded"
                                                sx={{ width: 40, height: 40 }}
                                                onError={(e: any) => {
                                                    e.target.src = getPlaceholderImage();
                                                }}
                                            />
                                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                                                {card.name}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={hideBelowMd}>
                                        <Typography variant="body2" color="text.secondary">
                                            {card.set_name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={hideBelowSm}>
                                        <Chip
                                            label={card.rarity}
                                            size="small"
                                            sx={{
                                                bgcolor: getRarityHex(card.rarity),
                                                color: 'white',
                                                fontWeight: 500
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="mono" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                            {formatPrice(card.market_price)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                            {card.price_change_7d && card.price_change_7d > 0 ? (
                                                <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                                            ) : (
                                                <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                                            )}
                                            <Typography
                                                variant="mono"
                                                sx={{
                                                    color: card.price_change_7d && card.price_change_7d > 0 ? 'success.main' : 'error.main',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {formatPercentage(card.price_change_7d)}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center" sx={{ p: 1, ...hideBelowMd }}>
                                        <Box sx={{ width: 80, height: 30 }}>
                                            <Line data={getSparklineData(card.sparkline)} options={sparklineOptions} />
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="mono" color="text.primary">
                                            {trendType === 'volume' || trendType === 'price'
                                                ? (card.volume_24h?.toLocaleString() || '0')
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