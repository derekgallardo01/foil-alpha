// src/app/notifications/page.tsx - Enhanced with pending purchase handling
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    Card,
    CardContent,
    IconButton,
    Badge,
    Button,
    Alert,
    CircularProgress,
    Chip,
    Stack,
    Paper
} from '@mui/material';
import {
    Notifications as NotificationIcon,
    MarkEmailRead as MarkReadIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    CheckCircle as CheckIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Gavel as AuctionIcon,
    AttachMoney as MoneyIcon,
    ShoppingCart as SaleIcon,
    Timer as TimerIcon,
    PriorityHigh as UrgentIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import AppShell from '../components/AppShell';
import PendingPurchaseModal from '../components/PendingPurchaseModal';
import { useRequireAuth } from '../lib/useRequireAuth';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    data?: any;
    read: boolean;
    created_at: string;
    updated_at: string;
}

interface PendingPurchase {
    transaction_id: number;
    card_name: string;
    card_image?: string;
    amount: number;
    seller_name: string;
    expires_at: string;
    notification_id?: number;
}

export default function NotificationsPage() {
    const { status } = useRequireAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [markingRead, setMarkingRead] = useState<Set<number>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

    // Pending purchase modal state
    const [pendingPurchaseModal, setPendingPurchaseModal] = useState<{
        open: boolean;
        purchaseData: PendingPurchase | null;
    }>({
        open: false,
        purchaseData: null
    });

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/notifications?unread_only=true');

            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }

            const data = await response.json();
            setNotifications(Array.isArray(data) ? data : data.notifications || []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setError(err instanceof Error ? err.message : 'Failed to load notifications');
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    // Mark notification as read
    const markAsRead = async (notificationId: number) => {
        try {
            setMarkingRead(prev => new Set(prev).add(notificationId));

            const response = await fetch('/api/notifications', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ notificationId }),
            });

            if (!response.ok) {
                throw new Error('Failed to mark notification as read');
            }

            setNotifications(prev =>
                prev.map(notification =>
                    notification.id === notificationId
                        ? { ...notification, read: true }
                        : notification
                )
            );

            toast.success('Notification marked as read');
        } catch (error) {
            console.error('Error marking notification as read:', error);
            toast.error('Failed to mark notification as read');
        } finally {
            setMarkingRead(prev => {
                const newSet = new Set(prev);
                newSet.delete(notificationId);
                return newSet;
            });
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            const response = await fetch('/api/notifications', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ markAllAsRead: true }),
            });

            if (!response.ok) {
                throw new Error('Failed to mark all notifications as read');
            }

            setNotifications(prev =>
                prev.map(notification => ({ ...notification, read: true }))
            );

            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all notifications as read');
        }
    };

    // Delete notification
    const deleteNotification = async (notificationId: number) => {
        try {
            setDeletingIds(prev => new Set(prev).add(notificationId));

            const response = await fetch(`/api/notifications?id=${notificationId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete notification');
            }

            setNotifications(prev =>
                prev.filter(notification => notification.id !== notificationId)
            );

            toast.success('Notification deleted');
        } catch (error) {
            console.error('Error deleting notification:', error);
            toast.error('Failed to delete notification');
        } finally {
            setDeletingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(notificationId);
                return newSet;
            });
        }
    };

    // Handle notification click
    const handleNotificationClick = (notification: Notification) => {
        // Special handling for bid accepted notifications (pending purchase)
        if (notification.type === 'BID_ACCEPTED' && notification.data) {
            const purchaseData: PendingPurchase = {
                transaction_id: notification.data.reference_id,
                card_name: notification.data.card_name,
                card_image: notification.data.card_image,
                amount: notification.data.amount,
                seller_name: notification.data.seller_name || 'Unknown Seller',
                expires_at: notification.data.expires_at,
                notification_id: notification.id
            };

            setPendingPurchaseModal({
                open: true,
                purchaseData
            });
            return;
        }

        // Mark as read if not already read
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Navigate based on notification type
        switch (notification.type) {
            case 'BID_RECEIVED':
                router.push('/bids/my-auctions');
                break;
            case 'AUCTION_WON':
            case 'AUCTION_LOST':
                router.push('/collection');
                break;
            case 'BID_OUTBID':
                router.push('/marketplace');
                break;
            case 'SALE_COMPLETED':
            case 'PURCHASE_CONFIRMED':
                router.push('/wallet');
                break;
            case 'PURCHASE_DECLINED':
            case 'PURCHASE_EXPIRED':
                router.push('/bids/my-auctions');
                break;
            default:
                break;
        }
    };

    // Get notification icon based on type
    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'BID_RECEIVED':
            case 'BID_OUTBID':
                return <AuctionIcon />;
            case 'BID_ACCEPTED':
                return <UrgentIcon />;
            case 'SALE_COMPLETED':
            case 'PURCHASE_CONFIRMED':
                return <MoneyIcon />;
            case 'AUCTION_WON':
            case 'AUCTION_LOST':
                return <SaleIcon />;
            case 'PURCHASE_DECLINED':
            case 'PURCHASE_EXPIRED':
                return <TimerIcon />;
            case 'WARNING':
                return <WarningIcon />;
            case 'ERROR':
                return <ErrorIcon />;
            default:
                return <NotificationIcon />;
        }
    };

    // Get notification color based on type
    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'BID_RECEIVED':
            case 'AUCTION_WON':
            case 'SALE_COMPLETED':
            case 'PURCHASE_CONFIRMED':
                return 'success';
            case 'BID_ACCEPTED':
                return 'warning'; // Urgent action required
            case 'BID_OUTBID':
            case 'AUCTION_LOST':
            case 'PURCHASE_DECLINED':
            case 'PURCHASE_EXPIRED':
                return 'warning';
            case 'ERROR':
                return 'error';
            default:
                return 'info';
        }
    };

    // Check if notification is time-sensitive
    const isTimeSensitive = (notification: Notification) => {
        return notification.type === 'BID_ACCEPTED' &&
            notification.data?.action_required === true;
    };

    // Get time remaining for time-sensitive notifications
    const getTimeRemaining = (notification: Notification) => {
        if (!notification.data?.expires_at) return null;

        const now = new Date();
        const expires = new Date(notification.data.expires_at);
        const diffMs = expires.getTime() - now.getTime();

        if (diffMs <= 0) return 'Expired';

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `${hours}h ${minutes}m left`;
        return `${minutes}m left`;
    };

    const handlePendingPurchaseComplete = () => {
        fetchNotifications(); // Refresh notifications
        setPendingPurchaseModal({ open: false, purchaseData: null });
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchNotifications();
        }
    }, [status]);

    // Auto-refresh notifications every 30 seconds
    useEffect(() => {
        if (status === 'authenticated') {
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [status]);

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

    const unreadCount = notifications.filter(n => !n.read).length;
    const urgentNotifications = notifications.filter(n => isTimeSensitive(n) && !n.read);

    return (
        <AppShell>
            <Container sx={{ marginTop: 4, marginBottom: 4 }}>

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Badge badgeContent={unreadCount} color="error">
                        <NotificationIcon sx={{ color: 'primary.main' }} />
                    </Badge>
                    <Box
                        component="span"
                        sx={{
                            background: (t) => t.foil.gradient,
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Notifications
                    </Box>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton onClick={fetchNotifications} title="Refresh">
                        <RefreshIcon />
                    </IconButton>
                    {unreadCount > 0 && (
                        <Button
                            variant="contained"
                            size="small"
                            onClick={markAllAsRead}
                            startIcon={<MarkReadIcon />}
                        >
                            Mark All Read
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Urgent Notifications Alert */}
            {urgentNotifications.length > 0 && (
                <Alert
                    severity="warning"
                    sx={{ mb: 3 }}
                    icon={<UrgentIcon />}
                >
                    <Typography variant="subtitle2" gutterBottom>
                        Action Required: You have {urgentNotifications.length} pending purchase confirmation{urgentNotifications.length > 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="body2">
                        Click on the notifications below to confirm your purchases within 24 hours.
                    </Typography>
                </Alert>
            )}

            {/* Content */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : notifications.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <NotificationIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        No notifications yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        You'll see notifications here when you receive bids, make sales, or other activity occurs.
                    </Typography>
                </Paper>
            ) : (
                <Stack spacing={2}>
                    {notifications.map((notification) => {
                        const isUrgent = isTimeSensitive(notification);
                        const timeRemaining = isUrgent ? getTimeRemaining(notification) : null;

                        return (
                            <Card
                                key={notification.id}
                                sx={{
                                    cursor: 'pointer',
                                    opacity: notification.read ? 0.7 : 1,
                                    border: 1,
                                    borderColor: notification.read ? 'divider' :
                                        isUrgent ? 'warning.main' : 'primary.main',
                                    backgroundColor: 'background.paper',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        borderColor: notification.read ? 'divider' :
                                            isUrgent ? 'warning.main' : 'primary.main',
                                    },
                                    transition: 'all 0.2s ease-in-out',
                                }}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                                            <Box sx={{ color: `${getNotificationColor(notification.type)}.main` }}>
                                                {getNotificationIcon(notification.type)}
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <Typography variant="h6" component="h3">
                                                        {notification.title}
                                                    </Typography>
                                                    <Chip
                                                        label={notification.type.replace('_', ' ')}
                                                        color={getNotificationColor(notification.type) as any}
                                                        size="small"
                                                    />
                                                    {!notification.read && (
                                                        <Chip label="New" color="primary" size="small" />
                                                    )}
                                                    {isUrgent && (
                                                        <Chip
                                                            label="ACTION REQUIRED"
                                                            color="warning"
                                                            size="small"
                                                            icon={<UrgentIcon />}
                                                        />
                                                    )}
                                                </Box>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                    {notification.message}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                    </Typography>
                                                    {timeRemaining && (
                                                        <Chip
                                                            label={timeRemaining}
                                                            color={timeRemaining === 'Expired' ? 'error' : 'warning'}
                                                            size="small"
                                                            icon={<TimerIcon />}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            {!notification.read && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notification.id);
                                                    }}
                                                    disabled={markingRead.has(notification.id)}
                                                    title="Mark as read"
                                                >
                                                    {markingRead.has(notification.id) ? (
                                                        <CircularProgress size={20} />
                                                    ) : (
                                                        <CheckIcon />
                                                    )}
                                                </IconButton>
                                            )}
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                disabled={deletingIds.has(notification.id)}
                                                title="Delete notification"
                                            >
                                                {deletingIds.has(notification.id) ? (
                                                    <CircularProgress size={20} />
                                                ) : (
                                                    <DeleteIcon />
                                                )}
                                            </IconButton>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            )}

            {/* Pending Purchase Modal */}
            <PendingPurchaseModal
                open={pendingPurchaseModal.open}
                onClose={() => setPendingPurchaseModal({ open: false, purchaseData: null })}
                purchaseData={pendingPurchaseModal.purchaseData}
                onConfirmationComplete={handlePendingPurchaseComplete}
            />
            </Container>
        </AppShell>
    );
}