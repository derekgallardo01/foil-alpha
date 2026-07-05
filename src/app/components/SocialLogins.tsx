"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getProviders, signIn } from "next-auth/react";
import { Box, Button, Divider, Typography } from "@mui/material";

type Brand = { label: string; bg: string; color: string; border?: string; icon: ReactNode };

const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const DiscordIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.32 4.37A19.79 19.79 0 0 0 15.4 3l-.24.5a13.7 13.7 0 0 1 4.06 2.05 16.2 16.2 0 0 0-14.44 0A13.7 13.7 0 0 1 8.84 3.5L8.6 3a19.79 19.79 0 0 0-4.92 1.37C.9 8.5.36 12.5.62 16.44a19.9 19.9 0 0 0 6.06 3.06c.49-.66.93-1.36 1.3-2.1-.71-.27-1.4-.6-2.04-1 .17-.13.34-.26.5-.4a14.24 14.24 0 0 0 12.12 0c.16.14.33.27.5.4-.65.4-1.34.73-2.05 1 .37.74.81 1.44 1.3 2.1a19.9 19.9 0 0 0 6.06-3.06c.3-4.56-.55-8.53-3.15-12.07zM9.68 14.17c-.98 0-1.79-.9-1.79-2s.79-2 1.79-2 1.8.9 1.79 2c0 1.1-.8 2-1.79 2zm4.64 0c-.98 0-1.79-.9-1.79-2s.79-2 1.79-2 1.8.9 1.79 2c0 1.1-.79 2-1.79 2z" />
  </svg>
);

const FacebookIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94" />
  </svg>
);

const XIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.9 1.5h3.68l-8.04 9.19L24 22.5h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.5h7.59l5.24 6.93L18.9 1.5zm-1.29 18.8h2.04L6.48 3.6H4.29l13.32 16.7z" />
  </svg>
);

const AppleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.36 12.78c.02 2.6 2.28 3.47 2.3 3.48-.02.06-.36 1.24-1.19 2.46-.72 1.06-1.47 2.11-2.65 2.13-1.16.02-1.53-.69-2.86-.69-1.32 0-1.74.67-2.83.71-1.14.04-2-.14-2.73-1.19-1.5-2.17-2.65-6.13-1.1-8.81.76-1.33 2.13-2.17 3.61-2.19 1.11-.02 2.16.75 2.84.75.68 0 1.95-.93 3.29-.79.56.02 2.13.23 3.14 1.7-.08.05-1.87 1.09-1.85 3.26M14.13 4.6c.6-.73 1.01-1.74.9-2.75-.87.03-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.65.97.08 1.96-.49 2.56-1.21" />
  </svg>
);

const BRANDS: Record<string, Brand> = {
  google: { label: "Continue with Google", bg: "#ffffff", color: "#3c4043", border: "1px solid #dadce0", icon: GoogleIcon },
  discord: { label: "Continue with Discord", bg: "#5865F2", color: "#ffffff", icon: DiscordIcon },
  facebook: { label: "Continue with Facebook", bg: "#1877F2", color: "#ffffff", icon: FacebookIcon },
  twitter: { label: "Continue with X", bg: "#000000", color: "#ffffff", icon: XIcon },
  apple: { label: "Continue with Apple", bg: "#000000", color: "#ffffff", icon: AppleIcon },
};

const ORDER = ["google", "apple", "facebook", "twitter", "discord"];

export default function SocialLogins({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    getProviders()
      .then((providers) => {
        if (!providers) return;
        const available = Object.keys(providers).filter((id) => id !== "credentials");
        available.sort((a, b) => {
          const ia = ORDER.indexOf(a);
          const ib = ORDER.indexOf(b);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        setIds(available);
      })
      .catch(() => setIds([]));
  }, []);

  if (ids.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ my: 2 }}>
        <Typography variant="caption" color="text.secondary">
          or continue with
        </Typography>
      </Divider>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {ids.map((id) => {
          const brand =
            BRANDS[id] ?? { label: `Continue with ${id}`, bg: "#333", color: "#fff", icon: null };
          return (
            <Button
              key={id}
              onClick={() => signIn(id, { callbackUrl })}
              fullWidth
              variant="contained"
              disableElevation
              startIcon={brand.icon}
              sx={{
                bgcolor: brand.bg,
                color: brand.color,
                border: brand.border ?? "none",
                textTransform: "none",
                fontWeight: 600,
                py: 1.1,
                "&:hover": { bgcolor: brand.bg, filter: "brightness(0.95)" },
              }}
            >
              {brand.label}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}
