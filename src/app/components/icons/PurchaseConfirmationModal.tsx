// src/app/components/PurchaseConfirmationModal.tsx
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
    CircularProgress,
    Alert,
    Divider,
    Chip
} from '@mui/material';
import {
    ShoppingCart as ShoppingCartIcon,
    CheckCircle as CheckCircleIcon,
    Store as StoreIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import Image from 'next/image';
import { toast } from 'react-toastify';

interface PurchaseConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    listingData?: {
        id: string;
        type: 'CATALOG' | 'USER_CARD';
        user_card_id?: number;
        card: {
            id: number;
            name: string;
            set_name: string;
            set_number: string;
            rarity: string;
            image_url: string;
            small_image_url: string;
        };
        owner: {
            id: number;
            name: string;
            role: string;
        };
        condition: string;
        current_price: number;
        availability: string;
    } | null;
    onPurchaseComplete?: () => void;
}

export default function PurchaseConfirmationModal({
    open,
    onClose,
    listingData,
    onPurchaseComplete
}: PurchaseConfirmationModalProps) {
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirmPurchase = async () => {
        if (!listingData) return;

        setPurchasing(true);
        setError(null);

        try {
            const requestBody = listingData.type === 'CATALOG'
                ? { catalog_card_id: listingData.card.id, quantity: 1 }
                : { user_card_id: listingData.user_card_id };

            const response = await fetch('/api/marketplace/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (response.ok) {
                const message = listingData.type === 'CATALOG'
                    ? `Successfully purchased ${data.purchase_details.card_name}!`
                    : `Successfully purchased ${data.purchase_details.card_name}!`;

                toast.success(message);
                onPurchaseComplete?.();
                onClose();
            } else {
                setError(data.error || 'Failed to purchase card');
            }
        } catch (error) {
            console.error('Purchase error:', error);
            setError('Failed to purchase card. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const formatPrice = (price: number) => `$${price.toFixed(2)}`;

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

    if (!listingData) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: 'grey.900',
                    border: '1px solid rgba(150, 255, 155, 0.3)'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: '#96ff9b',
                borderBottom: '1px solid rgba(150, 255, 155, 0.2)',
                pb: 2
            }}>
                <ShoppingCartIcon />
                Confirm Purchase
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Card Details */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Box sx={{ flexShrink: 0 }}>
                        <Image
                            src={listingData.card.small_image_url || listingData.card.image_url || '/placeholder-card.png'}
                            alt={listingData.card.name}
                            width={100}
                            height={140}
                            style={{
                                objectFit: 'contain',
                                borderRadius: 8,
                                border: '1px solid rgba(150, 255, 155, 0.3)'
                            }}
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                            }}
                        />
                    </Box>

                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
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
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                            Seller: {listingData.owner.name}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(150, 255, 155, 0.2)' }} />

                {/* Purchase Summary */}
                <Box sx={{ bgcolor: 'grey.800', p: 2, borderRadius: 1, border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                    <Typography variant="h6" sx={{ color: '#96ff9b', mb: 2 }}>
                        Purchase Summary
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Card Price:
                        </Typography>
                        <Typography variant="body2" color="text.primary">
                            {formatPrice(listingData.current_price)}
                        </Typography>
                    </Box>

                    {listingData.type === 'USER_CARD' && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Marketplace Fee (5%):
                            </Typography>
                            <Typography variant="body2" color="text.primary">
                                {formatPrice(listingData.current_price * 0.05)}
                            </Typography>
                        </Box>
                    )}

                    <Divider sx={{ my: 1, borderColor: 'rgba(150, 255, 155, 0.2)' }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="h6" sx={{ color: '#96ff9b' }}>
                            Total:
                        </Typography>
                        <Typography variant="h6" sx={{ color: '#96ff9b' }}>
                            {formatPrice(listingData.current_price)}
                        </Typography>
                    </Box>
                </Box>

                {/* Purchase Type Info */}
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(150, 255, 155, 0.1)', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        {listingData.type === 'CATALOG'
                            ? 'This card will be added to your collection as a new mint condition card.'
                            : 'This card will be transferred to your collection from the current owner.'
                        }
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions sx={{
                p: 3,
                borderTop: '1px solid rgba(150, 255, 155, 0.2)',
                gap: 2
            }}>
                <Button
                    onClick={onClose}
                    disabled={purchasing}
                    variant="outlined"
                    sx={{
                        borderColor: 'text.secondary',
                        color: 'text.secondary'
                    }}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleConfirmPurchase}
                    disabled={purchasing}
                    startIcon={purchasing ? <CircularProgress size={20} /> : <ShoppingCartIcon />}
                    sx={{
                        bgcolor: '#96ff9b',
                        color: 'grey.900',
                        minWidth: 140,
                        '&:hover': {
                            bgcolor: 'rgba(150, 255, 155, 0.8)'
                        },
                        '&:disabled': {
                            bgcolor: 'rgba(150, 255, 155, 0.3)',
                            color: 'grey.700'
                        }
                    }}
                >
                    {purchasing ? 'Processing...' : `Purchase ${formatPrice(listingData.current_price)}`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}