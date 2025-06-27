// src/app/notifications/page.tsx - Notifications page with plural route
'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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
    Divider,
    Paper
} from '@mui/material';
import {
    Notifications as NotificationIcon,
    MarkEmailRead as MarkReadIcon,
    Delete as DeleteIcon,
    Menu as MenuIcon,
    Refresh as RefreshIcon,
    CheckCircle as CheckIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Gavel as AuctionIcon,
    AttachMoney as MoneyIcon,
    ShoppingCart as SaleIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';

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

interface NotificationResponse {
    notifications: Notification[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export default function NotificationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [markingRead, setMarkingRead] = useState<Set<number>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/notifications');

            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }

            const data: NotificationResponse = await response.json();

            // Extract notifications array from response
            setNotifications(data.notifications || []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setError(err instanceof Error ? err.message : 'Failed to load notifications');
            setNotifications([]); // Set empty array on error
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

            // Update local state
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

            // Update local state
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

            // Remove from local state
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

    // Handle notification click (navigate based on type)
    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Navigate based on notification type
        switch (notification.type) {
            case 'BID_RECEIVED':
            case 'BID_ACCEPTED':
                router.push('/selling/dashboard');
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
            default:
                // Stay on notifications page
                break;
        }
    };

    // Get notification icon based on type
    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'BID_RECEIVED':
            case 'BID_ACCEPTED':
            case 'BID_OUTBID':
                return <AuctionIcon />;
            case 'SALE_COMPLETED':
            case 'PURCHASE_CONFIRMED':
                return <MoneyIcon />;
            case 'AUCTION_WON':
            case 'AUCTION_LOST':
                return <SaleIcon />;
            case 'INFO':
                return <InfoIcon />;
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
            case 'BID_ACCEPTED':
                return 'success';
            case 'BID_OUTBID':
            case 'AUCTION_LOST':
                return 'warning';
            case 'ERROR':
                return 'error';
            default:
                return 'info';
        }
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchNotifications();
        }
    }, [status, router]);

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

    return (
        <Container sx={{ marginTop: 4, marginBottom: 4 }}>
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <IconButton onClick={toggleSidebar}>
                    <MenuIcon />
                </IconButton>
                <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Badge badgeContent={unreadCount} color="error">
                        <NotificationIcon />
                    </Badge>
                    Notifications
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
                    {notifications.map((notification) => (
                        <Card
                            key={notification.id}
                            sx={{
                                cursor: 'pointer',
                                opacity: notification.read ? 0.7 : 1,
                                border: notification.read ? 'none' : '2px solid',
                                borderColor: notification.read ? 'none' : 'primary.main',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: 4,
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
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                {notification.message}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                            </Typography>
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
                    ))}
                </Stack>
            )}
        </Container>
    );
}