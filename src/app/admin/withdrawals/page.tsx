"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Container,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { AccountBalance as WithdrawIcon } from "@mui/icons-material";
import { toast } from "react-toastify";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import { TableRowsSkeleton } from "../../components/ui/Skeletons";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { formatPrice, formatDateTime } from "../../lib/format";
import { hideBelowMd } from "../../lib/responsive";

interface AdminWithdrawal {
  id: number;
  amount: number;
  status: "PENDING" | "PAID" | "REJECTED" | "CANCELLED";
  method: string | null;
  admin_note: string | null;
  requested_at: string;
  user: { id: number; name: string; email: string } | null;
}

const STATUS_COLOR: Record<string, "warning" | "success" | "error" | "default"> = {
  PENDING: "warning",
  PAID: "success",
  REJECTED: "error",
  CANCELLED: "default",
};

export default function AdminWithdrawalsPage() {
  useRequireAuth({ admin: true });
  const [status, setStatus] = useState<string>("PENDING");
  const [rows, setRows] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${status}`);
      if (res.ok) setRows((await res.json()).withdrawals ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: number, action: "pay" | "reject" | "retry_payout") => {
    if (action === "reject" && !confirm("Reject this withdrawal? The hold is released back to the user.")) return;
    if (action === "pay" && !confirm("Mark as PAID? This deducts the amount from the user's balance.")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed.");
        return;
      }
      // A settled withdrawal whose Stripe transfer failed needs a retry — surface
      // it loudly rather than as a plain success.
      if (data.payout?.transfer_error) {
        toast.error(`Marked paid, but the payout did NOT send: ${data.payout.transfer_error}. Use "Retry payout".`, { autoClose: false });
      } else if (action === "retry_payout") {
        toast.success(data.payout?.transfer_id ? "Payout sent." : "Payout still failed — check Stripe.");
      } else {
        toast.success(action === "pay" ? "Marked as paid." : "Rejected.");
      }
      load();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell variant="admin">
      <PageHeader
        title="Withdrawals"
        icon={<WithdrawIcon />}
        actions={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={status}
            onChange={(_e, v) => v && setStatus(v)}
          >
            <ToggleButton value="PENDING">Pending</ToggleButton>
            <ToggleButton value="PAID">Paid</ToggleButton>
            <ToggleButton value="REJECTED">Rejected</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Card>
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={hideBelowMd}>Payout to</TableCell>
                    <TableCell sx={hideBelowMd}>Requested</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRowsSkeleton rows={5} cols={6} />
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ border: 0 }}>
                        <EmptyState icon={<WithdrawIcon />} title={`No ${status.toLowerCase()} withdrawals`} minHeight={160} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((w) => (
                      <TableRow key={w.id} hover>
                        <TableCell>
                          <Box sx={{ fontWeight: 600 }}>{w.user?.name ?? `User #${w.user?.id ?? "?"}`}</Box>
                          <Box sx={{ fontSize: 12, color: "text.secondary" }}>{w.user?.email}</Box>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ fontFamily: (t) => t.typography.mono?.fontFamily, fontWeight: 700 }}>
                            {formatPrice(w.amount)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={w.status} color={STATUS_COLOR[w.status] ?? "default"} />
                        </TableCell>
                        <TableCell sx={hideBelowMd}>{w.method || "—"}</TableCell>
                        <TableCell sx={hideBelowMd}>{formatDateTime(w.requested_at)}</TableCell>
                        <TableCell align="right">
                          {w.status === "PENDING" ? (
                            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                              <Button size="small" color="error" onClick={() => act(w.id, "reject")} disabled={busyId === w.id}>
                                Reject
                              </Button>
                              <Button size="small" variant="contained" onClick={() => act(w.id, "pay")} disabled={busyId === w.id}>
                                Mark paid
                              </Button>
                            </Box>
                          ) : w.status === "PAID" && (w.admin_note || "").includes("Payout not sent") ? (
                            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", alignItems: "center" }}>
                              <Box sx={{ fontSize: 12, color: "error.main" }}>Payout failed</Box>
                              <Button size="small" variant="contained" color="warning" onClick={() => act(w.id, "retry_payout")} disabled={busyId === w.id}>
                                Retry payout
                              </Button>
                            </Box>
                          ) : (
                            <Box sx={{ fontSize: 12, color: "text.secondary" }}>{w.admin_note || "—"}</Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>
    </AppShell>
  );
}
