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
import { useTheme } from "@mui/material/styles";
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

  const getPriceChartData = (history: PriceHistory[]) => {
    const dates = Array.from(new Set(history.map(item => new Date(item.recorded_at).toLocaleDateString()))).sort();

    const retailers = ['Target', 'Walmart', 'BestBuy', 'GameStop', 'Barnes & Noble'];
    const datasets = retailers.map(retailer => {
      const prices = dates.map(date => {
        const entry = history.find(
          item => item.retailer === retailer && new Date(item.recorded_at).toLocaleDateString() === date
        );
        return entry ? parseFloat(entry.price.replace('$', '')) : null;
      });

      return {
        label: `Price History (${retailer})`,
        data: prices,
        borderColor: retailer === 'Target' ? '#9B5Cff' : 
                    retailer === 'Walmart' ? '#ffcc00' : 
                    retailer === 'BestBuy' ? '#ff4444' : 
                    retailer === 'GameStop' ? '#00bcd4' : '#9c27b0',
        backgroundColor: retailer === 'Target' ? 'rgba(155, 92, 255, 0.2)' : 
                        retailer === 'Walmart' ? 'rgba(255, 204, 0, 0.2)' : 
                        retailer === 'BestBuy' ? 'rgba(255, 68, 68, 0.2)' : 
                        retailer === 'GameStop' ? 'rgba(0, 188, 212, 0.2)' : 'rgba(156, 39, 176, 0.2)',
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
        title: {
          display: true,
          text: 'Price ($)',
          color: '#FFFFFF',
        },
        ticks: { color: '#90a4ae' },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
          color: '#FFFFFF',
        },
        ticks: { color: '#90a4ae' },
      }
    },
    plugins: {
      legend: { 
        labels: { color: '#FFFFFF' }
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
        }
      }
    }
  };

  return (
    <AppShell>
      <Container sx={{ marginTop: 4, marginBottom: 4, paddingLeft: 0, paddingRight: 0 }}>
      <Box
        component="section"
        sx={{
          width: "100%",
          padding: "20px",
          marginTop: "20px",
          backgroundColor: "background.paper",
          color: "text.primary",
          borderRadius: 2,
          border: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="h2" sx={{ marginBottom: "20px", fontSize: "2rem", color: "primary.main" }}>
          Product Watchlist
        </Typography>
        <Button
          variant="contained"
          onClick={triggerScrape}
          disabled={loading}
          sx={{ marginBottom: "20px" }}
        >
          {loading ? "Refreshing..." : "Refresh Products"}
        </Button>

        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
            <CircularProgress size={60} thickness={4} sx={{ color: "primary.main", marginBottom: "20px" }} />
            <Typography variant="body1" sx={{ color: "text.secondary", fontSize: "1.2rem" }}>
              Fetching product data...
            </Typography>
          </Box>
        ) : error ? (
          <Typography variant="body1" sx={{ textAlign: "center", fontSize: "18px", color: "error.main", padding: "20px" }}>
            Error: {error}
          </Typography>
        ) : products.length > 0 ? (
          products.map((product, index) => {
            const productPriceHistory = getProductPriceHistory(product.product_id);

            // Calculate trends for each retailer
            const targetTrend = getPriceTrend(productPriceHistory, 'Target');
            const walmartTrend = getPriceTrend(productPriceHistory, 'Walmart');
            const bestbuyTrend = getPriceTrend(productPriceHistory, 'BestBuy');
            const gamestopTrend = getPriceTrend(productPriceHistory, 'GameStop');
            const barnesNobleTrend = getPriceTrend(productPriceHistory, 'Barnes & Noble');

            // Get the latest price for each retailer
            const latestTargetPriceEntry = productPriceHistory
              .filter(item => item.retailer === 'Target')
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
            const latestWalmartPriceEntry = productPriceHistory
              .filter(item => item.retailer === 'Walmart')
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
            const latestBestbuyPriceEntry = productPriceHistory
              .filter(item => item.retailer === 'BestBuy')
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
            const latestGamestopPriceEntry = productPriceHistory
              .filter(item => item.retailer === 'GameStop')
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
            const latestBarnesNoblePriceEntry = productPriceHistory
              .filter(item => item.retailer === 'Barnes & Noble')
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];

            const latestTargetPrice = latestTargetPriceEntry ? latestTargetPriceEntry.price : 'N/A';
            const latestWalmartPrice = latestWalmartPriceEntry ? latestWalmartPriceEntry.price : 'N/A';
            const latestBestbuyPrice = latestBestbuyPriceEntry ? latestBestbuyPriceEntry.price : 'N/A';
            const latestGamestopPrice = latestGamestopPriceEntry ? latestGamestopPriceEntry.price : 'N/A';
            const latestBarnesNoblePrice = latestBarnesNoblePriceEntry ? latestBarnesNoblePriceEntry.price : 'N/A';

            return (
              <Box
                key={`${product.product_id}-${index}`}
                sx={{
                  backgroundColor: "background.default",
                  padding: "15px",
                  borderRadius: 2,
                  marginBottom: "20px",
                  border: 1,
                  borderColor: "divider",
                }}
              >
                <Typography variant="h3" sx={{ fontSize: "1.5rem", color: "text.secondary", fontWeight: "bold", marginBottom: "8px" }}>
                  Product {index + 1}
                </Typography>
                <Typography variant="h4" sx={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "8px", color: "text.primary" }}>
                  {he.decode(product.title)}
                </Typography>
                <a href={product.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "200px" }}>
                  <Image
                    width={200}
                    height={200}
                    src={product.image}
                    alt={product.title}
                    style={{
                      borderRadius: "8px",
                      border: `1px solid ${theme.palette.divider}`,
                      display: "block",
                      marginBottom: "10px",
                    }}
                  />
                </a>

                {/* Display Latest Prices and Trends for Each Retailer */}
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "text.primary" }}>
                  <span style={{ color: theme.palette.text.secondary }}>Target: </span>
                  <span style={{ color: theme.palette.text.primary, fontWeight: "bold", fontFamily: '"JetBrains Mono Variable", monospace' }}>{latestTargetPrice}</span>
                  {targetTrend && (
                    <span style={{ 
                      color: targetTrend === '↑' ? theme.palette.success.main : targetTrend === '↓' ? theme.palette.error.main : theme.palette.text.secondary,
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {targetTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "text.primary" }}>
                  <span style={{ color: theme.palette.text.secondary }}>Walmart: </span>
                  <span style={{ color: theme.palette.text.primary, fontWeight: "bold", fontFamily: '"JetBrains Mono Variable", monospace' }}>{latestWalmartPrice}</span>
                  {walmartTrend && (
                    <span style={{ 
                      color: walmartTrend === '↑' ? theme.palette.success.main : walmartTrend === '↓' ? theme.palette.error.main : theme.palette.text.secondary,
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {walmartTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "text.primary" }}>
                  <span style={{ color: theme.palette.text.secondary }}>BestBuy: </span>
                  <span style={{ color: theme.palette.text.primary, fontWeight: "bold", fontFamily: '"JetBrains Mono Variable", monospace' }}>{latestBestbuyPrice}</span>
                  {bestbuyTrend && (
                    <span style={{ 
                      color: bestbuyTrend === '↑' ? theme.palette.success.main : bestbuyTrend === '↓' ? theme.palette.error.main : theme.palette.text.secondary,
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {bestbuyTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "text.primary" }}>
                  <span style={{ color: theme.palette.text.secondary }}>GameStop: </span>
                  <span style={{ color: theme.palette.text.primary, fontWeight: "bold", fontFamily: '"JetBrains Mono Variable", monospace' }}>{latestGamestopPrice}</span>
                  {gamestopTrend && (
                    <span style={{ 
                      color: gamestopTrend === '↑' ? theme.palette.success.main : gamestopTrend === '↓' ? theme.palette.error.main : theme.palette.text.secondary,
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {gamestopTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "text.primary" }}>
                  <span style={{ color: theme.palette.text.secondary }}>Barnes & Noble: </span>
                  <span style={{ color: theme.palette.text.primary, fontWeight: "bold", fontFamily: '"JetBrains Mono Variable", monospace' }}>{latestBarnesNoblePrice}</span>
                  {barnesNobleTrend && (
                    <span style={{ 
                      color: barnesNobleTrend === '↑' ? theme.palette.success.main : barnesNobleTrend === '↓' ? theme.palette.error.main : theme.palette.text.secondary,
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {barnesNobleTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="body1" sx={{ fontSize: "1rem", fontWeight: "500", marginBottom: "5px" }}>
                  <span style={{ color: theme.palette.text.secondary }}>Stock Status: </span>
                  <span
                    style={{
                      color: product.stockStatus.toLowerCase() === "in stock" ? theme.palette.success.main : theme.palette.error.main,
                      fontWeight: "bold",
                    }}
                  >
                    {product.stockStatus}
                  </span>
                </Typography>
                {product.release_date && (
                  <Typography variant="body1" sx={{ fontSize: "1rem", fontWeight: "500", marginBottom: "10px" }}>
                    <span style={{ color: theme.palette.text.secondary }}>Release Date: </span>
                    <span style={{ color: theme.palette.text.primary, fontWeight: "bold", fontFamily: '"JetBrains Mono Variable", monospace' }}>
                      {new Date(product.release_date).toLocaleDateString()}
                    </span>
                  </Typography>
                )}

                {/* Price History Accordion with Combined Chart */}
                {productPriceHistory.length > 0 && (
                  <Accordion sx={{ backgroundColor: "background.paper", color: "text.primary", marginBottom: "10px", border: 1, borderColor: "divider" }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: "text.secondary" }} />}>
                      <Typography>Price History (All Retailers)</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ height: '200px', marginBottom: '15px' }}>
                        <Line 
                          data={getPriceChartData(productPriceHistory)} 
                          options={chartOptions}
                        />
                      </Box>
                      <Box sx={{ 
                        maxHeight: '150px', 
                        overflowY: 'auto',
                        backgroundColor: 'background.default',
                        padding: '10px',
                        borderRadius: '4px',
                      }}>
                        {productPriceHistory.map((price, idx) => (
                          <Box
                            key={price.id}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '5px 0',
                              borderBottom: idx === productPriceHistory.length - 1 ? 'none' : 1,
                              borderColor: 'divider',
                              color: 'text.secondary',
                              '&:hover': {
                                backgroundColor: 'action.hover',
                                color: 'text.primary',
                              },
                            }}
                          >
                            <Typography sx={{ fontSize: '0.9rem' }}>
                              {price.retailer} - {new Date(price.recorded_at).toLocaleString()}
                            </Typography>
                            <Typography variant="mono" sx={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'text.primary' }}>
                              {price.price}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}

                <Button
                  variant="outlined"
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    borderColor: "divider",
                    color: "text.primary",
                    padding: "8px 15px",
                    marginRight: "10px",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    "&:hover": { backgroundColor: "action.hover", borderColor: "divider" },
                  }}
                >
                  View Product
                </Button>
                {product.screenshot && (
                  <Button
                    variant="outlined"
                    href={product.screenshot}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      borderColor: "divider",
                      color: "text.primary",
                      padding: "8px 15px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      "&:hover": { backgroundColor: "action.hover", borderColor: "divider" },
                    }}
                  >
                    View Screenshot
                  </Button>
                )}
                <Divider sx={{ marginY: "10px" }} />
              </Box>
            );
          })
        ) : (
          <Typography sx={{ textAlign: "center", fontSize: "18px", padding: "20px", color: "text.secondary" }}>
            No product details found
          </Typography>
        )}
      </Box>
      </Container>
    </AppShell>
  );
};

export default Watchlist;