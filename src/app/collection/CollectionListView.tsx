"use client";

import {
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, Box, Typography, Chip, IconButton, Button, Tooltip,
} from "@mui/material";
import { Timeline, WorkspacePremium, Inventory2 } from "@mui/icons-material";
import { formatPrice } from "../lib/format";
import type { EnhancedUserCard } from "./collection-client";

/** Compact, scannable list/table view of the collection (horizontally scrollable). */
export default function CollectionListView({
  cards,
  onShowPriceHistory,
  onSellCard,
  onRemoveFromSale,
}: {
  cards: EnhancedUserCard[];
  onShowPriceHistory: (card: EnhancedUserCard) => void;
  onSellCard: (card: EnhancedUserCard) => void;
  onRemoveFromSale: (cardId: number, cardName: string) => void;
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" sx={{ "& td, & th": { borderColor: "divider" } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: "text.secondary", fontWeight: 700 }}>Item</TableCell>
            <TableCell sx={{ color: "text.secondary", fontWeight: 700 }}>Set</TableCell>
            <TableCell sx={{ color: "text.secondary", fontWeight: 700 }}>Type</TableCell>
            <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 700 }}>Qty</TableCell>
            <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 700 }}>Value</TableCell>
            <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 700 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cards.map((c) => {
            const sealed = c.card.product_type === "SEALED";
            const price = c.card.market_price || 0;
            return (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      component="img"
                      src={c.card.image_url || "/placeholder-card.png"}
                      alt={c.card.name}
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-card.png"; }}
                      sx={{ width: 30, height: 42, objectFit: "contain", bgcolor: "background.default", borderRadius: 0.5, flexShrink: 0 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{c.card.name.trim()}</Typography>
                      {c.card.rarity && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                          {c.card.rarity}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap>{c.card.set_name}</Typography>
                </TableCell>
                <TableCell>
                  {c.is_graded ? (
                    <Chip size="small" color="secondary" icon={<WorkspacePremium sx={{ fontSize: 14 }} />} label="Graded" />
                  ) : sealed ? (
                    <Chip size="small" color="info" icon={<Inventory2 sx={{ fontSize: 14 }} />} label="Sealed" />
                  ) : (
                    <Chip size="small" variant="outlined" label={c.condition} />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="mono">{c.quantity}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="mono" sx={{ fontWeight: 700 }}>{price > 0 ? formatPrice(price) : "—"}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", alignItems: "center" }}>
                    <Tooltip title="Price history">
                      <IconButton size="small" onClick={() => onShowPriceHistory(c)} aria-label="Price history">
                        <Timeline sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    {c.is_for_sale ? (
                      <Button size="small" color="error" onClick={() => onRemoveFromSale(c.id, c.card.name)}>Unlist</Button>
                    ) : (
                      <Button size="small" variant="outlined" onClick={() => onSellCard(c)}>Sell</Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
