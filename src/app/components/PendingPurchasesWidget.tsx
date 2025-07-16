// src/app/components/PendingPurchasesWidget.tsx - Dashboard widget for pending purchases
'use client';

import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Button,
    Chip,
    Alert,
    CircularProgress,
    Stack,
    Divider
} from '@mui/material';
import {
    Timer as TimerIcon,
    Warning as WarningIcon,
    ShoppingCart as CartIcon,
    CheckCircle as CheckIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import PendingPurchaseModal from './PendingPurchaseModal';

interface PendingPurchase {
    transaction_id: number;
    card_name: string;
    card_image?: string;
    amount: number;
    seller_name: string;
    expires_at: string;
    notification_id?: number;
}

interface PendingPurchasesWidgetProps {
    onPurchaseComplete?: () => void;
}

export default function PendingPurchasesWidget({ onPurchaseComplete }: PendingPurchasesWidgetProps) {
    const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPurchase, setSelectedPurchase] = useState<PendingPurchase | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Fetch pending purchases from notifications
    const fetchPendingPurchases = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/notifications?unread_only=true');
            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }

            const notifications = await response.json();

            // Filter for BID_ACCEPTED notifications that require action
            const pending = notifications
                .filter((notif: any) =>
                    notif.type === 'BID_ACCEPTED' &&
                    !notif.read &&
                    notif.data?.action_required === true
                )
                .map((notif: any) => ({
                    transaction_id: notif.data.reference_id,
                    card_name: notif.data.card_name,
                    card_image: notif.data.card_image,
                    amount: notif.data.amount,
                    seller_name: notif.data.seller_name || 'Unknown Seller',
                    expires_at: notif.data.expires_at,
                    notification_id: notif.id
                }));

            setPendingPurchases(pending);
        } catch (err) {
            console.error('Error fetching pending purchases:', err);
            setError(err instanceof Error ? err.message : 'Failed to load pending purchases');
        } finally {
            setLoading(false);
        }
    };

    const getTimeRemaining = (expiresAt: string) => {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diffMs = expires.getTime() - now.getTime();

        if (diffMs <= 0) return { text: 'Expired', isExpired: true };

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        const isUrgent = hours < 2; // Less than 2 hours

        if (hours > 0) {
            return {
                text: `${hours}h ${minutes}m left`,
                isExpired: false,
                isUrgent
            };
        }

        return {
            text: `${minutes}m left`,
            isExpired: false,
            isUrgent: true
        };
    };

    const handlePurchaseClick = (purchase: PendingPurchase) => {
        setSelectedPurchase(purchase);
        setModalOpen(true);
    };

    const handlePurchaseComplete = () => {
        fetchPendingPurchases(); // Refresh the list
        setModalOpen(false);
        setSelectedPurchase(null);
        if (onPurchaseComplete) {
            onPurchaseComplete();
        }
    };

    useEffect(() => {
        fetchPendingPurchases();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchPendingPurchases, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (pendingPurchases.length === 0) {
        return null; // Don't show widget if no pending purchases
    }

    return (
        <>
            <Card sx={{
                border: '2px solid',
                borderColor: 'warning.main',
                backgroundColor: 'rgba(255, 152, 0, 0.05)'
            }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <WarningIcon color="warning" />
                        <Typography variant="h6" color="warning.main">
                            Action Required
                        </Typography>
                        <Chip
                            label={`${pendingPurchases.length} pending`}
                            color="warning"
                            size="small"
                        />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        You have won auctions that require purchase confirmation within 24 hours.
                    </Typography>

                    <Stack spacing={2}>
                        {pendingPurchases.map((purchase) => {
                            const timeInfo = getTimeRemaining(purchase.expires_at);

                            return (
                                <Box
                                    key={purchase.transaction_id}
                                    sx={{
                                        p: 2,
                                        border: '1px solid',
                                        borderColor: timeInfo.isExpired ? 'error.main' :
                                            timeInfo.isUrgent ? 'warning.main' : 'primary.main',
                                        borderRadius: 1,
                                        backgroundColor: timeInfo.isExpired ? 'rgba(244, 67, 54, 0.05)' :
                                            timeInfo.isUrgent ? 'rgba(255, 152, 0, 0.05)' :
                                                'rgba(25, 118, 210, 0.05)'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="subtitle2" gutterBottom>
                                                {purchase.card_name}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                Seller: {purchase.seller_name}
                                            </Typography>
                                            <Typography variant="h6" color="primary.main">
                                                ${purchase.amount.toFixed(2)}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            icon={<TimerIcon />}
                                            label={timeInfo.text}
                                            color={timeInfo.isExpired ? 'error' :
                                                timeInfo.isUrgent ? 'warning' : 'info'}
                                            size="small"
                                        />
                                    </Box>

                                    {timeInfo.isExpired ? (
                                        <Alert severity="error" sx={{ mt: 1 }}>
                                            This purchase opportunity has expired
                                        </Alert>
                                    ) : (
                                        <Button
                                            variant="contained"
                                            color="warning"
                                            fullWidth
                                            onClick={() => handlePurchaseClick(purchase)}
                                            startIcon={<CheckIcon />}
                                            sx={{ mt: 1 }}
                                        >
                                            Confirm Purchase
                                        </Button>
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                        Purchase confirmations expire 24 hours after bid acceptance
                    </Typography>
                </CardContent>
            </Card>

            {/* Pending Purchase Modal */}
            <PendingPurchaseModal
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedPurchase(null);
                }}
                purchaseData={selectedPurchase}
                onConfirmationComplete={handlePurchaseComplete}
            />
        </>
    );
}