// src/app/admin/pricing/update/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import {
    Box,
    Paper,
    Typography,
    Button,
    Card,
    CardContent,
    CircularProgress,
    LinearProgress,
    Chip,
    Divider,
    Switch,
    FormControlLabel,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    Refresh,
    Schedule,
    TrendingUp,
    TrendingDown,
    Speed,
    Error as ErrorIcon,
    CheckCircle,
    Info,
    PlayArrow,
    Stop
} from '@mui/icons-material';
import AppShell from "../../../components/AppShell";
import PageHeader from "../../../components/ui/PageHeader";
import StatCard from "../../../components/StatCard";
import ErrorState from "../../../components/ui/ErrorState";
import { StatRowSkeleton } from "../../../components/ui/Skeletons";
import { formatPrice } from "../../../lib/format";

interface PricingSyncResult {
    total_cards: number;
    successful_updates: number;
    failed_updates: number;
    skipped_cards: number;
    errors: Array<{
        card_id: number;
        card_name: string;
        error: string;
    }>;
    pricing_summary: {
        total_market_value: number;
        avg_price_change: number;
        cards_with_increases: number;
        cards_with_decreases: number;
        highest_value_card: {
            name: string;
            price: number;
        } | null;
    };
}

interface CronStatus {
    total_cards_with_api: number;
    recent_updates_24h: number;
    stale_cards: number;
    last_sync_status: string;
    next_sync_time: string;
    current_time: string;
}

