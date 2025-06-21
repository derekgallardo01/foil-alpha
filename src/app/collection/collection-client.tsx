"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@mui/material";
import {
    Sell,
    Gavel,
    AttachMoney,
} from "@mui/icons-material";
import Image from "next/image";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

interface SellRequestBody {
    sale_type: 'FIXED' | 'AUCTION';
    fixed_price?: number;
    reserve_price?: number;
    auction_duration_hours?: number;
}

export default function CollectionPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [userCards, setUserCards] = useState<UserCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [sellDialogOpen, setSellDialogOpen] = useState(false);
    const [sellData, setSellData] = useState<SellDialogData>({
        userCardId: 0,
        cardName: '',
        saleType: 'FIXED',
        fixedPrice: '',
        reservePrice: '',
        auctionDays: '7'
    });
    const [actionLoading, setActionLoading] = useState(false);

    const fetchUserCards = useCallback(async () => {
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
    }, [session?.accessToken]);

    useEffect(() => {
        if (status === "authenticated") {
            fetchUserCards();
        } else if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router, fetchUserCards]);

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

            const requestBody: SellRequestBody = {
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

            await response.json();
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

    const getRarityColor = (rarity: string): 'default' | 'primary' | 'secondary' | 'warning' => {
        switch (rarity.toLowerCase()) {
            case 'common': return 'default';
            case 'uncommon': return 'primary';
            case 'rare': return 'secondary';
            case 'rare holo': return 'warning';
            default: return 'default';
        }
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
                    {`${session?.user?.name}'s Card Collection`}
                </Typography>

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
                                                color={getRarityColor(userCard.card.rarity)}
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
            </Container>

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
        </Box>
    );
}