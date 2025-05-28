"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider, CssBaseline, Box, Typography } from "@mui/material";
import darkTheme from "./theme";
import { SessionProvider, useSession } from "next-auth/react";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Component to display Discord status
  const DiscordStatus = () => {
    const { status } = useSession();
    const isConnected = status === "authenticated";
    
    return (
      <Box
        sx={{
          position: "fixed",
          top: 10,
          right: 10,
          display: "flex",
          alignItems: "center",
          gap: 1,
          zIndex: 1000,
        }}
      >
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
    );
  };

  return (
    <>
      {isClient && (
        <SessionProvider>
          <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <DiscordStatus /> {/* Add status indicator */}
            {children}
          </ThemeProvider>
        </SessionProvider>
      )}
    </>
  );
}