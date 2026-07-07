"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import { AccountBalance, Close } from "@mui/icons-material";
import { toast } from "react-toastify";
import { formatPrice, formatDateTime } from "../lib/format";

interface Withdrawal {
  id: number;
  amount: number;
  status: "PENDING" | "PAID" | "REJECTED" | "CANCELLED";
  method: string | null;
  admin_note: string | null;
  requested_at: string;
}

const STATUS_COLOR: Record<Withdrawal["status"], "warning" | "success" | "error" | "default"> = {
  PENDING: "warning",
  PAID: "success",
  REJECTED: "error",
  CANCELLED: "default",
};

/** Request a payout of wallet balance; funds are held in escrow until an admin pays or rejects. */
export default function WithdrawFundsCard() {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/withdraw");
      if (res.ok) setWithdrawals((await res.json()).withdrawals ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const request = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), method: method.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Withdrawal request failed.");
        return;
      }
      toast.success("Withdrawal requested. Funds are held until it's processed.");
      setAmount("");
      setMethod("");
      load();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const cancel = async (id: number) => {
    try {
      const res = await fetch(`/api/wallet/withdraw?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not cancel.");
        return;
      }
      toast.success("Withdrawal cancelled.");
      load();
    } catch {
      toast.error("Something went wrong.");
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <AccountBalance sx={{ color: "primary.main" }} fontSize="small" />
          <Typography variant="h6">Withdraw funds</Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            type="number"
            size="small"
            label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            inputProps={{ min: 5, max: 10000 }}
            sx={{ width: 150, "& input": { fontFamily: (t) => t.typography.mono?.fontFamily } }}
          />
          <TextField
            size="small"
            label="Payout to (optional)"
            placeholder="PayPal, bank…"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            sx={{ width: 200 }}
          />
          <Button variant="contained" onClick={request} disabled={loading || !amount} startIcon={<AccountBalance />}>
            {loading ? "Requesting…" : "Request withdrawal"}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Requested funds are held in escrow and paid out by an admin. Minimum $5.
        </Typography>

        {withdrawals.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="overline" sx={{ color: "text.disabled" }}>
              Your requests
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
              {withdrawals.map((w) => (
                <Box key={w.id} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.5 }}>
                  <Typography variant="mono" sx={{ fontWeight: 700, minWidth: 84 }}>
                    {formatPrice(w.amount)}
                  </Typography>
                  <Chip size="small" label={w.status} color={STATUS_COLOR[w.status]} />
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                    {formatDateTime(w.requested_at)}
                    {w.method ? ` · ${w.method}` : ""}
                    {w.admin_note ? ` · ${w.admin_note}` : ""}
                  </Typography>
                  {w.status === "PENDING" && (
                    <Tooltip title="Cancel request">
                      <IconButton size="small" onClick={() => cancel(w.id)} aria-label="Cancel">
                        <Close fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
