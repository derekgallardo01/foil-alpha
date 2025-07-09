// src/app/components/PriceDisplay.tsx
'use client';

import React from 'react';
import {
    Box,
    Typography,
    Tooltip,
    TypographyProps
} from '@mui/material';
import { useCurrencyContext } from '../lib/currency-context';
import { useSession } from 'next-auth/react';

interface PriceDisplayProps {
    usdAmount: number;
    variant?: TypographyProps['variant'];
    color?: TypographyProps['color'];
    showUSDReference?: boolean;
    showTooltip?: boolean;
    sx?: any;
    component?: React.ElementType;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
    usdAmount,
    variant = 'body1',
    color = 'inherit',
    showUSDReference = false,
    showTooltip = true,
    sx,
    component
}) => {
    const { data: session } = useSession();
    const {
        selectedCurrency,
        convertPrice,
        formatPrice,
        isUSDFallback
    } = useCurrencyContext();

    // Admin users always see USD prices
    const isAdmin = session?.user?.role === 'admin';
    const shouldShowUSD = isAdmin || selectedCurrency === 'USD';

    // Calculate converted amount
    const convertedAmount = shouldShowUSD ? usdAmount : convertPrice(usdAmount);
    const displayCurrency = shouldShowUSD ? 'USD' : selectedCurrency;
    const formattedPrice = formatPrice(convertedAmount, displayCurrency);

    // Create tooltip content
    const tooltipContent = (() => {
        if (isAdmin) return 'Admin view: USD prices only';
        if (isUSDFallback) return 'Currency service unavailable, showing USD';
        if (shouldShowUSD) return 'Original USD price';
        return `USD: $${usdAmount.toFixed(2)}`;
    })();

    const typographyProps: any = {
        variant,
        color,
        sx: {
            ...sx,
            ...(isAdmin && {
                borderBottom: '1px dotted',
                borderColor: 'primary.main'
            })
        }
    };

    // Only add component prop if it's defined
    if (component) {
        typographyProps.component = component;
    }

    const priceElement = (
        <Typography {...typographyProps}>
            {formattedPrice}
            {isAdmin && (
                <Typography
                    component="span"
                    variant="caption"
                    sx={{ ml: 0.5, color: 'primary.main', fontSize: '0.7em' }}
                >
                    (Admin)
                </Typography>
            )}
            {showUSDReference && !shouldShowUSD && (
                <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 1, fontSize: '0.8em' }}
                >
                    (${usdAmount.toFixed(2)} USD)
                </Typography>
            )}
        </Typography>
    );

    if (showTooltip && !shouldShowUSD) {
        return (
            <Tooltip title={tooltipContent} arrow>
                {priceElement}
            </Tooltip>
        );
    }

    return priceElement;
};

// Convenience component for large price displays
export const LargePriceDisplay: React.FC<Omit<PriceDisplayProps, 'variant'>> = (props) => (
    <PriceDisplay {...props} variant="h4" />
);

// Convenience component for small price displays
export const SmallPriceDisplay: React.FC<Omit<PriceDisplayProps, 'variant'>> = (props) => (
    <PriceDisplay {...props} variant="body2" />
);

// Convenience component for price displays with USD reference
export const PriceWithReference: React.FC<Omit<PriceDisplayProps, 'showUSDReference'>> = (props) => (
    <PriceDisplay {...props} showUSDReference={true} />
);

export default PriceDisplay;