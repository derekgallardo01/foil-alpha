"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "../lib/useRequireAuth";
import {
    Box,
    Container,
    Typography,
    Button,
    CircularProgress,
} from "@mui/material";
import { AccountBalanceWallet as WalletIcon } from "@mui/icons-material";
import UserWallet from "../components/UserWallet";
import AddFundsCard from "../components/AddFundsCard";
import AppShell from "../components/AppShell";
import PageHeader from "../components/ui/PageHeader";
import { toast } from "react-toastify";

export default function WalletPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { status } = useRequireAuth();

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
        return (
            <AppShell>
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress />
                </Box>
            </AppShell>
        );
    }

    if (status === "unauthenticated") {
        return null;
    }

    return (
        <AppShell>
            <PageHeader
                title="Wallet"
                icon={<WalletIcon />}
                actions={
                    <>
                        <Button variant="outlined" onClick={() => router.push('/marketplace')}>
                            Marketplace
                        </Button>
                        <Button variant="outlined" onClick={() => router.push('/collection')}>
                            Collection
                        </Button>
                    </>
                }
            />

            <Container maxWidth="md" sx={{ py: 3, flex: 1 }}>
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