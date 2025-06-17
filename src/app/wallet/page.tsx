// src/app/wallet/page.tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Typography,
    IconButton,
    Button,
} from "@mui/material";
import { Menu as MenuIcon, ArrowBack } from "@mui/icons-material";
import Image from "next/image";
import UserWallet from "../components/UserWallet";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function WalletPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    if (status === "loading") {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Loading...</Box>;
    }

    if (status === "unauthenticated") {
        router.push("/login");
        return null;
    }

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
            <ToastContainer position="top-right" />

            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: '1px solid rgba(150, 255, 155, 0.2)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market" width={40} height={20} />
                    <Typography variant="h5" sx={{ color: '#96ff9b', fontWeight: 'bold' }}>
                        My Wallet
                    </Typography>
                </Box>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/marketplace')}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        Marketplace
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/collection')}
                        sx={{
                            borderColor: '#96ff9b',
                            color: '#96ff9b',
                            '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                        }}
                    >
                        My Collection
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="md" sx={{ py: 3, flex: 1 }}>
                <Typography variant="h4" sx={{ color: '#96ff9b', mb: 3, textAlign: 'center' }}>
                    Welcome, {session?.user?.name}
                </Typography>

                <UserWallet />

                <Box sx={{ textAlign: 'center', mt: 3 }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
                        Your wallet balance is ready for purchasing cards, placing bids, and participating in auctions.
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Button
                            variant="contained"
                            onClick={() => router.push('/marketplace')}
                            sx={{
                                bgcolor: '#96ff9b',
                                color: 'grey.900',
                                '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                            }}
                        >
                            Browse Cards for Sale
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => router.push('/marketplace?filter=auction')}
                            sx={{
                                bgcolor: '#96ff9b',
                                color: 'grey.900',
                                '&:hover': { bgcolor: 'rgba(150, 255, 155, 0.8)' }
                            }}
                        >
                            View Auctions
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => router.push('/collection')}
                            sx={{
                                borderColor: '#96ff9b',
                                color: '#96ff9b',
                                '&:hover': { borderColor: '#96ff9b', backgroundColor: 'rgba(150, 255, 155, 0.1)' }
                            }}
                        >
                            Manage My Cards
                        </Button>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}