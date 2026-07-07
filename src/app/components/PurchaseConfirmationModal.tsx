// src/app/components/PurchaseConfirmationModal.tsx
'use client';
import React, { useState, useEffect } from 'react';
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
    Divider,
    Skeleton
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    ShoppingCart as CartIcon,
    AttachMoney as MoneyIcon,
    CheckCircle as CheckIcon,
    Percent as PercentIcon,
    AccountBalance as WalletIcon,
    Store as StoreIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { getRarityColor } from '../lib/rarity';

interface Card {
    id: number;
    name: string;
    set_name: string;
    set_number: string;
    rarity: string;
    card_type: string;
    image_url: string;
    small_image_url: string;
    market_price?: number;
}

interface Listing {
    id: string;
    type: 'CATALOG' | 'USER_CARD';
    user_card_id?: number;
    card: Card;
    owner: { id: number | null; name: string; role?: string };
    condition: string;
    sale_type: 'FIXED' | 'AUCTION';
    fixed_price: number | null;
    reserve_price: number | null;
    current_price: number;
    notes: string | null;
    availability?: string; // Add this for compatibility
}

interface CommissionInfo {
    commission_rate: number;
    commission_amount: number;
    buyer_pays: number;
    seller_receives: number;
    admin_receives: number;
}

interface PurchaseConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    listingData: Listing | null; // Changed from listing to listingData for compatibility
    onPurchaseComplete?: () => void;
}

