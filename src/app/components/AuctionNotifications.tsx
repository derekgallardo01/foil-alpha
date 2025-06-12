'use client';
import React, { useState, useEffect } from 'react';
import {
    Box,
    IconButton,
    Badge,
    Menu,
    MenuItem,
    Typography,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    Chip,
    Button,
    Divider,
    Paper
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    Gavel as GavelIcon,
    AttachMoney as MoneyIcon,
    Schedule as ScheduleIcon,
    EmojiEvents as TrophyIcon,
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

interface Notification {
    id: number;
    type: 'BID_PLACED' | 'BID_OUTBID' | 'AUCTION_WON' | 'AUCTION_LOST' | 'AUCTION_ENDING' | 'SALE_COMPLETED';
    title: string;
    message: string;
    card_name: string;
    card_image?: string;
    amount?: number;
    created_at: string;
    is_read: boolean;
    auction_id?: number;
}

interface AuctionNotificationsProps {
    userId: number;
}

export default function AuctionNotifications({ userId }: AuctionNotificationsProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [loading, setLoading] = useState(false);

    // Mock notifications matching your data structure
    const mockNotifications: Notification[] = [
        {
            id: 1,
            type: 'AUCTION_WON',
            title: 'Auction Won!',
            message: 'Congratulations! You won the auction.',
            card_name: 'Charizard VMAX',
            amount: 125.50,
            created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            is_read: false
        },
        {
            id: 2,
            type: 'BID_OUTBID',
            title: 'You\'ve been outbid',
            message: 'Your bid has been exceeded by another bidder.',
            card_name: 'Pikachu Gold',
            amount: 85.00,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            is_read: false
        },
        {
            id: 3,
            type: 'AUCTION_ENDING',
            title: 'Auction ending soon',
            message: 'Less than 1 hour remaining on your bid.',
            card_name: 'Blastoise EX',
            amount: 45.25,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
            is_read: true
        },
        {
            id: 4,
            type: 'SALE_COMPLETED',
            title: 'Your card sold!',
            message: 'Your fixed-price listing has been purchased.',
            card_name: 'Venusaur Holo',
            amount: 67.00,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
            is_read: true
        }
    ];

    useEffect(() => {
        // In real app, fetch notifications from your API
        setNotifications(mockNotifications);
        setUnreadCount(mockNotifications.filter(n => !n.is_read).length);
    }, [userId]);

    const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const markAsRead = async (notificationId: number) => {
        setNotifications(prev =>
            prev.map(n =>
                n.id === notificationId ? { ...n, is_read: true } : n
            )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'AUCTION_WON':
                return <TrophyIcon sx={{ color: 'success.main' }} />;
            case 'BID_OUTBID':
                return <GavelIcon sx={{ color: 'warning.main' }} />;
            case 'AUCTION_ENDING':
                return <ScheduleIcon sx={{ color: 'info.main' }} />;
            case 'SALE_COMPLETED':
                return <MoneyIcon sx={{ color: 'success.main' }} />;
            case 'AUCTION_LOST':
                return <CancelIcon sx={{ color: 'error.main' }} />;
            default:
                return <NotificationsIcon />;
        }
    };

    const getNotificationColor = (type: Notification['type']): 'success' | 'warning' | 'info' | 'error' | 'default' => {
        switch (type) {
            case 'AUCTION_WON':
            case 'SALE_COMPLETED':
                return 'success';
            case 'BID_OUTBID':
                return 'warning';
            case 'AUCTION_ENDING':
                return 'info';
            case 'AUCTION_LOST':
                return 'error';
            default:
                return 'default';
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${Number(price).toFixed(2)}`;
    };

    return (
        <Box>
            <IconButton
                size="large"
                aria-label="show notifications"
                color="inherit"
                onClick={handleNotificationClick}
                sx={{
                    color: 'text.primary',
                    '&:hover': {
                        backgroundColor: 'action.hover'
                    }
                }}
            >
                <Badge badgeContent={unreadCount} color="error">
                    <NotificationsIcon />
                </Badge>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        width: 400,
                        maxHeight: 500,
                        overflow: 'auto',
                        mt: 1
                    }
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                {/* Header */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" component="h3">
                            Notifications
                        </Typography>
                        {unreadCount > 0 && (
                            <Button
                                size="small"
                                onClick={markAllAsRead}
                                sx={{ textTransform: 'none' }}
                            >
                                Mark all read
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* Notifications List */}
                {notifications.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                            No notifications yet
                        </Typography>
                    </Box>
                ) : (
                    <List sx={{ p: 0 }}>
                        {notifications.map((notification, index) => [
                            <ListItem
                                key={notification.id}
                                sx={{
                                    bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: 'action.selected'
                                    }
                                }}
                                onClick={() => markAsRead(notification.id)}
                            >
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: 'transparent' }}>
                                        {getNotificationIcon(notification.type)}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                            <Typography variant="subtitle2" component="span">
                                                {notification.title}
                                            </Typography>
                                            <Chip
                                                label={notification.type.replace('_', ' ')}
                                                size="small"
                                                color={getNotificationColor(notification.type)}
                                                sx={{
                                                    fontSize: '0.6rem',
                                                    height: 18,
                                                    '& .MuiChip-label': {
                                                        px: 0.5
                                                    }
                                                }}
                                            />
                                        </Box>
                                    }
                                    secondary={
                                        <Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }} component="span">
                                                {notification.message}
                                            </Typography>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                <Typography variant="caption" sx={{ fontWeight: 'medium', color: 'text.primary' }} component="span">
                                                    {notification.card_name}
                                                </Typography>
                                                {notification.amount && (
                                                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold' }} component="span">
                                                        {formatPrice(notification.amount)}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Typography variant="caption" color="text.disabled" component="span">
                                                {formatTimeAgo(notification.created_at)}
                                            </Typography>
                                        </Box>
                                    }
                                />
                                {!notification.is_read && (
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            bgcolor: 'primary.main',
                                            ml: 1
                                        }}
                                    />
                                )}
                            </ListItem>,
                            index < notifications.length - 1 ? <Divider key={`divider-${notification.id}`} variant="inset" component="li" /> : null
                        ].filter(Boolean))}
                    </List>
                )}

                {notifications.length > 0 && [
                    <Divider key="footer-divider" />,
                    <Box key="footer" sx={{ p: 1 }}>
                        <Button
                            fullWidth
                            size="small"
                            sx={{ textTransform: 'none' }}
                            onClick={handleClose}
                        >
                            View All Notifications
                        </Button>
                    </Box>
                ]}
            </Menu>
        </Box>
    );
}