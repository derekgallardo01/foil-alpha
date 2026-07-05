"use client";

import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Typography,
    IconButton,
    Button,
    Card,
    CardContent,
    Grid,
} from "@mui/material";
import { Menu as MenuIcon, ArrowBack, AccountBalanceWallet, Person, Settings } from "@mui/icons-material";
import { useState } from "react";
import AdminSidebar from "../../components/AdminSidebar";
import Image from "next/image";

export default function AdminWalletsPage() {
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                bgcolor: "grey.900",
                background: "linear-gradient(181deg,rgba(0, 0, 0, 0.74), #031e04,rgba(0, 0, 0, 0.17), #000000d4)",
                backgroundSize: "200% 200%",
                animation: "gradientShift 20s ease infinite",
                "@keyframes gradientShift": {
                    "0%": { backgroundPosition: "0% 0%" },
                    "50%": { backgroundPosition: "100% 100%" },
                    "100%": { backgroundPosition: "0% 0%" },
                },
            }}
        >
            <AdminSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: "1px solid rgba(150, 255, 155, 0.2)" }}>
                <IconButton onClick={toggleSidebar} sx={{ color: '#96ff9b' }}>
                    <MenuIcon />
                </IconButton>
                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="Foil Alpha" width={40} height={20} />
                    <Typography variant="h5" sx={{ color: '#96ff9b', fontWeight: 'bold' }}>
                        Wallet Management
                    </Typography>
                </Box>
                <Box sx={{ ml: 'auto' }}>
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBack />}
                        onClick={() => router.push('/admin/users')}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        Back to Users
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <AccountBalanceWallet sx={{ fontSize: 80, color: '#96ff9b', mb: 2 }} />
                    <Typography variant="h3" sx={{ color: '#96ff9b', mb: 2, fontWeight: 'bold' }}>
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
                            border: '1px solid rgba(150, 255, 155, 0.2)',
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <Person sx={{ fontSize: 50, color: '#96ff9b', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: '#96ff9b', mb: 2 }}>
                                    User Management
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                    Access wallet management through the Users page. Click on any user's "Wallet" button to manage their funds.
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={() => router.push('/admin/users')}
                                    sx={{
                                        bgcolor: '#96ff9b',
                                        color: 'grey.900',
                                        '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
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
                            border: '1px solid rgba(150, 255, 155, 0.2)',
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <AccountBalanceWallet sx={{ fontSize: 50, color: '#96ff9b', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: '#96ff9b', mb: 2 }}>
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
                            border: '1px solid rgba(150, 255, 155, 0.2)',
                            height: '100%',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-4px)' }
                        }}>
                            <CardContent sx={{ textAlign: 'center', p: 4 }}>
                                <Settings sx={{ fontSize: 50, color: '#96ff9b', mb: 2 }} />
                                <Typography variant="h5" sx={{ color: '#96ff9b', mb: 2 }}>
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
                    bgcolor: 'rgba(150, 255, 155, 0.05)',
                    borderRadius: 2,
                    border: '1px solid rgba(150, 255, 155, 0.2)'
                }}>
                    <Typography variant="h6" sx={{ color: '#96ff9b', mb: 2 }}>
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
                            bgcolor: '#96ff9b',
                            color: 'grey.900',
                            px: 4,
                            py: 1.5,
                            fontSize: '1.1rem',
                            '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                        }}
                    >
                        Start Managing Wallets
                    </Button>
                </Box>
            </Container>
        </Box>
    );
}