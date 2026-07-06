// src/app/admin/pricing/update/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    Alert,
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
import {
    Refresh,
    Schedule,
    TrendingUp,
    TrendingDown,
    AttachMoney,
    Speed,
    Error as ErrorIcon,
    CheckCircle,
    Info,
    PlayArrow,
    Stop
} from '@mui/icons-material';
import AppShell from "../../../components/AppShell";

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
    const [syncResult, setSyncResult] = useState<PricingSyncResult | null>(null);
    const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoSync, setAutoSync] = useState(true);
    const [batchSize, setBatchSize] = useState(50);
    const [maxAgeHours, setMaxAgeHours] = useState(24);
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    // Fetch cron status on component mount
    useEffect(() => {
        fetchCronStatus();
        const interval = setInterval(fetchCronStatus, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

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
            const response = await fetch('/api/cron/daily-price-sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'test-secret'}`,
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value);
    };

    return (
        <AppShell variant="admin">
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoney />
                Price Update Management
            </Typography>

            {/* Cron Status Section */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Schedule />
                                Automated Price Sync Status
                            </Typography>

                            {cronStatus ? (
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="primary">
                                                {cronStatus.total_cards_with_api}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Cards with API
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="success.main">
                                                {cronStatus.recent_updates_24h}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Updated (24h)
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="warning.main">
                                                {cronStatus.stale_cards}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Stale Cards
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
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
                                <CircularProgress />
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Manual Sync Controls */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
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

                <Grid item xs={12} md={6}>
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
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Sync Results */}
            {syncResult && (
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CheckCircle color="success" />
                                    Last Sync Results
                                </Typography>

                                {/* Summary Stats */}
                                <Grid container spacing={2} sx={{ mb: 3 }}>
                                    <Grid item xs={6} sm={3}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="primary">
                                                {syncResult.total_cards}
                                            </Typography>
                                            <Typography variant="body2">Total Cards</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="success.main">
                                                {syncResult.successful_updates}
                                            </Typography>
                                            <Typography variant="body2">Updated</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="error.main">
                                                {syncResult.failed_updates}
                                            </Typography>
                                            <Typography variant="body2">Failed</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="text.secondary">
                                                {syncResult.skipped_cards}
                                            </Typography>
                                            <Typography variant="body2">Skipped</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>

                                <Divider sx={{ my: 2 }} />

                                {/* Pricing Summary */}
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    Market Analysis
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TrendingUp color="success" />
                                            <Box>
                                                <Typography variant="h6" color="success.main">
                                                    {syncResult.pricing_summary.cards_with_increases}
                                                </Typography>
                                                <Typography variant="body2">Price Increases</Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TrendingDown color="error" />
                                            <Box>
                                                <Typography variant="h6" color="error.main">
                                                    {syncResult.pricing_summary.cards_with_decreases}
                                                </Typography>
                                                <Typography variant="body2">Price Decreases</Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Box>
                                            <Typography variant="h6">
                                                {formatCurrency(syncResult.pricing_summary.total_market_value)}
                                            </Typography>
                                            <Typography variant="body2">Total Market Value</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Box>
                                            <Typography variant="h6" color={
                                                syncResult.pricing_summary.avg_price_change > 0 ? 'success.main' :
                                                    syncResult.pricing_summary.avg_price_change < 0 ? 'error.main' : 'text.primary'
                                            }>
                                                {syncResult.pricing_summary.avg_price_change > 0 ? '+' : ''}
                                                {syncResult.pricing_summary.avg_price_change.toFixed(2)}%
                                            </Typography>
                                            <Typography variant="body2">Avg Price Change</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>

                                {/* Highest Value Card */}
                                {syncResult.pricing_summary.highest_value_card && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                                        <Typography variant="body1">
                                            <strong>Highest Value Card:</strong> {syncResult.pricing_summary.highest_value_card.name}
                                            {' - '}{formatCurrency(syncResult.pricing_summary.highest_value_card.price)}
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