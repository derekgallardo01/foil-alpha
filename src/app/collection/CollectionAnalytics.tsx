"use client";

import { Box, Chip } from "@mui/material";
import Grid from '@mui/material/Grid2';
import {
    AttachMoney,
    Inventory2,
    Collections as CollectionsIcon,
    WorkspacePremium
} from "@mui/icons-material";
import StatCard from "../components/StatCard";
import { formatPrice } from "../lib/format";
import type { CollectionSummary } from './collection-client';

// Collection Analytics — real holdings breakdown on the shared StatCard tiles.
export default function CollectionAnalytics({ summary }: { summary: CollectionSummary | null }) {
    if (!summary) return null;

    const tiles = [
        { label: 'Collection Value', value: formatPrice(summary.totalValue), accent: true, icon: <AttachMoney fontSize="small" /> },
        { label: 'Total Items', value: summary.totalUnits.toLocaleString(), icon: <Inventory2 fontSize="small" /> },
        { label: 'Unique Cards', value: summary.cardCount.toLocaleString(), icon: <CollectionsIcon fontSize="small" /> },
        { label: 'Sealed Products', value: summary.sealedCount.toLocaleString(), icon: <Inventory2 fontSize="small" /> },
    ];

    return (
        <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
                {tiles.map((t) => (
                    <Grid size={{ xs: 6, md: 3 }} key={t.label}>
                        <StatCard label={t.label} value={t.value} accent={t.accent} icon={t.icon} />
                    </Grid>
                ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
                <Chip icon={<WorkspacePremium />} label={`${summary.gradedCount} Graded`} color="secondary" variant="outlined" />
                <Chip label={`${summary.cardCount} Cards`} variant="outlined" />
                <Chip label={`${summary.sealedCount} Sealed`} variant="outlined" />
            </Box>
        </Box>
    );
}
