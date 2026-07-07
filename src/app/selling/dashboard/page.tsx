// src/app/selling/dashboard/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    Card,
    CardContent,
    CardMedia,
    Button,
    Chip,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Tooltip,
    Divider,
    Tabs,
    Tab,
    Badge,
    List,
    ListItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    Gavel as GavelIcon,
    AccessTime as ClockIcon,
    Person as PersonIcon,
    AttachMoney as MoneyIcon,
    Check as AcceptIcon,
    Refresh as RefreshIcon,
    History as HistoryIcon,
    Sell as SellIcon,
    ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import AppShell from '../../components/AppShell';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { CardGridSkeleton } from '../../components/ui/Skeletons';
import { getRarityColor } from '../../lib/rarity';
import { formatDuration, formatDateTime, formatPriceNA as formatPrice } from '../../lib/format';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { hideBelowMd } from "../../lib/responsive";

interface Card {
    id: number;
    name: string;
    set_name: string;
    set_number: string;
    rarity: string;
    image_url: string;
    small_image_url: string;
}

interface Bid {
    id: number;
    amount: number;
    bidder: { id: number; name: string; email: string };
    created_at: string;
    is_active: boolean;
}

interface ActiveSale {
    id: number;
    card: Card;
    condition: string;
    sale_type: 'FIXED' | 'AUCTION';
    fixed_price?: number;
    reserve_price?: number;
    auction_end?: string;
    bids: Bid[];
    highest_bid?: number;
    bid_count: number;
    time_remaining?: number;
    created_at: string;
}

interface SoldItem {
    id: number;
    card: Card;
    condition: string;
    sale_type: string;
    sale_price: number;
    buyer: { id: number; name: string; email: string };
    completed_at: string;
    created_at: string;
    notes?: string;
}

interface SalesData {
    activeSales: ActiveSale[];
    soldItems: SoldItem[];
}

interface SalesStats {
    totalActiveSales: number;
    totalSoldItems: number;
    totalRevenue: number;
    averageSalePrice: number;
    totalBidsReceived: number;
}

