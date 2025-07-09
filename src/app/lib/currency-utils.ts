// src/app/lib/currency-utils.ts
import { useState, useCallback } from 'react';
import Freecurrencyapi from '@everapi/freecurrencyapi-js';

// Popular currencies with their display names and symbols
export const CURRENCY_CONFIG = {
    USD: { name: 'US Dollar', symbol: '$' },
    EUR: { name: 'Euro', symbol: '€' },
    GBP: { name: 'British Pound', symbol: '£' },
    JPY: { name: 'Japanese Yen', symbol: '¥' },
    CAD: { name: 'Canadian Dollar', symbol: 'C$' },
    AUD: { name: 'Australian Dollar', symbol: 'A$' },
    CHF: { name: 'Swiss Franc', symbol: 'CHF' },
    CNY: { name: 'Chinese Yuan', symbol: '¥' },
    SEK: { name: 'Swedish Krona', symbol: 'kr' },
    NZD: { name: 'New Zealand Dollar', symbol: 'NZ$' },
    MXN: { name: 'Mexican Peso', symbol: '$' },
    SGD: { name: 'Singapore Dollar', symbol: 'S$' },
    HKD: { name: 'Hong Kong Dollar', symbol: 'HK$' },
    NOK: { name: 'Norwegian Krone', symbol: 'kr' },
    KRW: { name: 'South Korean Won', symbol: '₩' },
    INR: { name: 'Indian Rupee', symbol: '₹' },
    BRL: { name: 'Brazilian Real', symbol: 'R$' },
    PLN: { name: 'Polish Zloty', symbol: 'zł' },
    CZK: { name: 'Czech Koruna', symbol: 'Kč' },
    THB: { name: 'Thai Baht', symbol: '฿' }
};

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const CACHE_KEY = 'tcg_currency_rates';
const CACHE_TIMESTAMP_KEY = 'tcg_currency_rates_timestamp';

interface ExchangeRateCache {
    rates: Record<string, number>;
    timestamp: number;
}

interface CurrencyData {
    code: string;
    name: string;
    symbol: string;
}

export const useCurrency = () => {
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get available currencies from our configuration
    const availableCurrencies: CurrencyData[] = Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
        code,
        name: config.name,
        symbol: config.symbol
    }));

    // Load cached rates from localStorage
    const loadCachedRates = (): Record<string, number> | null => {
        if (typeof window === 'undefined') return null;

        try {
            const cachedRates = localStorage.getItem(CACHE_KEY);
            const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

            if (!cachedRates || !cachedTimestamp) return null;

            const timestamp = parseInt(cachedTimestamp);
            if (Date.now() - timestamp > CACHE_DURATION) {
                // Cache expired
                localStorage.removeItem(CACHE_KEY);
                localStorage.removeItem(CACHE_TIMESTAMP_KEY);
                return null;
            }

            return JSON.parse(cachedRates);
        } catch (error) {
            console.error('Error loading cached exchange rates:', error);
            return null;
        }
    };

    // Save rates to localStorage
    const saveCachedRates = (rates: Record<string, number>) => {
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
            localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch (error) {
            console.error('Error saving exchange rates to cache:', error);
        }
    };

    // Fetch exchange rates from API
    const fetchRates = useCallback(async () => {
        // First try to load from cache
        const cachedRates = loadCachedRates();
        if (cachedRates) {
            setExchangeRates(cachedRates);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Check if API key is available
            const apiKey = process.env.NEXT_PUBLIC_FREECURRENCY_API_KEY;
            if (!apiKey) {
                throw new Error('Currency API key not configured');
            }

            const freecurrencyapi = new Freecurrencyapi(apiKey);

            // Get all supported currencies from our config
            const currencies = Object.keys(CURRENCY_CONFIG).filter(code => code !== 'USD').join(',');

            const response = await freecurrencyapi.latest({
                base_currency: 'USD',
                currencies: currencies
            });

            if (response && response.data) {
                const rates = { USD: 1, ...response.data };
                setExchangeRates(rates);
                saveCachedRates(rates);
                setError(null);
            } else {
                throw new Error('Invalid response format from currency API');
            }
        } catch (err) {
            console.error('Error fetching exchange rates:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch exchange rates');

            // Fall back to USD only
            setExchangeRates({ USD: 1 });
        } finally {
            setLoading(false);
        }
    }, []);

    // Convert USD amount to target currency
    const convertUSDTo = (usdAmount: number, targetCurrency: string): number => {
        if (!usdAmount || !targetCurrency || targetCurrency === 'USD') {
            return usdAmount;
        }

        const rate = exchangeRates[targetCurrency];
        if (!rate) {
            console.warn(`Exchange rate not found for ${targetCurrency}, using USD`);
            return usdAmount;
        }

        return usdAmount * rate;
    };

    // Format currency amount with proper symbol and decimal places
    const formatCurrency = (amount: number, currency: string): string => {
        if (!amount && amount !== 0) return '0.00';

        const config = CURRENCY_CONFIG[currency as keyof typeof CURRENCY_CONFIG];
        if (!config) return `${amount.toFixed(2)}`;

        // Special formatting for certain currencies
        if (currency === 'JPY' || currency === 'KRW') {
            // These currencies typically don't use decimal places
            return `${config.symbol}${Math.round(amount).toLocaleString()}`;
        }

        // Standard formatting with 2 decimal places
        return `${config.symbol}${amount.toFixed(2)}`;
    };

    // Get currency symbol
    const getCurrencySymbol = (currency: string): string => {
        const config = CURRENCY_CONFIG[currency as keyof typeof CURRENCY_CONFIG];
        return config?.symbol || currency;
    };

    // Check if currency is supported
    const isCurrencySupported = (currency: string): boolean => {
        return currency in CURRENCY_CONFIG;
    };

    return {
        exchangeRates,
        availableCurrencies,
        loading,
        error,
        fetchRates,
        convertUSDTo,
        formatCurrency,
        getCurrencySymbol,
        isCurrencySupported
    };
};