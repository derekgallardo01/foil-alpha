"use client";

import { useState } from "react";
import {
    Box,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    CircularProgress
} from "@mui/material";
import Grid from '@mui/material/Grid2';
import { toast } from "react-toastify";

// Bulk Price Update Modal Component
export default function BulkPriceUpdateModal({
    open,
    onClose,
    selectedCards,
    onUpdateComplete
}: {
    open: boolean;
    onClose: () => void;
    selectedCards: number[];
    onUpdateComplete: () => void;
}) {
    const [updating, setUpdating] = useState(false);
    const [results, setResults] = useState<any>(null);

    const handleBulkUpdate = async () => {
        try {
            setUpdating(true);
            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardIds: selectedCards,
                    force: true,
                    batchSize: 10,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setResults(data.result);
                onUpdateComplete();
                toast.success(`Updated prices for ${data.result.successful_updates} cards`);
            } else {
                toast.error(data.error || 'Failed to update prices');
            }
        } catch (error) {
            toast.error('Failed to update prices');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Bulk Price Update</DialogTitle>
            <DialogContent>
                {!results ? (
                    <Box>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Update market prices for {selectedCards.length} selected cards using the latest pricing data.
                        </Typography>
                        <Alert severity="info">
                            This will fetch the latest market prices from Pokemon Price Tracker API.
                        </Alert>
                    </Box>
                ) : (
                    <Box>
                        <Alert severity="success" sx={{ mb: 2 }}>
                            Price update completed!
                        </Alert>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 4 }}>
                                <Typography variant="mono" component="div" align="center" sx={{ fontSize: 30, fontWeight: 700, color: 'success.main' }}>
                                    {results.successful_updates}
                                </Typography>
                                <Typography variant="body2" align="center">Updated</Typography>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <Typography variant="mono" component="div" align="center" sx={{ fontSize: 30, fontWeight: 700, color: 'warning.main' }}>
                                    {results.skipped_cards}
                                </Typography>
                                <Typography variant="body2" align="center">Skipped</Typography>
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <Typography variant="mono" component="div" align="center" sx={{ fontSize: 30, fontWeight: 700, color: 'error.main' }}>
                                    {results.failed_updates}
                                </Typography>
                                <Typography variant="body2" align="center">Failed</Typography>
                            </Grid>
                        </Grid>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>
                    {results ? 'Close' : 'Cancel'}
                </Button>
                {!results && (
                    <Button
                        variant="contained"
                        onClick={handleBulkUpdate}
                        disabled={updating}
                    >
                        {updating ? <CircularProgress size={20} /> : 'Update Prices'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