export default function SellingDashboard() {
    const { status } = useRequireAuth();
    const router = useRouter();
    const [salesData, setSalesData] = useState<SalesData>({ activeSales: [], soldItems: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSale, setSelectedSale] = useState<ActiveSale | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [acceptingBid, setAcceptingBid] = useState<number | null>(null);
    const [currentTab, setCurrentTab] = useState(0);
    const [stats, setStats] = useState<SalesStats>({
        totalActiveSales: 0,
        totalSoldItems: 0,
        totalRevenue: 0,
        averageSalePrice: 0,
        totalBidsReceived: 0
    });

    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        bidId: number | null;
        bidAmount: number;
        bidderName: string;
    }>({
        open: false,
        bidId: null,
        bidAmount: 0,
        bidderName: ''
    });

    const fetchSalesData = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/user-cards/my-sales');
            if (!response.ok) {
                throw new Error('Failed to fetch sales data');
            }

            const data: SalesData = await response.json();
            setSalesData(data);

            // Calculate stats
            const totalRevenue = data.soldItems.reduce((sum, item) => sum + item.sale_price, 0);
            const totalBidsReceived = data.activeSales.reduce((sum, sale) => sum + sale.bid_count, 0);

            setStats({
                totalActiveSales: data.activeSales.length,
                totalSoldItems: data.soldItems.length,
                totalRevenue,
                averageSalePrice: data.soldItems.length > 0 ? totalRevenue / data.soldItems.length : 0,
                totalBidsReceived
            });

        } catch (err) {
            console.error('Error fetching sales data:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchSalesData();
        }
    }, [status]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (status === 'authenticated') {
            const interval = setInterval(fetchSalesData, 30000);
            return () => clearInterval(interval);
        }
    }, [status]);

    // Fix: Update formatPrice to handle undefined values

    const getAuctionStatus = (sale: ActiveSale) => {
        if (sale.sale_type === 'FIXED') return { label: 'Fixed Price', color: 'primary' as const };
        if (sale.time_remaining && sale.time_remaining > 0) return { label: 'Active', color: 'success' as const };
        return { label: 'Ended', color: 'error' as const };
    };

    const handleAcceptBid = (bid: Bid) => {
        setConfirmDialog({
            open: true,
            bidId: bid.id,
            bidAmount: bid.amount,
            bidderName: bid.bidder.name
        });
    };

    const confirmAcceptBid = async () => {
        if (!confirmDialog.bidId) return;

        setAcceptingBid(confirmDialog.bidId);

        try {
            const response = await fetch('/api/bids/accept', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bid_id: confirmDialog.bidId
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Bid accepted! ${data.transaction.card_name} sold to ${data.transaction.buyer_name} for ${formatPrice(data.transaction.amount)}`);
                fetchSalesData(); // Refresh data
                setDetailsModalOpen(false);
            } else {
                toast.error(data.error || 'Failed to accept bid');
            }
        } catch (error) {
            console.error('Error accepting bid:', error);
            toast.error('Failed to accept bid');
        } finally {
            setAcceptingBid(null);
            setConfirmDialog({
                open: false,
                bidId: null,
                bidAmount: 0,
                bidderName: ''
            });
        }
    };

    const showBidDetails = (sale: ActiveSale) => {
        setSelectedSale(sale);
        setDetailsModalOpen(true);
    };

    const getTransactionTypeLabel = (type: string) => {
        switch (type) {
            case 'FIXED_PRICE': return 'Fixed Price';
            case 'BID_ACCEPTED': return 'Bid Accepted';
            case 'AUCTION_WIN': return 'Auction Won';
            default: return type;
        }
    };

    if (status === 'loading') {
        return (
            <AppShell>
                <PageHeader title="My Sales" icon={<SellIcon />} />
                <Container maxWidth="lg" sx={{ py: 3 }}>
                    <CardGridSkeleton count={6} />
                </Container>
            </AppShell>
        );
    }

    if (status === 'unauthenticated') {
        return null;
    }

    const hasData = salesData.activeSales.length > 0 || salesData.soldItems.length > 0;

    return (
        <AppShell>
            <PageHeader
                title="My Sales"
                icon={<SellIcon />}
                actions={
                    <>
                        <IconButton onClick={fetchSalesData} title="Refresh" aria-label="Refresh sales">
                            <RefreshIcon />
                        </IconButton>
                        <Button
                            variant="outlined"
                            onClick={() => router.push('/collection')}
                            size="small"
                            startIcon={<ShoppingCartIcon />}
                        >
                            Sell Cards
                        </Button>
                        <Button variant="outlined" onClick={() => router.push('/marketplace')} size="small">
                            Marketplace
                        </Button>
                    </>
                }
            />
        <Container maxWidth="xl" sx={{ pb: 4 }}>
            {/* Quick Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 3, mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard label="Active Sales" value={stats.totalActiveSales} icon={<SellIcon fontSize="small" />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard label="Total Sold" value={stats.totalSoldItems} icon={<HistoryIcon fontSize="small" />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard accent label="Total Revenue" value={formatPrice(stats.totalRevenue)} icon={<MoneyIcon fontSize="small" />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard label="Total Bids" value={stats.totalBidsReceived} icon={<GavelIcon fontSize="small" />} />
                </Grid>
            </Grid>

            {/* Error State */}
            {error && hasData && (
                <ErrorState variant="inline" message="Couldn't refresh your sales." onRetry={fetchSalesData} />
            )}

            {/* Content Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={currentTab}
                    onChange={(e, newValue) => setCurrentTab(newValue)}
                    variant="fullWidth"
                >
                    <Tab
                        label={
                            <Badge badgeContent={stats.totalActiveSales} color="primary">
                                Active Sales & Auctions
                            </Badge>
                        }
                        icon={<SellIcon />}
                    />
                    <Tab
                        label={
                            <Badge badgeContent={stats.totalSoldItems} color="success">
                                Sales History
                            </Badge>
                        }
                        icon={<HistoryIcon />}
                    />
                </Tabs>
            </Paper>

            {/* Loading / content — spinner only on first load so the 30s auto-refresh
                doesn't blank the tabs. */}
            {loading && !hasData ? (
                <CardGridSkeleton count={6} />
            ) : error && !hasData ? (
                <ErrorState message="We couldn't load your sales right now." onRetry={fetchSalesData} />
            ) : (
                <>
                    {/* Active Sales Tab */}
                    {currentTab === 0 && (
                        <>
                            {salesData.activeSales.length === 0 ? (
                                <EmptyState
                                    icon={<SellIcon />}
                                    title="No active sales or auctions"
                                    description="List cards from your collection to start selling."
                                    action={
                                        <Button
                                            variant="contained"
                                            onClick={() => router.push('/collection')}
                                            startIcon={<ShoppingCartIcon />}
                                        >
                                            Go to Collection
                                        </Button>
                                    }
                                />
                            ) : (
                                <Grid container spacing={3}>
                                    {salesData.activeSales.map((sale) => {
                                        const status = getAuctionStatus(sale);
                                        const hasActiveBids = sale.bid_count > 0;

                                        return (
                                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={sale.id}>
                                                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                                    {/* Card Image */}
                                                    <Box sx={{ position: 'relative' }}>
                                                        <CardMedia
                                                            component="img"
                                                            height="200"
                                                            loading="lazy"
                                                            image={sale.card.small_image_url || sale.card.image_url || '/placeholder-card.png'}
                                                            alt={sale.card.name}
                                                            sx={{ objectFit: 'contain', bgcolor: 'background.default' }}
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                            }}
                                                        />

                                                        {/* Status Badge */}
                                                        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                            <Chip
                                                                label={sale.sale_type === 'AUCTION' ? status.label : 'Fixed'}
                                                                color={status.color}
                                                                size="small"
                                                                variant="filled"
                                                            />
                                                        </Box>

                                                        {/* Bid Count Badge */}
                                                        {hasActiveBids && (
                                                            <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
                                                                <Badge badgeContent={sale.bid_count} color="secondary">
                                                                    <GavelIcon sx={{ color: 'white' }} />
                                                                </Badge>
                                                            </Box>
                                                        )}
                                                    </Box>

                                                    {/* Card Content */}
                                                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <Typography variant="h6" component="h3" gutterBottom noWrap>
                                                            {sale.card.name}
                                                        </Typography>

                                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                                            {sale.card.set_name}
                                                        </Typography>

                                                        <Chip
                                                            label={sale.card.rarity}
                                                            color={getRarityColor(sale.card.rarity)}
                                                            size="small"
                                                            sx={{ mb: 2, alignSelf: 'flex-start' }}
                                                        />

                                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                                            Condition: {sale.condition}
                                                        </Typography>

                                                        <Divider sx={{ my: 1 }} />

                                                        {/* Sale Info */}
                                                        <Box sx={{ mt: 'auto' }}>
                                                            {sale.sale_type === 'FIXED' ? (
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Price:
                                                                    </Typography>
                                                                    <Typography variant="mono" sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'text.primary' }}>
                                                                        {formatPrice(sale.fixed_price)}
                                                                    </Typography>
                                                                </Box>
                                                            ) : (
                                                                <>
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            Current Bid:
                                                                        </Typography>
                                                                        <Typography
                                                                            variant="mono"
                                                                            sx={{ fontSize: '1.2rem', fontWeight: 700, color: sale.highest_bid ? 'text.primary' : 'text.secondary' }}
                                                                        >
                                                                            {formatPrice(sale.highest_bid || sale.reserve_price)}
                                                                        </Typography>
                                                                    </Box>

                                                                    {status.label === 'Active' && sale.time_remaining && (
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                                <ClockIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                                                                <Typography variant="body2" color="text.secondary">
                                                                                    Time left:
                                                                                </Typography>
                                                                            </Box>
                                                                            <Typography variant="body2" color="error.main">
                                                                                {formatDuration(sale.time_remaining)}
                                                                            </Typography>
                                                                        </Box>
                                                                    )}
                                                                </>
                                                            )}

                                                            {/* Action Buttons */}
                                                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                                                <Button
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    onClick={() => showBidDetails(sale)}
                                                                >
                                                                    {sale.sale_type === 'FIXED' ?
                                                                        'View Details' :
                                                                        `Manage Bids (${sale.bid_count})`
                                                                    }
                                                                </Button>

                                                                {sale.sale_type === 'AUCTION' && sale.highest_bid && status.label === 'Active' && (
                                                                    <Tooltip title="Accept highest bid">
                                                                        <IconButton
                                                                            color="success"
                                                                            onClick={() => handleAcceptBid(sale.bids[0])}
                                                                            disabled={acceptingBid === sale.bids[0]?.id}
                                                                        >
                                                                            {acceptingBid === sale.bids[0]?.id ? (
                                                                                <CircularProgress size={20} />
                                                                            ) : (
                                                                                <AcceptIcon />
                                                                            )}
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            )}
                        </>
                    )}

                    {/* Sales History Tab */}
                    {currentTab === 1 && (
                        <>
                            {salesData.soldItems.length === 0 ? (
                                <EmptyState
                                    icon={<HistoryIcon />}
                                    title="No sales history yet"
                                    description="Your completed sales will appear here."
                                />
                            ) : (
                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Card</TableCell>
                                                <TableCell sx={hideBelowMd}>Sale Type</TableCell>
                                                <TableCell align="right">Sale Price</TableCell>
                                                <TableCell sx={hideBelowMd}>Buyer</TableCell>
                                                <TableCell>Date Sold</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {salesData.soldItems.map((item) => (
                                                <TableRow key={item.id} hover>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <img
                                                                src={item.card.small_image_url || item.card.image_url || '/placeholder-card.png'}
                                                                alt={item.card.name}
                                                                style={{
                                                                    width: 40,
                                                                    height: 56,
                                                                    objectFit: 'contain',
                                                                    borderRadius: 4
                                                                }}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                                }}
                                                            />
                                                            <Box>
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    {item.card.name}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" display="block">
                                                                    {item.card.set_name}
                                                                </Typography>
                                                                <Chip
                                                                    label={item.condition}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{ mt: 0.5 }}
                                                                />
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={hideBelowMd}>
                                                        <Chip
                                                            label={getTransactionTypeLabel(item.sale_type)}
                                                            color="primary"
                                                            variant="outlined"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="mono" sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'success.main' }}>
                                                            {formatPrice(item.sale_price)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell sx={hideBelowMd}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <PersonIcon fontSize="small" />
                                                            <Typography variant="body2">
                                                                {item.buyer.name}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2">
                                                            {formatDateTime(item.completed_at)}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Bid Management Modal */}
            <Dialog open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {selectedSale?.sale_type === 'AUCTION' ? <GavelIcon /> : <SellIcon />}
                        <Typography variant="h6">
                            {selectedSale?.sale_type === 'AUCTION' ? 'Manage Bids for' : 'Details for'} {selectedSale?.card.name}
                        </Typography>
                    </Box>
                </DialogTitle>

                <DialogContent>
                    {selectedSale && (
                        <Box>
                            {/* Card Summary */}
                            <Paper sx={{ p: 2, mb: 3 }}>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 4 }}>
                                        <img
                                            src={selectedSale.card.small_image_url || selectedSale.card.image_url || '/placeholder-card.png'}
                                            alt={selectedSale.card.name}
                                            style={{ width: '100%', height: 'auto', maxHeight: '150px', objectFit: 'contain' }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 8 }}>
                                        <Typography variant="h6">{selectedSale.card.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {selectedSale.card.set_name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            Condition: {selectedSale.condition}
                                        </Typography>

                                        {selectedSale.sale_type === 'FIXED' ? (
                                            <Typography variant="body2">
                                                Fixed Price: {formatPrice(selectedSale.fixed_price)}
                                            </Typography>
                                        ) : (
                                            <>
                                                <Typography variant="body2">
                                                    Reserve: {formatPrice(selectedSale.reserve_price)}
                                                </Typography>
                                                <Typography variant="body2">
                                                    Ends: {selectedSale.auction_end ? formatDateTime(selectedSale.auction_end) : 'N/A'}
                                                </Typography>
                                            </>
                                        )}
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Bids or Fixed Price Info */}
                            {selectedSale.sale_type === 'FIXED' ? (
                                <Paper sx={{ p: 3, textAlign: 'center' }}>
                                    <Typography variant="h6" gutterBottom>
                                        Fixed Price Sale
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        Listed at {formatPrice(selectedSale.fixed_price)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        Buyers can purchase immediately at this price
                                    </Typography>
                                </Paper>
                            ) : (
                                <>
                                    {selectedSale.bids.length === 0 ? (
                                        <Paper sx={{ p: 3, textAlign: 'center' }}>
                                            <GavelIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                            <Typography variant="body1" color="text.secondary">
                                                No bids received yet
                                            </Typography>
                                        </Paper>
                                    ) : (
                                        <List>
                                            {selectedSale.bids
                                                .sort((a, b) => Number(b.amount) - Number(a.amount))
                                                .map((bid, index) => (
                                                    <ListItem key={bid.id} divider>
                                                        <ListItemIcon>
                                                            <PersonIcon />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <Box>
                                                                        <Typography variant="body1">
                                                                            {bid.bidder.name}
                                                                        </Typography>
                                                                        {index === 0 && (
                                                                            <Chip label="Highest Bid" color="primary" size="small" />
                                                                        )}
                                                                    </Box>
                                                                    <Typography variant="mono" sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'text.primary' }}>
                                                                        {formatPrice(bid.amount)}
                                                                    </Typography>
                                                                </Box>
                                                            }
                                                            secondary={formatDateTime(bid.created_at)}
                                                        />
                                                        {bid.is_active && getAuctionStatus(selectedSale).label === 'Active' && (
                                                            <Button
                                                                variant="contained"
                                                                color="success"
                                                                size="small"
                                                                onClick={() => handleAcceptBid(bid)}
                                                                disabled={acceptingBid === bid.id}
                                                                startIcon={acceptingBid === bid.id ?
                                                                    <CircularProgress size={16} /> :
                                                                    <AcceptIcon />
                                                                }
                                                            >
                                                                Accept
                                                            </Button>
                                                        )}
                                                    </ListItem>
                                                ))}
                                        </List>
                                    )}
                                </>
                            )}
                        </Box>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setDetailsModalOpen(false)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Accept Bid Dialog */}
            <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
                <DialogTitle>Confirm Bid Acceptance</DialogTitle>
                <DialogContent>
                    <Typography variant="body1">
                        Accept bid of <strong>{formatPrice(confirmDialog.bidAmount)}</strong> from{' '}
                        <strong>{confirmDialog.bidderName}</strong>?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        This will end the auction and transfer the card immediately.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
                        disabled={acceptingBid !== null}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmAcceptBid}
                        variant="contained"
                        color="success"
                        disabled={acceptingBid !== null}
                        startIcon={acceptingBid !== null ? <CircularProgress size={16} /> : <AcceptIcon />}
                    >
                        Accept Bid
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
        </AppShell>
    );
 }