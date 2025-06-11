'use client';
import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Card,
    CardMedia,
    Chip,
    Alert,
    CircularProgress,
    Paper,
    Grid,
    Divider
} from '@mui/material';
import {
    ShoppingCart as CartIcon,
    Person as PersonIcon,
    AttachMoney as MoneyIcon,
    CheckCircle as CheckIcon,
    Warning as WarningIcon
} from '@mui/icons-material';

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
    notes: string | null;
}

interface PurchaseModalProps {
    open: boolean;
    onClose: () => void;
    userCard: UserCard | null;
    onPurchaseComplete?: () => void;
}

export default function PurchaseModal({ open, onClose, userCard, onPurchaseComplete }: PurchaseModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${Number(price).toFixed(2)}`;
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

    const handlePurchase = async () => {
        if (!userCard) return;

        setLoading(true);
        setError(null);

        try {
            // For now, we'll simulate the purchase by creating a transaction record
            // In a real app, this would integrate with payment processing

            const response = await fetch('/api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_card_id: userCard.id,
                    transaction_type: 'PURCHASE',
                    amount: userCard.fixed_price,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to complete purchase');
            }

            setSuccess(true);

            // Call the callback to refresh the parent component
            if (onPurchaseComplete) {
                onPurchaseComplete();
            }

            // Close modal after delay
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 3000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            onClose();
            setError(null);
            setSuccess(false);
        }
    };

    if (!userCard) return null;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CartIcon color="primary" />
                    <Typography variant="h6">Confirm Purchase</Typography>
                </Box>
            </DialogTitle>

            <DialogContent>
                {success ? (
                    // Success State
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h5" gutterBottom color="success.main">
                            Purchase Successful!
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            The card has been added to your collection.
                        </Typography>
                    </Box>
                ) : (
                    // Purchase Confirmation
                    <Grid container spacing={3}>
                        {/* Card Display */}
                        <Grid item xs={12} sm={5}>
                            <Card>
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
                            </Card>
                        </Grid>

                        {/* Card Details */}
                        <Grid item xs={12} sm={7}>
                            <Typography variant="h6" gutterBottom>
                                {userCard.card.name}
                            </Typography>

                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                {userCard.card.set_name} • {userCard.card.set_number}
                            </Typography>

                            <Chip
                                label={userCard.card.rarity}
                                color={getRarityColor(userCard.card.rarity)}
                                size="small"
                                sx={{ mb: 2 }}
                            />

                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Condition:</strong> {userCard.condition}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>Seller:</strong> {userCard.owner.name}
                                </Typography>
                            </Box>

                            {userCard.notes && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        <strong>Notes:</strong> {userCard.notes}
                                    </Typography>
                                </Box>
                            )}
                        </Grid>

                        {/* Purchase Summary */}
                        <Grid item xs={12}>
                            <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                                <Typography variant="h6" gutterBottom>
                                    Purchase Summary
                                </Typography>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body1">
                                        Card Price:
                                    </Typography>
                                    <Typography variant="h6" color="primary.main">
                                        {formatPrice(userCard.fixed_price)}
                                    </Typography>
                                </Box>

                                <Divider sx={{ my: 1 }} />

                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="h6">
                                        Total:
                                    </Typography>
                                    <Typography variant="h6" color="primary.main">
                                        {formatPrice(userCard.fixed_price)}
                                    </Typography>
                                </Box>
                            </Paper>

                            {/* Disclaimer */}
                            <Alert
                                severity="info"
                                icon={<WarningIcon />}
                                sx={{ mt: 2 }}
                            >
                                <Typography variant="body2">
                                    This is a demo transaction. In a real marketplace, this would integrate with payment processing.
                                </Typography>
                            </Alert>

                            {/* Error Display */}
                            {error && (
                                <Alert severity="error" sx={{ mt: 2 }}>
                                    {error}
                                </Alert>
                            )}
                        </Grid>
                    </Grid>
                )}
            </DialogContent>

            {!success && (
                <DialogActions>
                    <Button onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handlePurchase}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : <MoneyIcon />}
                    >
                        {loading ? 'Processing...' : `Buy Now - ${formatPrice(userCard.fixed_price)}`}
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
}