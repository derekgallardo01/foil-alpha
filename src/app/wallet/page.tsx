"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Box,
    Container,
    Typography,
    Button,
} from "@mui/material";
import UserWallet from "../components/UserWallet";
import AddFundsCard from "../components/AddFundsCard";
import AppShell from "../components/AppShell";
import { toast } from "react-toastify";

export default function WalletPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();

    useEffect(() => {
        const deposit = searchParams.get("deposit");
        if (deposit === "success") {
            toast.success("Deposit received — your balance updates once payment settles.");
            router.replace("/wallet");
        } else if (deposit === "cancelled") {
            toast.info("Deposit cancelled.");
            router.replace("/wallet");
        }
    }, [searchParams, router]);

    if (status === "loading") {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Loading...</Box>;
    }

    if (status === "unauthenticated") {
        router.push("/login");
        return null;
    }

    return (
        <AppShell>

            {/* Header */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/marketplace')}
                        sx={{
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' }
                        }}
                    >
                        Marketplace
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => router.push('/collection')}
                        sx={{
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' }
                        }}
                    >
                        My Collection
                    </Button>
                </Box>
            </Box>

            <Container maxWidth="md" sx={{ py: 3, flex: 1 }}>
                <Typography variant="h4" sx={{ color: 'primary.main', mb: 3, textAlign: 'center' }}>
                    Welcome, {session?.user?.name}
                </Typography>

                <UserWallet />

                <AddFundsCard />

                <Box sx={{ textAlign: 'center', mt: 3 }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
                        Your wallet balance is ready for purchasing cards, placing bids, and participating in auctions.
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Button
                            variant="contained"
                            onClick={() => router.push('/marketplace')}
                        >
                            Browse Cards for Sale
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => router.push('/marketplace?filter=auction')}
                        >
                            View Auctions
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => router.push('/collection')}
                            sx={{
                                borderColor: 'primary.main',
                                color: 'primary.main',
                                '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' }
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