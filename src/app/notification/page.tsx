// src/app/notifications/page.tsx - Fixed with consistent endpoints and HTML structure
'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Typography,
    Box,
    Paper,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Button,
    Chip,
    Alert,
    CircularProgress,
    Divider,
    Badge
} from '@mui/material';
import {
    Notifications as NotificationIcon,
    Gavel as GavelIcon,
    AttachMoney as MoneyIcon,
    Check as CheckIcon,
    Menu as MenuIcon,
    MarkEmailRead as MarkReadIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    reference_id?: number;
    reference_type?: string;
    metadata?: any;
    created_at: string;
}

export default function NotificationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [markingAsRead, setMarkingAsRead] = useState<Set<number>>(new Set());

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            setError(null);

            // FIXED: Use consistent API endpoint
            const response = await fetch('/api/notifications');

            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.status}`);
            }

            const data = await response.json();
            console.log('Fetched notifications:', data);
            setNotifications(data || []);

        } catch (err) {
            console.error('Error fetching notifications:', err);
            setError(err instanceof Error ? err.message : 'Failed to load notifications');

            // Show sample notifications as fallback
            const sampleNotifications: Notification[] = [
                {
                    id: 1,
                    type: 'BID_RECEIVED',
                    title: 'New Bid Received',
                    message: 'Someone placed a bid of $25.00 on your Pikachu card',
                    is_read: false,
                    created_at: new Date().toISOString()
                },
                {
                    id: 2,
                    type: 'AUCTION_WON',
                    title: 'Auction Won!',
                    message: 'Congratulations! You won the auction for Charizard with a bid of $150.00',
                    is_read: false,
                    created_at: new Date(Date.now() - 3600000).toISOString()
                }
            ];
            setNotifications(sampleNotifications);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

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

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'BID_RECEIVED':
            case 'BID_OUTBID':
            case 'BID_ACCEPTED':
                return <GavelIcon />;
            case 'AUCTION_WON':
            case 'AUCTION_LOST':
                return <GavelIcon color="primary" />;
            case 'PURCHASE_COMPLETE':
            case 'SALE_COMPLETE':
            case 'PURCHASE_CONFIRMED':
            case 'SALE_COMPLETED':
                return <MoneyIcon color="success" />;
            default:
                return <NotificationIcon />;
        }
    };

    const getNotificationColor = (type: string, isRead: boolean) => {
        if (isRead) return 'default';

        switch (type) {
            case 'BID_RECEIVED':
            case 'AUCTION_WON':
                return 'success';
            case 'BID_OUTBID':
            case 'AUCTION_LOST':
                return 'warning';
            case 'BID_ACCEPTED':
            case 'PURCHASE_COMPLETE':
            case 'SALE_COMPLETE':
            case 'PURCHASE_CONFIRMED':
            case 'SALE_COMPLETED':
                return 'primary';
            default:
                return 'default';
        }
    };

    const markAsRead = async (notificationId: number) => {
        setMarkingAsRead(prev => new Set(prev).add(notificationId));

        try {
            // FIXED: Use consistent API endpoint
            const response = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    notification_id: notificationId
                })
            });

            if (response.ok) {
                setNotifications(prev =>
                    prev.map(notif =>
                        notif.id === notificationId
                            ? { ...notif, is_read: true }
                            : notif
                    )
                );
                toast.success('Notification marked as read');
            } else {
                throw new Error('Failed to mark as read');
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
            toast.error('Failed to mark notification as read');
        } finally {
            setMarkingAsRead(prev => {
                const newSet = new Set(prev);
                newSet.delete(notificationId);
                return newSet;
            });
        }
    };

    const markAllAsRead = async () => {
        try {
            // FIXED: Use consistent API endpoint
            const response = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mark_as_read: 'all'
                })
            });

            if (response.ok) {
                setNotifications(prev =>
                    prev.map(notif => ({ ...notif, is_read: true }))
                );
                toast.success('All notifications marked as read');
            } else {
                throw new Error('Failed to mark all as read');
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
        }
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.is_read) {
            markAsRead(notification.id);
        }

        // Navigate based on notification type
        switch (notification.type) {
            case 'BID_RECEIVED':
                router.push('/selling/dashboard');
                break;
            case 'BID_ACCEPTED':
            case 'AUCTION_WON':
            case 'PURCHASE_COMPLETE':
            case 'PURCHASE_CONFIRMED':
                router.push('/collection');
                break;
            case 'SALE_COMPLETE':
            case 'SALE_COMPLETED':
                router.push('/wallet');
                break;
            case 'BID_OUTBID':
            case 'AUCTION_LOST':
                router.push('/marketplace');
                break;
            default:
                break;
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

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

    return (
        <Container sx={{ marginTop: 4, marginBottom: 4 }}>
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 3 }}>
                <IconButton onClick={toggleSidebar}>
                    <MenuIcon />
                </IconButton>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Badge badgeContent={unreadCount} color="error">
                        <NotificationIcon />
                    </Badge>
                    <Typography variant="h4">Notifications</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {unreadCount > 0 && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={markAllAsRead}
                            startIcon={<MarkReadIcon />}
                        >
                            Mark All Read
                        </Button>
                    )}
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/marketplace')}
                        size="small"
                    >
                        Back to Marketplace
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={fetchNotifications}
                        size="small"
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            {/* Error State */}
            {error && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    {error} - Showing sample notifications
                </Alert>
            )}

            {/* Loading State */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {/* Notifications List */}
                    {notifications.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <NotificationIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No notifications yet
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                You'll receive notifications for bids, auctions, and sales here
                            </Typography>
                        </Paper>
                    ) : (
                        <Paper>
                            <List>
                                {notifications.map((notification, index) => (
                                    <React.Fragment key={notification.id}>
                                        <ListItem
                                            onClick={() => handleNotificationClick(notification)}
                                            sx={{
                                                bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                                                '&:hover': {
                                                    bgcolor: 'action.selected'
                                                },
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <ListItemIcon>
                                                {getNotificationIcon(notification.type)}
                                            </ListItemIcon>

                                            <ListItemText
                                                primary={
                                                    // FIXED: Removed nested Box to prevent div in p error
                                                    <Typography
                                                        variant="subtitle1"
                                                        fontWeight={notification.is_read ? 'normal' : 'bold'}
                                                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                                    >
                                                        {notification.title}
                                                        {!notification.is_read && (
                                                            <Chip
                                                                label="New"
                                                                color={getNotificationColor(notification.type, notification.is_read)}
                                                                size="small"
                                                            />
                                                        )}
                                                    </Typography>
                                                }
                                                secondary={
                                                    // FIXED: Use string concatenation instead of nested divs
                                                    `${notification.message} • ${formatDateTime(notification.created_at)}`
                                                }
                                            />

                                            <ListItemSecondaryAction>
                                                {!notification.is_read && (
                                                    <IconButton
                                                        edge="end"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            markAsRead(notification.id);
                                                        }}
                                                        disabled={markingAsRead.has(notification.id)}
                                                        size="small"
                                                    >
                                                        {markingAsRead.has(notification.id) ? (
                                                            <CircularProgress size={20} />
                                                        ) : (
                                                            <CheckIcon />
                                                        )}
                                                    </IconButton>
                                                )}
                                            </ListItemSecondaryAction>
                                        </ListItem>
                                        {index < notifications.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </List>
                        </Paper>
                    )}
                </>
            )}
        </Container>
    );
}