"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider, CssBaseline, Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import darkTheme from "./theme";
import { SessionProvider, useSession } from "next-auth/react";
import AuctionNotifications from "./components/AuctionNotifications";
import { CurrencyProvider } from "./lib/currency-context";
import { usePathname } from "next/navigation";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Component to display Discord status and notifications with smart positioning
  const HeaderStatus = () => {
    const { data: session, status } = useSession();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const pathname = usePathname();
    const isConnected = status === "authenticated";

    // Determine positioning based on page type
    const getPositioning = () => {
      const isAdminPage = pathname?.startsWith('/admin');
      const isDashboardPage = pathname === '/dashboard';

      if (isMobile) {
        return {
          top: 8,
          right: 8,
          transform: 'none',
        };
      }

      if (isAdminPage) {
        return {
          top: 16,
          right: 16,
          transform: 'none',
        };
      }

      return {
        top: 16,
        right: 20,
        transform: 'none',
      };
    };

    const positioning = getPositioning();

    return (
      <Box
        sx={{
          position: "fixed",
          ...positioning,
          display: "flex",
          flexDirection: isMobile ? "column-reverse" : "row",
          alignItems: "flex-end",
          gap: isMobile ? 0.5 : 1.5,
          zIndex: 9999, // Very high z-index to overlay everything
          pointerEvents: "none", // Allow clicks to pass through the container
          "& > *": {
            pointerEvents: "auto", // But enable clicks on child elements
          }
        }}
      >
        {/* Discord Status - Compact overlay style */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.8,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(12px)",
            borderRadius: 3,
            px: 1.2,
            py: 0.6,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            minWidth: "fit-content",
            transition: "all 0.3s ease",
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.85)",
              transform: "translateY(-1px)",
              boxShadow: "0 6px 25px rgba(0, 0, 0, 0.4)",
            }
          }}
        >
          <Box
            sx={{
              width: isMobile ? 6 : 8,
              height: isMobile ? 6 : 8,
              borderRadius: "50%",
              bgcolor: isConnected ? "#4caf50" : "#f44336",
              boxShadow: isConnected
                ? `0 0 12px #4caf50`
                : `0 0 12px #f44336`,
              flexShrink: 0,
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: "#ffffff",
              fontSize: isMobile ? "0.6rem" : "0.7rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {isMobile
              ? (isConnected ? "ON" : "OFF")
              : (isConnected ? "Connected" : "Offline")
            }
          </Typography>
        </Box>

        {/* Notifications - only show when authenticated */}
        {isConnected && session?.user?.id && (
          <Box
            sx={{
              "& .MuiIconButton-root": {
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                transition: "all 0.3s ease",
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.85)",
                  transform: "translateY(-1px)",
                  boxShadow: "0 6px 25px rgba(0, 0, 0, 0.4)",
                }
              }
            }}
          >
            <AuctionNotifications userId={parseInt(session.user.id)} />
          </Box>
        )}
      </Box>
    );
  };

  return (
    <>
      {isClient && (
        <SessionProvider>
          <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <CurrencyProvider>
              <HeaderStatus />
              {children}
            </CurrencyProvider>
          </ThemeProvider>
        </SessionProvider>
      )}
    </>
  );
}