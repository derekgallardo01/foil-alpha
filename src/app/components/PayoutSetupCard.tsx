"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, Box, Typography, Button, Chip, CircularProgress } from "@mui/material";
import { AccountBalanceWallet, CheckCircle } from "@mui/icons-material";
import { toast } from "react-toastify";

interface ConnectStatus {
  enabled: boolean;
  hasAccount: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

/**
 * Seller payout onboarding (Stripe Connect). Renders nothing when Connect isn't
 * enabled — withdrawals then fall back to manual admin payouts.
 */
export default function PayoutSetupCard() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/wallet/connect");
        if (res.ok) setStatus(await res.json());
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/wallet/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not start onboarding.");
        return;
      }
      if (data.url) window.location.href = data.url as string;
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setStarting(false);
    }
  };

  // Dormant until Connect is enabled on the Stripe account.
  if (loading || !status || !status.enabled) return null;

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
          <AccountBalanceWallet sx={{ color: "primary.main" }} fontSize="small" />
          <Typography variant="h6">Payout account</Typography>
          {status.payoutsEnabled && (
            <Chip size="small" color="success" icon={<CheckCircle sx={{ fontSize: 15 }} />} label="Ready" />
          )}
        </Box>

        {status.payoutsEnabled ? (
          <Typography variant="body2" color="text.secondary">
            Your payout account is set up — approved withdrawals are sent to your bank automatically.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {status.hasAccount
                ? "Finish setting up your payout account to receive withdrawals to your bank."
                : "Set up a payout account to withdraw your balance to your bank."}
            </Typography>
            <Button variant="contained" onClick={start} disabled={starting} startIcon={<AccountBalanceWallet />}>
              {starting ? "Redirecting…" : status.hasAccount ? "Finish setup" : "Set up payouts"}
            </Button>
          </>
        )}
        {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
      </CardContent>
    </Card>
  );
}
