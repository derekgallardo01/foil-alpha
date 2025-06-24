// File: components/StockChecker.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Backdrop,
  Link,
  Chip,
} from '@mui/material';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface StockInfo {
  isOutOfStockInAllStores: boolean;
  soldOut: boolean;
  storeAvailability: string;
  storeQuantity: number;
  shipAvailability: string;
  shipQuantity: number;
  scheduledDelivery: string;
}

interface ApiResponse {
  data: {
    product: {
      fulfillment: {
        is_out_of_stock_in_all_store_locations: boolean;
        sold_out: boolean;
        store_options: Array<{
          order_pickup: { availability_status: string };
          location_available_to_promise_quantity: number;
        }>;
        shipping_options: {
          availability_status: string;
          available_to_promise_quantity: number;
        };
        scheduled_delivery: { availability_status: string };
      };
    };
  };
}

const AnimatedCard = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

const API_URL = '/api/proxy-target';
const TCIN = '94300072';
const STORE_ID = '746';
const ZIP = '33186';
const STATE = 'FL';
const LATITUDE = '25.660';
const LONGITUDE = '-80.410';
const VISITOR_ID = '00000000027F010142CAF3A8F5970299';
const POLLING_INTERVAL = 300000; // 5 minutes

export default function StockChecker() {
  const [stockStatus, setStockStatus] = useState<StockInfo | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchStockData = async () => {
    setIsLoading(true);
    const url = `${API_URL}?tcin=${TCIN}&store_id=${STORE_ID}&zip=${ZIP}&state=${STATE}&latitude=${LATITUDE}&longitude=${LONGITUDE}&scheduled_delivery_store_id=${STORE_ID}&visitor_id=${VISITOR_ID}`;

    try {
      console.log('Initiating API request:', { url, timestamp: new Date().toISOString() });
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No response body');
        throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}, body: ${errorText}`);
      }

      const data: ApiResponse = await response.json();
      console.log('API response data:', JSON.stringify(data, null, 2));

      const fulfillment = data?.data?.product?.fulfillment;
      const stockInfo: StockInfo = {
        isOutOfStockInAllStores: fulfillment?.is_out_of_stock_in_all_store_locations,
        soldOut: fulfillment?.sold_out,
        storeAvailability: fulfillment?.store_options?.[0]?.order_pickup?.availability_status,
        storeQuantity: fulfillment?.store_options?.[0]?.location_available_to_promise_quantity,
        shipAvailability: fulfillment?.shipping_options?.availability_status,
        shipQuantity: fulfillment?.shipping_options?.available_to_promise_quantity,
        scheduledDelivery: fulfillment?.scheduled_delivery?.availability_status,
      };

      setStockStatus(stockInfo);
      setLastChecked(new Date());
      setError(null);
      toast.success('Stock data updated and saved!', { position: 'top-right' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('API request failed:', { error: errorMessage, timestamp: new Date().toISOString(), url });
      setError(errorMessage);
      setStockStatus(null);
      toast.error(`Error: ${errorMessage}`, { position: 'top-right' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('stockStatus updated:', stockStatus);
  }, [stockStatus]);

  useEffect(() => {
    fetchStockData();
    const intervalId = setInterval(fetchStockData, POLLING_INTERVAL);
    return () => {
      console.log('Cleaning up polling interval:', intervalId);
      clearInterval(intervalId);
    };
  }, []);

  const availabilityStatus = stockStatus
    ? (stockStatus.storeAvailability === 'AVAILABLE' || stockStatus.shipAvailability === 'AVAILABLE' || stockStatus.scheduledDelivery === 'AVAILABLE')
      ? 'In Stock'
      : 'Out of Stock'
    : null;

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={isLoading}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'grey.900',
          p: 3,
          position: 'relative',
          background: 'linear-gradient(181deg, #000000bd, #031e04, #0000002b, #000000d4)',
          backgroundSize: '200% 200%',
          animation: 'gradientShift 15s ease infinite',
        }}
      >
        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.6 }}>
              <Paper
                elevation={6}
                sx={{
                  p: 4,
                  bgcolor: 'grey.900',
                  backgroundImage: 'linear-gradient(#000000, rgba(0, 0, 0, 0))',
                  borderRadius: 2,
                  boxShadow: '0 0 10px rgba(150, 255, 155, 0.21)',
                }}
              >
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Image
                      src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
                      alt="TCG Market Logo"
                      width={200}
                      height={100}
                      priority
                      onError={() => console.error('Failed to load logo image')}
                    />
                  </motion.div>
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    textAlign: 'center',
                    color: '#96FF9B',
                    mb: 1,
                    fontWeight: 'bold',
                    textShadow: '0 0 10px rgba(150, 255, 155, 0.5)',
                  }}
                >
                  Pokémon Stock Availability
                </Typography>
                <Typography variant="h4" sx={{ mb: 1, textAlign: 'center', color: 'text.primary' }}>
                  Prismatic Evolutions Checker
                </Typography>
                <Typography variant="subtitle1" sx={{ textAlign: 'center', color: 'grey.400', mb: 3 }}>
                  Real-time stock for TCIN: {TCIN} at Store ID: {STORE_ID} (Kendall, Miami, FL)
                </Typography>

                <Box>
                  {error && (
                    <Box
                      sx={{
                        textAlign: 'center',
                        color: 'white',
                        mt: 2,
                        p: 2,
                        bgcolor: 'error.light',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body1">Error: {error}</Typography>
                      <Button
                        onClick={fetchStockData}
                        variant="contained"
                        sx={{ bgcolor: 'green.600', '&:hover': { bgcolor: 'green.700' }, mt: 1 }}
                        disabled={isLoading}
                        aria-label="Retry Stock Check"
                      >
                        Retry
                      </Button>
                    </Box>
                  )}

                  {stockStatus && (
                    <AnimatedCard delay={0.1}>
                      <Paper
                        elevation={6}
                        sx={{
                          p: 4,
                          bgcolor: 'grey.900',
                          backgroundImage: 'linear-gradient(#000000, rgba(0, 0, 0, 0))',
                          borderRadius: 2,
                          boxShadow: '0 0 10px rgba(150, 255, 155, 0.21)',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                          <Chip
                            label={availabilityStatus}
                            color={availabilityStatus === 'In Stock' ? 'success' : 'error'}
                            sx={{
                              fontWeight: 'bold',
                              bgcolor:
                                availabilityStatus === 'In Stock'
                                  ? 'rgba(150, 255, 155, 0.2)'
                                  : 'rgba(239, 83, 80, 0.2)',
                              color: availabilityStatus === 'In Stock' ? '#96FF9B' : '#EF5350',
                            }}
                          />
                        </Box>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 'bold',
                            color: 'text.primary',
                            mb: 2,
                          }}
                        >
                          Stock Status (Last checked: {lastChecked?.toLocaleString()})
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, color: 'grey.400' }}>
                          <li>
                            <Typography>
                              In-Store Pickup:{' '}
                              {stockStatus.storeAvailability === 'AVAILABLE'
                                ? `Available (${stockStatus.storeQuantity} units)`
                                : 'Unavailable'}
                            </Typography>
                          </li>
                          <li>
                            <Typography>
                              Shipping:{' '}
                              {stockStatus.shipAvailability === 'AVAILABLE'
                                ? `Available (${stockStatus.shipQuantity} units)`
                                : 'Out of Stock'}
                            </Typography>
                          </li>
                          <li>
                            <Typography>
                              Scheduled Delivery:{' '}
                              {stockStatus.scheduledDelivery === 'AVAILABLE' ? 'Available' : 'Unavailable'}
                            </Typography>
                          </li>
                        </Box>
                      </Paper>
                    </AnimatedCard>
                  )}

                  <Button
                    onClick={fetchStockData}
                    variant="contained"
                    sx={{
                      bgcolor: 'green.600',
                      '&:hover': { bgcolor: 'green.700' },
                      mt: 2,
                      width: '100%',
                    }}
                    disabled={isLoading}
                    aria-label="Refresh Stock Check"
                  >
                    Refresh Now
                  </Button>
                </Box>
              </Paper>
            </motion.div>
          </motion.div>
        </Container>

        <Box sx={{ textAlign: 'center', py: 2, bgcolor: 'grey.800', width: '100%', mt: 'auto' }}>
          <Typography variant="body2" sx={{ color: 'grey.400' }}>
            2025 TCG Market. All rights reserved.{' '}
            <Link
              href="/privacy"
              sx={{ color: '#96FF9B', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Privacy Policy
            </Link>{' '}
            |{' '}
            <Link
              href="/about"
              sx={{ color: '#96FF9B', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Learn More
            </Link>
          </Typography>
        </Box>
      </Box>
    </>
  );
}