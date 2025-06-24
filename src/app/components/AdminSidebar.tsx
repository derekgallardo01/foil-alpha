"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Divider,
    Avatar,
    Chip,
    Collapse,
    Badge,
} from "@mui/material";
import {
    Dashboard as DashboardIcon,
    People as PeopleIcon,
    AccountBalanceWallet as WalletIcon,
    Style as CardsIcon,
    Store as MarketplaceIcon,
    Gavel as AuctionIcon,
    Assessment as AnalyticsIcon,
    Settings as SettingsIcon,
    ExitToApp as LogoutIcon,
    ExpandLess,
    ExpandMore,
    PersonAdd as UserAddIcon,
    CreditCard as CardAddIcon,
    TrendingUp as SalesIcon,
    History as TransactionIcon,
    Schedule as ScheduleIcon,
    NotificationsActive as NotificationIcon,
    Security as SecurityIcon,
    Receipt as InvoiceIcon,
    SupervisorAccount as AdminIcon,
    MonetizationOn as MoneyIcon,
    Lock as FreezeIcon,
    Payment as PaymentIcon,
    Build as ToolsIcon,
    Storefront as Store,
    HistoryToggleOff as History,
    TrendingUp,
} from "@mui/icons-material";
import { signOut } from "next-auth/react";
import Image from "next/image";

interface AdminSidebarProps {
    isOpen: boolean;
    toggleSidebar: () => void;
}

interface NavigationItem {
    title: string;
    icon: React.JSX.Element;
    path?: string;
    badge?: number | string;
    children?: NavigationItem[];
    divider?: boolean;
}

