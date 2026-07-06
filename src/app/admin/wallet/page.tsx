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
import PageHeader from "../../components/ui/PageHeader";

export default function AdminWalletsPage() {
    const router = useRouter();

    return (
        <AppShell variant="admin">
            {/* Header */}
            <PageHeader
                title="Admin Wallet"
                icon={<AccountBalanceWallet />}
                actions={
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<ArrowBack />}
                        onClick={() => router.push('/admin/users')}
                    >
                        Back to Users
                    </Button>
                }
            />

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <AccountBalanceWallet sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h3" sx={{ color: 'primary.main', mb: 2, fontWeight: 'bold' }}>
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
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <Person sx={{ fontSize: 50, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: 'primary.main', mb: 2 }}>
                                    User Management
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                    Access wallet management through the Users page. Click on any user's "Wallet" button to manage their funds.
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => router.push('/admin/users')}
                                >
                                    Go to Users
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card sx={{
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <AccountBalanceWallet sx={{ fontSize: 50, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: 'primary.main', mb: 2 }}>
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
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <Settings sx={{ fontSize: 50, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: 'primary.main', mb: 2 }}>
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
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider'
                }}>
                    <Typography variant="h6" sx={{ color: 'primary.main', mb: 2 }}>
                        No Admin Wallet Required
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        This system operates without requiring an admin wallet. All fund operations are handled
                        systemically with proper authorization and tracking. Admins can directly manage user
                        wallets without maintaining their own wallet balance.
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={() => router.push('/admin/users')}
                        sx={{
                            px: 4,
                            py: 1.5,
                            fontSize: '1.1rem',
                        }}
                    >
                        Start Managing Wallets
                    </Button>
                </Box>
            </Container>
        </AppShell>
    );
}
