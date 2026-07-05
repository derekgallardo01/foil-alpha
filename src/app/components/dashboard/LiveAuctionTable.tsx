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
    Avatar,
    IconButton,
    Chip,
    Button,
    LinearProgress,
    Tooltip,
    Badge
} from '@mui/material';
import {
    Gavel,
    Timer,
    Visibility,
    Refresh,
    LocalOffer
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import CountdownTimer from '../CountdownTimer';

interface LiveAuction {
    id: number;
    card: {
        id: number;
        name: string;
        set_name: string;
        rarity: string;
        image_url: string | null;
        market_price: number | null;
    };
    seller: string;
    current_bid: number | null;
    reserve_price: number | null;
    bid_count: number;
    time_remaining: number;
    auction_end: Date;
    condition: string | null;
    watching_count: number;
}

interface LiveAuctionTableProps {
    limit?: number;
    height?: number;
    autoRefresh?: boolean;
}

export default function LiveAuctionTable({
    limit = 10,
    height = 500,
    autoRefresh = true
}: LiveAuctionTableProps) {
    const router = useRouter();
    const [auctions, setAuctions] = useState<LiveAuction[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'ending_soon' | 'most_bids' | 'highest_price'>('ending_soon');

    const fetchAuctions = async () => {
        try {
            const response = await fetch(`/api/dashboard/live-auctions?limit=${limit}&sortBy=${sortBy}`);
            const data = await response.json();

            if (data.success) {
                setAuctions(data.data);
            }
        } catch (error) {
            console.error('Error fetching live auctions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuctions();

        if (autoRefresh) {
            const interval = setInterval(fetchAuctions, 30000); // Refresh every 30 seconds
            return () => clearInterval(interval);
        }
    }, [sortBy, autoRefresh]);

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${price.toFixed(2)}`;
    };

    const getConditionColor = (condition: string | null) => {
        const colors: Record<string, string> = {
            'Mint': '#4CAF50',
            'Near Mint': '#8BC34A',
            'Excellent': '#FFC107',
            'Good': '#FF9800',
            'Fair': '#FF5722',
            'Poor': '#F44336'
        };
        return colors[condition || ''] || '#757575';
    };

    const getTimeColor = (timeRemaining: number) => {
        const hours = timeRemaining / (1000 * 60 * 60);
        if (hours < 1) return '#F44336';
        if (hours < 24) return '#FF9800';
        return '#4CAF50';
    };

    function formatTimeRemaining(time_remaining: number): React.ReactNode {
        const now = Date.now();
        const remaining = time_remaining - now;
        
        if (remaining <= 0) {
            return <Chip label="ENDED" color="error" size="small" />;
        }
        
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return <Chip label={`${days}d ${hours}h`} color="success" size="small" />;
        } else if (hours > 0) {
            return <Chip label={`${hours}h ${minutes}m`} color="warning" size="small" />;
        } else {
            return <Chip label={`${minutes}m`} color="error" size="small" />;
        }
    }

    return (
        <Paper sx={{ p: 3, height }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Gavel sx={{ color: '#9B5Cff' }} />
                    Live Auctions
                    <Chip
                        label="LIVE"
                        size="small"
                        sx={{
                            bgcolor: '#F44336',
                            color: 'white',
                            animation: 'pulse 2s infinite'
                        }}
                    />
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        variant={sortBy === 'ending_soon' ? 'contained' : 'outlined'}
                        onClick={() => setSortBy('ending_soon')}
                        sx={{
                            borderColor: '#9B5Cff',
                            color: sortBy === 'ending_soon' ? '#000' : '#9B5Cff',
                            bgcolor: sortBy === 'ending_soon' ? '#9B5Cff' : 'transparent'
                        }}
                    >
                        Ending Soon
                    </Button>
                    <Button
                        size="small"
                        variant={sortBy === 'most_bids' ? 'contained' : 'outlined'}
                        onClick={() => setSortBy('most_bids')}
                        sx={{
                            borderColor: '#9B5Cff',
                            color: sortBy === 'most_bids' ? '#000' : '#9B5Cff',
                            bgcolor: sortBy === 'most_bids' ? '#9B5Cff' : 'transparent'
                        }}
                    >
                        Most Bids
                    </Button>
                    <Button
                        size="small"
                        variant={sortBy === 'highest_price' ? 'contained' : 'outlined'}
                        onClick={() => setSortBy('highest_price')}
                        sx={{
                            borderColor: '#9B5Cff',
                            color: sortBy === 'highest_price' ? '#000' : '#9B5Cff',
                            bgcolor: sortBy === 'highest_price' ? '#9B5Cff' : 'transparent'
                        }}
                    >
                        Highest Price
                    </Button>
                    <IconButton size="small" onClick={fetchAuctions}>
                        <Refresh />
                    </IconButton>
                </Box>
            </Box>

            <TableContainer sx={{ maxHeight: height - 120 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: 'background.paper' }}>Card</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper' }}>Seller</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper' }}>Condition</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper' }}>Current Bid</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper' }}>Bids</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper' }}>Time Left</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper' }}>Watching</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper' }}>Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <LinearProgress sx={{ my: 2 }} />
                                </TableCell>
                            </TableRow>
                        ) : auctions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                                        No active auctions at the moment
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            auctions.map((auction) => (
                                <TableRow key={auction.id} hover>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar
                                                src={auction.card.image_url || ''}
                                                variant="rounded"
                                                sx={{ width: 50, height: 50 }}
                                            />
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                    {auction.card.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {auction.card.set_name}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{auction.seller}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={auction.condition || 'Unknown'}
                                            size="small"
                                            sx={{
                                                bgcolor: getConditionColor(auction.condition),
                                                color: 'white',
                                                fontWeight: 500
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {formatPrice(auction.current_bid || auction.reserve_price)}
                                            </Typography>
                                            {auction.card.market_price && (
                                                <Typography variant="caption" color="text.secondary">
                                                    Market: {formatPrice(auction.card.market_price)}
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Badge badgeContent={auction.bid_count} color="primary">
                                            <LocalOffer fontSize="small" />
                                        </Badge>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box sx={{ color: getTimeColor(auction.time_remaining) }}>
                                            <Typography variant="body2">
                                                {formatTimeRemaining(auction.time_remaining)}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                            <Visibility fontSize="small" sx={{ color: 'text.secondary' }} />
                                            <Typography variant="body2">
                                                {auction.watching_count}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={() => router.push(`/marketplace?auction=${auction.id}`)}
                                            sx={{
                                                bgcolor: '#9B5Cff',
                                                color: '#000',
                                                '&:hover': { bgcolor: '#7ee683' }
                                            }}
                                        >
                                            Bid Now
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <style jsx global>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>
        </Paper>
    );
}