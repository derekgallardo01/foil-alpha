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
import { Favorite as WatchIcon } from "@mui/icons-material";
import AppShell from "../components/AppShell";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import { TableRowsSkeleton } from "../components/ui/Skeletons";
import WatchButton from "../components/WatchButton";
import { useRequireAuth } from "../lib/useRequireAuth";
import { formatPrice, formatTimeLeft } from "../lib/format";
import { useDashboardResource } from "../lib/useDashboardResource";
import { useEventStream } from "../lib/useEventStream";
import { hideBelowMd, hideBelowSm } from "../lib/responsive";

interface Watched {
  user_card_id: number;
  card: { id: number; name: string; set_name: string; image_url: string | null } | null;
  seller: string;
  sale_type: string | null;
  price: number | null;
  auction_end: string | null;
  is_for_sale: boolean;
  status: "live" | "ended";
}

export default function WatchingPage() {
  useRequireAuth();
  const router = useRouter();

  const { data: items, loading, error, refetch } = useDashboardResource<Watched>("/api/watch", {
    deps: [],
    refreshMs: 60000,
    loadingMode: "initial",
  });

  // Live: a bid or an auction ending changes a watched item's price/status.
  useEventStream((e) => {
    if (e.type === "bid" || e.type === "auction_ended") refetch();
  });

  return (
    <AppShell>
      <PageHeader
        title="Watching"
        icon={<WatchIcon />}
        subtitle={!loading && items.length > 0 ? `${items.length} saved` : undefined}
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
                    <TableCell padding="checkbox" />
                    <TableCell>Card</TableCell>
                    <TableCell sx={hideBelowMd}>Seller</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="center" sx={hideBelowSm}>Ends</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRowsSkeleton rows={5} cols={7} />
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ border: 0 }}>
                        <ErrorState message="We couldn't load your watchlist." onRetry={refetch} />
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ border: 0 }}>
                        <EmptyState
                          icon={<WatchIcon />}
                          title="You're not watching anything yet"
                          description="Tap the heart on a card or auction to save it here and get an alert when it's ending soon."
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
                    items.map((w) => {
                      const isAuction = w.sale_type === "AUCTION";
                      return (
                        <TableRow key={w.user_card_id} hover>
                          <TableCell padding="checkbox">
                            <WatchButton
                              userCardId={w.user_card_id}
                              initialWatching
                              onChange={(watching) => {
                                if (!watching) refetch();
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              <Avatar src={w.card?.image_url || undefined} variant="rounded" sx={{ width: 32, height: 44 }} />
                              <Box sx={{ minWidth: 0 }}>
                                <Box sx={{ fontWeight: 600 }}>{w.card?.name}</Box>
                                <Box sx={{ fontSize: 12, color: "text.secondary" }}>{w.card?.set_name}</Box>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={hideBelowMd}>{w.seller}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={w.status === "ended" ? "Ended" : isAuction ? "Auction" : "Fixed price"}
                              color={w.status === "ended" ? "default" : isAuction ? "secondary" : "default"}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ fontFamily: (t) => t.typography.mono?.fontFamily, fontWeight: 700 }}>
                              {w.price != null ? formatPrice(w.price) : "—"}
                            </Box>
                          </TableCell>
                          <TableCell align="center" sx={hideBelowSm}>
                            {isAuction && w.auction_end && w.status === "live" ? formatTimeLeft(w.auction_end) : "—"}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!w.card}
                              onClick={() => w.card && router.push(`/card/${w.card.id}`)}
                            >
                              View
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
