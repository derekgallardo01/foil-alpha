// src/app/collection/collection-client.tsx - Updated with purchase confirmations
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    IconButton,
    Alert,
    Paper,
    Tabs,
    Tab,
    Badge
} from "@mui/material";
import {
    Menu as MenuIcon,
    Sell,
    Gavel,
    AttachMoney,
    Schedule,
    Visibility,
    Edit,
    CheckCircle,
    Warning,
    ShoppingCart
} from "@mui/icons-material";
import Image from "next/image";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PurchaseConfirmationModal from "../components/PurchaseConfirmationModal";

interface UserCard {
    id: number;
    condition: string;
    is_for_sale: boolean;
    sale_type: string | null;
    fixed_price: number | null;
    reserve_price: number | null;
    auction_end: string | null;
    is_sold: boolean;
    acquired_date: string;
    card: {
        id: number;
        name: string;
        set_name: string;
        rarity: string;
        image_url: string | null;
    };
}

interface SellDialogData {
    userCardId: number;
    cardName: string;
    saleType: 'FIXED' | 'AUCTION';
    fixedPrice: string;
    reservePrice: string;
    auctionDays: string;
}

interface PendingPurchase {
    transaction_id: number;
    card_name: string;
    card_image: string;
    amount: number;
    seller_name: string;
    expires_at: string;
    notification_id?: number;
}

