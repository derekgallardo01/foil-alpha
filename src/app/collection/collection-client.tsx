'use client';
import React, { useState, useEffect } from 'react';
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
    Button,
    Chip,
    Alert,
    CircularProgress,
    Paper,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Tabs,
    Tab
} from '@mui/material';
import {
    Menu as MenuIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Visibility as ViewIcon,
    AttachMoney as MoneyIcon,
    Gavel as GavelIcon,
    Store as StoreIcon
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
    condition: string;
    is_for_sale: boolean;
    sale_type: 'FIXED' | 'AUCTION' | null;
    fixed_price: number | null;
    reserve_price: number | null;
    auction_end: string | null;
    is_sold: boolean;
    notes: string | null;
    acquired_date: string;
    bids: Array<{
        id: number;
        amount: number;
        bidder: { id: number; name: string };
        created_at: string;
    }>;
}

interface UserCardsResponse {
    userCards: UserCard[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
    return (
        <div hidden={value !== index} style={{ marginTop: 16 }}>
            {value === index && children}
        </div>
    );
}

export default function CardCollectionPage() {
    const { status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [userCards, setUserCards] = useState<UserCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0);

    // Dialog states
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);
    const [editForm, setEditForm] = useState({
        is_for_sale: false,
        sale_type: '',
        fixed_price: '',
        reserve_price: '',
        auction_duration_hours: '168', // 7 days default
        notes: ''
    });

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const fetchUserCards = async (forSale?: boolean) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (forSale !== undefined) {
                params.append('forSale', forSale.toString());
            }

