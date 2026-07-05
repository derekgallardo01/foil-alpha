"use client";

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  Card,
  CardContent,
  Tabs,
  Tab,
  Chip,
  Button
} from '@mui/material';
import {
  TrendingUp,
  Gavel,
  NewReleases,
  Whatshot,
  Assessment,
  Refresh,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import TrendingCardsTable from '../components/dashboard/TrendingCardsTable';
import LiveAuctionTable from '../components/dashboard/LiveAuctionTable';
import NewReleasesCarousel from '../components/dashboard/NewReleasesCarousel';
import PopularityMetrics from '../components/dashboard/PopularityMetrics';
import PriceChart from '../components/PriceChart';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

interface DashboardStats {
  totalValue: number;
  totalCards: number;
  activeAuctions: number;
  recentSales: number;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<DashboardStats>({
    totalValue: 0,
    totalCards: 0,
    activeAuctions: 0,
    recentSales: 0
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch user stats
  const fetchUserStats = async () => {
    if (!session?.user?.id) return;

    try {
      // Fetch user collection stats
      const collectionRes = await fetch('/api/user/collection');
      const collectionData = await collectionRes.json();

      // Fetch active auctions
      const auctionsRes = await fetch('/api/bids?user_id=' + session.user.id);
      const auctionsData = await auctionsRes.json();

      setStats({
        totalValue: collectionData.totalValue || 0,
        totalCards: collectionData.totalCards || 0,
        activeAuctions: auctionsData.filter((bid: any) => bid.is_active).length,
        recentSales: collectionData.recentSales || 0
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUserStats();
    }
  }, [status, session]);

  const handleRefresh = () => {
    setLastRefresh(new Date());
    fetchUserStats();
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <AppShell>
      {/* Page header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", px: { xs: 2, md: 3 }, pt: 3, pb: 1 }}>
        <Typography variant="h4" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DashboardIcon color="primary" />
          Market Dashboard
        </Typography>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
          <Button variant="outlined" startIcon={<Refresh />} onClick={handleRefresh}>
            Refresh
          </Button>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          {/* User Stats Cards */}
          {session && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Collection Value
                      </Typography>
                      <Typography variant="h4" sx={{ color: '#9B5Cff', fontWeight: 'bold' }}>
                        ${stats.totalValue.toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Total Cards
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                        {stats.totalCards}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Active Bids
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                        {stats.activeAuctions}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Recent Sales
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                        {stats.recentSales}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {/* Main Dashboard Tabs */}
          <motion.div variants={itemVariants}>
            <Paper sx={{ bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)', mb: 3 }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  borderBottom: '1px solid rgba(155, 92, 255, 0.2)',
                  '& .MuiTab-root': {
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      color: '#9B5Cff'
                    }
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#9B5Cff'
                  }
                }}
              >
                <Tab icon={<Assessment />} label="Overview" />
                <Tab icon={<TrendingUp />} label="Trending" />
                <Tab icon={<Gavel />} label="Live Auctions" />
                <Tab icon={<NewReleases />} label="New Releases" />
                <Tab icon={<Whatshot />} label="Popular" />
              </Tabs>
            </Paper>
          </motion.div>

          {/* Tab Content */}
          {activeTab === 0 && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={3}>
                {/* Trending Cards - Half Width */}
                <Grid item xs={12} lg={6}>
                  <TrendingCardsTable limit={5} height={400} />
                </Grid>

                {/* Popular Cards - Half Width */}
                <Grid item xs={12} lg={6}>
                  <PopularityMetrics limit={5} />
                </Grid>

                {/* Live Auctions - Full Width */}
                <Grid item xs={12}>
                  <LiveAuctionTable limit={5} height={400} />
                </Grid>

                {/* New Releases - Full Width */}
                <Grid item xs={12}>
                  <NewReleasesCarousel limit={6} />
                </Grid>
              </Grid>
            </motion.div>
          )}

          {activeTab === 1 && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TrendingCardsTable limit={20} height={600} />
                </Grid>
                {/* Price Chart for Top Trending Card */}
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <Typography variant="h6" gutterBottom>
                      Price Trend Analysis
                    </Typography>
                    <PriceChart cardId={1} height={300} />
                  </Paper>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {activeTab === 2 && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <LiveAuctionTable limit={20} height={700} autoRefresh={true} />
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        Auction Activity
                      </Typography>
                      <Chip
                        label="Real-time updates enabled"
                        color="success"
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Auctions refresh automatically every 30 seconds. Click on any auction to place a bid.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {activeTab === 3 && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <NewReleasesCarousel limit={12} />
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <Typography variant="h6" gutterBottom>
                      Release Calendar
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Stay updated with the latest Pokemon TCG releases and pre-order opportunities.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {activeTab === 4 && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <PopularityMetrics limit={10} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <Typography variant="h6" gutterBottom>
                      Popularity Trends
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cards are ranked by views, active listings, and recent sales activity.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, bgcolor: 'grey.800', border: '1px solid rgba(155, 92, 255, 0.2)' }}>
                    <Typography variant="h6" gutterBottom>
                      Market Insights
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Popular cards often indicate market trends and potential investment opportunities.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </motion.div>
          )}
        </motion.div>
      </Container>
    </AppShell>
  );
}