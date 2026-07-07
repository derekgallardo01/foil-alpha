"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  ListSubheader,
  IconButton,
  Divider,
  Typography,
  Chip,
  useMediaQuery,
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
  LocalOffer as MyBidsIcon,
  ReceiptLong as PurchasesIcon,
  AdminPanelSettings as AdminIcon,
  People as PeopleIcon,
  History as HistoryIcon,
  HowToReg as WaitlistIcon,
  Percent as CommissionIcon,
  AccountBalance as PlatformIcon,
  Payments as PaymentsIcon,
  Assessment as ReportIcon,
  Style as CardsIcon,
  ListAlt as ListingsIcon,
  PriceChange as PricingIcon,
  ReceiptLong as TxnIcon,
  PendingActions as PendingIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import CurrencySelector from "./CurrencySelector";
import AuctionNotifications from "./AuctionNotifications";
import CommandPalette, { Command } from "./CommandPalette";

const DRAWER_WIDTH = 248;

type NavItem = { label: string; path: string; icon: React.ReactNode };
type NavSection = { heading?: string; items: NavItem[] };

const USER_NAV: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { label: "Marketplace", path: "/marketplace", icon: <StorefrontIcon /> },
  { label: "Watchlist", path: "/watchlist", icon: <WatchIcon /> },
  { label: "Collection", path: "/collection", icon: <CollectionsIcon /> },
  { label: "Wallet", path: "/wallet", icon: <WalletIcon /> },
  { label: "My Sales", path: "/selling/dashboard", icon: <SellIcon /> },
  { label: "My Auctions", path: "/bids/my-auctions", icon: <AuctionIcon /> },
  { label: "My Bids", path: "/bids/my-bids", icon: <MyBidsIcon /> },
  { label: "My Purchases", path: "/purchases", icon: <PurchasesIcon /> },
  { label: "Notifications", path: "/notifications", icon: <NotificationsIcon /> },
  { label: "Settings", path: "/settings", icon: <SettingsIcon /> },
  { label: "Chat", path: "/chat", icon: <ChatIcon /> },
];

const ADMIN_SECTIONS: NavSection[] = [
  { items: [{ label: "Dashboard", path: "/admin/dashboard", icon: <DashboardIcon /> }] },
  {
    heading: "Users",
    items: [
      { label: "All Users", path: "/admin/users", icon: <PeopleIcon /> },
      { label: "User Activity", path: "/admin/users/activity", icon: <HistoryIcon /> },
      { label: "Waitlist", path: "/admin/waitlist-signups", icon: <WaitlistIcon /> },
    ],
  },
  {
    heading: "Finance",
    items: [
      { label: "Wallets", path: "/admin/wallet", icon: <WalletIcon /> },
      { label: "Commission", path: "/admin/commission", icon: <CommissionIcon /> },
      { label: "Platform Wallet", path: "/admin/commission/wallet", icon: <PlatformIcon /> },
      { label: "Withdrawals", path: "/admin/withdrawals", icon: <PaymentsIcon /> },
      { label: "Reports", path: "/admin/commission/reports", icon: <ReportIcon /> },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { label: "Cards", path: "/admin/cards", icon: <CardsIcon /> },
      { label: "Listings", path: "/admin/listings", icon: <ListingsIcon /> },
      { label: "Pricing", path: "/admin/pricing/update", icon: <PricingIcon /> },
    ],
  },
  {
    heading: "Trading",
    items: [
      { label: "Auctions", path: "/admin/auctions", icon: <AuctionIcon /> },
      { label: "Transactions", path: "/admin/transactions", icon: <TxnIcon /> },
      { label: "Pending", path: "/admin/transactions/pending", icon: <PendingIcon /> },
    ],
  },
];

