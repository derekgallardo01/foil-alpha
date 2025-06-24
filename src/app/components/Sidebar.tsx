import React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
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
} from "@mui/icons-material";

// Define prop types
interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
    toggleSidebar(); // Close sidebar on navigation
  };

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
            height={40}
            priority
          />
          <IconButton onClick={toggleSidebar}>
            <MenuIcon />
          </IconButton>
        </Box>

        {/* Sidebar Links */}
        <List>
          <ListItem
            component="div"
            onClick={() => handleNavigation("/dashboard")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
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
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
            }}
          >
            <ListItemIcon>
              <StorefrontIcon />
            </ListItemIcon>
            <ListItemText primary="Marketplace" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/collection")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
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
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
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
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
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
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
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
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
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
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
            }}
          >
            <ListItemIcon>
              <TaskIcon />
            </ListItemIcon>
            <ListItemText primary="Tasks" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => handleNavigation("/settings")}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
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
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
            }}
          >
            <ListItemIcon>
              <ChatIcon />
            </ListItemIcon>
            <ListItemText primary="Chat" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => signOut({ callbackUrl: "/login" })}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
            }}
          >
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar;