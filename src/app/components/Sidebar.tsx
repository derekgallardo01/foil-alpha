// src/app/components/Sidebar.tsx - Updated with Active Page Highlighting
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
  Divider,
  Typography,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Storefront as StorefrontIcon,
  Collections as CollectionsIcon,
  Assignment as TaskIcon,
  ExitToApp as LogoutIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Chat as ChatIcon,
  Gavel as AuctionIcon,
  AccountBalanceWallet as WalletIcon,
  Notifications as NotificationsIcon,
  Sell as SellIcon,
  AdminPanelSettings as AdminIcon,
} from "@mui/icons-material";
import CurrencySelector from "./CurrencySelector";

// Define prop types
interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleNavigation = (path: string) => {
    router.push(path);
    toggleSidebar(); // Close sidebar on navigation
  };

  const isAdmin = session?.user?.role === 'admin';

  // Function to check if current path matches the menu item
  const isActivePath = (path: string) => {
    // Handle exact matches
    if (pathname === path) return true;

    // Handle nested routes (e.g., /admin/dashboard matches /admin)
    if (path === '/admin/dashboard' && pathname.startsWith('/admin')) return true;

    // Handle other nested routes
    if (path !== '/' && path !== '/dashboard' && pathname.startsWith(path)) return true;

    return false;
  };

  // Define active and hover styles
  const getMenuItemStyles = (path: string) => ({
    cursor: 'pointer',
    backgroundColor: isActivePath(path) ? 'rgba(155, 92, 255, 0.15)' : 'transparent',
    borderLeft: isActivePath(path) ? '4px solid #9B5Cff' : '4px solid transparent',
    '&:hover': {
      backgroundColor: isActivePath(path)
        ? 'rgba(155, 92, 255, 0.2)'
        : 'rgba(155, 92, 255, 0.1)'
    }
  });

  const getIconColor = (path: string) =>
    isActivePath(path) ? '#9B5Cff' : 'inherit';

  const getTextStyles = (path: string) => ({
    color: isActivePath(path) ? '#9B5Cff' : 'inherit',
    fontWeight: isActivePath(path) ? 'bold' : 'normal'
  });

  return (
    <Drawer anchor="left" open={isOpen} onClose={toggleSidebar}>
      <Box
        sx={{
          width: 250,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Sidebar Header */}
        <Box
          sx={{
            p: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Image
            src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
            alt="Logo"
            width={120}
            height={60}
            priority
          />
          <IconButton onClick={toggleSidebar}>
            <MenuIcon />
          </IconButton>
        </Box>

        {/* User Info */}
        {session?.user && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Welcome, {session.user.name}
            </Typography>
            {isAdmin && (
              <Typography variant="caption" color="primary.main">
                Administrator
              </Typography>
            )}
          </Box>
        )}

        {/* Currency Selector - Only for non-admin users */}
        {!isAdmin && (
          <Box sx={{ px: 2, pb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Display Currency
            </Typography>
            <CurrencySelector size="small" />
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Sidebar Links */}
        <List sx={{ flexGrow: 1 }}>
          <ListItem
            component="div"
            onClick={() => handleNavigation("/dashboard")}
            sx={getMenuItemStyles("/dashboard")}
          >
            <ListItemIcon>
              <DashboardIcon sx={{ color: getIconColor("/dashboard") }} />
            </ListItemIcon>
            <ListItemText
              primary="Dashboard"
              primaryTypographyProps={getTextStyles("/dashboard")}
            />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/marketplace")}
            sx={getMenuItemStyles("/marketplace")}
          >
            <ListItemIcon>
              <StorefrontIcon sx={{ color: getIconColor("/marketplace") }} />
            </ListItemIcon>
            <ListItemText
              primary="Marketplace"
              primaryTypographyProps={getTextStyles("/marketplace")}
            />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/watchlist")}
            sx={getMenuItemStyles("/watchlist")}
          >
            <ListItemIcon>
              <TaskIcon sx={{ color: getIconColor("/watchlist") }} />
            </ListItemIcon>
            <ListItemText
              primary="My Watchlist"
              primaryTypographyProps={getTextStyles("/watchlist")}
            />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/collection")}
            sx={getMenuItemStyles("/collection")}
          >
            <ListItemIcon>
              <CollectionsIcon sx={{ color: getIconColor("/collection") }} />
            </ListItemIcon>
            <ListItemText
              primary="My Collection"
              primaryTypographyProps={getTextStyles("/collection")}
            />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/wallet")}
            sx={getMenuItemStyles("/wallet")}
          >
            <ListItemIcon>
              <WalletIcon sx={{ color: getIconColor("/wallet") }} />
            </ListItemIcon>
            <ListItemText
              primary="My Wallet"
              primaryTypographyProps={getTextStyles("/wallet")}
            />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/selling/dashboard")}
            sx={getMenuItemStyles("/selling/dashboard")}
          >
            <ListItemIcon>
              <SellIcon sx={{ color: getIconColor("/selling/dashboard") }} />
            </ListItemIcon>
            <ListItemText
              primary="My Sales"
              primaryTypographyProps={getTextStyles("/selling/dashboard")}
            />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/bids/my-auctions")}
            sx={getMenuItemStyles("/bids/my-auctions")}
          >
            <ListItemIcon>
              <AuctionIcon sx={{ color: getIconColor("/bids/my-auctions") }} />
            </ListItemIcon>
            <ListItemText
              primary="My Auctions"
              primaryTypographyProps={getTextStyles("/bids/my-auctions")}
            />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/notifications")}
            sx={getMenuItemStyles("/notifications")}
          >
            <ListItemIcon>
              <NotificationsIcon sx={{ color: getIconColor("/notifications") }} />
            </ListItemIcon>
            <ListItemText
              primary="Notifications"
              primaryTypographyProps={getTextStyles("/notifications")}
            />
          </ListItem>

         

          {/* Admin Panel - Only for admin users */}
          {isAdmin && (
            <ListItem
              component="div"
              onClick={() => handleNavigation("/admin/dashboard")}
              sx={{
                ...getMenuItemStyles("/admin/dashboard"),
                bgcolor: isActivePath("/admin/dashboard")
                  ? 'rgba(155, 92, 255, 0.2)'
                  : 'rgba(155, 92, 255, 0.05)',
                border: isActivePath("/admin/dashboard")
                  ? '1px solid #9B5Cff'
                  : '1px solid rgba(155, 92, 255, 0.2)',
                borderRadius: 1,
                mx: 1,
                my: 0.5
              }}
            >
              <ListItemIcon>
                <AdminIcon sx={{ color: '#9B5Cff' }} />
              </ListItemIcon>
              <ListItemText
                primary="Admin Panel"
                primaryTypographyProps={{ color: '#9B5Cff', fontWeight: 'bold' }}
              />
            </ListItem>
          )}

          <ListItem
            component="div"
            onClick={() => handleNavigation("/settings")}
            sx={getMenuItemStyles("/settings")}
          >
            <ListItemIcon>
              <SettingsIcon sx={{ color: getIconColor("/settings") }} />
            </ListItemIcon>
            <ListItemText
              primary="Settings"
              primaryTypographyProps={getTextStyles("/settings")}
            />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/chat")}
            sx={getMenuItemStyles("/chat")}
          >
            <ListItemIcon>
              <ChatIcon sx={{ color: getIconColor("/chat") }} />
            </ListItemIcon>
            <ListItemText
              primary="Chat"
              primaryTypographyProps={getTextStyles("/chat")}
            />
          </ListItem>
        </List>

        {/* Logout at bottom */}
        <Box sx={{ mt: 'auto' }}>
          <Divider sx={{ mb: 1 }} />
          <ListItem
            component="div"
            onClick={() => signOut({ callbackUrl: "/login" })}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.1)' }
            }}
          >
            <ListItemIcon>
              <LogoutIcon sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText
              primary="Logout"
              primaryTypographyProps={{ color: 'error.main' }}
            />
          </ListItem>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;