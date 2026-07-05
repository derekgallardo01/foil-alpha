"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Box,
    Container,
    Typography,
    Button,
} from "@mui/material";
import UserWallet from "../components/UserWallet";
import AppShell from "../components/AppShell";
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
        <AppShell>
            <ToastContainer position="top-right" />

            {/* Header */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", p: 2, borderBottom: '1px solid rgba(155, 92, 255, 0.2)' }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/marketplace')}
                        sx={{
                            borderColor: '#9B5Cff',
                            color: '#9B5Cff',
                            '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                        }}
                    >
                        Marketplace
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/collection')}
                        sx={{
                            borderColor: '#9B5Cff',
                            color: '#9B5Cff',
                            '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                        }}
                    >
                        My Collection
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="md" sx={{ py: 3, flex: 1 }}>
                <Typography variant="h4" sx={{ color: '#9B5Cff', mb: 3, textAlign: 'center' }}>
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
                                bgcolor: '#9B5Cff',
                                color: 'grey.900',
                                '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                            }}
                        >
                            Browse Cards for Sale
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => router.push('/marketplace?filter=auction')}
                            sx={{
                                bgcolor: '#9B5Cff',
                                color: 'grey.900',
                                '&:hover': { bgcolor: 'rgba(155, 92, 255, 0.8)' }
                            }}
                        >
                            View Auctions
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => router.push('/collection')}
                            sx={{
                                borderColor: '#9B5Cff',
                                color: '#9B5Cff',
                                '&:hover': { borderColor: '#9B5Cff', backgroundColor: 'rgba(155, 92, 255, 0.1)' }
                            }}
                        >
                            Manage My Cards
                        </Button>
                    </Box>
                </Box>
            </Container>
        </AppShell>
    );
}