export default function CollectionPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [userCards, setUserCards] = useState<UserCard[]>([]);
    const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState(0);
    const [sellDialogOpen, setSellDialogOpen] = useState(false);
    const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<PendingPurchase | null>(null);
    const [sellData, setSellData] = useState<SellDialogData>({
        userCardId: 0,
        cardName: '',
        saleType: 'FIXED',
        fixedPrice: '',
        reservePrice: '',
        auctionDays: '7'
    });
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (status === "authenticated") {
            fetchUserCards();
            fetchPendingPurchases();
        } else if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    // Auto-refresh pending purchases every 30 seconds
    useEffect(() => {
        if (status === 'authenticated') {
            const interval = setInterval(() => {
                fetchPendingPurchases();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [status]);

    const fetchUserCards = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/user/collection", {
                headers: {
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
            });

            if (!response.ok) throw new Error("Failed to fetch collection");

            const data = await response.json();
            setUserCards(data);

        } catch (error) {
            console.error("Error fetching collection:", error);
            toast.error("Failed to load collection");
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingPurchases = async () => {
        try {
            // Get pending transactions for this user
            const response = await fetch('/api/notifications?unread_only=true');
            if (response.ok) {
                const notifications = await response.json();

                // Filter for auction won notifications that need confirmation
                const pendingPurchaseNotifications = notifications.filter(
                    (notif: any) =>
                        (notif.type === 'AUCTION_WON' || notif.type === 'BID_ACCEPTED') &&
                        notif.metadata?.action_required === true
                );

                const pendingPurchases: PendingPurchase[] = pendingPurchaseNotifications.map((notif: any) => ({
                    transaction_id: notif.reference_id,
                    card_name: notif.metadata?.card_name || 'Unknown Card',
                    card_image: notif.metadata?.card_image || '/placeholder-card.png',
                    amount: notif.metadata?.amount || notif.metadata?.winning_amount || 0,
                    seller_name: notif.metadata?.seller_name || 'Unknown Seller',
                    expires_at: notif.metadata?.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    notification_id: notif.id
                }));

                setPendingPurchases(pendingPurchases);
            }
        } catch (error) {
            console.error("Error fetching pending purchases:", error);
        }
    };

    const handleSellCard = (userCard: UserCard) => {
        setSellData({
            userCardId: userCard.id,
            cardName: userCard.card.name,
            saleType: 'FIXED',
            fixedPrice: '',
            reservePrice: '',
            auctionDays: '7'
        });
        setSellDialogOpen(true);
    };

    const handleConfirmSale = async () => {
        try {
            setActionLoading(true);

            const requestBody: any = {
                sale_type: sellData.saleType,
            };

            if (sellData.saleType === 'FIXED') {
                requestBody.fixed_price = parseFloat(sellData.fixedPrice);
            } else {
                requestBody.reserve_price = parseFloat(sellData.reservePrice);
                requestBody.auction_duration_hours = parseInt(sellData.auctionDays) * 24;
            }

            const response = await fetch(`/api/user/collection/${sellData.userCardId}/sell`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to list card');
            }

            toast.success(`${sellData.cardName} listed for ${sellData.saleType === 'FIXED' ? 'sale' : 'auction'}!`);
            setSellDialogOpen(false);
            fetchUserCards();

        } catch (error) {
            console.error("Error listing card:", error);
            toast.error(error instanceof Error ? error.message : "Failed to list card");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFromSale = async (userCardId: number, cardName: string) => {
        try {
            const response = await fetch(`/api/user/collection/${userCardId}/sell`, {
                method: 'DELETE',
                headers: {
                    "Authorization": `Bearer ${session?.accessToken}`,
                },
            });

            if (!response.ok) throw new Error('Failed to remove from sale');

            toast.success(`${cardName} removed from sale`);
            fetchUserCards();

        } catch (error) {
            console.error("Error removing from sale:", error);
            toast.error("Failed to remove from sale");
        }
    };

    const handleConfirmPurchase = (purchase: PendingPurchase) => {
        setSelectedPurchase(purchase);
        setConfirmationModalOpen(true);
    };

    const handleConfirmationComplete = () => {
        fetchPendingPurchases();
        fetchUserCards();
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity.toLowerCase()) {
            case 'common': return 'default';
            case 'uncommon': return 'primary';
            case 'rare': return 'secondary';
            case 'rare holo': return 'warning';
            default: return 'default';
        }
    };

    const formatPrice = (price: number) => {
        return `$${price.toFixed(2)}`;
    };

    const formatTimeLeft = (expiresAt: string) => {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diffMs = expires.getTime() - now.getTime();

        if (diffMs <= 0) return 'Expired';

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                Loading your collection...
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                bgcolor: "grey.900",
                background: "linear-gradient(181deg,rgba(0, 0, 0, 0.74), #031e04,rgba(0, 0, 0, 0.17), #000000d4)",
                backgroundSize: "200% 200%",
                animation: "gradientShift 20s ease infinite",
                "@keyframes gradientShift": {
                    "0%": { backgroundPosition: "0% 0%" },
                    "50%": { backgroundPosition: "100% 100%" },
                    "100%": { backgroundPosition: "0% 0%" },
                },
            }}
        >
            <ToastContainer position="top-right" />

            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: '1px solid rgba(150, 255, 155, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market" width={40} height={20} />
                    <Typography variant="h5" sx={{ color: '#96ff9b', fontWeight: 'bold' }}>
                        My Collection
                    </Typography>
                </Box>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/wallet')}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        My Wallet
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/marketplace')}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        Marketplace
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <Typography variant="h4" sx={{ color: '#96ff9b', mb: 3, textAlign: 'center' }}>
                    {session?.user?.name}'s Card Collection
                </Typography>

                {/* Pending Purchase Alerts */}
                {pendingPurchases.length > 0 && (
                    <Alert
                        severity="warning"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => setCurrentTab(1)}
                            >
                                View All
                            </Button>
                        }
                        sx={{ mb: 3 }}
                    >
                        You have {pendingPurchases.length} pending purchase confirmation{pendingPurchases.length > 1 ? 's' : ''} that require your attention!
                    </Alert>
                )}

                {/* Tabs */}
                <Paper sx={{ mb: 3, bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                    <Tabs
                        value={currentTab}
                        onChange={(e, newValue) => setCurrentTab(newValue)}
                        sx={{
                            '& .MuiTab-root': { color: 'text.secondary' },
                            '& .Mui-selected': { color: '#96ff9b' },
                            '& .MuiTabs-indicator': { backgroundColor: '#96ff9b' }
                        }}
                    >
                        <Tab
                            label={`My Cards (${userCards.length})`}
                            icon={<ShoppingCart />}
                        />
                        <Tab
                            label={
                                <Badge badgeContent={pendingPurchases.length} color="error">
                                    Pending Purchases
                                </Badge>
                            }
                            icon={<Warning />}
                        />
                    </Tabs>
                </Paper>

                {/* Tab Content */}
                {currentTab === 0 && (
                    /* My Cards Tab */
                    <>
                        {userCards.length === 0 ? (
                            <Box sx={{ textAlign: 'center', mt: 10 }}>
                                <Typography variant="h6" sx={{ color: 'text.secondary', mb: 3 }}>
                                    Your collection is empty
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={() => router.push('/marketplace')}
                                    sx={{
                                        bgcolor: '#96ff9b',
                                        color: 'grey.900',
                                        '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                                    }}
                                >
                                    Browse Marketplace
                                </Button>
                            </Box>
                        ) : (
                            <Grid container spacing={3}>
                                {userCards.map((userCard) => (
                                    <Grid item xs={12} sm={6} md={4} lg={3} key={userCard.id}>
                                        <Card sx={{
                                            bgcolor: 'grey.800',
                                            border: '1px solid rgba(150, 255, 155, 0.2)',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}>
                                            <CardMedia
                                                component="img"
                                                height="200"
                                                image={userCard.card.image_url || '/placeholder-card.png'}
                                                alt={userCard.card.name}
                                                sx={{ objectFit: 'contain', bgcolor: 'grey.700' }}
                                            />
                                            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                                <Typography variant="h6" sx={{ color: '#96ff9b', mb: 1 }}>
                                                    {userCard.card.name}
                                                </Typography>

                                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                                    {userCard.card.set_name}
                                                </Typography>

                                                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                                    <Chip
                                                        label={userCard.card.rarity}
                                                        size="small"
                                                        color={getRarityColor(userCard.card.rarity) as any}
                                                    />
                                                    <Chip
                                                        label={userCard.condition}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                </Box>

                                                {userCard.is_for_sale && (
                                                    <Box sx={{ mb: 2 }}>
                                                        <Chip
                                                            label={`FOR ${userCard.sale_type === 'FIXED' ? 'SALE' : 'AUCTION'}`}
                                                            color="success"
                                                            size="small"
                                                            icon={userCard.sale_type === 'FIXED' ? <AttachMoney /> : <Gavel />}
                                                        />
                                                        {userCard.sale_type === 'FIXED' && userCard.fixed_price && (
                                                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                                                                ${userCard.fixed_price.toFixed(2)}
                                                            </Typography>
                                                        )}
                                                        {userCard.sale_type === 'AUCTION' && (
                                                            <Typography variant="body2" sx={{ color: 'warning.main', mt: 1 }}>
                                                                Reserve: ${userCard.reserve_price?.toFixed(2) || '0.00'}
                                                                <br />
                                                                Ends: {userCard.auction_end ? new Date(userCard.auction_end).toLocaleDateString() : 'N/A'}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                )}

                                                <Box sx={{ mt: 'auto', display: 'flex', gap: 1, flexDirection: 'column' }}>
                                                    {!userCard.is_for_sale ? (
                                                        <Button
                                                            variant="contained"
                                                            startIcon={<Sell />}
                                                            onClick={() => handleSellCard(userCard)}
                                                            sx={{
                                                                bgcolor: '#96ff9b',
                                                                color: 'grey.900',
                                                                '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                                                            }}
                                                        >
                                                            List for Sale
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outlined"
                                                            color="error"
                                                            onClick={() => handleRemoveFromSale(userCard.id, userCard.card.name)}
                                                            sx={{ borderColor: 'error.main', color: 'error.main' }}
                                                        >
                                                            Remove from Sale
                                                        </Button>
                                                    )}
                                                </Box>

                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                                    Acquired: {new Date(userCard.acquired_date).toLocaleDateString()}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </>
                )}

                {currentTab === 1 && (
                    /* Pending Purchases Tab */
                    <>
                        {pendingPurchases.length === 0 ? (
                            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                                <Typography variant="h6" color="text.secondary">
                                    No pending purchases
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    All your auction wins and accepted bids are up to date
                                </Typography>
                            </Paper>
                        ) : (
                            <Grid container spacing={3}>
                                {pendingPurchases.map((purchase, index) => {
                                    const timeLeft = formatTimeLeft(purchase.expires_at);
                                    const isExpired = timeLeft === 'Expired';

                                    return (
                                        <Grid item xs={12} md={6} key={index}>
                                            <Card sx={{
                                                bgcolor: 'grey.800',
                                                border: isExpired ? '1px solid rgba(244, 67, 54, 0.5)' : '1px solid rgba(255, 152, 0, 0.5)'
                                            }}>
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                        <Warning sx={{ color: isExpired ? 'error.main' : 'warning.main', mr: 1 }} />
                                                        <Typography variant="h6" sx={{ color: '#96ff9b' }}>
                                                            {isExpired ? 'Purchase Expired' : 'Confirm Purchase'}
                                                        </Typography>
                                                        <Chip
                                                            label={timeLeft}
                                                            color={isExpired ? 'error' : 'warning'}
                                                            size="small"
                                                            sx={{ ml: 'auto' }}
                                                        />
                                                    </Box>

                                                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                                        <img
                                                            src={purchase.card_image}
                                                            alt={purchase.card_name}
                                                            style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 4 }}
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                                            }}
                                                        />
                                                        <Box sx={{ flexGrow: 1 }}>
                                                            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
                                                                {purchase.card_name}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Seller: {purchase.seller_name}
                                                            </Typography>
                                                            <Typography variant="h6" color="primary.main">
                                                                {formatPrice(purchase.amount)}
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    {!isExpired && (
                                                        <Button
                                                            variant="contained"
                                                            fullWidth
                                                            onClick={() => handleConfirmPurchase(purchase)}
                                                            startIcon={<CheckCircle />}
                                                            sx={{
                                                                bgcolor: '#96ff9b',
                                                                color: 'grey.900',
                                                                '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                                                            }}
                                                        >
                                                            Confirm Purchase
                                                        </Button>
                                                    )}

                                                    {isExpired && (
                                                        <Alert severity="error" sx={{ mt: 1 }}>
                                                            This purchase opportunity has expired. The auction may be relisted.
                                                        </Alert>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        )}
                    </>
                )}
            </Container>

            {/* Sell Dialog */}
            <Dialog open={sellDialogOpen} onClose={() => setSellDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>List {sellData.cardName} for Sale</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Sale Type</InputLabel>
                            <Select
                                value={sellData.saleType}
                                onChange={(e) => setSellData(prev => ({ ...prev, saleType: e.target.value as 'FIXED' | 'AUCTION' }))}
                            >
                                <MenuItem value="FIXED">Fixed Price Sale</MenuItem>
                                <MenuItem value="AUCTION">Auction</MenuItem>
                            </Select>
                        </FormControl>

                        {sellData.saleType === 'FIXED' ? (
                            <TextField
                                label="Sale Price ($)"
                                type="number"
                                fullWidth
                                value={sellData.fixedPrice}
                                onChange={(e) => setSellData(prev => ({ ...prev, fixedPrice: e.target.value }))}
                                inputProps={{ min: 0, step: 0.01 }}
                            />
                        ) : (
                            <>
                                <TextField
                                    label="Reserve Price ($)"
                                    type="number"
                                    fullWidth
                                    value={sellData.reservePrice}
                                    onChange={(e) => setSellData(prev => ({ ...prev, reservePrice: e.target.value }))}
                                    inputProps={{ min: 0, step: 0.01 }}
                                    sx={{ mb: 2 }}
                                    helperText="Minimum price for the auction"
                                />
                                <FormControl fullWidth>
                                    <InputLabel>Auction Duration</InputLabel>
                                    <Select
                                        value={sellData.auctionDays}
                                        onChange={(e) => setSellData(prev => ({ ...prev, auctionDays: e.target.value }))}
                                    >
                                        <MenuItem value="1">1 Day</MenuItem>
                                        <MenuItem value="3">3 Days</MenuItem>
                                        <MenuItem value="7">7 Days</MenuItem>
                                        <MenuItem value="14">14 Days</MenuItem>
                                    </Select>
                                </FormControl>
                            </>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSellDialogOpen(false)} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmSale}
                        disabled={actionLoading || (!sellData.fixedPrice && sellData.saleType === 'FIXED') || (!sellData.reservePrice && sellData.saleType === 'AUCTION')}
                        sx={{
                            bgcolor: '#96ff9b',
                            color: 'grey.900',
                            '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                        }}
                    >
                        {actionLoading ? 'Listing...' : `List for ${sellData.saleType === 'FIXED' ? 'Sale' : 'Auction'}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Purchase Confirmation Modal */}
            <PurchaseConfirmationModal
                open={confirmationModalOpen}
                onClose={() => setConfirmationModalOpen(false)}
                purchaseData={selectedPurchase}
                onConfirmationComplete={handleConfirmationComplete}
            />
        </Box>
    );
}