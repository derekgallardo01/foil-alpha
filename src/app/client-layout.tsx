"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import darkTheme from "./theme";
import { SessionProvider } from "next-auth/react";
import { CurrencyProvider } from "./lib/currency-context";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      {isClient && (
        <SessionProvider>
          <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <CurrencyProvider>{children}</CurrencyProvider>
          </ThemeProvider>
        </SessionProvider>
      )}
    </>
  );
}
