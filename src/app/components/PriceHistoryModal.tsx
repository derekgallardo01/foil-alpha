"use client";

import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Button, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth fullScreen={fullScreen}>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <History />
          Price History — {cardName}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ height: { xs: "auto", sm: 600 } }}>
        <PriceChart cardId={cardId} userCardId={userCardId} height={fullScreen ? 360 : 550} showUserPrice autoRefresh={false} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
