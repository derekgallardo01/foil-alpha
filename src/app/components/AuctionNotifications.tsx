'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Badge,
  Menu,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Button,
  Divider,
  CircularProgress
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
import { useRouter } from 'next/navigation';
import { useEventStream } from '../lib/useEventStream';

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

interface AuctionNotificationsProps {
  userId: number;
}

export default function AuctionNotifications({ userId }: AuctionNotificationsProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/notifications?unread_only=true');

      if (response.ok) {
        const data = await response.json();

        // Ensure data is an array
        const notificationsArray = Array.isArray(data)
          ? data
          : Array.isArray(data.notifications)
            ? data.notifications
            : [];

        setNotifications(notificationsArray.slice(0, 5)); // Show only latest 5
        setUnreadCount(notificationsArray.length);
      } else {
        throw new Error('Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      // Don't fabricate notifications on error — show none rather than masking
      // the failure with fake "Auction Won"/"Outbid" samples.
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Slow safety-net poll; real-time push (below) is primary.
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  // Live: refresh the bell the moment a notification is pushed to this user.
  useEventStream((e) => {
    if (e.type === 'notification') fetchNotifications();
  });

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    if (!loading) {
      fetchNotifications(); // Refresh when opening
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationId
        })
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markAllAsRead: true
        })
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleViewAll = () => {
    handleClose();
    router.push('/notifications');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'AUCTION_WON':
        return <TrophyIcon sx={{ color: 'success.main' }} />;
      case 'BID_OUTBID':
        return <GavelIcon sx={{ color: 'warning.main' }} />;
      case 'AUCTION_ENDING':
        return <ScheduleIcon sx={{ color: 'info.main' }} />;
      case 'SALE_COMPLETED':
      case 'SALE_COMPLETE':
      case 'PURCHASE_CONFIRMED':
        return <MoneyIcon sx={{ color: 'success.main' }} />;
      case 'AUCTION_LOST':
        return <CancelIcon sx={{ color: 'error.main' }} />;
      case 'BID_RECEIVED':
        return <GavelIcon sx={{ color: 'primary.main' }} />;
      case 'BID_ACCEPTED':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      default:
        return <NotificationsIcon />;
    }
  };

  const getNotificationColor = (type: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    switch (type) {
      case 'AUCTION_WON':
      case 'SALE_COMPLETED':
      case 'SALE_COMPLETE':
      case 'PURCHASE_CONFIRMED':
      case 'BID_ACCEPTED':
        return 'success';
      case 'BID_OUTBID':
        return 'warning';
      case 'AUCTION_ENDING':
      case 'BID_RECEIVED':
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getCardName = (notification: Notification) => {
    return notification.metadata?.card_name || 'Card';
  };

  const getAmount = (notification: Notification) => {
    const amount = notification.metadata?.amount ||
      notification.metadata?.bid_amount ||
      notification.metadata?.winning_amount;
    return amount ? `$${Number(amount).toFixed(2)}` : '';
  };

  return (
    <Box>
      <IconButton
        size="large"
        aria-label="show notifications"
        color="inherit"
        onClick={handleNotificationClick}
        sx={{
          color: '#ffffff',
          padding: 1,
          '&:hover': {
            backgroundColor: 'transparent'
          }
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: '#ff4444',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '0.7rem',
            }
          }}
        >
          <NotificationsIcon sx={{
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
            fontSize: '1.3rem'
          }} />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: 'calc(100vw - 32px)', sm: 400 },
            maxWidth: 400,
            maxHeight: 500,
            overflow: 'auto',
            mt: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        MenuListProps={{
          sx: { padding: 0 }
        }}
      >
        {[
          // Header
          <Box key="header" sx={{ p: 2, borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" component="h3" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                Notifications
              </Typography>
              {unreadCount > 0 && (
                <Button
                  size="small"
                  onClick={markAllAsRead}
                  sx={{
                    textTransform: 'none',
                    color: 'primary.main',
                    fontWeight: 'bold'
                  }}
                >
                  Mark all read
                </Button>
              )}
            </Box>
            {error && (
              <Typography variant="caption" color="error" display="block">
                {error} - Showing sample data
              </Typography>
            )}
          </Box>,

          // Loading State
          loading && (
            <Box key="loading" sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress size={24} sx={{ color: '#ffffff' }} />
              <Typography variant="body2" color="#cccccc" sx={{ mt: 1 }}>
                Loading notifications...
              </Typography>
            </Box>
          ),

          // Notifications List
          !loading &&
          (notifications.length === 0 ? (
            <Box key="empty" sx={{ p: 3, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.3)', mb: 1 }} />
              <Typography variant="body2" color="#cccccc">
                No new notifications
              </Typography>
            </Box>
          ) : (
            <List key="notifications" sx={{ p: 0 }}>
              {notifications.map((notification, index) => [
                <ListItem
                  key={notification.id}
                  sx={{
                    bgcolor: notification.is_read ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
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
                        <Typography variant="subtitle2" component="span" sx={{ color: '#ffffff' }}>
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
                              px: 0.5,
                            },
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="body2"
                          color="#cccccc"
                          sx={{ mb: 0.5 }}
                          component="span"
                        >
                          {notification.message}
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 'medium', color: '#ffffff' }}
                            component="span"
                          >
                            {getCardName(notification)}
                          </Typography>
                          {getAmount(notification) && (
                            <Typography
                              variant="caption"
                              color="primary.main"
                              sx={{ fontWeight: 'bold' }}
                              component="span"
                            >
                              {getAmount(notification)}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          color="rgba(255, 255, 255, 0.5)"
                          component="span"
                        >
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
                        ml: 1,
                      }}
                    />
                  )}
                </ListItem>,
                index < notifications.length - 1 ? (
                  <Divider key={`divider-${notification.id}`} variant="inset" component="li" sx={{
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }} />
                ) : null,
              ].filter(Boolean))}
            </List>
          )),

          // Footer
          !loading &&
          notifications.length > 0 && [
            <Divider key="footer-divider" sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />,
            <Box key="footer" sx={{ p: 1 }}>
              <Button
                fullWidth
                size="small"
                sx={{
                  textTransform: 'none',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                onClick={handleViewAll}
              >
                View All Notifications
              </Button>
            </Box>,
          ],
        ].filter(Boolean)}
      </Menu>
    </Box>
  );
}