"use client";

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
} from "@mui/material";
import { LocalOffer as BidsIcon, Gavel } from "@mui/icons-material";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import { TableRowsSkeleton } from "../../components/ui/Skeletons";
import { useRequireAuth } from "../../lib/useRequireAuth";
import { formatPriceNA as formatPrice, formatTimeLeft } from "../../lib/format";
import { useDashboardResource } from "../../lib/useDashboardResource";
import { useEventStream } from "../../lib/useEventStream";
import { hideBelowMd, hideBelowSm } from "../../lib/responsive";

interface MyBid {
  user_card_id: number;
  card: { id: number; name: string; set_name: string; image_url: string | null } | null;
  seller: string;
  my_bid: number;
  current_highest: number;
  is_winning: boolean;
  bid_count: number;
  auction_end: string | null;
  reserve_price: number | null;
  reserve_met: boolean;
  status: "winning" | "outbid" | "won" | "ended";
}

const STATUS: Record<MyBid["status"], { label: string; color: "success" | "warning" | "default" }> = {
  winning: { label: "Winning", color: "success" },
  won: { label: "Won", color: "success" },
  outbid: { label: "Outbid", color: "warning" },
  ended: { label: "Ended", color: "default" },
};

export default function MyBidsPage() {
  useRequireAuth();
  const router = useRouter();

  const { data: bids, loading, error, refetch } = useDashboardResource<MyBid>(
    "/api/bids/my-bids",
    { deps: [], refreshMs: 60000, loadingMode: "initial" }
  );

  // Live: refresh when a bid lands or an auction ends — you may have been outbid.
  useEventStream((e) => {
    if (e.type === "bid" || e.type === "outbid" || e.type === "auction_ended") refetch();
  });

  const activeCount = bids.filter((b) => b.status === "winning" || b.status === "outbid").length;
  const outbidCount = bids.filter((b) => b.status === "outbid").length;

  return (
    <AppShell>
      <PageHeader
        title="My Bids"
        icon={<BidsIcon />}
        subtitle={
          !loading && bids.length > 0
            ? `${activeCount} active${outbidCount ? ` · ${outbidCount} outbid` : ""}`
            : undefined
        }
        actions={
          <Button variant="outlined" onClick={() => router.push("/marketplace?filter=auction")}>
            Browse Auctions
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
                    <TableCell align="right">My Bid</TableCell>
                    <TableCell align="right" sx={hideBelowSm}>Highest</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center" sx={hideBelowSm}>Time Left</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRowsSkeleton rows={5} cols={7} />
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ border: 0 }}>
                        <ErrorState message="We couldn't load your bids." onRetry={refetch} />
                      </TableCell>
                    </TableRow>
                  ) : bids.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ border: 0 }}>
                        <EmptyState
                          icon={<Gavel />}
                          title="You're not bidding on anything yet"
                          description="Find an auction and place a bid — the ones you're bidding on show up here with live winning / outbid status."
                          action={
                            <Button variant="contained" onClick={() => router.push("/marketplace?filter=auction")}>
                              Browse Auctions
                            </Button>
                          }
                          minHeight={200}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    bids.map((b) => {
                      const s = STATUS[b.status];
                      const isLive = b.status === "winning" || b.status === "outbid";
                      return (
                        <TableRow key={b.user_card_id} hover>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              <Avatar
                                src={b.card?.image_url || undefined}
                                variant="rounded"
                                sx={{ width: 36, height: 50 }}
                              />
                              <Box sx={{ minWidth: 0 }}>
                                <Box sx={{ fontWeight: 600 }}>{b.card?.name}</Box>
                                <Box sx={{ fontSize: 12, color: "text.secondary" }}>{b.card?.set_name}</Box>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={hideBelowMd}>{b.seller}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ fontFamily: (t) => t.typography.mono?.fontFamily, fontWeight: 700 }}>
                              {formatPrice(b.my_bid)}
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={hideBelowSm}>
                            <Box
                              sx={{
                                fontFamily: (t) => t.typography.mono?.fontFamily,
                                color: b.is_winning ? "success.main" : "warning.main",
                              }}
                            >
                              {formatPrice(b.current_highest)}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip size="small" label={s.label} color={s.color} />
                          </TableCell>
                          <TableCell align="center" sx={hideBelowSm}>
                            {b.auction_end ? formatTimeLeft(b.auction_end) : "—"}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant={b.status === "outbid" ? "contained" : "outlined"}
                              color={b.status === "outbid" ? "warning" : "primary"}
                              disabled={!isLive}
                              onClick={() => router.push(`/marketplace?auction=${b.user_card_id}`)}
                            >
                              {b.status === "outbid" ? "Bid again" : "View"}
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
    </AppShell>
  );
}
