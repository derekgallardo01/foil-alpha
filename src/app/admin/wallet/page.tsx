"use client";

import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Typography,
    Button,
    Card,
    CardContent,
    Grid,
} from "@mui/material";
import { ArrowBack, AccountBalanceWallet, Person, Settings } from "@mui/icons-material";
import AppShell from "../../components/AppShell";

export default function AdminWalletsPage() {
    const router = useRouter();

    return (
        <AppShell variant="admin">
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: "1px solid rgba(155, 92, 255, 0.2)" }}>
                <Typography variant="h4" sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>
                    Wallet Management
                </Typography>
                <Box sx={{ ml: 'auto' }}>
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBack />}
                        onClick={() => router.push('/admin/users')}
                        sx={{
                            borderColor: '#9B5Cff',
                            color: '#9B5Cff',
                            '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                        }}
                    >
                        Back to Users
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <AccountBalanceWallet sx={{ fontSize: 80, color: '#9B5Cff', mb: 2 }} />
                    <Typography variant="h3" sx={{ color: '#9B5Cff', mb: 2, fontWeight: 'bold' }}>
                        Wallet Management System
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'text.secondary', mb: 4, maxWidth: 600, mx: 'auto' }}>
                        Manage user wallets directly from the admin panel. No admin wallet required -
                        add funds, deduct amounts, freeze/unfreeze balances with full transaction tracking.
                    </Typography>
                </Box>

                <Grid container spacing={4} sx={{ mb: 6 }}>
                    <Grid item xs={12} md={4}>
                        <Card sx={{
                            bgcolor: 'grey.800',
                            border: '1px solid rgba(155, 92, 255, 0.2)',
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <Person sx={{ fontSize: 50, color: '#9B5Cff', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: '#9B5Cff', mb: 2 }}>
                                    User Management
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                    Access wallet management through the Users page. Click on any user's "Wallet" button to manage their funds.
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={() => router.push('/admin/users')}
                                    sx={{
                                        bgcolor: '#9B5Cff',
                                        color: 'grey.900',
                                        '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                                    }}
                                >
                                    Go to Users
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card sx={{
                            bgcolor: 'grey.800',
                            border: '1px solid rgba(155, 92, 255, 0.2)',
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <AccountBalanceWallet sx={{ fontSize: 50, color: '#9B5Cff', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: '#9B5Cff', mb: 2 }}>
                                    Direct Operations
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                    Add money, deduct funds, freeze/unfreeze balances directly. No admin wallet required - funds are managed systemically.
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Typography variant="caption" sx={{ color: 'success.main' }}>✓ Add Money</Typography>
                                    <Typography variant="caption" sx={{ color: 'error.main' }}>✓ Deduct Funds</Typography>
                                    <Typography variant="caption" sx={{ color: 'warning.main' }}>✓ Freeze/Unfreeze</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card sx={{
                            bgcolor: 'grey.800',
                            border: '1px solid rgba(155, 92, 255, 0.2)',
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <Settings sx={{ fontSize: 50, color: '#9B5Cff', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: '#9B5Cff', mb: 2 }}>
                                    Full Tracking
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                    Every wallet operation is logged with admin information, timestamps, and detailed transaction history.
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Typography variant="caption" sx={{ color: 'info.main' }}>✓ Transaction History</Typography>
                                    <Typography variant="caption" sx={{ color: 'info.main' }}>✓ Admin Attribution</Typography>
                                    <Typography variant="caption" sx={{ color: 'info.main' }}>✓ Balance Tracking</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                <Box sx={{
                    textAlign: 'center',
                    p: 4,
                    bgcolor: 'rgba(155, 92, 255, 0.05)',
                    borderRadius: 2,
                    border: '1px solid rgba(155, 92, 255, 0.2)'
                }}>
                    <Typography variant="h6" sx={{ color: '#9B5Cff', mb: 2 }}>
                        🚀 No Admin Wallet Required
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        This system operates without requiring an admin wallet. All fund operations are handled
                        systemically with proper authorization and tracking. Admins can directly manage user
                        wallets without maintaining their own wallet balance.
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={() => router.push('/admin/users')}
                        sx={{
                            bgcolor: '#9B5Cff',
                            color: 'grey.900',
                            px: 4,
                            py: 1.5,
                            fontSize: '1.1rem',
                            '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                        }}
                    >
                        Start Managing Wallets
                    </Button>
                </Box>
            </Container>
        </AppShell>
    );
}