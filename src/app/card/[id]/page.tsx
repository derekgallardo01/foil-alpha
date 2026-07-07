"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Container,
  Card,
  CardContent,
  Chip,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@mui/material";
import { OpenInNew, ArrowBack } from "@mui/icons-material";
import AppShell from "../../components/AppShell";
import GradientHeading from "../../components/ui/GradientHeading";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import PriceChart from "../../components/PriceChart";
import { formatPrice, formatTimeLeft, formatDateTime } from "../../lib/format";
import { getRarityHex } from "../../lib/rarity";

interface Listing {
  user_card_id: number;
  sale_type: string | null;
  condition: string | null;
  fixed_price: number | null;
  reserve_price: number | null;
  auction_end: string | null;
  seller_id: number;
  seller: string;
  seller_rating: { average: number; count: number } | null;
  current_bid: number | null;
  bid_count: number;
}

interface Sale {
  id: number;
  amount: number;
  seller: string;
  buyer: string;
  type: string;
  date: string;
}

interface CardDetail {
  id: number;
  name: string;
  set_name: string;
  card_number: string;
  total_set_number: string | null;
  rarity: string;
  card_type: string | null;
  hp: number | null;
  stage: string | null;
  artist: string | null;
  image_url: string | null;
  market_price: number | null;
  tcg_player_url: string | null;
}

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const [data, setData] = useState<{ card: CardDetail; listings: Listing[]; sales: Sale[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/cards/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("failed");
      setData({ card: json.card, listings: json.listings, sales: json.sales ?? [] });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isNaN(id)) load();
  }, [id, load]);

  return (
    <AppShell>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => router.push("/marketplace")} sx={{ mb: 2 }}>
          Marketplace
        </Button>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error || !data ? (
          <ErrorState message="We couldn't load this card." onRetry={load} />
        ) : (
          <>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  <Box
                    component="img"
                    src={data.card.image_url || undefined}
                    alt={data.card.name}
                    sx={{ width: 220, maxWidth: "100%", borderRadius: 2, alignSelf: "flex-start", bgcolor: "background.default" }}
                  />
                  <Box sx={{ flex: 1, minWidth: 260 }}>
                    <GradientHeading variant="h4" component="h1">
                      {data.card.name}
                    </GradientHeading>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
                      {data.card.set_name} · #{data.card.card_number}
                      {data.card.total_set_number ? `/${data.card.total_set_number}` : ""}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                      <Chip label={data.card.rarity} size="small" sx={{ bgcolor: getRarityHex(data.card.rarity), color: "#fff" }} />
                      {data.card.card_type && <Chip label={data.card.card_type} size="small" variant="outlined" />}
                      {data.card.hp != null && <Chip label={`${data.card.hp} HP`} size="small" variant="outlined" />}
                      {data.card.stage && <Chip label={data.card.stage} size="small" variant="outlined" />}
                    </Box>
                    {data.card.market_price != null && (
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {formatPrice(data.card.market_price)}
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          market price
                        </Typography>
                      </Typography>
                    )}
                    {data.card.artist && (
                      <Typography variant="body2" color="text.secondary">
                        Illustrated by {data.card.artist}
                      </Typography>
                    )}
                    {data.card.tcg_player_url && (
                      <Button
                        href={data.card.tcg_player_url}
                        target="_blank"
                        rel="noopener"
                        endIcon={<OpenInNew />}
                        sx={{ mt: 2 }}
                        variant="outlined"
                        size="small"
                      >
                        View on TCGplayer
                      </Button>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ mb: 3 }}>
              <PriceChart cardId={id} />
            </Box>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Available now ({data.listings.length})
                </Typography>
                {data.listings.length === 0 ? (
                  <EmptyState
                    title="No active listings"
                    description="No one is selling this card right now. Check back later or list yours from your collection."
                    minHeight={140}
                  />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Seller</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Price</TableCell>
                          <TableCell align="center">Ends</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.listings.map((l) => {
                          const isAuction = l.sale_type === "AUCTION";
                          const price = isAuction ? l.current_bid ?? l.reserve_price : l.fixed_price;
                          return (
                            <TableRow key={l.user_card_id} hover>
                              <TableCell>
                                <Box
                                  component="span"
                                  onClick={() => router.push(`/seller/${l.seller_id}`)}
                                  sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                                >
                                  {l.seller}
                                </Box>
                                {l.seller_rating && l.seller_rating.count > 0 ? (
                                  <Box component="span" sx={{ ml: 1, color: "warning.main", fontSize: 12, whiteSpace: "nowrap" }}>
                                    ★ {l.seller_rating.average}
                                    <Box component="span" sx={{ color: "text.secondary" }}> ({l.seller_rating.count})</Box>
                                  </Box>
                                ) : null}
                                {l.condition ? (
                                  <Box component="span" sx={{ color: "text.secondary", ml: 1, fontSize: 12 }}>
                                    {l.condition}
                                  </Box>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={isAuction ? `Auction${l.bid_count ? ` · ${l.bid_count} bids` : ""}` : "Fixed price"}
                                  color={isAuction ? "secondary" : "default"}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ fontFamily: (t) => t.typography.mono?.fontFamily, fontWeight: 700 }}>
                                  {price != null ? formatPrice(price) : "—"}
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                {isAuction && l.auction_end ? formatTimeLeft(l.auction_end) : "—"}
                              </TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() =>
                                    router.push(
                                      isAuction
                                        ? `/marketplace?auction=${l.user_card_id}`
                                        : `/marketplace?search=${encodeURIComponent(data.card.name)}`
                                    )
                                  }
                                >
                                  {isAuction ? "Bid" : "Buy"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            {data.sales.length > 0 && (
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Sale history
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Seller → Buyer</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Type</TableCell>
                          <TableCell align="right">Price</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.sales.map((s) => (
                          <TableRow key={s.id} hover>
                            <TableCell>{formatDateTime(s.date)}</TableCell>
                            <TableCell>
                              {s.seller} <Box component="span" sx={{ color: "text.secondary" }}>→</Box> {s.buyer}
                            </TableCell>
                            <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                              <Chip size="small" variant="outlined" label={s.type.replace(/_/g, " ")} />
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ fontFamily: (t) => t.typography.mono?.fontFamily, fontWeight: 700 }}>
                                {formatPrice(s.amount)}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Container>
    </AppShell>
  );
}
