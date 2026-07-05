"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  AppBar,
  Toolbar,
  Drawer,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Typography,
  useMediaQuery,
  Tooltip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  Dashboard as DashboardIcon,
  Storefront as StorefrontIcon,
  Collections as CollectionsIcon,
  Visibility as WatchIcon,
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

const DRAWER_WIDTH = 248;

type NavItem = { label: string; path: string; icon: React.ReactNode };

const USER_NAV: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { label: "Marketplace", path: "/marketplace", icon: <StorefrontIcon /> },
  { label: "Watchlist", path: "/watchlist", icon: <WatchIcon /> },
  { label: "Collection", path: "/collection", icon: <CollectionsIcon /> },
  { label: "Wallet", path: "/wallet", icon: <WalletIcon /> },
  { label: "My Sales", path: "/selling/dashboard", icon: <SellIcon /> },
  { label: "My Auctions", path: "/bids/my-auctions", icon: <AuctionIcon /> },
  { label: "Notifications", path: "/notifications", icon: <NotificationsIcon /> },
  { label: "Settings", path: "/settings", icon: <SettingsIcon /> },
  { label: "Chat", path: "/chat", icon: <ChatIcon /> },
];

/** The iridescent brand wordmark (Holo signature moment). */
function Wordmark() {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, userSelect: "none" }}>
      <Typography component="span" sx={{ fontFamily: "var(--fa-display, inherit)", fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em" }}>
        Foil
      </Typography>
      <Typography
        component="span"
        sx={{
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: "-0.03em",
          background: (t) => t.foil.gradient,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Alpha
      </Typography>
    </Box>
  );
}

/**
 * Shared application shell: a persistent sidebar (desktop) / drawer (mobile)
 * plus a top bar with the brand wordmark. Pages opt in by wrapping their
 * content: `<AppShell><PageContent/></AppShell>` — no per-page drawer state.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = session?.user?.role === "admin";

  const isActive = (path: string) =>
    pathname === path || (path !== "/dashboard" && pathname?.startsWith(path));

  const go = (path: string) => {
    router.push(path);
    setMobileOpen(false);
  };

  const navItems: NavItem[] = isAdmin
    ? [...USER_NAV, { label: "Admin Panel", path: "/admin/dashboard", icon: <AdminIcon /> }]
    : USER_NAV;

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
      <Toolbar sx={{ px: 2.5 }}>
        <Wordmark />
      </Toolbar>
      <Divider />

      {session?.user && (
        <Box sx={{ px: 2.5, py: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Signed in
          </Typography>
          <Typography variant="body2" fontWeight={600} noWrap>
            {session.user.name}
          </Typography>
          {isAdmin && (
            <Typography variant="caption" color="primary.main" fontWeight={700}>
              Administrator
            </Typography>
          )}
        </Box>
      )}

      {!isAdmin && (
        <Box sx={{ px: 2.5, pb: 1 }}>
          <CurrencySelector size="small" />
        </Box>
      )}

      <Divider />

      <List sx={{ flexGrow: 1, px: 1.5, py: 1, overflowY: "auto" }}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          const isAdminLink = item.path.startsWith("/admin");
          return (
            <ListItemButton
              key={item.path}
              onClick={() => go(item.path)}
              selected={!!active}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: active ? "primary.main" : "text.secondary",
                ...(isAdminLink && {
                  border: "1px solid",
                  borderColor: active ? "primary.main" : "rgba(155,92,255,0.25)",
                }),
                "& .MuiListItemIcon-root": { color: active ? "primary.main" : "text.secondary", minWidth: 38 },
                "&.Mui-selected": { bgcolor: "action.selected" },
                "&.Mui-selected:hover": { bgcolor: "action.selected" },
                "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: 14.5 }} />
            </ListItemButton>
          );
        })}
      </List>

      <Divider />
      <List sx={{ px: 1.5, py: 1 }}>
        <ListItemButton
          onClick={() => signOut({ callbackUrl: "/login" })}
          sx={{ borderRadius: 2, color: "error.main", "&:hover": { bgcolor: "rgba(255,92,108,0.1)" } }}
        >
          <ListItemIcon sx={{ color: "error.main", minWidth: 38 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Log out" primaryTypographyProps={{ fontWeight: 600, fontSize: 14.5 }} />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Mobile top bar */}
      {!isDesktop && (
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
            <Wordmark />
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar: permanent on desktop, temporary on mobile */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }} aria-label="Main navigation">
        {isDesktop ? (
          <Drawer
            variant="permanent"
            open
            sx={{
              "& .MuiDrawer-paper": {
                width: DRAWER_WIDTH,
                boxSizing: "border-box",
                borderRight: `1px solid ${theme.palette.divider}`,
                backgroundImage: "none",
              },
            }}
          >
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" } }}
          >
            {drawerContent}
          </Drawer>
        )}
      </Box>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        {!isDesktop && <Toolbar />}
        {children}
      </Box>
    </Box>
  );
}
