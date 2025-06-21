// src/app/admin/wallets/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Typography,
    IconButton,
    Button,
} from "@mui/material";
import { Menu as MenuIcon, ArrowBack } from "@mui/icons-material";
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
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: '1px solid rgba(150, 255, 155, 0.2)' }}>
                <IconButton onClick={toggleSidebar} sx={{ color: '#96ff9b' }}>
                    <MenuIcon />
                </IconButton>
                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market" width={40} height={20} />
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
                <Box sx={{ textAlign: 'center', mt: 10 }}>
                    <Typography variant="h4" sx={{ color: '#96ff9b', mb: 2 }}>
                        Wallet Management
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                        Manage user wallets from the Users page. Click on any user's "Wallet" button to access wallet management features.
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
                        Go to Users Page
                    </Button>
                </Box>
            </Container>
        </Box>
    );
}