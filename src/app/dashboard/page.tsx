"use client";

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Chip,
  Button
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  TrendingUp,
  Gavel,
  NewReleases,
  Whatshot,
  Assessment,
  Refresh,
  Dashboard as DashboardIcon,
  AccountBalanceWallet as WalletIcon,
  Collections as CollectionsIcon,
  Sell as SellIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import StatCard from '../components/StatCard';
import PortfolioOverview, { PortfolioSummary, PortfolioTopItem } from '../components/dashboard/PortfolioOverview';
import ForecastPanel from '../components/ForecastPanel';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import { StatRowSkeleton } from '../components/ui/Skeletons';
import { formatPrice } from '../lib/format';
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
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [topCard, setTopCard] = useState<{ id: number; name: string } | null>(null);
  const [portfolio, setPortfolio] = useState<{ summary: PortfolioSummary; topItems: PortfolioTopItem[] } | null>(null);

  // Fetch user stats
  const fetchUserStats = async () => {
    if (!session?.user?.id) return;

    setStatsError(false);
    try {
      const [collectionRes, auctionsRes] = await Promise.all([
        fetch('/api/user/collection?limit=1000'),
        fetch('/api/bids?user_id=' + session.user.id),
      ]);
      if (!collectionRes.ok || !auctionsRes.ok) throw new Error('Failed to load stats');

      const collectionData = await collectionRes.json();
      const auctionsData = await auctionsRes.json();

      setStats({
        totalValue: collectionData.totalValue || 0,
        totalCards: collectionData.totalCards || 0,
        activeAuctions: Array.isArray(auctionsData)
          ? auctionsData.filter((bid: any) => bid.is_active).length
          : 0,
        recentSales: collectionData.recentSales || 0
      });

      // Portfolio overview: holdings breakdown (from summary) + top items by value.
      const cards = Array.isArray(collectionData.cards) ? collectionData.cards : [];
      const topItems: PortfolioTopItem[] = [...cards]
        .filter((c: any) => c.card?.market_price)
        .sort((a: any, b: any) => (b.card.market_price || 0) - (a.card.market_price || 0))
        .slice(0, 5)
        .map((c: any) => ({
          name: c.card.name,
          value: c.card.market_price,
          image: c.card.image_url,
          graded: !!c.is_graded,
          sealed: c.card.product_type === 'SEALED',
          setName: c.card.set_name,
        }));
      setPortfolio(collectionData.summary ? { summary: collectionData.summary, topItems } : null);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUserStats();
    }
  }, [status, session]);

  // Resolve the actual top-trending card for the forecast/chart (replaces the
  // old hardcoded "Charizard" / cardId={1} placeholder).
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/dashboard/trending-cards?limit=1&type=price')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const card = d?.data?.[0];
        if (card?.id) setTopCard({ id: card.id, name: card.name });
      })
      .catch(() => {});
  }, [status]);

  const handleRefresh = () => {
    setLastRefresh(new Date());
    fetchUserStats();
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <AppShell>
      <PageHeader
        title="Market Dashboard"
        icon={<DashboardIcon />}
        actions={
          <>
            <Typography variant="body2" color="text.secondary">
              Updated {lastRefresh.toLocaleTimeString()}
            </Typography>
            <Button variant="outlined" startIcon={<Refresh />} onClick={handleRefresh}>
              Refresh
            </Button>
          </>
        }
      />

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          {/* User Stats Cards */}
          {session && (
            <motion.div variants={itemVariants}>
              <Box sx={{ mb: 3 }}>
                {statsLoading ? (
                  <StatRowSkeleton count={4} />
                ) : statsError ? (
                  <ErrorState
                    variant="inline"
                    message="Couldn't load your stats."
                    onRetry={fetchUserStats}
                  />
                ) : (
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <StatCard accent label="Collection Value" value={formatPrice(stats.totalValue)} icon={<WalletIcon fontSize="small" />} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <StatCard label="Total Cards" value={stats.totalCards} icon={<CollectionsIcon fontSize="small" />} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <StatCard label="Active Bids" value={stats.activeAuctions} icon={<Gavel fontSize="small" />} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <StatCard label="Recent Sales" value={stats.recentSales} icon={<SellIcon fontSize="small" />} />
                    </Grid>
                  </Grid>
                )}
              </Box>
            </motion.div>
          )}

          {/* Portfolio overview (holdings breakdown + most valuable) */}
          {session && portfolio && (
            <motion.div variants={itemVariants}>
              <Box sx={{ mb: 3 }}>
                <PortfolioOverview summary={portfolio.summary} topItems={portfolio.topItems} />
              </Box>
            </motion.div>
          )}

          {/* Main Dashboard Tabs */}
          <motion.div variants={itemVariants}>
            <Paper variant="outlined" sx={{ mb: 3 }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  '& .MuiTab-root': { color: 'text.secondary', '&.Mui-selected': { color: 'primary.main' } },
                  '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
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
                <Grid size={{ xs: 12, lg: 6 }}>
                  <TrendingCardsTable limit={5} height={400} />
                </Grid>

                {/* Popular Cards - Half Width */}
                <Grid size={{ xs: 12, lg: 6 }}>
                  <PopularityMetrics limit={5} />
                </Grid>

                {/* Live Auctions - Full Width */}
                <Grid size={{ xs: 12 }}>
                  <LiveAuctionTable limit={5} height={400} />
                </Grid>

                {/* New Releases - Full Width */}
                <Grid size={{ xs: 12 }}>
                  <NewReleasesCarousel limit={6} />
                </Grid>
              </Grid>
            </motion.div>
          )}

          {activeTab === 1 && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <TrendingCardsTable limit={20} height={600} />
                </Grid>
                {/* Price forecast + trend for the actual top-trending card (Phase 2) */}
                {topCard && (
                  <>
                    <Grid size={{ xs: 12 }}>
                      <ForecastPanel cardId={topCard.id} title={`${topCard.name} — Price Forecast`} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                          {topCard.name} — Price Trend
                        </Typography>
                        <PriceChart cardId={topCard.id} height={300} />
                      </Paper>
                    </Grid>
                  </>
                )}
              </Grid>
            </motion.div>
          )}

          {activeTab === 2 && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <LiveAuctionTable limit={20} height={700} autoRefresh={true} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 3 }}>
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
              <NewReleasesCarousel limit={12} />
            </motion.div>
          )}

          {activeTab === 4 && (
            <motion.div variants={itemVariants}>
              <PopularityMetrics limit={10} />
            </motion.div>
          )}
        </motion.div>
      </Container>
    </AppShell>
  );
}