export default function PurchaseConfirmationModal({
    open,
    onClose,
    listingData, // Changed from listing to listingData
    onPurchaseComplete
}: PurchaseConfirmationModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [commissionInfo, setCommissionInfo] = useState<CommissionInfo | null>(null);
    const [loadingCommission, setLoadingCommission] = useState(false);

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${Number(price).toFixed(2)}`;
    };

    // Calculate commission when modal opens
    useEffect(() => {
        if (open && listingData) {
            calculateCommission();
        }
    }, [open, listingData]);

    const calculateCommission = async () => {
        if (!listingData) return;

        setLoadingCommission(true);
        try {
            const cardPrice = listingData.fixed_price || listingData.current_price || 0;

            // Call commission calculation API
            const response = await fetch('/api/commission/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    card_price: cardPrice,
                    card_rarity: listingData.card.rarity,
                    transaction_type: listingData.type === 'CATALOG' ? 'MARKETPLACE_SALE' : 'USER_SALE'
                })
            });

            if (response.ok) {
                const data = await response.json();
                setCommissionInfo(data);
            } else {
                // Fallback calculation
                const commissionRate = 5; // Default 5%
                const commissionAmount = (cardPrice * commissionRate) / 100;

                if (listingData.type === 'CATALOG') {
                    // Marketplace sale: buyer pays price + commission, platform gets full amount
                    setCommissionInfo({
                        commission_rate: commissionRate,
                        commission_amount: commissionAmount,
                        buyer_pays: cardPrice + commissionAmount,
                        seller_receives: 0, // Platform sale
                        admin_receives: cardPrice + commissionAmount
                    });
                } else {
                    // User sale: buyer pays price + commission, seller gets price - commission
                    setCommissionInfo({
                        commission_rate: commissionRate,
                        commission_amount: commissionAmount,
                        buyer_pays: cardPrice + commissionAmount,
                        seller_receives: cardPrice - commissionAmount,
                        admin_receives: commissionAmount * 2 // Double commission
                    });
                }
            }
        } catch (error) {
            console.error('Failed to calculate commission:', error);
            // Use fallback calculation on error
            const cardPrice = listingData.fixed_price || listingData.current_price || 0;
            const commissionRate = 5;
            const commissionAmount = (cardPrice * commissionRate) / 100;

            setCommissionInfo({
                commission_rate: commissionRate,
                commission_amount: commissionAmount,
                buyer_pays: cardPrice + commissionAmount,
                seller_receives: listingData.type === 'CATALOG' ? 0 : cardPrice - commissionAmount,
                admin_receives: listingData.type === 'CATALOG' ? cardPrice + commissionAmount : commissionAmount * 2
            });
        } finally {
            setLoadingCommission(false);
        }
    };

    const handlePurchase = async () => {
        if (!listingData) return;
        console.log('🔍 DEBUG: listingData:', {
            id: listingData.id,
            type: listingData.type,
            user_card_id: listingData.user_card_id,
            card_id: listingData.card.id,
            owner: listingData.owner
        });

        setLoading(true);
        setError(null);

        try {
            let requestBody: any;

            if (listingData.type === 'CATALOG') {
                requestBody = {
                    catalog_card_id: listingData.card.id,
                    quantity: 1
                };
            } else if (listingData.type === 'USER_CARD') {
                if (!listingData.user_card_id) {
                    throw new Error('User card ID is missing');
                }
                requestBody = {
                    user_card_id: listingData.user_card_id
                };
            } else {
                throw new Error(`Invalid listing type: ${listingData.type}`);
            }

            console.log('🛒 Processing purchase:', requestBody);

            const response = await fetch('/api/marketplace/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                let errorMessage = `Failed to purchase: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || errorMessage;
                } catch (parseError) {
                    console.error('Could not parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            if (data.success) {
                setSuccess(true);

                const cardName = data.purchase_details?.card_name || listingData.card.name;

                toast.success(`Successfully purchased ${cardName}!`);

                // Call the callback to refresh the parent component
                if (onPurchaseComplete) {
                    onPurchaseComplete();
                }

                // Auto-close after 3 seconds
                setTimeout(() => {
                    handleClose();
                }, 3000);
            } else {
                throw new Error(data.error || data.message || 'Purchase failed');
            }

        } catch (err) {
            console.error('Purchase error:', err);
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
            setCommissionInfo(null);
        }
    };

    if (!listingData) return null;

    const cardPrice = listingData.fixed_price || listingData.current_price || 0;

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'primary.main',
                borderBottom: 1,
                borderColor: 'divider',
                pb: 2
            }}>
                <CartIcon />
                <Typography variant="h6">
                    {success ? 'Purchase Complete!' : 'Confirm Purchase'}
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {success ? (
                    // Success State
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h5" gutterBottom color="success.main">
                            Purchase Successful!
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {listingData.card.name} has been added to your collection.
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                            <Chip
                                icon={<WalletIcon />}
                                label="Wallet Updated"
                                color="success"
                                variant="outlined"
                            />
                        </Box>
                    </Box>
                ) : (
                    // Purchase Confirmation
                    <Grid container spacing={3}>
                        {/* Card Display */}
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Card sx={{
                                border: 1,
                                borderColor: 'divider',
                                bgcolor: 'background.default'
                            }}>
                                <CardMedia
                                    component="img"
                                    height="300"
                                    image={listingData.card.image_url || listingData.card.small_image_url || '/placeholder-card.png'}
                                    alt={listingData.card.name}
                                    sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                    }}
                                />
                            </Card>
                        </Grid>

                        {/* Card Details */}
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                                {listingData.card.name}
                            </Typography>

                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                {listingData.card.set_name} • {listingData.card.set_number}
                            </Typography>

                            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                <Chip
                                    label={listingData.card.rarity}
                                    color={getRarityColor(listingData.card.rarity)}
                                    size="small"
                                />
                                <Chip
                                    label={listingData.condition}
                                    variant="outlined"
                                    size="small"
                                />
                                {listingData.type === 'CATALOG' ? (
                                    <Chip
                                        icon={<StoreIcon />}
                                        label="Catalog"
                                        color="info"
                                        size="small"
                                    />
                                ) : (
                                    <Chip
                                        icon={<PersonIcon />}
                                        label="User"
                                        color="primary"
                                        size="small"
                                    />
                                )}
                                <Chip
                                    label={listingData.sale_type === 'FIXED' ? 'Fixed Price' : 'Auction'}
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                />
                            </Box>

                            <Box sx={{ mb: 3 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    <strong>Seller:</strong> {listingData.owner.name}
                                </Typography>
                                {listingData.card.market_price && (
                                    <Typography variant="body2" color="text.secondary">
                                        <strong>Market Price:</strong> <Typography component="span" variant="mono" color="text.primary">{formatPrice(listingData.card.market_price)}</Typography>
                                    </Typography>
                                )}
                                {listingData.notes && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        <strong>Notes:</strong> {listingData.notes}
                                    </Typography>
                                )}
                            </Box>

                            {/* Commission Information */}
                            {loadingCommission ? (
                                <Paper sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <PercentIcon sx={{ color: 'primary.main' }} />
                                        <Typography variant="h6" sx={{ color: 'primary.main' }}>
                                            Calculating Fees...
                                        </Typography>
                                    </Box>
                                    <Skeleton variant="text" width="60%" />
                                    <Skeleton variant="text" width="80%" />
                                    <Skeleton variant="text" width="40%" />
                                </Paper>
                            ) : commissionInfo ? (
                                <Paper sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <MoneyIcon sx={{ color: 'primary.main' }} />
                                        <Typography variant="h6" sx={{ color: 'primary.main' }}>
                                            Purchase Summary
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Card Price:
                                        </Typography>
                                        <Typography variant="mono" color="text.primary">
                                            {formatPrice(cardPrice)}
                                        </Typography>
                                    </Box>

                                    {listingData.type === 'USER_CARD' && (
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Marketplace Fee ({commissionInfo.commission_rate}%):
                                            </Typography>
                                            <Typography variant="mono" color="text.secondary">
                                                {formatPrice(commissionInfo.commission_amount)}
                                            </Typography>
                                        </Box>
                                    )}

                                    <Divider sx={{ my: 1, borderColor: 'divider' }} />

                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                                        <Typography variant="h6" sx={{ color: 'text.primary' }}>
                                            Total You Pay:
                                        </Typography>
                                        <Typography variant="mono" sx={{ color: 'success.main', fontSize: 20, fontWeight: 700 }}>
                                            {formatPrice(commissionInfo.buyer_pays)}
                                        </Typography>
                                    </Box>

                                    {/* Breakdown for user sales */}
                                    {listingData.type === 'USER_CARD' && commissionInfo.seller_receives > 0 && (
                                        <Box sx={{ mt: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Seller receives: <Typography component="span" variant="mono" sx={{ color: 'success.main' }}>{formatPrice(commissionInfo.seller_receives)}</Typography>
                                            </Typography>
                                        </Box>
                                    )}
                                </Paper>
                            ) : null}

                            {/* Purchase Type Info */}
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                    {listingData.type === 'CATALOG'
                                        ? 'This card will be added to your collection as a new mint condition card.'
                                        : 'This card will be transferred to your collection from the current owner.'
                                    }
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                )}
            </DialogContent>

            <DialogActions sx={{
                p: 3,
                borderTop: 1,
                borderColor: 'divider',
                gap: 2
            }}>
                {!success && (
                    <>
                        <Button
                            onClick={handleClose}
                            disabled={loading}
                            variant="outlined"
                            color="inherit"
                            sx={{
                                borderColor: 'divider',
                                color: 'text.secondary'
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handlePurchase}
                            disabled={loading || loadingCommission}
                            startIcon={loading ? <CircularProgress size={20} /> : <CartIcon />}
                            sx={{ minWidth: 160 }}
                        >
                            {loading
                                ? 'Processing...'
                                : loadingCommission
                                    ? 'Calculating...'
                                    : `Purchase ${commissionInfo ? formatPrice(commissionInfo.buyer_pays) : formatPrice(cardPrice)}`
                            }
                        </Button>
                    </>
                )}
                {success && (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleClose}
                    >
                        Close
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}