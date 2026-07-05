// src/app/components/PendingPurchaseModal.tsx - Fixed API endpoints and modal closing
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
    CircularProgress,
    Alert,
    Divider,
    Chip,
    Paper
} from '@mui/material';
import {
    CheckCircle,
    Warning,
    AttachMoney,
    Timer,
    Cancel
} from '@mui/icons-material';
import { toast } from 'react-toastify';

interface PendingPurchase {
    transaction_id: number;
    card_name: string;
    card_image?: string;
    amount: number;
    seller_name: string;
    expires_at: string;
    notification_id?: number;
}

interface PendingPurchaseModalProps {
    open: boolean;
    onClose: () => void;
    purchaseData: PendingPurchase | null;
    onConfirmationComplete: () => void;
}

export default function PendingPurchaseModal({
    open,
    onClose,
    purchaseData,
    onConfirmationComplete
}: PendingPurchaseModalProps) {
    const [confirming, setConfirming] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');

    // Update countdown timer
    useEffect(() => {
        if (!purchaseData?.expires_at) return;

        const updateTimer = () => {
            const now = new Date();
            const expires = new Date(purchaseData.expires_at);
            const diffMs = expires.getTime() - now.getTime();

            if (diffMs <= 0) {
                setTimeLeft('Expired');
                return;
            }

            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
            } else if (minutes > 0) {
                setTimeLeft(`${minutes}m ${seconds}s`);
            } else {
                setTimeLeft(`${seconds}s`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [purchaseData?.expires_at]);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setError(null);
            setConfirming(false);
            setDeclining(false);
        }
    }, [open]);

    const handleConfirmPurchase = async () => {
        if (!purchaseData) return;

        setConfirming(true);
        setError(null);

        try {
            console.log('Confirming purchase for transaction:', purchaseData.transaction_id);

            // FIXED: Use the correct API endpoint
            const response = await fetch('/api/bids/confirm-purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transaction_id: purchaseData.transaction_id,
                    confirm_purchase: true
                })
            });

            const data = await response.json();
            console.log('Confirm purchase response:', data);

            if (response.ok && data.success) {
                toast.success(`Successfully confirmed purchase of ${purchaseData.card_name}!`);

                // Mark notification as read if it exists
                if (purchaseData.notification_id) {
                    try {
                        await fetch(`/api/notifications`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                notificationId: purchaseData.notification_id,
                                read: true
                            })
                        });
                        console.log('Notification marked as read');
                    } catch (notifError) {
                        console.error('Error marking notification as read:', notifError);
                    }
                }

                // Close modal and refresh data
                onConfirmationComplete();
                onClose();
            } else {
                setError(data.error || 'Failed to confirm purchase');
                console.error('Purchase confirmation failed:', data);
            }
        } catch (error) {
            console.error('Confirmation error:', error);
            setError('Failed to confirm purchase. Please try again.');
        } finally {
            setConfirming(false);
        }
    };

    const handleDeclinePurchase = async () => {
        if (!purchaseData) return;

        setDeclining(true);
        setError(null);

        try {
            console.log('Declining purchase for transaction:', purchaseData.transaction_id);

            // FIXED: Use the correct API endpoint
            const response = await fetch('/api/bids/confirm-purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transaction_id: purchaseData.transaction_id,
                    confirm_purchase: false
                })
            });

            const data = await response.json();
            console.log('Decline purchase response:', data);

            if (response.ok && data.success) {
                toast.info(`Purchase declined. The auction will continue with other bidders.`);

                // Mark notification as read
                if (purchaseData.notification_id) {
                    try {
                        await fetch(`/api/notifications`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                notificationId: purchaseData.notification_id,
                                read: true
                            })
                        });
                        console.log('Notification marked as read');
                    } catch (notifError) {
                        console.error('Error marking notification as read:', notifError);
                    }
                }

                // Close modal and refresh data
                onConfirmationComplete();
                onClose();
            } else {
                setError(data.error || 'Failed to decline purchase');
                console.error('Purchase decline failed:', data);
            }
        } catch (error) {
            console.error('Decline error:', error);
            setError('Failed to decline purchase. Please try again.');
        } finally {
            setDeclining(false);
        }
    };

    if (!purchaseData) return null;

    const isExpired = timeLeft === 'Expired';

    return (
        <Dialog
            open={open}
            onClose={!confirming && !declining ? onClose : undefined} // Prevent closing while processing
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: 'grey.900',
                    border: '1px solid rgba(155, 92, 255, 0.3)'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: '#9B5Cff',
                borderBottom: '1px solid rgba(155, 92, 255, 0.2)',
                pb: 2
            }}>
                <CheckCircle />
                Confirm Auction Win
                <Chip
                    icon={<Timer />}
                    label={timeLeft}
                    color={isExpired ? 'error' : 'warning'}
                    size="small"
                    sx={{ ml: 'auto' }}
                />
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {isExpired && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        This purchase opportunity has expired. The card may be relisted.
                    </Alert>
                )}

                {/* Card Details */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Box sx={{ flexShrink: 0 }}>
                        <img
                            src={purchaseData.card_image || '/placeholder-card.png'}
                            alt={purchaseData.card_name}
                            style={{
                                width: 100,
                                height: 140,
                                objectFit: 'contain',
                                borderRadius: 8,
                                border: '1px solid rgba(155, 92, 255, 0.3)'
                            }}
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-card.png';
                            }}
                        />
                    </Box>

                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
                            {purchaseData.card_name}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Seller: {purchaseData.seller_name}
                        </Typography>

                        <Typography variant="h5" sx={{ color: '#9B5Cff', mt: 2 }}>
                            ${purchaseData.amount.toFixed(2)}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(155, 92, 255, 0.2)' }} />

                {/* Purchase Summary */}
                <Paper sx={{ p: 2, bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <Typography variant="subtitle2" sx={{ color: '#9B5Cff', mb: 2 }}>
                        Purchase Summary
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Winning Bid:
                        </Typography>
                        <Typography variant="body2" color="text.primary">
                            ${purchaseData.amount.toFixed(2)}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Marketplace Fee (0%):
                        </Typography>
                        <Typography variant="body2" color="text.primary">
                            $0.00
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 1, borderColor: 'rgba(155, 92, 255, 0.2)' }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" sx={{ color: '#9B5Cff' }}>
                            Total:
                        </Typography>
                        <Typography variant="subtitle2" sx={{ color: '#9B5Cff' }}>
                            ${purchaseData.amount.toFixed(2)}
                        </Typography>
                    </Box>
                </Paper>

                {/* Info Box */}
                <Alert
                    severity="info"
                    icon={<Warning />}
                    sx={{ mt: 2, bgcolor: 'rgba(155, 92, 255, 0.1)', border: '1px solid rgba(155, 92, 255, 0.3)' }}
                >
                    <Typography variant="body2">
                        You won this auction! Please confirm the purchase within 24 hours to complete the transaction.
                        If you decline, other bidders can still compete for this card.
                    </Typography>
                </Alert>
            </DialogContent>

            <DialogActions sx={{
                p: 3,
                borderTop: '1px solid rgba(155, 92, 255, 0.2)',
                gap: 2
            }}>
                <Button
                    variant="outlined"
                    onClick={handleDeclinePurchase}
                    disabled={confirming || declining || isExpired}
                    startIcon={declining ? <CircularProgress size={20} /> : <Cancel />}
                    sx={{
                        borderColor: 'error.main',
                        color: 'error.main',
                        '&:hover': {
                            borderColor: 'error.dark',
                            bgcolor: 'rgba(244, 67, 54, 0.1)'
                        }
                    }}
                >
                    {declining ? 'Declining...' : 'Decline'}
                </Button>
                <Button
                    variant="contained"
                    onClick={handleConfirmPurchase}
                    disabled={confirming || declining || isExpired}
                    startIcon={confirming ? <CircularProgress size={20} /> : <AttachMoney />}
                    sx={{
                        bgcolor: '#9B5Cff',
                        color: 'grey.900',
                        minWidth: 140,
                        '&:hover': {
                            bgcolor: 'rgba(155, 92, 255, 0.8)'
                        },
                        '&:disabled': {
                            bgcolor: 'rgba(155, 92, 255, 0.3)',
                            color: 'grey.700'
                        }
                    }}
                >
                    {confirming ? 'Processing...' : 'Confirm Purchase'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}