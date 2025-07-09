// src/app/components/Sidebar.tsx - Updated with Currency Selector
import React from "react";
import { useRouter } from "next/navigation";
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
  const { data: session } = useSession();

  const handleNavigation = (path: string) => {
    router.push(path);
    toggleSidebar(); // Close sidebar on navigation
  };

  const isAdmin = session?.user?.role === 'admin';

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
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/marketplace")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <StorefrontIcon />
            </ListItemIcon>
            <ListItemText primary="Marketplace" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/watchlist")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
            }}
          >
            <ListItemIcon>
              <TaskIcon />
            </ListItemIcon>
            <ListItemText primary="My Watchlist" />
          </ListItem>


          <ListItem
            component="div"
            onClick={() => handleNavigation("/collection")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <CollectionsIcon />
            </ListItemIcon>
            <ListItemText primary="My Collection" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/wallet")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <WalletIcon />
            </ListItemIcon>
            <ListItemText primary="My Wallet" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/selling/dashboard")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <SellIcon />
            </ListItemIcon>
            <ListItemText primary="My Sales" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/bids/my-auctions")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <AuctionIcon />
            </ListItemIcon>
            <ListItemText primary="My Auctions" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/notifications")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <NotificationsIcon />
            </ListItemIcon>
            <ListItemText primary="Notifications" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/tasks")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <TaskIcon />
            </ListItemIcon>
            <ListItemText primary="Tasks" />
          </ListItem>

          {/* Admin Panel - Only for admin users */}
          {isAdmin && (
            <ListItem
              component="div"
              onClick={() => handleNavigation("/admin/dashboard")}
              sx={{
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' },
                bgcolor: 'rgba(150, 255, 155, 0.05)',
                border: '1px solid rgba(150, 255, 155, 0.2)',
                borderRadius: 1,
                mx: 1,
                my: 0.5
              }}
            >
              <ListItemIcon>
                <AdminIcon sx={{ color: '#96ff9b' }} />
              </ListItemIcon>
              <ListItemText
                primary="Admin Panel"
                primaryTypographyProps={{ color: '#96ff9b', fontWeight: 'bold' }}
              />
            </ListItem>
          )}

          <ListItem
            component="div"
            onClick={() => handleNavigation("/settings")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/chat")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(150, 255, 155, 0.1)' }
            }}
          >
            <ListItemIcon>
              <ChatIcon />
            </ListItemIcon>
            <ListItemText primary="Chat" />
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