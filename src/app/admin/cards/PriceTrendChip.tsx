"use client";

import { Chip, Tooltip } from "@mui/material";
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';

// Price Trend Chip Component
export default function PriceTrendChip({ trend, change }: { trend?: string; change?: number }) {
    const getTrendIcon = () => {
        switch (trend) {
            case 'up':
                return <TrendingUp sx={{ fontSize: 16 }} />;
            case 'down':
                return <TrendingDown sx={{ fontSize: 16 }} />;
            default:
                return <TrendingFlat sx={{ fontSize: 16 }} />;
        }
    };

    const getTrendColor = () => {
        switch (trend) {
            case 'up':
                return 'success' as const;
            case 'down':
                return 'error' as const;
            default:
                return 'default' as const;
        }
    };

    if (!trend) return null;

    return (
        <Tooltip title={`Price trend: ${trend}${change !== undefined ? ` (${change > 0 ? '+' : ''}${change.toFixed(1)}%)` : ''}`}>
            <Chip
                icon={getTrendIcon()}
                label={change !== undefined ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : trend}
                color={getTrendColor()}
                size="small"
                variant="outlined"
            />
        </Tooltip>
    );
}
