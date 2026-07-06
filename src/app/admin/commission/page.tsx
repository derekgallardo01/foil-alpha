// src/app/admin/commission/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Grid,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Alert,
    InputAdornment,
    Divider,
} from "@mui/material";
import {
    Save,
    Refresh,
    AccountBalance,
    TrendingUp,
    Percent,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import AppShell from "../../components/AppShell";

interface Rarity {
    id: number;
    name: string;
    symbol: string | null;
    color: string | null;
    order_index: number | null;
    commission_rate: number | null;
}

interface AdminWallet {
    id: number;
    balance: number;
    total_commissions: number;
    total_marketplace_sales: number;
}

interface CommissionData {
    global_commission: number;
    rarities: Rarity[];
    admin_wallet: AdminWallet | null;
}

export default function CommissionManagement() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<CommissionData>({
        global_commission: 5.00,
        rarities: [],
        admin_wallet: null
    });
    const [globalCommission, setGlobalCommission] = useState<string>("5.00");
    const [rarityCommissions, setRarityCommissions] = useState<{ [key: string]: string }>({});

    // Redirect if not admin
    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "admin") {
            router.push("/unauthorized");
        }
    }, [status, session, router]);

    // Fetch commission data
    const fetchCommissionData = async () => {
        try {
            setLoading(true);

            const response = await fetch("/api/admin/commission");
            if (!response.ok) throw new Error("Failed to fetch commission data");

            const commissionData: CommissionData = await response.json();
            setData(commissionData);
            setGlobalCommission(commissionData.global_commission.toFixed(2));

            // Set rarity commission values
            const rarityMap: { [key: string]: string } = {};
            commissionData.rarities.forEach(rarity => {
                rarityMap[rarity.name] = rarity.commission_rate ? rarity.commission_rate.toFixed(2) : "";
            });
            setRarityCommissions(rarityMap);

            toast.success("Commission data loaded!");
        } catch (error) {
            console.error("Error fetching commission data:", error);
            toast.error("Failed to load commission data");
        } finally {
            setLoading(false);
        }
    };

    // Save commission settings
    const saveCommissionSettings = async () => {
        try {
            setSaving(true);

            // Validate global commission
            const globalRate = parseFloat(globalCommission);
            if (isNaN(globalRate) || globalRate < 0 || globalRate > 50) {
                toast.error("Global commission must be between 0 and 50%");
                return;
            }

            // Validate rarity commissions
            const rarityRates: { [key: string]: number | null } = {};
            for (const [rarityName, rateString] of Object.entries(rarityCommissions)) {
                if (rateString.trim() === "") {
                    rarityRates[rarityName] = null; // Use global rate
                } else {
                    const rate = parseFloat(rateString);
                    if (isNaN(rate) || rate < 0 || rate > 50) {
                        toast.error(`Commission rate for ${rarityName} must be between 0 and 50%`);
                        return;
                    }
                    rarityRates[rarityName] = rate;
                }
            }

            const response = await fetch("/api/admin/commission", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    global_commission: globalRate,
                    rarity_commissions: rarityRates
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to save commission settings");
            }

            toast.success("Commission settings saved successfully!");
            await fetchCommissionData(); // Refresh data
        } catch (error) {
            console.error("Error saving commission settings:", error);
            toast.error(error instanceof Error ? error.message : "Failed to save commission settings");
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role === "admin") {
            fetchCommissionData();
        }
    }, [status, session]);

    const handleRarityCommissionChange = (rarityName: string, value: string) => {
        setRarityCommissions(prev => ({
            ...prev,
            [rarityName]: value
        }));
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <AppShell variant="admin">
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 800,
                        background: (theme) => theme.foil.gradient,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}
                >
                    Commission Management
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={fetchCommissionData}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={saveCommissionSettings}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Grid container spacing={3}>
                        {/* Admin Wallet Info */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AccountBalance />
                                        Platform Wallet
                                    </Typography>
                                    {data.admin_wallet ? (
                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={4}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="mono" component="div" sx={{ fontSize: 34, fontWeight: 700, color: 'success.main' }}>
                                                        ${data.admin_wallet.balance.toFixed(2)}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Current Balance
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="mono" component="div" sx={{ fontSize: 34, fontWeight: 700, color: 'success.main' }}>
                                                        ${data.admin_wallet.total_commissions.toFixed(2)}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Total Commissions
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="mono" component="div" sx={{ fontSize: 34, fontWeight: 700, color: 'success.main' }}>
                                                        ${data.admin_wallet.total_marketplace_sales.toFixed(2)}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Marketplace Sales
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    ) : (
                                        <Alert severity="warning">
                                            Admin wallet not found. It will be created automatically when you save settings.
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Global Commission Setting */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Percent />
                                        Global Commission Rate
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        label="Global Commission (%)"
                                        value={globalCommission}
                                        onChange={(e) => setGlobalCommission(e.target.value)}
                                        type="number"
                                        inputProps={{ min: 0, max: 50, step: 0.01 }}
                                        InputProps={{
                                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                        }}
                                    />
                                    <Alert severity="info" sx={{ mt: 2 }}>
                                        This rate applies to all cards unless a specific rarity rate is set below.
                                    </Alert>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Commission Calculation Example */}
                        <Grid item xs={12} md={6}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TrendingUp />
                                        Commission Calculation
                                    </Typography>
                                    <Box sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            Example: $100 card with {globalCommission}% commission
                                        </Typography>
                                        <Divider sx={{ my: 1 }} />
                                        <Typography variant="body2" color="text.primary">
                                            • Card Price: $100.00
                                        </Typography>
                                        <Typography variant="body2" color="success.main">
                                            • Commission: ${(100 * parseFloat(globalCommission || "0") / 100).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" color="text.primary">
                                            • Buyer Pays: ${(100 + (100 * parseFloat(globalCommission || "0") / 100)).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" color="text.primary">
                                            • Seller Receives: ${(100 - (100 * parseFloat(globalCommission || "0") / 100)).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" color="success.main">
                                            • Platform Gets: ${(100 * parseFloat(globalCommission || "0") / 100).toFixed(2)}
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Rarity-Specific Commission Rates */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 2 }}>
                                        Rarity-Specific Commission Rates
                                    </Typography>
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        Leave empty to use the global commission rate. Set a specific rate to override the global rate for that rarity.
                                    </Alert>
                                    <TableContainer component={Paper} sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Rarity</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Symbol</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Color</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Commission Rate (%)</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {data.rarities.map((rarity) => (
                                                    <TableRow key={rarity.id}>
                                                        <TableCell sx={{ color: 'text.primary' }}>
                                                            {rarity.name}
                                                        </TableCell>
                                                        <TableCell sx={{ color: 'text.secondary' }}>
                                                            {rarity.symbol || '-'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {rarity.color ? (
                                                                <Box
                                                                    sx={{
                                                                        width: 20,
                                                                        height: 20,
                                                                        backgroundColor: rarity.color,
                                                                        borderRadius: '50%',
                                                                        border: '1px solid rgba(255,255,255,0.3)'
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">-</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <TextField
                                                                size="small"
                                                                placeholder={`${globalCommission}% (global)`}
                                                                value={rarityCommissions[rarity.name] || ""}
                                                                onChange={(e) => handleRarityCommissionChange(rarity.name, e.target.value)}
                                                                type="number"
                                                                inputProps={{ min: 0, max: 50, step: 0.01 }}
                                                                InputProps={{
                                                                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                                                }}
                                                                sx={{ width: 120 }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {rarityCommissions[rarity.name] && rarityCommissions[rarity.name].trim() !== "" ? (
                                                                <Chip
                                                                    label="Custom Rate"
                                                                    color="warning"
                                                                    size="small"
                                                                />
                                                            ) : (
                                                                <Chip
                                                                    label="Uses Global"
                                                                    color="default"
                                                                    size="small"
                                                                />
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Save Actions */}
                        <Grid item xs={12}>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                                <Button
                                    variant="outlined"
                                    onClick={fetchCommissionData}
                                    disabled={loading}
                                >
                                    Reset Changes
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<Save />}
                                    onClick={saveCommissionSettings}
                                    disabled={saving}
                                    size="large"
                                    sx={{ px: 4 }}
                                >
                                    {saving ? 'Saving...' : 'Save All Commission Settings'}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </motion.div>
            </Container>
        </AppShell>
    );
}