/** The iridescent brand wordmark (Holo signature moment). */
function Wordmark() {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, userSelect: "none" }}>
      <Typography component="span" sx={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em" }}>
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
 * content: `<AppShell><PageContent/></AppShell>`. Pass variant="admin" for the
 * admin console navigation.
 */
export default function AppShell({
  children,
  variant = "user",
}: {
  children: React.ReactNode;
  variant?: "user" | "admin";
}) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl+K toggles the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isAdminUser = session?.user?.role === "admin";
  const isAdminView = variant === "admin";

  const isActive = (path: string) => {
    if (pathname === path) return true;
    if (path === "/dashboard" || path === "/admin/dashboard") return false;
    return !!pathname?.startsWith(path);
  };

  const go = (path: string) => {
    router.push(path);
    setMobileOpen(false);
  };

  const sections: NavSection[] = isAdminView
    ? ADMIN_SECTIONS
    : [
        {
          items: isAdminUser
            ? [...USER_NAV, { label: "Admin Panel", path: "/admin/dashboard", icon: <AdminIcon /> }]
            : USER_NAV,
        },
      ];

  // Flatten every visible nav destination (+ Log out) into palette commands.
  const commands: Command[] = useMemo(() => {
    const list: Command[] = sections.flatMap((section) =>
      section.items.map((item) => ({
        id: `nav:${item.path}`,
        label: item.label,
        group: section.heading ?? "Navigate",
        icon: item.icon,
        run: () => go(item.path),
      }))
    );
    list.push({
      id: "action:logout",
      label: "Log out",
      group: "Actions",
      icon: <LogoutIcon />,
      run: () => signOut({ callbackUrl: "/login" }),
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const navButton = (item: NavItem) => {
    const active = isActive(item.path);
    const isAdminLink = item.path === "/admin/dashboard" && !isAdminView;
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
          "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "action.selected" },
          "&:hover": { bgcolor: "action.hover", color: "text.primary" },
        }}
      >
        <ListItemIcon>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: 14.5 }} />
      </ListItemButton>
    );
  };

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
      <Toolbar sx={{ px: 2.5, gap: 1 }}>
        <Wordmark />
        {isAdminView && (
          <Typography variant="overline" sx={{ color: "primary.main", ml: 0.5 }}>
            Admin
          </Typography>
        )}
        {session?.user?.id && (
          <Box sx={{ ml: "auto" }}>
            <AuctionNotifications userId={parseInt(session.user.id)} />
          </Box>
        )}
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
          {isAdminUser && (
            <Typography variant="caption" color="primary.main" fontWeight={700}>
              Administrator
            </Typography>
          )}
        </Box>
      )}

      {!isAdminView && !isAdminUser && (
        <Box sx={{ px: 2.5, pb: 1 }}>
          <CurrencySelector size="small" />
        </Box>
      )}

      <Divider />

      <Box sx={{ px: 1.5, pt: 1 }}>
        <ListItemButton
          onClick={() => {
            setPaletteOpen(true);
            setMobileOpen(false);
          }}
          sx={{
            borderRadius: 2,
            color: "text.secondary",
            border: 1,
            borderColor: "divider",
            "& .MuiListItemIcon-root": { color: "text.secondary", minWidth: 34 },
            "&:hover": { bgcolor: "action.hover", color: "text.primary" },
          }}
        >
          <ListItemIcon>
            <SearchIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Search" primaryTypographyProps={{ fontSize: 14 }} />
          <Chip label="⌘K" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: 11 } }} />
        </ListItemButton>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: "auto", px: 1.5, py: 1 }}>
        {sections.map((section, i) => (
          <List
            key={section.heading ?? `sec-${i}`}
            dense
            subheader={
              section.heading ? (
                <ListSubheader
                  disableSticky
                  sx={{ bgcolor: "transparent", color: "text.disabled", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", lineHeight: 2.4 }}
                >
                  {section.heading.toUpperCase()}
                </ListSubheader>
              ) : undefined
            }
          >
            {section.items.map(navButton)}
          </List>
        ))}
        {isAdminView && (
          <>
            <Divider sx={{ my: 1 }} />
            <List dense>{navButton({ label: "Back to App", path: "/dashboard", icon: <BackIcon /> })}</List>
          </>
        )}
      </Box>

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
      {!isDesktop && (
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
            <Wordmark />
            <IconButton sx={{ ml: "auto" }} onClick={() => setPaletteOpen(true)} aria-label="Search">
              <SearchIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

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

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        {!isDesktop && <Toolbar />}
        {children}
      </Box>
    </Box>
  );
}
