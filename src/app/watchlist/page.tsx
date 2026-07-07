'use client';
import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  CircularProgress,
  Button,
  Box,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Visibility as WatchIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useTheme, alpha } from "@mui/material/styles";
import he from "he";
import axios from "axios";
import Image from "next/image";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from 'chart.js';
import AppShell from "../components/AppShell";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Product {
  product_id: string;
  retailer: string;
  title: string;
  url: string;
  image: string;
  screenshot: string;
  stockStatus: string;
  price: string;
  recorded_at: string | null;
  release_date?: string | null;
}

interface PriceHistory {
  id: string;
  product_id: string;
  retailer: string;
  price: string;
  recorded_at: string;
}

// Single source of truth for retailers — colors come from the theme, not hardcoded hex.
const RETAILERS = [
  { name: 'Target', colorKey: 'primary' },
  { name: 'Walmart', colorKey: 'warning' },
  { name: 'BestBuy', colorKey: 'error' },
  { name: 'GameStop', colorKey: 'info' },
  { name: 'Barnes & Noble', colorKey: 'success' },
] as const;

const Watchlist = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsResponse, priceHistoryResponse] = await Promise.all([
        axios.get<Product[]>("/api/products", { timeout: 10000 }),
        axios.get<PriceHistory[]>("/api/price-history", { timeout: 10000 })
      ]);

      const uniqueProducts = productsResponse.data.filter((product, index, self) =>
        index === self.findIndex((p) => p.product_id === product.product_id)
      );
      setProducts(uniqueProducts);
      setPriceHistory(priceHistoryResponse.data);
      setError(null);
    } catch (error) {
      setError(
        axios.isAxiosError(error)
          ? error.code === "ECONNABORTED"
            ? "Request timed out after 10 seconds"
            : error.response
              ? `Server error: ${error.response.status} - ${error.response.data?.error || "Unknown error"}`
              : "Network error: Unable to reach server"
          : "Unexpected error occurred"
      );
      setProducts([]);
      setPriceHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerScrape = async () => {
    try {
      setLoading(true);
      await axios.post("/api/scrapeTarget");
      await fetchData();
    } catch (error) {
      setError("Failed to start scraping: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  const getProductPriceHistory = (productId: string): PriceHistory[] => {
    return priceHistory
      .filter(price => price.product_id === productId)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  };

  const getPriceTrend = (history: PriceHistory[], retailer: string): string | null => {
    const filteredHistory = history.filter(item => item.retailer === retailer);
    if (filteredHistory.length < 2) return null;
    const latest = parseFloat(filteredHistory[filteredHistory.length - 1].price.replace('$', ''));
    const previous = parseFloat(filteredHistory[filteredHistory.length - 2].price.replace('$', ''));
    return latest > previous ? '↑' : latest < previous ? '↓' : '→';
  };

  const getLatestPrice = (history: PriceHistory[], retailer: string): string => {
    const entry = history
      .filter(item => item.retailer === retailer)
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
    return entry ? entry.price : 'N/A';
  };

  const getPriceChartData = (history: PriceHistory[]) => {
    const dates = Array.from(new Set(history.map(item => new Date(item.recorded_at).toLocaleDateString()))).sort();

    const datasets = RETAILERS.map(({ name, colorKey }) => {
      const color = theme.palette[colorKey].main;
      const prices = dates.map(date => {
        const entry = history.find(
          item => item.retailer === name && new Date(item.recorded_at).toLocaleDateString() === date
        );
        return entry ? parseFloat(entry.price.replace('$', '')) : null;
      });

      return {
        label: name,
        data: prices,
        borderColor: color,
        backgroundColor: alpha(color, 0.2),
        fill: false,
        tension: 0.1,
        hidden: prices.every(price => price === null),
      };
    });

    return {
      labels: dates,
      datasets: datasets.filter(dataset => !dataset.hidden),
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
        title: { display: true, text: 'Price ($)', color: theme.palette.text.secondary },
        ticks: { color: theme.palette.text.secondary },
        grid: { color: theme.palette.divider },
      },
      x: {
        title: { display: true, text: 'Date', color: theme.palette.text.secondary },
        ticks: { color: theme.palette.text.secondary },
        grid: { color: theme.palette.divider },
      }
    },
    plugins: {
      legend: { labels: { color: theme.palette.text.primary } },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
        }
      }
    }
  };

  const trendColor = (trend: string | null) =>
    trend === '↑' ? 'success.main' : trend === '↓' ? 'error.main' : 'text.secondary';

  return (
    <AppShell>
      <PageHeader
        title="Watchlist"
        icon={<WatchIcon />}
        subtitle="Retail sealed-product prices across stores"
        actions={
          <Button
            variant="contained"
            onClick={triggerScrape}
            disabled={loading}
            startIcon={<RefreshIcon />}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />
      <Container maxWidth="lg" sx={{ pb: 4 }}>
        {loading && products.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240, gap: 2 }}>
            <CircularProgress size={48} />
            <Typography variant="body2" color="text.secondary">Fetching product data…</Typography>
          </Box>
        ) : error && products.length === 0 ? (
          <ErrorState message="We couldn't load your watchlist." onRetry={fetchData} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<WatchIcon />}
            title="No products on your watchlist"
            description="Refresh to pull the latest tracked retail products."
            action={<Button variant="contained" onClick={triggerScrape} startIcon={<RefreshIcon />}>Refresh</Button>}
          />
        ) : (
          products.map((product, index) => {
            const productPriceHistory = getProductPriceHistory(product.product_id);
            const inStock = product.stockStatus.toLowerCase() === "in stock";

            return (
              <Box
                key={`${product.product_id}-${index}`}
                component="section"
                sx={{
                  backgroundColor: "background.paper",
                  p: 2.5,
                  borderRadius: 2,
                  mb: 2.5,
                  border: 1,
                  borderColor: "divider",
                }}
              >
                <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                  {he.decode(product.title)}
                </Typography>

                <a href={product.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: 200 }}>
                  <Image
                    width={200}
                    height={200}
                    src={product.image}
                    alt={product.title}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${theme.palette.divider}`,
                      display: "block",
                      marginBottom: 12,
                    }}
                  />
                </a>

                {/* Latest price + trend per retailer (config-driven) */}
                <Box sx={{ display: "grid", gap: 0.5, mb: 1.5 }}>
                  {RETAILERS.map(({ name }) => {
                    const price = getLatestPrice(productPriceHistory, name);
                    const trend = getPriceTrend(productPriceHistory, name);
                    return (
                      <Box key={name} sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                          {name}
                        </Typography>
                        <Typography variant="mono" sx={{ fontWeight: 700, color: price === 'N/A' ? 'text.disabled' : 'text.primary' }}>
                          {price}
                        </Typography>
                        {trend && (
                          <Typography variant="mono" sx={{ color: trendColor(trend) }}>
                            {trend}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>

                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Stock Status:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: inStock ? "success.main" : "error.main" }}>
                    {product.stockStatus}
                  </Typography>
                </Box>

                {product.release_date && (
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Release Date:</Typography>
                    <Typography variant="mono" sx={{ fontWeight: 700 }}>
                      {new Date(product.release_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}

                {/* Price History Accordion with Combined Chart */}
                {productPriceHistory.length > 0 && (
                  <Accordion sx={{ backgroundColor: "background.default", color: "text.primary", mt: 1.5, border: 1, borderColor: "divider" }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: "text.secondary" }} />}>
                      <Typography>Price History (All Retailers)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ height: 200, mb: 2 }}>
                        <Line data={getPriceChartData(productPriceHistory)} options={chartOptions} />
                      </Box>
                      <Box sx={{
                        maxHeight: 150,
                        overflowY: 'auto',
                        backgroundColor: 'background.paper',
                        p: 1.25,
                        borderRadius: 1,
                      }}>
                        {productPriceHistory.map((price, idx) => (
                          <Box
                            key={price.id}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              py: 0.5,
                              borderBottom: idx === productPriceHistory.length - 1 ? 'none' : 1,
                              borderColor: 'divider',
                              color: 'text.secondary',
                              '&:hover': { backgroundColor: 'action.hover', color: 'text.primary' },
                            }}
                          >
                            <Typography sx={{ fontSize: '0.9rem' }}>
                              {price.retailer} — {new Date(price.recorded_at).toLocaleString()}
                            </Typography>
                            <Typography variant="mono" sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.primary' }}>
                              {price.price}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  <Button variant="outlined" href={product.url} target="_blank" rel="noopener noreferrer">
                    View Product
                  </Button>
                  {product.screenshot && (
                    <Button variant="outlined" href={product.screenshot} target="_blank" rel="noopener noreferrer">
                      View Screenshot
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Container>
    </AppShell>
  );
};

export default Watchlist;
