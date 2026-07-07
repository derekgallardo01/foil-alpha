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
  Rating,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  CircularProgress,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import AppShell from "../../components/AppShell";
import GradientHeading from "../../components/ui/GradientHeading";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import { formatPrice, formatDateTime } from "../../lib/format";

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  reviewer: string;
  created_at: string;
}

interface Listing {
  user_card_id: number;
  card: { id: number; name: string; set_name: string; image_url: string | null } | null;
  sale_type: string | null;
  condition: string | null;
  fixed_price: number | null;
  reserve_price: number | null;
  auction_end: string | null;
  current_bid: number | null;
}

interface SellerData {
  seller: { id: number; name: string };
  rating: { average: number; count: number };
  reviews: Review[];
  listings: Listing[];
}

export default function SellerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const [data, setData] = useState<SellerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/sellers/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("failed");
      setData(json);
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
        <Button startIcon={<ArrowBack />} onClick={() => router.back()} sx={{ mb: 2 }}>
          Back
        </Button>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error || !data ? (
          <ErrorState message="We couldn't load this seller." onRetry={load} />
        ) : (
          <>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                  <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.main" }}>
                    {data.seller.name?.[0]?.toUpperCase() ?? "?"}
                  </Avatar>
                  <Box>
                    <GradientHeading variant="h4" component="h1">
                      {data.seller.name}
                    </GradientHeading>
                    {data.rating.count > 0 ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Rating value={data.rating.average} precision={0.1} readOnly size="small" />
                        <Typography variant="body2" color="text.secondary">
                          {data.rating.average} · {data.rating.count} review{data.rating.count === 1 ? "" : "s"}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No reviews yet
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Active listings ({data.listings.length})
                </Typography>
                {data.listings.length === 0 ? (
                  <EmptyState title="No active listings" description="This seller has nothing listed right now." minHeight={120} />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Card</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Price</TableCell>
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
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                  <Avatar src={l.card?.image_url || undefined} variant="rounded" sx={{ width: 32, height: 44 }} />
                                  <Box>
                                    <Box sx={{ fontWeight: 600 }}>{l.card?.name}</Box>
                                    <Box sx={{ fontSize: 12, color: "text.secondary" }}>{l.card?.set_name}</Box>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip size="small" label={isAuction ? "Auction" : "Fixed price"} color={isAuction ? "secondary" : "default"} />
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ fontFamily: (t) => t.typography.mono?.fontFamily, fontWeight: 700 }}>
                                  {price != null ? formatPrice(price) : "—"}
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Button size="small" variant="outlined" disabled={!l.card} onClick={() => l.card && router.push(`/card/${l.card.id}`)}>
                                  View
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

            {data.reviews.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Reviews
                  </Typography>
                  {data.reviews.map((r, i) => (
                    <Box key={r.id} sx={{ py: 1.5, borderTop: i === 0 ? 0 : 1, borderColor: "divider" }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                        <Rating value={r.rating} readOnly size="small" />
                        <Typography variant="caption" color="text.secondary">
                          {r.reviewer} · {formatDateTime(r.created_at)}
                        </Typography>
                      </Box>
                      {r.comment && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {r.comment}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Container>
    </AppShell>
  );
}
