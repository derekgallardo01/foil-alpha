'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    IconButton,
    Grid,
    Card,
    CardContent,
    CardMedia,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Chip,
    Alert,
    CircularProgress,
    InputAdornment,
    Paper,
    Divider
} from '@mui/material';
import {
    Search as SearchIcon,
    Menu as MenuIcon,
    AccessTime as ClockIcon,
    AttachMoney as DollarIcon,
    Gavel as GavelIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import Image from 'next/image';
import Sidebar from '../components/Sidebar';

interface Card {
    id: number;
    name: string;
    set_name: string;
    set_number: string;
    rarity: string;
    card_type: string;
    image_url: string;
    small_image_url: string;
}

interface UserCard {
    id: number;
    card: Card;
    owner: { id: number; name: string };
    condition: string;
    sale_type: 'FIXED' | 'AUCTION';
    fixed_price: number | null;
    reserve_price: number | null;
    auction_end: string | null;
    current_price: number;
    highest_bid: number | null;
    bid_count: number;
    time_remaining: number | null;
    notes: string | null;
}

interface MarketplaceResponse {
    listings: UserCard[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export default function MarketplacePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [cards, setCards] = useState<UserCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSet, setSelectedSet] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedSaleType, setSelectedSaleType] = useState('');
    const [purchasing, setPurchasing] = useState(false);

    // Extract unique sets and types from cards for filters
    const availableSets = Array.from(new Set(cards.map(card => card.card.set_name))).sort();
    const availableTypes = Array.from(new Set(cards.map(card => card.card.card_type))).sort();

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const fetchCards = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();

            if (searchTerm) params.append('search', searchTerm);
            if (selectedSet) params.append('set', selectedSet);
            if (selectedType) params.append('type', selectedType);
            if (selectedSaleType) params.append('sale_type', selectedSaleType);

            const response = await fetch(`/api/marketplace?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch marketplace cards');
            }

            const data: MarketplaceResponse = await response.json();
            console.log('Marketplace data:', data); // Debug log
            setCards(data.listings || []);
        } catch (err) {
            console.error('Marketplace fetch error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, selectedSet, selectedType, selectedSaleType]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchCards();
        }
    }, [fetchCards, status]);

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${Number(price).toFixed(2)}`;
    };

    const formatTimeLeft = (timeLeftMs: number | null) => {
        if (!timeLeftMs || timeLeftMs <= 0) return 'Ended';

        const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const handlePurchase = async (userCard: UserCard) => {
        if (!session?.user?.id) {
            alert('Please login to purchase cards');
            return;
        }

        if (userCard.owner.id === parseInt(session.user.id)) {
            alert('You cannot buy your own card');
            return;
        }

        setPurchasing(true);
        try {
            const response = await fetch('/api/marketplace/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_card_id: userCard.id
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert(`Successfully purchased ${data.card_name} for $${data.purchase_price}!`);
                fetchCards(); // Refresh the marketplace
            } else {
                alert(data.error || 'Failed to purchase card');
            }
        } catch (error) {
            console.error('Purchase error:', error);
            alert('Failed to purchase card');
        } finally {
            setPurchasing(false);
        }
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity.toLowerCase()) {
            case 'common': return 'default' as const;
            case 'uncommon': return 'success' as const;
            case 'rare': return 'primary' as const;
            case 'holo rare': return 'secondary' as const;
            case 'ultra rare': return 'error' as const;
            default: return 'default' as const;
        }
    };

    if (status === 'loading') {
        return (
            <Container>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (status === 'unauthenticated') {
        return null;
    }

    return (
        <Container sx={{ marginTop: 4, marginBottom: 4 }}>
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 3 }}>
                <IconButton onClick={toggleSidebar}>
                    <MenuIcon />
                </IconButton>
                <Image
                    src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
                    alt="Logo"
                    width={120}
                    height={60}
                    priority
                />
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ mr: 2 }}>
                        Welcome, {session?.user?.name}
                    </Typography>
                </Box>
            </Box>

            {/* Page Title */}
            <Box sx={{ my: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Card Marketplace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Discover and purchase Pokemon cards from other collectors
                </Typography>
            </Box>

            {/* Search and Filters */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FilterIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Search & Filters</Typography>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                        <TextField
                            fullWidth
                            label="Search cards"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Set</InputLabel>
                            <Select
                                value={selectedSet}
                                label="Set"
                                onChange={(e) => setSelectedSet(e.target.value as string)}
                            >
                                <MenuItem value="">All Sets</MenuItem>
                                {availableSets.map(set => (
                                    <MenuItem key={set} value={set}>{set}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select
                                value={selectedType}
                                label="Type"
                                onChange={(e) => setSelectedType(e.target.value as string)}
                            >
                                <MenuItem value="">All Types</MenuItem>
                                {availableTypes.map(type => (
                                    <MenuItem key={type} value={type}>{type}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Sale Type</InputLabel>
                            <Select
                                value={selectedSaleType}
                                label="Sale Type"
                                onChange={(e) => setSelectedSaleType(e.target.value as string)}
                            >
                                <MenuItem value="">All Sale Types</MenuItem>
                                <MenuItem value="FIXED">Fixed Price</MenuItem>
                                <MenuItem value="AUCTION">Auction</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            {/* Error State */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Error: {error}
                </Alert>
            )}

            {/* Loading State */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {/* Cards Grid */}
                    {cards.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="h6" color="text.secondary">
                                No cards found matching your criteria
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Try adjusting your search or filters
                            </Typography>
                        </Paper>
                    ) : (
                        <Grid container spacing={3}>
                            {cards.map((userCard) => (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={userCard.id}>
                                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        {/* Card Image */}
                                        <Box sx={{ position: 'relative' }}>
                                            <CardMedia
                                                component="img"
                                                height="200"
                                                image={userCard.card.small_image_url || userCard.card.image_url || '/placeholder-card.png'}
                                                alt={userCard.card.name}
                                                sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                }}
                                            />

                                            {/* Sale Type Badge */}
                                            <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                {userCard.sale_type === 'AUCTION' ? (
                                                    <Chip
                                                        icon={<GavelIcon />}
                                                        label="Auction"
                                                        color="secondary"
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Chip
                                                        icon={<DollarIcon />}
                                                        label="Fixed"
                                                        color="primary"
                                                        size="small"
                                                    />
                                                )}
                                            </Box>
                                        </Box>

                                        {/* Card Content */}
                                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                            <Typography variant="h6" component="h3" gutterBottom noWrap>
                                                {userCard.card.name}
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                {userCard.card.set_name} • {userCard.card.set_number}
                                            </Typography>

                                            <Chip
                                                label={userCard.card.rarity}
                                                color={getRarityColor(userCard.card.rarity)}
                                                size="small"
                                                sx={{ mb: 2, alignSelf: 'flex-start' }}
                                            />

                                            {/* Condition and Owner */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Condition: {userCard.condition}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    by {userCard.owner.name}
                                                </Typography>
                                            </Box>

                                            <Divider sx={{ my: 1 }} />

                                            {/* Price and Action */}
                                            <Box sx={{ mt: 'auto' }}>
                                                {userCard.sale_type === 'FIXED' ? (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="h6" color="primary.main">
                                                            {formatPrice(userCard.fixed_price)}
                                                        </Typography>
                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            onClick={() => handlePurchase(userCard)}
                                                            disabled={purchasing || userCard.owner.id === parseInt(session?.user?.id || '0')}
                                                        >
                                                            {purchasing ? <CircularProgress size={20} /> : 'Buy Now'}
                                                        </Button>
                                                    </Box>
                                                ) : (
                                                    <Box>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Current Bid:
                                                            </Typography>
                                                            <Typography variant="subtitle1" color="primary.main">
                                                                {formatPrice(userCard.highest_bid || userCard.reserve_price)}
                                                            </Typography>
                                                        </Box>

                                                        {userCard.time_remaining && userCard.time_remaining > 0 ? (
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                    <ClockIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Time left:
                                                                    </Typography>
                                                                </Box>
                                                                <Typography variant="body2" color="error.main">
                                                                    {formatTimeLeft(userCard.time_remaining)}
                                                                </Typography>
                                                            </Box>
                                                        ) : (
                                                            <Typography variant="body2" color="error.main" align="center" sx={{ mb: 2 }}>
                                                                Auction Ended
                                                            </Typography>
                                                        )}

                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {userCard.bid_count} bid{userCard.bid_count !== 1 ? 's' : ''}
                                                            </Typography>
                                                            <Button
                                                                variant="contained"
                                                                color="secondary"
                                                                size="small"
                                                                disabled={!userCard.time_remaining || userCard.time_remaining <= 0}
                                                            >
                                                                Place Bid
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                )}
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </>
            )}
        </Container>
    );
}