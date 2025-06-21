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
        borderColor: retailer === 'Target' ? '#96ff9b' : 
                    retailer === 'Walmart' ? '#ffcc00' : 
                    retailer === 'BestBuy' ? '#ff4444' : 
                    retailer === 'GameStop' ? '#00bcd4' : '#9c27b0',
        backgroundColor: retailer === 'Target' ? 'rgba(150, 255, 155, 0.2)' : 
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
    <Container sx={{ marginTop: 4, marginBottom: 4, paddingLeft: 0, paddingRight: 0 }}>
      <Box
        component="section"
        sx={{
          width: "100%",
          padding: "20px",
          marginTop: "20px",
          backgroundColor: "#1E1E1E",
          color: "#FFFFFF",
          borderRadius: "10px",
          boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.3)",
        }}
      >
        <Typography variant="h2" color="#ffffff" sx={{ marginBottom: "20px", fontSize: "2rem" }}>
          Product Watchlist
        </Typography>
        <Button
          variant="contained"
          onClick={triggerScrape}
          disabled={loading}
          sx={{ marginBottom: "20px", backgroundColor: "#96ff9b", color: "#1E1E1E" }}
        >
          {loading ? "Refreshing..." : "Refresh Products"}
        </Button>

        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
            <CircularProgress size={60} thickness={4} sx={{ color: "#96ff9b", marginBottom: "20px" }} />
            <Typography variant="body1" sx={{ color: "#90a4ae", fontSize: "1.2rem" }}>
              Fetching product data...
            </Typography>
          </Box>
        ) : error ? (
          <Typography variant="body1" sx={{ textAlign: "center", fontSize: "18px", color: "#E57373", padding: "20px" }}>
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
              <div
                key={`${product.product_id}-${index}`}
                style={{
                  backgroundColor: "#2A2A2A",
                  padding: "15px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.2)",
                }}
              >
                <Typography variant="h3" sx={{ fontSize: "1.5rem", color: "#90a4ae", fontWeight: "bold", marginBottom: "8px" }}>
                  Product {index + 1}
                </Typography>
                <Typography variant="h4" sx={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "8px", color: "#FFFFFF" }}>
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
                      border: `2px solid ${theme.palette.primary.main}`,
                      display: "block",
                      marginBottom: "10px",
                    }}
                  />
                </a>

                {/* Display Latest Prices and Trends for Each Retailer */}
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "#FFFFFF" }}>
                  <span style={{ color: "rgb(144 164 174)" }}>Target: </span>
                  <span style={{ color: "#96ff9b", fontWeight: "bold" }}>{latestTargetPrice}</span>
                  {targetTrend && (
                    <span style={{ 
                      color: targetTrend === '↑' ? '#E57373' : targetTrend === '↓' ? '#66BB6A' : '#90a4ae',
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {targetTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "#FFFFFF" }}>
                  <span style={{ color: "rgb(144 164 174)" }}>Walmart: </span>
                  <span style={{ color: "#ffcc00", fontWeight: "bold" }}>{latestWalmartPrice}</span>
                  {walmartTrend && (
                    <span style={{ 
                      color: walmartTrend === '↑' ? '#E57373' : walmartTrend === '↓' ? '#66BB6A' : '#90a4ae',
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {walmartTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "#FFFFFF" }}>
                  <span style={{ color: "rgb(144 164 174)" }}>BestBuy: </span>
                  <span style={{ color: "#ff4444", fontWeight: "bold" }}>{latestBestbuyPrice}</span>
                  {bestbuyTrend && (
                    <span style={{ 
                      color: bestbuyTrend === '↑' ? '#E57373' : bestbuyTrend === '↓' ? '#66BB6A' : '#90a4ae',
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {bestbuyTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "#FFFFFF" }}>
                  <span style={{ color: "rgb(144 164 174)" }}>GameStop: </span>
                  <span style={{ color: "#00bcd4", fontWeight: "bold" }}>{latestGamestopPrice}</span>
                  {gamestopTrend && (
                    <span style={{ 
                      color: gamestopTrend === '↑' ? '#E57373' : gamestopTrend === '↓' ? '#66BB6A' : '#90a4ae',
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {gamestopTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "5px", color: "#FFFFFF" }}>
                  <span style={{ color: "rgb(144 164 174)" }}>Barnes & Noble: </span>
                  <span style={{ color: "#9c27b0", fontWeight: "bold" }}>{latestBarnesNoblePrice}</span>
                  {barnesNobleTrend && (
                    <span style={{ 
                      color: barnesNobleTrend === '↑' ? '#E57373' : barnesNobleTrend === '↓' ? '#66BB6A' : '#90a4ae',
                      marginLeft: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {barnesNobleTrend}
                    </span>
                  )}
                </Typography>
                <Typography variant="body1" sx={{ fontSize: "1rem", fontWeight: "500", marginBottom: "5px" }}>
                  <span style={{ color: "rgb(144 164 174)" }}>Stock Status: </span>
                  <span
                    style={{
                      color: product.stockStatus.toLowerCase() === "in stock" ? "#66BB6A" : "#E57373",
                      fontWeight: "bold",
                    }}
                  >
                    {product.stockStatus}
                  </span>
                </Typography>
                {product.release_date && (
                  <Typography variant="body1" sx={{ fontSize: "1rem", fontWeight: "500", marginBottom: "10px" }}>
                    <span style={{ color: "rgb(144 164 174)" }}>Release Date: </span>
                    <span style={{ color: "#FFFFFF", fontWeight: "bold" }}>
                      {new Date(product.release_date).toLocaleDateString()}
                    </span>
                  </Typography>
                )}

                {/* Price History Accordion with Combined Chart */}
                {productPriceHistory.length > 0 && (
                  <Accordion sx={{ backgroundColor: "#333333", color: "#FFFFFF", marginBottom: "10px" }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: "#FFFFFF" }} />}>
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
                        backgroundColor: '#2A2A2A',
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
                              borderBottom: idx === productPriceHistory.length - 1 ? 'none' : '1px solid #455A64',
                              color: '#90a4ae',
                              '&:hover': {
                                backgroundColor: '#3A3A3A',
                                color: '#FFFFFF',
                              },
                            }}
                          >
                            <Typography sx={{ fontSize: '0.9rem' }}>
                              {price.retailer} - {new Date(price.recorded_at).toLocaleString()}
                            </Typography>
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#96ff9b' }}>
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
                    borderColor: "primary",
                    color: "#ffffff",
                    padding: "8px 15px",
                    marginRight: "10px",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    "&:hover": { backgroundColor: "primary", color: "#ffffff" },
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
                      borderColor: "secondary",
                      color: "#ffffff",
                      padding: "8px 15px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      "&:hover": { backgroundColor: "secondary", color: "#ffffff" },
                    }}
                  >
                    View Screenshot
                  </Button>
                )}
                <Divider sx={{ borderBottom: "0.5px solid #455A64", marginY: "10px" }} />
              </div>
            );
          })
        ) : (
          <Typography sx={{ textAlign: "center", fontSize: "18px", padding: "20px" }}>
            No product details found
          </Typography>
        )}
      </Box>
    </Container>
  );
};

export default Watchlist;