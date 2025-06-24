"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider, CssBaseline, Box, Typography } from "@mui/material";
import darkTheme from "./theme";
import { SessionProvider, useSession } from "next-auth/react";
import AuctionNotifications from "./components/AuctionNotifications";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Component to display Discord status and notifications
  const HeaderStatus = () => {
    const { data: session, status } = useSession();
    const isConnected = status === "authenticated";

    return (
      <Box
        sx={{
          position: "fixed",
          top: 10,
          right: 10,
          display: "flex",
          alignItems: "center",
          gap: 2,
          zIndex: 1000,
        }}
      >
        {/* Notifications - only show when authenticated */}
        {isConnected && session?.user?.id && (
          <AuctionNotifications userId={parseInt(session.user.id)} />
        )}

        {/* Discord Status */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              bgcolor: isConnected ? "#4caf50" : "#f44336", // Green for connected, red for disconnected
              boxShadow: isConnected
                ? "0 0 8px #4caf50"
                : "0 0 8px #f44336", // Glow effect
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: "#e0e0e0", fontSize: "0.8rem" }}
          >
            Discord: {isConnected ? "Connected" : "Disconnected"}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <>
      {isClient && (
        <SessionProvider>
          <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <HeaderStatus />
            {children}
          </ThemeProvider>
        </SessionProvider>
      )}
    </>
  );
}