export default function AdminSidebar({ isOpen, toggleSidebar }: AdminSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session } = useSession();
    const [expandedItems, setExpandedItems] = useState<string[]>(['users', 'cards', 'transactions']);

    // Sample data - replace with real data from APIs
    const [stats] = useState({
        pendingUsers: 3,
        activeAuctions: 12,
        pendingTransactions: 8,
        totalCards: 245,
        totalUsers: 156,
        totalSales: 89,
    });

    const navigationItems: NavigationItem[] = [
        // MAIN DASHBOARD
        {
            title: "Dashboard",
            icon: <DashboardIcon />,
            path: "/admin/dashboard",
        },

        // USER MANAGEMENT
        {
            title: "User Management",
            icon: <PeopleIcon />,
            badge: stats.pendingUsers,
            children: [
                {
                    title: "All Users",
                    icon: <PeopleIcon />,
                    path: "/admin/users",
                    badge: stats.totalUsers,
                },
                {
                    title: "Add User",
                    icon: <UserAddIcon />,
                    path: "/admin/users/add",
                },
                {
                    title: "Waitlist Signups",
                    icon: <ScheduleIcon />,
                    path: "/admin/waitlist-signups",
                    badge: stats.pendingUsers,
                },
                {
                    title: "User Activity",
                    icon: <AnalyticsIcon />,
                    path: "/admin/users/activity",
                },
            ],
        },

        // WALLET MANAGEMENT
        {
            title: "Wallet Management",
            icon: <WalletIcon />,
            children: [
                {
                    title: "Wallet Overview",
                    icon: <WalletIcon />,
                    path: "/admin/wallets",
                },
                {
                    title: "Add Funds",
                    icon: <MoneyIcon />,
                    path: "/admin/wallets/add-funds",
                },
                {
                    title: "Freeze/Unfreeze",
                    icon: <FreezeIcon />,
                    path: "/admin/wallets/freeze",
                },
                {
                    title: "Wallet Transactions",
                    icon: <PaymentIcon />,
                    path: "/admin/wallets/transactions",
                },
            ],
        },

        // CARD MANAGEMENT
        {
            title: "Card Management",
            icon: <CardsIcon />,
            badge: stats.totalCards,
            children: [
                {
                    title: "All Cards",
                    icon: <CardsIcon />,
                    path: "/admin/cards",
                    badge: stats.totalCards,
                },
                {
                    title: "Add Cards",
                    icon: <CardAddIcon />,
                    path: "/admin/cards/add",
                },
                {
                    title: "Card Listings",
                    icon: <Store />,
                    path: "/admin/listings",
                },
                {
                    title: "Bulk Operations",
                    icon: <ToolsIcon />,
                    path: "/admin/cards/bulk",
                },
            ],
        },

        // MARKETPLACE & AUCTIONS
        {
            title: "Marketplace",
            icon: <MarketplaceIcon />,
            children: [
                {
                    title: "Active Listings",
                    icon: <Store />,
                    path: "/admin/marketplace",
                },
                {
                    title: "Auctions",
                    icon: <AuctionIcon />,
                    path: "/admin/auctions",
                    badge: stats.activeAuctions,
                },
                {
                    title: "Process Auctions",
                    icon: <ScheduleIcon />,
                    path: "/admin/process-auctions",
                },
                {
                    title: "Sales Analytics",
                    icon: <SalesIcon />,
                    path: "/admin/sales",
                    badge: stats.totalSales,
                },
            ],
        },

        // TRANSACTIONS & FINANCE
        {
            title: "Transactions",
            icon: <TransactionIcon />,
            badge: stats.pendingTransactions,
            children: [
                {
                    title: "All Transactions",
                    icon: <TransactionIcon />,
                    path: "/admin/transactions",
                    badge: stats.pendingTransactions,
                },
                {
                    title: "Pending Payments",
                    icon: <PaymentIcon />,
                    path: "/admin/transactions/pending",
                    badge: stats.pendingTransactions,
                },
                {
                    title: "Financial Reports",
                    icon: <InvoiceIcon />,
                    path: "/admin/reports/financial",
                },
                {
                    title: "Refunds",
                    icon: <History />,
                    path: "/admin/transactions/refunds",
                },
            ],
        },

        // ANALYTICS & REPORTS
        {
            title: "Analytics",
            icon: <AnalyticsIcon />,
            children: [
                {
                    title: "Dashboard Analytics",
                    icon: <DashboardIcon />,
                    path: "/admin/analytics/dashboard",
                },
                {
                    title: "User Analytics",
                    icon: <PeopleIcon />,
                    path: "/admin/analytics/users",
                },
                {
                    title: "Sales Reports",
                    icon: <SalesIcon />,
                    path: "/admin/analytics/sales",
                },
                {
                    title: "Market Trends",
                    icon: <TrendingUp />,
                    path: "/admin/analytics/trends",
                },
            ],
        },

        // SYSTEM & SETTINGS
        {
            title: "System",
            icon: <SettingsIcon />,
            divider: true,
            children: [
                {
                    title: "Admin Settings",
                    icon: <AdminIcon />,
                    path: "/admin/settings",
                },
                {
                    title: "Security",
                    icon: <SecurityIcon />,
                    path: "/admin/security",
                },
                {
                    title: "Notifications",
                    icon: <NotificationIcon />,
                    path: "/admin/notifications",
                },
                {
                    title: "System Tools",
                    icon: <ToolsIcon />,
                    path: "/admin/tools",
                },
            ],
        },
    ];

    const handleItemClick = (item: NavigationItem) => {
        if (item.children) {
            // Toggle expansion for items with children
            setExpandedItems(prev =>
                prev.includes(item.title.toLowerCase().replace(' ', ''))
                    ? prev.filter(i => i !== item.title.toLowerCase().replace(' ', ''))
                    : [...prev, item.title.toLowerCase().replace(' ', '')]
            );
        } else if (item.path) {
            // Navigate to path
            router.push(item.path);
            if (window.innerWidth < 900) {
                toggleSidebar(); // Close sidebar on mobile after navigation
            }
        }
    };

    const handleLogout = async () => {
        await signOut({ callbackUrl: '/login' });
    };

    const isItemActive = (path?: string) => {
        if (!path) return false;
        return pathname === path || pathname.startsWith(path + '/');
    };

    const isParentActive = (item: NavigationItem) => {
        if (item.path && isItemActive(item.path)) return true;
        if (item.children) {
            return item.children.some(child => isItemActive(child.path));
        }
        return false;
    };

    const drawerContent = (
        <Box sx={{ width: 280, height: '100%', bgcolor: 'grey.900' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(150, 255, 155, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Image
                        src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
                        alt="TCG Market"
                        width={40}
                        height={20}
                    />
                    <Typography variant="h6" sx={{ ml: 1, color: '#96ff9b', fontWeight: 'bold' }}>
                        Admin Panel
                    </Typography>
                </Box>

                {/* Admin Profile */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: '#96ff9b', color: 'grey.900', width: 32, height: 32 }}>
                        {session?.user?.name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography variant="body2" color="text.primary" fontWeight="bold">
                            {session?.user?.name}
                        </Typography>
                        <Chip
                            label="Admin"
                            size="small"
                            sx={{
                                bgcolor: '#96ff9b',
                                color: 'grey.900',
                                height: 18,
                                fontSize: '0.7rem'
                            }}
                        />
                    </Box>
                </Box>
            </Box>

            {/* Navigation */}
            <List sx={{ py: 1, px: 1 }}>
                {navigationItems.map((item) => (
                    <Box key={item.title}>
                        {item.divider && <Divider sx={{ my: 1, borderColor: 'rgba(150, 255, 155, 0.2)' }} />}

                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={() => handleItemClick(item)}
                                sx={{
                                    borderRadius: 1,
                                    mb: 0.5,
                                    bgcolor: isParentActive(item) ? 'rgba(150, 255, 155, 0.1)' : 'transparent',
                                    color: isParentActive(item) ? '#96ff9b' : 'text.secondary',
                                    '&:hover': {
                                        bgcolor: 'rgba(150, 255, 155, 0.05)',
                                        color: '#96ff9b',
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                                    {item.badge && typeof item.badge === 'number' && item.badge > 0 ? (
                                        <Badge badgeContent={item.badge} color="error">
                                            {item.icon}
                                        </Badge>
                                    ) : (
                                        item.icon
                                    )}
                                </ListItemIcon>

                                <ListItemText
                                    primary={item.title}
                                    primaryTypographyProps={{
                                        fontSize: '0.9rem',
                                        fontWeight: isParentActive(item) ? 'bold' : 'normal'
                                    }}
                                />

                                {item.badge && typeof item.badge === 'string' && (
                                    <Chip
                                        label={item.badge}
                                        size="small"
                                        sx={{
                                            bgcolor: '#96ff9b',
                                            color: 'grey.900',
                                            height: 20,
                                            fontSize: '0.7rem'
                                        }}
                                    />
                                )}

                                {item.children && (
                                    expandedItems.includes(item.title.toLowerCase().replace(' ', ''))
                                        ? <ExpandLess />
                                        : <ExpandMore />
                                )}
                            </ListItemButton>
                        </ListItem>

                        {/* Sub-items */}
                        {item.children && (
                            <Collapse
                                in={expandedItems.includes(item.title.toLowerCase().replace(' ', ''))}
                                timeout="auto"
                                unmountOnExit
                            >
                                <List component="div" disablePadding sx={{ pl: 2 }}>
                                    {item.children.map((child) => (
                                        <ListItem key={child.title} disablePadding>
                                            <ListItemButton
                                                onClick={() => handleItemClick(child)}
                                                sx={{
                                                    borderRadius: 1,
                                                    mb: 0.5,
                                                    bgcolor: isItemActive(child.path) ? 'rgba(150, 255, 155, 0.15)' : 'transparent',
                                                    color: isItemActive(child.path) ? '#96ff9b' : 'text.secondary',
                                                    '&:hover': {
                                                        bgcolor: 'rgba(150, 255, 155, 0.08)',
                                                        color: '#96ff9b',
                                                    },
                                                }}
                                            >
                                                <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                                                    {child.badge && typeof child.badge === 'number' && child.badge > 0 ? (
                                                        <Badge badgeContent={child.badge} color="error">
                                                            {child.icon}
                                                        </Badge>
                                                    ) : (
                                                        child.icon
                                                    )}
                                                </ListItemIcon>

                                                <ListItemText
                                                    primary={child.title}
                                                    primaryTypographyProps={{
                                                        fontSize: '0.85rem',
                                                        fontWeight: isItemActive(child.path) ? 'bold' : 'normal'
                                                    }}
                                                />

                                                {child.badge && typeof child.badge === 'string' && (
                                                    <Chip
                                                        label={child.badge}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: '#96ff9b',
                                                            color: 'grey.900',
                                                            height: 18,
                                                            fontSize: '0.65rem'
                                                        }}
                                                    />
                                                )}
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                            </Collapse>
                        )}
                    </Box>
                ))}
            </List>

            {/* Footer with Logout */}
            <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid rgba(150, 255, 155, 0.2)' }}>
                <ListItemButton
                    onClick={handleLogout}
                    sx={{
                        borderRadius: 1,
                        color: 'error.main',
                        '&:hover': {
                            bgcolor: 'rgba(244, 67, 54, 0.1)',
                        },
                    }}
                >
                    <ListItemIcon sx={{ color: 'inherit' }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    <ListItemText
                        primary="Logout"
                        primaryTypographyProps={{
                            fontSize: '0.9rem',
                            fontWeight: 'bold'
                        }}
                    />
                </ListItemButton>

                {/* Admin Info */}
                <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(150, 255, 155, 0.05)', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                        Logged in as
                    </Typography>
                    <Typography variant="body2" color="#96ff9b" fontWeight="bold">
                        {session?.user?.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {session?.user?.email}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );

    return (
        <Drawer
            anchor="left"
            open={isOpen}
            onClose={toggleSidebar}
            variant="temporary"
            sx={{
                '& .MuiDrawer-paper': {
                    bgcolor: 'grey.900',
                    backgroundImage: 'linear-gradient(#000000, rgba(0, 0, 0, 0))',
                    borderRight: '1px solid rgba(150, 255, 155, 0.2)',
                },
            }}
        >
            {drawerContent}
        </Drawer>
    );
}