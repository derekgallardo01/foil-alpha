"use client";

import { useState } from "react";
import {
    Box,
    Typography,
    CircularProgress,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Alert,
    Tooltip
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
    Sync,
    AttachMoney,
    PriceCheck,
    Warning
} from '@mui/icons-material';
import { toast } from "react-toastify";
import StatCard from "../../components/StatCard";
import { formatPrice } from "../../lib/format";
import { ProgressDisplay, useProgressTracker, formatNumber } from "./admin-cards-client";

// Enhanced Price Sync Modal Component with Progress Tracking
export default function PriceSyncModal({ open, onClose, onSyncComplete }: {
    open: boolean;
    onClose: () => void;
    onSyncComplete?: (results: any) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [syncStrategy, setSyncStrategy] = useState('AUTO');
    const [batchSize, setBatchSize] = useState(20);
    const [maxAgeHours, setMaxAgeHours] = useState(24);
    const [syncResults, setSyncResults] = useState<any>(null);
    const [error, setError] = useState('');

    // Progress tracking
    const { progress, startProgress, updateProgress, updateStats, completeProgress, resetProgress } = useProgressTracker();

    const handleStartSync = async () => {
        try {
            setLoading(true);
            setError('');
            setSyncResults(null);

            // Start progress tracking for price sync
            startProgress(100, 'Syncing card prices...');

            let processed = 0;
            const progressInterval = setInterval(() => {
                if (processed < 95) { // Don't complete until we get the actual results
                    processed += Math.floor(Math.random() * 5) + 1;
                    processed = Math.min(processed, 95);
                    updateProgress(processed, 'Fetching price data from APIs...', 'importing');
                }
            }, 300);

            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    force: false,
                    batchSize,
                    maxAgeHours,
                    pricingStrategy: syncStrategy,
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();

            if (data.success) {
                const completed = data.result.successful_updates || 0;
                const failed = data.result.failed_updates || 0;
                const skipped = data.result.skipped_cards || 0;

                updateStats(completed, failed, skipped);
                updateProgress(100, 'Price sync completed', 'completed');
                completeProgress({ completed, failed, skipped });

                setSyncResults(data.result);
                onSyncComplete?.(data.result);
                toast.success(`Price sync completed! ${formatNumber(data.result.successful_updates)} cards updated.`);
            } else {
                setError(data.error || 'Sync failed');
                updateProgress(100, 'Price sync failed', 'error');
                toast.error(data.error || 'Price sync failed');
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMsg);
            updateProgress(100, 'Price sync failed', 'error');
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleForceSync = async () => {
        if (!confirm('Force sync will update ALL cards regardless of last update time. This may take a while. Continue?')) {
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Start progress tracking for force sync
            startProgress(100, 'Force syncing all card prices...');

            let processed = 0;
            const progressInterval = setInterval(() => {
                if (processed < 95) {
                    processed += Math.floor(Math.random() * 3) + 1;
                    processed = Math.min(processed, 95);
                    updateProgress(processed, 'Force updating all card prices...', 'importing');
                }
            }, 500);

            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    force: true,
                    batchSize: 10,
                    pricingStrategy: syncStrategy,
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();

            if (data.success) {
                const completed = data.result.successful_updates || 0;
                const failed = data.result.failed_updates || 0;
                const skipped = data.result.skipped_cards || 0;

                updateStats(completed, failed, skipped);
                updateProgress(100, 'Force sync completed', 'completed');
                completeProgress({ completed, failed, skipped });

                setSyncResults(data.result);
                onSyncComplete?.(data.result);
                toast.success(`Force sync completed! ${formatNumber(data.result.successful_updates)} cards updated.`);
            } else {
                setError(data.error || 'Force sync failed');
                updateProgress(100, 'Force sync failed', 'error');
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMsg);
            updateProgress(100, 'Force sync failed', 'error');
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            resetProgress();
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Sync />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        Sync Card Prices
                    </Typography>
                </Box>
            </DialogTitle>
            <DialogContent>
                {/* Progress Display */}
                <ProgressDisplay progress={progress} />

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {!syncResults ? (
                    <Box>
                        <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                            Update card prices using the Pokémon Price Tracker API for real-time market data.
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Sync Strategy</InputLabel>
                                    <Select
                                        value={syncStrategy}
                                        label="Sync Strategy"
                                        onChange={(e) => setSyncStrategy(e.target.value)}
                                        disabled={loading}
                                    >
                                        <MenuItem value="AUTO">Auto (Price Tracker + TCG API)</MenuItem>
                                        <MenuItem value="PRICE_TRACKER_ONLY">Price Tracker API Only</MenuItem>
                                        <MenuItem value="TCG_API_ONLY">Pokémon TCG API Only</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    label="Batch Size"
                                    type="number"
                                    value={batchSize}
                                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 20)}
                                    inputProps={{ min: 5, max: 50 }}
                                    fullWidth
                                    helperText="Cards processed per API call"
                                    disabled={loading}
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Update Cards Older Than (Hours)"
                                    type="number"
                                    value={maxAgeHours}
                                    onChange={(e) => setMaxAgeHours(parseInt(e.target.value) || 24)}
                                    inputProps={{ min: 1, max: 168 }}
                                    fullWidth
                                    helperText="Only update cards that haven't been updated in this time period"
                                    disabled={loading}
                                />
                            </Grid>
                        </Grid>

                        <Alert severity="info" sx={{ mt: 3 }} icon={<InfoOutlinedIcon />}>
                            <Typography variant="body2">
                                <strong>Rate Limits:</strong> The Pokémon Price Tracker API allows 60 requests per minute.
                                Large syncs will be automatically throttled to respect these limits. Progress will be tracked in real-time.
                            </Typography>
                        </Alert>
                    </Box>
                ) : (
                    <Box>
                        <Alert severity="success" sx={{ mb: 3 }}>
                            Price sync completed successfully!
                        </Alert>

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6, md: 3 }}>
                                <StatCard
                                    icon={<PriceCheck />}
                                    label="Cards Updated"
                                    value={formatNumber(syncResults.successful_updates)}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, md: 3 }}>
                                <StatCard
                                    icon={<Warning />}
                                    label="Skipped"
                                    value={formatNumber(syncResults.skipped_cards)}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, md: 3 }}>
                                <StatCard
                                    icon={<DeleteIcon />}
                                    label="Failed"
                                    value={formatNumber(syncResults.failed_updates)}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, md: 3 }}>
                                <StatCard
                                    icon={<AttachMoney />}
                                    label="Avg. Price"
                                    value={formatPrice(syncResults.pricing_summary?.avg_market_price)}
                                    accent
                                />
                            </Grid>
                        </Grid>

                        {syncResults.pricing_summary && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>Pricing Summary</Typography>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            API Pricing Success: {formatNumber(syncResults.pricing_summary.api_pricing_success || 0)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Fallback Pricing Used: {formatNumber(syncResults.pricing_summary.fallback_pricing_used || 0)}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Price Range: {formatPrice(syncResults.pricing_summary.price_range?.min)} - {formatPrice(syncResults.pricing_summary.price_range?.max)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Price Increases: {formatNumber(syncResults.pricing_summary.cards_with_increases || 0)}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}

                        {syncResults.errors && syncResults.errors.length > 0 && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" color="error" sx={{ mb: 2 }}>
                                    Errors ({formatNumber(syncResults.errors.length)})
                                </Typography>
                                <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'background.default', p: 2, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                                    {syncResults.errors.slice(0, 10).map((error: any, index: number) => (
                                        <Alert severity="error" key={index} sx={{ mb: 1 }}>
                                            <Typography variant="body2">
                                                <strong>{error.card_name}:</strong> {error.error}
                                            </Typography>
                                        </Alert>
                                    ))}
                                    {syncResults.errors.length > 10 && (
                                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                                            ... and {formatNumber(syncResults.errors.length - 10)} more errors
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
                <Button onClick={handleClose} disabled={loading}>
                    {syncResults ? 'Close' : 'Cancel'}
                </Button>
                {!syncResults && (
                    <>
                        <Tooltip title="Force update all cards regardless of last update time">
                            <Button
                                variant="outlined"
                                onClick={handleForceSync}
                                disabled={loading}
                                color="warning"
                                startIcon={loading ? <CircularProgress size={20} /> : <Sync />}
                            >
                                Force Sync All
                            </Button>
                        </Tooltip>
                        <Button
                            variant="contained"
                            onClick={handleStartSync}
                            disabled={loading}
                            color="primary"
                            startIcon={loading ? <CircularProgress size={20} /> : <Sync />}
                        >
                            {loading ? 'Syncing...' : 'Start Sync'}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
