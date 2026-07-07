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
    Badge
} from '@mui/material';
import {
    Gavel,
    Refresh,
    LocalOffer
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import ErrorState from '../ui/ErrorState';
import { TableRowsSkeleton } from '../ui/Skeletons';
import { hideBelowMd, hideBelowSm } from "../../lib/responsive";
import { getConditionColor } from "../../lib/rarity";
import WidgetHeader from "../ui/WidgetHeader";

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
    const [error, setError] = useState(false);
    const [sortBy, setSortBy] = useState<'ending_soon' | 'most_bids' | 'highest_price'>('ending_soon');

    const fetchAuctions = async () => {
        setError(false);
        try {
            const response = await fetch(`/api/dashboard/live-auctions?limit=${limit}&sortBy=${sortBy}`);
            const data = await response.json();

            if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load auctions');
            setAuctions(data.data);
        } catch (error) {
            console.error('Error fetching live auctions:', error);
            setError(true);
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
        <Paper variant="outlined" sx={{ p: 3, height, border: 1, borderColor: 'divider' }}>
            <WidgetHeader
                icon={<Gavel sx={{ color: 'primary.main' }} />}
                title={
                    <>
                        Live Auctions
                        <Chip
                            label="LIVE"
                            size="small"
                            color="error"
                            sx={{
                                animation: 'pulse 2s infinite'
                            }}
                        />
                    </>
                }
                actions={
                    <>
                        <Button
                            size="small"
                            color="primary"
                            variant={sortBy === 'ending_soon' ? 'contained' : 'outlined'}
                            onClick={() => setSortBy('ending_soon')}
                        >
                            Ending Soon
                        </Button>
                        <Button
                            size="small"
                            color="primary"
                            variant={sortBy === 'most_bids' ? 'contained' : 'outlined'}
                            onClick={() => setSortBy('most_bids')}
                        >
                            Most Bids
                        </Button>
                        <Button
                            size="small"
                            color="primary"
                            variant={sortBy === 'highest_price' ? 'contained' : 'outlined'}
                            onClick={() => setSortBy('highest_price')}
                        >
                            Highest Price
                        </Button>
                        <IconButton size="small" onClick={fetchAuctions} sx={{ color: 'primary.main' }}>
                            <Refresh />
                        </IconButton>
                    </>
                }
            />

            <TableContainer sx={{ maxHeight: height - 120 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: 'background.paper' }}>Card</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper', ...hideBelowMd }}>Seller</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper', ...hideBelowSm }}>Condition</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper' }}>Current Bid</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper' }}>Bids</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper' }}>Time Left</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper' }}>Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRowsSkeleton rows={4} cols={7} />
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <ErrorState variant="inline" message="Couldn't load live auctions." onRetry={fetchAuctions} />
                                </TableCell>
                            </TableRow>
                        ) : auctions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
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
                                    <TableCell sx={hideBelowMd}>
                                        <Typography variant="body2">{auction.seller}</Typography>
                                    </TableCell>
                                    <TableCell sx={hideBelowSm}>
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
                                            <Typography variant="mono" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                                {formatPrice(auction.current_bid || auction.reserve_price)}
                                            </Typography>
                                            {auction.card.market_price && (
                                                <Typography variant="mono" component="div" sx={{ fontSize: 11, color: 'text.secondary' }}>
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
                                        <Button
                                            size="small"
                                            color="primary"
                                            variant="contained"
                                            onClick={() => router.push(`/marketplace?auction=${auction.id}`)}
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