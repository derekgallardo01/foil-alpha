"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Alert,
} from "@mui/material";
import { CreditCard } from "@mui/icons-material";
import { toast } from "react-toastify";

/** Real-money wallet top-up via Stripe Checkout. */
export default function AddFundsCard() {
  const [amount, setAmount] = useState("25");
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  const handleDeposit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not start checkout.");
        return;
      }
      if (data.url) window.location.href = data.url as string;
    } catch {
      toast.error("Something went wrong starting checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <CreditCard sx={{ color: "primary.main" }} fontSize="small" />
          <Typography variant="h6">Add funds</Typography>
        </Box>

        {notConfigured ? (
          <Alert severity="info">Card deposits aren&apos;t enabled yet.</Alert>
        ) : (
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              type="number"
              size="small"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ min: 1, max: 10000 }}
              sx={{ width: 160, "& input": { fontFamily: (t) => t.typography.mono?.fontFamily } }}
            />
            <Button variant="contained" onClick={handleDeposit} disabled={loading} startIcon={<CreditCard />}>
              {loading ? "Redirecting…" : "Add funds with card"}
            </Button>
            <Typography variant="caption" color="text.secondary">
              Secure checkout via Stripe.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
