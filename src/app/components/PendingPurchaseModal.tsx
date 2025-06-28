// src/app/components/PendingPurchaseModal.tsx
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
    Chip,
    Paper
} from '@mui/material';
import {
    CheckCircle,
    Warning,
    AttachMoney,
    Timer
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';

interface PendingPurchase {
    transaction_id: number;
    card_name: string;
    card_image: string;
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
    const { data: session } = useSession();
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirmPurchase = async () => {
        if (!purchaseData) return;

        setConfirming(true);
        setError(null);

        try {
            const response = await fetch(`/api/transactions/${purchaseData.transaction_id}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.accessToken}`,
                },
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Successfully confirmed purchase of ${purchaseData.card_name}!`);

                // Mark notification as read if it exists
                if (purchaseData.notification_id) {
                    await fetch(`/api/notifications/${purchaseData.notification_id}/read`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${session?.accessToken}`,
                        },
                    });
                }

                onConfirmationComplete();
                onClose();
            } else {
                setError(data.error || 'Failed to confirm purchase');
            }
        } catch (error) {
            console.error('Confirmation error:', error);
            setError('Failed to confirm purchase. Please try again.');
        } finally {
            setConfirming(false);
        }
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

    if (!purchaseData) return null;

    const timeLeft = formatTimeLeft(purchaseData.expires_at);
    const isExpired = timeLeft === 'Expired';

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
                                border: '1px solid rgba(150, 255, 155, 0.3)'
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

                        <Typography variant="h5" sx={{ color: '#96ff9b', mt: 2 }}>
                            ${purchaseData.amount.toFixed(2)}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(150, 255, 155, 0.2)' }} />

                {/* Purchase Summary */}
                <Paper sx={{ p: 2, bgcolor: 'grey.800', border: '1px solid rgba(150, 255, 155, 0.2)' }}>
                    <Typography variant="subtitle2" sx={{ color: '#96ff9b', mb: 2 }}>
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
                            Marketplace Fee (5%):
                        </Typography>
                        <Typography variant="body2" color="text.primary">
                            ${(purchaseData.amount * 0.05).toFixed(2)}
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 1, borderColor: 'rgba(150, 255, 155, 0.2)' }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" sx={{ color: '#96ff9b' }}>
                            Total:
                        </Typography>
                        <Typography variant="subtitle2" sx={{ color: '#96ff9b' }}>
                            ${purchaseData.amount.toFixed(2)}
                        </Typography>
                    </Box>
                </Paper>

                {/* Info Box */}
                <Alert
                    severity="info"
                    icon={<Warning />}
                    sx={{ mt: 2, bgcolor: 'rgba(150, 255, 155, 0.1)', border: '1px solid rgba(150, 255, 155, 0.3)' }}
                >
                    <Typography variant="body2">
                        You won this auction! Please confirm the purchase within 24 hours to complete the transaction.
                    </Typography>
                </Alert>
            </DialogContent>

            <DialogActions sx={{
                p: 3,
                borderTop: '1px solid rgba(150, 255, 155, 0.2)',
                gap: 2
            }}>
                <Button
                    onClick={onClose}
                    disabled={confirming}
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
                    disabled={confirming || isExpired}
                    startIcon={confirming ? <CircularProgress size={20} /> : <AttachMoney />}
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
                    {confirming ? 'Processing...' : 'Confirm Purchase'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}