import React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image"; // Import Image from next/image
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import TaskIcon from "@mui/icons-material/Assignment";
import LogoutIcon from "@mui/icons-material/ExitToApp";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import ChatIcon from "@mui/icons-material/Chat";

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
            width={120} // Specify width (adjust as needed)
            height={40} // Specify height to match previous style
            priority // Optional: prioritize loading for LCP
          />
          <IconButton onClick={toggleSidebar}>
            <MenuIcon />
          </IconButton>
        </Box>

        {/* Sidebar Links */}
        <List>
          <ListItem component="div" onClick={() => handleNavigation("/dashboard")}>
            <ListItemIcon>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItem>

          <ListItem component="div" onClick={() => handleNavigation("/tasks")}>
            <ListItemIcon>
              <TaskIcon />
            </ListItemIcon>
            <ListItemText primary="Tasks" />
          </ListItem>

          <ListItem component="div" onClick={() => handleNavigation("/settings")}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItem>

          <ListItem component="div" onClick={() => handleNavigation("/chat")}>
            <ListItemIcon>
              <ChatIcon />
            </ListItemIcon>
            <ListItemText primary="Chat" />
          </ListItem>

          <ListItem
            component="div"
            onClick={() => signOut({ callbackUrl: "/login" })}
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