export default function AdminPricingUpdatePage() {
    const { session, status } = useRequireAuth({ admin: true });
    const [syncResult, setSyncResult] = useState<PricingSyncResult | null>(null);
    const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoSync, setAutoSync] = useState(true);
    const [batchSize, setBatchSize] = useState(50);
    const [maxAgeHours, setMaxAgeHours] = useState(24);
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    // Fetch cron status on component mount (admins only)
    useEffect(() => {
        if (status !== 'authenticated' || session?.user?.role !== 'admin') return;
        fetchCronStatus();
        const interval = setInterval(fetchCronStatus, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [status, session]);

    const fetchCronStatus = async () => {
        try {
            const response = await fetch('/api/cron/daily-price-sync');
            const data = await response.json();

            if (data.success) {
                setCronStatus(data.status);
            }
        } catch (error) {
            console.error('Failed to fetch cron status:', error);
        }
    };

    const handleManualSync = async (force = false) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    force,
                    batchSize,
                    maxAgeHours: force ? 0 : maxAgeHours, // Force sync ignores age
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSyncResult(data.result);
                setLastUpdate(new Date());
                await fetchCronStatus(); // Refresh status
            } else {
                setError(data.error || 'Sync failed');
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleTestCron = async () => {
        setLoading(true);
        setError(null);

        try {
            // Authorized by the admin session cookie (server checks requireAdmin).
            const response = await fetch('/api/cron/daily-price-sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (data.success) {
                setSyncResult(data.results);
                setLastUpdate(new Date());
                await fetchCronStatus();
            } else {
                setError(data.error || 'Cron test failed');
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'success';
            case 'needs_sync': return 'warning';
            default: return 'error';
        }
    };

    if (status === 'loading') {
        return (
            <AppShell variant="admin">
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            </AppShell>
        );
    }
    if (status === 'unauthenticated' || session?.user?.role !== 'admin') {
        return null;
    }

    return (
        <AppShell variant="admin">
        <PageHeader
            title="Price Sync"
            icon={<Schedule />}
            actions={
                <IconButton onClick={fetchCronStatus} title="Refresh" sx={{ color: 'primary.main' }}>
                    <Refresh />
                </IconButton>
            }
        />
        <Box sx={{ p: 3 }}>
            {/* Cron Status Section */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Schedule />
                                Automated Price Sync Status
                            </Typography>

                            {cronStatus ? (
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <StatCard label="Total Cards with API" value={cronStatus.total_cards_with_api.toLocaleString()} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <StatCard label="Updated (24h)" value={cronStatus.recent_updates_24h.toLocaleString()} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <StatCard label="Stale Cards" value={cronStatus.stale_cards.toLocaleString()} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Chip
                                                label={cronStatus.last_sync_status}
                                                color={getStatusColor(cronStatus.last_sync_status)}
                                                sx={{ mb: 1 }}
                                            />
                                            <Typography variant="body2" color="text.secondary">
                                                {cronStatus.next_sync_time}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            ) : (
                                <StatRowSkeleton count={4} />
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Manual Sync Controls */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Manual Price Sync
                            </Typography>

                            <Box sx={{ mb: 2 }}>
                                <TextField
                                    label="Batch Size"
                                    type="number"
                                    value={batchSize}
                                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 50)}
                                    inputProps={{ min: 1, max: 100 }}
                                    size="small"
                                    sx={{ mr: 2, mb: 2 }}
                                />
                                <TextField
                                    label="Max Age (hours)"
                                    type="number"
                                    value={maxAgeHours}
                                    onChange={(e) => setMaxAgeHours(parseInt(e.target.value) || 24)}
                                    inputProps={{ min: 0, max: 168 }}
                                    size="small"
                                    sx={{ mb: 2 }}
                                />
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <Button
                                    variant="contained"
                                    onClick={() => handleManualSync(false)}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
                                >
                                    Sync Stale Cards
                                </Button>

                                <Button
                                    variant="outlined"
                                    onClick={() => handleManualSync(true)}
                                    disabled={loading}
                                    startIcon={<Speed />}
                                    color="warning"
                                >
                                    Force Sync All
                                </Button>

                                <Button
                                    variant="outlined"
                                    onClick={handleTestCron}
                                    disabled={loading}
                                    startIcon={<PlayArrow />}
                                    color="secondary"
                                >
                                    Test Cron Job
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Sync Settings
                            </Typography>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={autoSync}
                                        onChange={(e) => setAutoSync(e.target.checked)}
                                    />
                                }
                                label="Auto Sync Enabled"
                                sx={{ mb: 2 }}
                            />

                            <Typography variant="body2" color="text.secondary">
                                Automatic price updates run daily at midnight UTC.
                                Last manual update: {lastUpdate.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Loading Progress */}
            {loading && (
                <Box sx={{ mb: 3 }}>
                    <LinearProgress />
                    <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                        Syncing prices... This may take a few minutes.
                    </Typography>
                </Box>
            )}

            {/* Error Display */}
            {error && (
                <Box sx={{ mb: 3 }}>
                    <ErrorState
                        variant="inline"
                        message="Price sync failed."
                        onRetry={() => handleManualSync(false)}
                    />
                </Box>
            )}

            {/* Sync Results */}
            {syncResult && (
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CheckCircle color="success" />
                                    Last Sync Results
                                </Typography>

                                {/* Summary Stats */}
                                <Grid container spacing={2} sx={{ mb: 3 }}>
                                    <Grid size={{ xs: 6, sm: 3 }}>
                                        <StatCard label="Total Cards" value={syncResult.total_cards.toLocaleString()} />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 3 }}>
                                        <StatCard label="Updated" value={syncResult.successful_updates.toLocaleString()} />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 3 }}>
                                        <StatCard label="Failed" value={syncResult.failed_updates.toLocaleString()} />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 3 }}>
                                        <StatCard label="Skipped" value={syncResult.skipped_cards.toLocaleString()} />
                                    </Grid>
                                </Grid>

                                <Divider sx={{ my: 2 }} />

                                {/* Pricing Summary */}
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    Market Analysis
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <StatCard
                                            label="Price Increases"
                                            value={syncResult.pricing_summary.cards_with_increases.toLocaleString()}
                                            icon={<TrendingUp color="success" />}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <StatCard
                                            label="Price Decreases"
                                            value={syncResult.pricing_summary.cards_with_decreases.toLocaleString()}
                                            icon={<TrendingDown color="error" />}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <StatCard
                                            label="Total Market Value"
                                            value={formatPrice(syncResult.pricing_summary.total_market_value)}
                                            accent
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <StatCard
                                            label="Avg Price Change"
                                            value={`${syncResult.pricing_summary.avg_price_change > 0 ? '+' : ''}${syncResult.pricing_summary.avg_price_change.toFixed(2)}%`}
                                        />
                                    </Grid>
                                </Grid>

                                {/* Highest Value Card */}
                                {syncResult.pricing_summary.highest_value_card && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                        <Typography variant="body1">
                                            <strong>Highest Value Card:</strong> {syncResult.pricing_summary.highest_value_card.name}
                                            {' - '}{formatPrice(syncResult.pricing_summary.highest_value_card.price)}
                                        </Typography>
                                    </Box>
                                )}

                                {/* Errors */}
                                {syncResult.errors.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            startIcon={<ErrorIcon />}
                                            onClick={() => setShowErrorDialog(true)}
                                        >
                                            View {syncResult.errors.length} Errors
                                        </Button>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Error Dialog */}
            <Dialog
                open={showErrorDialog}
                onClose={() => setShowErrorDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Sync Errors</DialogTitle>
                <DialogContent>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Card ID</TableCell>
                                    <TableCell>Card Name</TableCell>
                                    <TableCell>Error</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {syncResult?.errors.map((error, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{error.card_id}</TableCell>
                                        <TableCell>{error.card_name}</TableCell>
                                        <TableCell>{error.error}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowErrorDialog(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Info Section */}
            <Card>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Info />
                        Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        • <strong>Automatic Sync:</strong> Runs daily at midnight UTC and updates all cards with stale pricing data (older than 24 hours).
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        • <strong>Manual Sync:</strong> Updates only cards that haven't been updated within the specified time frame.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        • <strong>Force Sync:</strong> Updates all cards regardless of when they were last updated.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        • <strong>API Rate Limits:</strong> The system respects Pokemon Price Tracker API rate limits with automatic batching and delays.
                    </Typography>
                </CardContent>
            </Card>
        </Box>
        </AppShell>
    );
}