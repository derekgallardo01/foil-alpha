"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Typography,
} from "@mui/material";
import { ReceiptLong as ReceiptIcon, Print as PrintIcon } from "@mui/icons-material";
import AppShell from "../components/AppShell";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import { TableRowsSkeleton } from "../components/ui/Skeletons";
import { useRequireAuth } from "../lib/useRequireAuth";
import { formatPrice, formatDateTime } from "../lib/format";
import { useDashboardResource } from "../lib/useDashboardResource";
import { hideBelowMd, hideBelowSm } from "../lib/responsive";

interface Purchase {
  id: number;
  card: { id: number; name: string; set_name: string; rarity: string; image_url: string | null } | null;
  condition: string | null;
  amount: number;
  seller: string;
  status: string;
  type: string;
  purchased_at: string;
  created_at: string;
  notes: string | null;
}

const STATUS: Record<string, { label: string; color: "success" | "warning" | "error" | "default" }> = {
  COMPLETED: { label: "Completed", color: "success" },
  PENDING_BUYER_CONFIRMATION: { label: "Awaiting confirmation", color: "warning" },
  DECLINED: { label: "Declined", color: "error" },
  CANCELLED: { label: "Cancelled", color: "default" },
  EXPIRED: { label: "Expired", color: "default" },
};

const statusOf = (s: string) => STATUS[s] ?? { label: s.replace(/_/g, " ").toLowerCase(), color: "default" as const };

export default function PurchasesPage() {
  useRequireAuth();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Purchase | null>(null);

  const { data: purchases, loading, error, refetch } = useDashboardResource<Purchase>("/api/purchases", { deps: [] });

  const completed = purchases.filter((p) => p.status === "COMPLETED").length;

  return (
    <AppShell>
      <PageHeader
        title="My Purchases"
        icon={<ReceiptIcon />}
        subtitle={!loading && purchases.length > 0 ? `${completed} completed` : undefined}
        actions={
          <Button variant="outlined" onClick={() => router.push("/marketplace")}>
            Browse Marketplace
          </Button>
        }
      />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Card>
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Card</TableCell>
                    <TableCell sx={hideBelowMd}>Seller</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell sx={hideBelowSm}>Date</TableCell>
                    <TableCell align="right">Receipt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRowsSkeleton rows={5} cols={6} />
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ border: 0 }}>
                        <ErrorState message="We couldn't load your purchases." onRetry={refetch} />
                      </TableCell>
                    </TableRow>
                  ) : purchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ border: 0 }}>
                        <EmptyState
                          icon={<ReceiptIcon />}
                          title="No purchases yet"
                          description="Cards you buy or win at auction will show up here with a receipt."
                          action={
                            <Button variant="contained" onClick={() => router.push("/marketplace")}>
                              Browse Marketplace
                            </Button>
                          }
                          minHeight={200}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    purchases.map((p) => {
                      const s = statusOf(p.status);
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              <Avatar src={p.card?.image_url || undefined} variant="rounded" sx={{ width: 36, height: 50 }} />
                              <Box sx={{ minWidth: 0 }}>
                                <Box sx={{ fontWeight: 600 }}>{p.card?.name ?? "Card"}</Box>
                                <Box sx={{ fontSize: 12, color: "text.secondary" }}>{p.card?.set_name}</Box>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={hideBelowMd}>{p.seller}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ fontFamily: (t) => t.typography.mono?.fontFamily, fontWeight: 700 }}>
                              {formatPrice(p.amount)}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip size="small" label={s.label} color={s.color} />
                          </TableCell>
                          <TableCell sx={hideBelowSm}>{formatDateTime(p.created_at)}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={p.status !== "COMPLETED"}
                              onClick={() => setReceipt(p)}
                            >
                              Receipt
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>

      <Dialog open={!!receipt} onClose={() => setReceipt(null)} maxWidth="xs" fullWidth>
        {receipt && (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ReceiptIcon color="primary" /> Receipt
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <Avatar src={receipt.card?.image_url || undefined} variant="rounded" sx={{ width: 48, height: 66 }} />
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{receipt.card?.name ?? "Card"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {receipt.card?.set_name}
                    {receipt.condition ? ` · ${receipt.condition}` : ""}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              {[
                ["Order #", `#${receipt.id}`],
                ["Seller", receipt.seller],
                ["Type", receipt.type.replace(/_/g, " ")],
                ["Date", formatDateTime(receipt.purchased_at)],
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{v}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Typography sx={{ fontWeight: 700 }}>Total paid</Typography>
                <Typography sx={{ fontWeight: 700, fontFamily: (t) => t.typography.mono?.fontFamily }}>
                  {formatPrice(receipt.amount)}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setReceipt(null)}>Close</Button>
              <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
                Print
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </AppShell>
  );
}
