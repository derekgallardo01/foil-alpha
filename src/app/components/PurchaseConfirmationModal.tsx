// src/app/components/PurchaseConfirmationModal.tsx - New component for winner confirmation
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
    Grid,
    Divider
} from '@mui/material';
import {
    AccessTime as ClockIcon,
    AttachMoney as MoneyIcon,
    CheckCircle as AcceptIcon,
    Cancel as DeclineIcon,
    Warning as WarningIcon
} from '@mui/icons-material';

interface PurchaseConfirmationData {
    transaction_id: number;
    card_name: string;
    card_image: string;
    amount: number;
    seller_name: string;
    expires_at: string;
    notification_id?: number;
}

interface PurchaseConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    purchaseData: PurchaseConfirmationData | null;
    onConfirmationComplete?: () => void;
}

export default function PurchaseConfirmationModal({
    open,
    onClose,
    purchaseData,
    onConfirmationComplete
}: PurchaseConfirmationModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    // Calculate time left
    useEffect(() => {
        if (!purchaseData?.expires_at) return;

        const updateTimeLeft = () => {
            const now = new Date().getTime();
            const expirationTime = new Date(purchaseData.expires_at).getTime();
            const difference = expirationTime - now;
            setTimeLeft(Math.max(0, difference));
        };

        updateTimeLeft();
        const interval = setInterval(updateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [purchaseData?.expires_at]);

    const formatTimeLeft = (timeLeftMs: number) => {
        if (timeLeftMs <= 0) return 'Expired';

        const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    };

    const formatPrice = (price: number) => {
        return `$${price.toFixed(2)}`;
    };

    const handleConfirmPurchase = async (confirmPurchase: boolean) => {
        if (!purchaseData) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/bids/confirm-purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transaction_id: purchaseData.transaction_id,
                    confirm_purchase: confirmPurchase
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process confirmation');
            }

            if (confirmPurchase) {
                setSuccess('Purchase confirmed! The card is now yours. Funds have been deducted from your wallet.');
            } else {
                setSuccess('Purchase declined. The auction will continue with other bidders.');
            }

            // Mark notification as read if provided
            if (purchaseData.notification_id) {
                try {
                    await fetch('/api/notifications', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            notification_id: purchaseData.notification_id,
                        })
                    });
                } catch (notificationError) {
                    console.error('Error marking notification as read:', notificationError);
                }
            }

            // Call callback to refresh parent component
            if (onConfirmationComplete) {
                onConfirmationComplete();
            }

            // Close modal after short delay
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (!purchaseData) return null;

    const isExpired = timeLeft <= 0;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MoneyIcon color="primary" />
                    <Typography variant="h6">Confirm Purchase</Typography>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Grid container spacing={2}>
                    {/* Card Display */}
                    <Grid item xs={12}>
                        <Card sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                                <CardMedia
                                    component="img"
                                    sx={{ width: 80, height: 80, objectFit: 'contain', mr: 2 }}
                                    image={purchaseData.card_image || '/placeholder-card.png'}
                                    alt={purchaseData.card_name}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/placeholder-card.png';
                                    }}
                                />
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="h6" gutterBottom>
                                        {purchaseData.card_name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Seller: {purchaseData.seller_name}
                                    </Typography>
                                    <Typography variant="h5" color="primary.main" sx={{ mt: 1 }}>
                                        {formatPrice(purchaseData.amount)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Card>
                    </Grid>

                    {/* Time Warning */}
                    <Grid item xs={12}>
                        <Alert
                            severity={isExpired ? "error" : timeLeft < 2 * 60 * 60 * 1000 ? "warning" : "info"}
                            icon={isExpired ? <WarningIcon /> : <ClockIcon />}
                            sx={{ mb: 2 }}
                        >
                            <Typography variant="body1" fontWeight="bold">
                                {isExpired ?
                                    'Purchase window has expired!' :
                                    `Time remaining: ${formatTimeLeft(timeLeft)}`
                                }
                            </Typography>
                            <Typography variant="body2">
                                {isExpired ?
                                    'You can no longer confirm this purchase.' :
                                    'You have 24 hours to confirm your purchase after winning the auction or having your bid accepted.'
                                }
                            </Typography>
                        </Alert>
                    </Grid>

                    {/* Purchase Details */}
                    <Grid item xs={12}>
                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h6" gutterBottom>
                                Purchase Summary
                            </Typography>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Card:
                                </Typography>
                                <Typography variant="body1">
                                    {purchaseData.card_name}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Seller:
                                </Typography>
                                <Typography variant="body1">
                                    {purchaseData.seller_name}
                                </Typography>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" fontWeight="bold">
                                    Total Amount:
                                </Typography>
                                <Typography variant="h6" color="primary.main">
                                    {formatPrice(purchaseData.amount)}
                                </Typography>
                            </Box>

                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Funds will be deducted from your wallet upon confirmation
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Status Messages */}
                    {error && (
                        <Grid item xs={12}>
                            <Alert severity="error">
                                {error}
                            </Alert>
                        </Grid>
                    )}

                    {success && (
                        <Grid item xs={12}>
                            <Alert severity="success">
                                {success}
                            </Alert>
                        </Grid>
                    )}
                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
                <Button
                    onClick={onClose}
                    disabled={loading}
                    color="inherit"
                >
                    Close
                </Button>

                {!isExpired && !success && (
                    <>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => handleConfirmPurchase(false)}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={16} /> : <DeclineIcon />}
                        >
                            Decline Purchase
                        </Button>

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleConfirmPurchase(true)}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={16} /> : <AcceptIcon />}
                        >
                            Confirm Purchase
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}