            const response = await fetch(`/api/user-cards?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch user cards');
            }

            const data: UserCardsResponse = await response.json();
            setUserCards(data.userCards);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchUserCards(tabValue === 1 ? true : undefined);
        }
    }, [status, tabValue]);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const openEditDialog = (userCard: UserCard) => {
        setSelectedCard(userCard);
        setEditForm({
            is_for_sale: userCard.is_for_sale,
            sale_type: userCard.sale_type || '',
            fixed_price: userCard.fixed_price?.toString() || '',
            reserve_price: userCard.reserve_price?.toString() || '',
            auction_duration_hours: '168',
            notes: userCard.notes || ''
        });
        setEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setEditDialogOpen(false);
        setSelectedCard(null);
        setEditForm({
            is_for_sale: false,
            sale_type: '',
            fixed_price: '',
            reserve_price: '',
            auction_duration_hours: '168',
            notes: ''
        });
    };

    const handleSaveCard = async () => {
        if (!selectedCard) return;

        try {
            const updateData: any = {
                is_for_sale: editForm.is_for_sale,
                notes: editForm.notes
            };

            if (editForm.is_for_sale) {
                updateData.sale_type = editForm.sale_type;

                if (editForm.sale_type === 'FIXED') {
                    updateData.fixed_price = parseFloat(editForm.fixed_price);
                } else if (editForm.sale_type === 'AUCTION') {
                    updateData.reserve_price = parseFloat(editForm.reserve_price);
                    updateData.auction_duration_hours = parseInt(editForm.auction_duration_hours);
                }
            }

            const response = await fetch(`/api/user-cards/${selectedCard.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                throw new Error('Failed to update card');
            }

            // Refresh the cards list
            fetchUserCards(tabValue === 1 ? true : undefined);
            closeEditDialog();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${Number(price).toFixed(2)}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
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

    const getHighestBid = (userCard: UserCard) => {
        if (userCard.bids.length === 0) return null;
        return Math.max(...userCard.bids.map(bid => Number(bid.amount)));
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

    const allCards = userCards;
    const cardsForSale = userCards.filter(card => card.is_for_sale && !card.is_sold);

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
            </Box>

            {/* Page Title */}
            <Box sx={{ my: 3 }}>
                <Typography variant="h4" gutterBottom>
                    My Card Collection
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Manage your Pokemon card collection and listings
                </Typography>
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs value={tabValue} onChange={handleTabChange} indicatorColor="primary">
                    <Tab
                        label={`All Cards (${allCards.length})`}
                        icon={<ViewIcon />}
                        iconPosition="start"
                    />
                    <Tab
                        label={`For Sale (${cardsForSale.length})`}
                        icon={<StoreIcon />}
                        iconPosition="start"
                    />
                </Tabs>
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
                    {/* Tab Panels */}
                    <TabPanel value={tabValue} index={0}>
                        {allCards.length === 0 ? (
                            <Paper sx={{ p: 4, textAlign: 'center' }}>
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    No cards in your collection yet
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Purchase cards from the marketplace to start building your collection
                                </Typography>
                                <Button
                                    variant="contained"
                                    sx={{ mt: 2 }}
                                    onClick={() => router.push('/marketplace')}
                                >
                                    Browse Marketplace
                                </Button>
                            </Paper>
                        ) : (
                            <Grid container spacing={3}>
                                {allCards.map((userCard) => (
                                    <Grid item xs={12} sm={6} md={4} lg={3} key={userCard.id}>
                                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            {/* Card Image */}
                                            <Box sx={{ position: 'relative' }}>
                                                <CardMedia
                                                    component="img"
                                                    height="200"
                                                    image={userCard.card.image_url || userCard.card.small_image_url || '/placeholder-card.png'}
                                                    alt={userCard.card.name}
                                                    sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                    }}
                                                />

                                                {/* Status Badges */}
                                                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                    {userCard.is_for_sale && (
                                                        <Chip
                                                            icon={userCard.sale_type === 'AUCTION' ? <GavelIcon /> : <MoneyIcon />}
                                                            label={userCard.sale_type === 'AUCTION' ? 'Auction' : 'For Sale'}
                                                            color={userCard.sale_type === 'AUCTION' ? 'secondary' : 'primary'}
                                                            size="small"
                                                            sx={{ mb: 1 }}
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

                                                {/* Card Details */}
                                                <Box sx={{ mb: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Condition: {userCard.condition}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Acquired: {formatDate(userCard.acquired_date)}
                                                    </Typography>
                                                </Box>

                                                {/* Sale Information */}
                                                {userCard.is_for_sale && (
                                                    <Box sx={{ mb: 2 }}>
                                                        <Divider sx={{ mb: 1 }} />
                                                        {userCard.sale_type === 'FIXED' ? (
                                                            <Typography variant="subtitle1" color="primary.main">
                                                                Price: {formatPrice(userCard.fixed_price)}
                                                            </Typography>
                                                        ) : (
                                                            <Box>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Reserve: {formatPrice(userCard.reserve_price)}
                                                                </Typography>
                                                                {userCard.bids.length > 0 && (
                                                                    <Typography variant="subtitle1" color="primary.main">
                                                                        Highest Bid: {formatPrice(getHighestBid(userCard))}
                                                                    </Typography>
                                                                )}
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {userCard.bids.length} bid{userCard.bids.length !== 1 ? 's' : ''}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                )}

                                                {/* Actions */}
                                                <Box sx={{ mt: 'auto' }}>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<EditIcon />}
                                                        onClick={() => openEditDialog(userCard)}
                                                        fullWidth
                                                    >
                                                        {userCard.is_for_sale ? 'Edit Listing' : 'List for Sale'}
                                                    </Button>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        {cardsForSale.length === 0 ? (
                            <Paper sx={{ p: 4, textAlign: 'center' }}>
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    No cards listed for sale
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Go to "All Cards" tab to list some cards for sale
                                </Typography>
                            </Paper>
                        ) : (
                            <Grid container spacing={3}>
                                {cardsForSale.map((userCard) => (
                                    <Grid item xs={12} sm={6} md={4} lg={3} key={userCard.id}>
                                        {/* Same card display as above - reuse the card component */}
                                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            {/* Card content same as above */}
                                            <Box sx={{ position: 'relative' }}>
                                                <CardMedia
                                                    component="img"
                                                    height="200"
                                                    image={userCard.card.image_url || userCard.card.small_image_url || '/placeholder-card.png'}
                                                    alt={userCard.card.name}
                                                    sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                    }}
                                                />

                                                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                                    <Chip
                                                        icon={userCard.sale_type === 'AUCTION' ? <GavelIcon /> : <MoneyIcon />}
                                                        label={userCard.sale_type === 'AUCTION' ? 'Auction' : 'For Sale'}
                                                        color={userCard.sale_type === 'AUCTION' ? 'secondary' : 'primary'}
                                                        size="small"
                                                    />
                                                </Box>
                                            </Box>

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

                                                <Box sx={{ mb: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Condition: {userCard.condition}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ mb: 2 }}>
                                                    <Divider sx={{ mb: 1 }} />
                                                    {userCard.sale_type === 'FIXED' ? (
                                                        <Typography variant="h6" color="primary.main">
                                                            {formatPrice(userCard.fixed_price)}
                                                        </Typography>
                                                    ) : (
                                                        <Box>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Reserve: {formatPrice(userCard.reserve_price)}
                                                            </Typography>
                                                            {userCard.bids.length > 0 ? (
                                                                <Typography variant="h6" color="primary.main">
                                                                    Current: {formatPrice(getHighestBid(userCard))}
                                                                </Typography>
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    No bids yet
                                                                </Typography>
                                                            )}
                                                            <Typography variant="caption" color="text.secondary">
                                                                {userCard.bids.length} bid{userCard.bids.length !== 1 ? 's' : ''}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>

                                                <Box sx={{ mt: 'auto' }}>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<EditIcon />}
                                                        onClick={() => openEditDialog(userCard)}
                                                        fullWidth
                                                    >
                                                        Edit Listing
                                                    </Button>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </TabPanel>
                </>
            )}

            {/* Edit Card Dialog */}
            <Dialog open={editDialogOpen} onClose={closeEditDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {selectedCard ? `Edit ${selectedCard.card.name}` : 'Edit Card'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={editForm.is_for_sale}
                                    onChange={(e) => setEditForm({ ...editForm, is_for_sale: e.target.checked })}
                                />
                            }
                            label="List for sale"
                            sx={{ mb: 2 }}
                        />

                        {editForm.is_for_sale && (
                            <>
                                <FormControl fullWidth sx={{ mb: 2 }}>
                                    <InputLabel>Sale Type</InputLabel>
                                    <Select
                                        value={editForm.sale_type}
                                        label="Sale Type"
                                        onChange={(e) => setEditForm({ ...editForm, sale_type: e.target.value as string })}
                                    >
                                        <MenuItem value="FIXED">Fixed Price</MenuItem>
                                        <MenuItem value="AUCTION">Auction</MenuItem>
                                    </Select>
                                </FormControl>

                                {editForm.sale_type === 'FIXED' && (
                                    <TextField
                                        fullWidth
                                        label="Fixed Price ($)"
                                        type="number"
                                        value={editForm.fixed_price}
                                        onChange={(e) => setEditForm({ ...editForm, fixed_price: e.target.value })}
                                        sx={{ mb: 2 }}
                                    />
                                )}

                                {editForm.sale_type === 'AUCTION' && (
                                    <>
                                        <TextField
                                            fullWidth
                                            label="Reserve Price ($)"
                                            type="number"
                                            value={editForm.reserve_price}
                                            onChange={(e) => setEditForm({ ...editForm, reserve_price: e.target.value })}
                                            sx={{ mb: 2 }}
                                        />
                                        <FormControl fullWidth sx={{ mb: 2 }}>
                                            <InputLabel>Auction Duration</InputLabel>
                                            <Select
                                                value={editForm.auction_duration_hours}
                                                label="Auction Duration"
                                                onChange={(e) => setEditForm({ ...editForm, auction_duration_hours: e.target.value as string })}
                                            >
                                                <MenuItem value="24">1 Day</MenuItem>
                                                <MenuItem value="72">3 Days</MenuItem>
                                                <MenuItem value="168">7 Days</MenuItem>
                                                <MenuItem value="336">14 Days</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </>
                                )}
                            </>
                        )}

                        <TextField
                            fullWidth
                            label="Notes"
                            multiline
                            rows={3}
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            placeholder="Add any notes about this card..."
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeEditDialog}>Cancel</Button>
                    <Button onClick={handleSaveCard} variant="contained">
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}