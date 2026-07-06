"use client";

import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Button } from "@mui/material";
import { History } from "@mui/icons-material";
import PriceChart from "./PriceChart";

/**
 * Shared price-history dialog (a chart + close button). Replaces the near-identical
 * copies previously inlined in the collection and marketplace pages.
 */
export default function PriceHistoryModal({
  open,
  onClose,
  cardId,
  userCardId,
  cardName,
}: {
  open: boolean;
  onClose: () => void;
  cardId?: number;
  userCardId?: number;
  cardName: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <History />
          Price History — {cardName}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ height: 600 }}>
        <PriceChart cardId={cardId} userCardId={userCardId} height={550} showUserPrice autoRefresh={false} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
