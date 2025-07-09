// src/app/lib/currency-context.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useCurrency } from './currency-utils';

interface CurrencyContextType {
    selectedCurrency: string;
    setSelectedCurrency: (currency: string) => void;
    convertPrice: (usdAmount: number) => number;
    formatPrice: (amount: number, currency?: string) => string;
    exchangeRates: Record<string, number>;
    availableCurrencies: Array<{ code: string; name: string; symbol: string }>;
    loading: boolean;
    error: string | null;
    isUSDFallback: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrencyContext = () => {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrencyContext must be used within a CurrencyProvider');
    }
    return context;
};

interface CurrencyProviderProps {
    children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
    const [selectedCurrency, setSelectedCurrencyState] = useState<string>('USD');
    const {
        exchangeRates,
        availableCurrencies,
        loading,
        error,
        fetchRates,
        convertUSDTo,
        formatCurrency
    } = useCurrency();

    // Load currency preference from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedCurrency = localStorage.getItem('tcg_preferred_currency');
            if (savedCurrency && availableCurrencies.some(c => c.code === savedCurrency)) {
                setSelectedCurrencyState(savedCurrency);
            }
        }
    }, [availableCurrencies]);

    // Fetch exchange rates on mount and every 30 minutes
    useEffect(() => {
        fetchRates();
        const interval = setInterval(fetchRates, 30 * 60 * 1000); // 30 minutes
        return () => clearInterval(interval);
    }, [fetchRates]);

    const setSelectedCurrency = (currency: string) => {
        setSelectedCurrencyState(currency);
        if (typeof window !== 'undefined') {
            localStorage.setItem('tcg_preferred_currency', currency);
        }
    };

    const convertPrice = (usdAmount: number): number => {
        return convertUSDTo(usdAmount, selectedCurrency);
    };

    const formatPrice = (amount: number, currency?: string): string => {
        return formatCurrency(amount, currency || selectedCurrency);
    };

    // Check if we're using USD as fallback due to API issues
    const isUSDFallback = error !== null && selectedCurrency !== 'USD';

    const value: CurrencyContextType = {
        selectedCurrency,
        setSelectedCurrency,
        convertPrice,
        formatPrice,
        exchangeRates,
        availableCurrencies,
        loading,
        error,
        isUSDFallback
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
};