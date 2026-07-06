"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import darkTheme from "./theme";
import { SessionProvider } from "next-auth/react";
import { CurrencyProvider } from "./lib/currency-context";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
            <CurrencyProvider>
              {children}
              <ToastContainer position="top-right" autoClose={3000} />
            </CurrencyProvider>
          </ThemeProvider>
        </SessionProvider>
      )}
    </>
  );
}
