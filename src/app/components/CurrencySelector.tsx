// src/app/components/CurrencySelector.tsx
'use client';

import React, { useState } from 'react';
import {
    FormControl,
    Select,
    MenuItem,
    Box,
    Typography,
    Chip,
    CircularProgress,
    Tooltip,
    Alert
} from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    Warning as WarningIcon,
    Error as ErrorIcon
} from '@mui/icons-material';
import { useCurrencyContext } from '../lib/currency-context';

interface CurrencySelectorProps {
    size?: 'small' | 'medium';
    showLabel?: boolean;
    variant?: 'outlined' | 'standard' | 'filled';
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
    size = 'small',
    showLabel = false,
    variant = 'outlined'
}) => {
    const {
        selectedCurrency,
        setSelectedCurrency,
        availableCurrencies,
        loading,
        error,
        isUSDFallback
    } = useCurrencyContext();

    const [open, setOpen] = useState(false);

    const handleChange = (event: any) => {
        const newCurrency = event.target.value;
        setSelectedCurrency(newCurrency);
    };

    const selectedCurrencyInfo = availableCurrencies.find(c => c.code === selectedCurrency);

    if (error && !isUSDFallback) {
        return (
            <Tooltip title={`Currency service unavailable: ${error}`}>
                <Chip
                    icon={<ErrorIcon />}
                    label="USD (Error)"
                    color="error"
                    size={size}
                    variant="outlined"
                />
            </Tooltip>
        );
    }

    return (
        <Box sx={{ minWidth: 120 }}>
            {showLabel && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Currency
                </Typography>
            )}

            <FormControl size={size} variant={variant} fullWidth>
                <Select
                    value={selectedCurrency}
                    onChange={handleChange}
                    open={open}
                    onOpen={() => setOpen(true)}
                    onClose={() => setOpen(false)}
                    disabled={loading}
                    displayEmpty
                    renderValue={(value) => (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {loading ? (
                                <CircularProgress size={16} />
                            ) : (
                                <MoneyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            )}
                            <Typography variant="body2">
                                {selectedCurrencyInfo?.symbol} {value}
                            </Typography>
                            {isUSDFallback && (
                                <Tooltip title="Using USD due to currency service issues">
                                    <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                </Tooltip>
                            )}
                        </Box>
                    )}
                    sx={{
                        '& .MuiSelect-select': {
                            py: size === 'small' ? 0.5 : 1,
                        }
                    }}
                >
                    {availableCurrencies.map((currency) => (
                        <MenuItem key={currency.code} value={currency.code}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 40 }}>
                                    {currency.symbol}
                                </Typography>
                                <Box>
                                    <Typography variant="body2">{currency.code}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {currency.name}
                                    </Typography>
                                </Box>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {/* Error Alert */}
            {error && isUSDFallback && (
                <Alert
                    severity="warning"
                    sx={{ mt: 1, fontSize: '0.75rem' }}
                    icon={<WarningIcon fontSize="small" />}
                >
                    Currency service unavailable. Showing USD prices.
                </Alert>
            )}
        </Box>
    );
};

export default CurrencySelector;