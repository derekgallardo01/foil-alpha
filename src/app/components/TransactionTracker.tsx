'use client';
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Collapse,
  IconButton
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon,
  Assessment as AssessmentIcon,
  ShoppingCart as ShoppingCartIcon,
  Visibility as VisibilityIcon,
  Cancel as CancelIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';

interface Transaction {
  id: number;
  user_card_id: number;
  transaction_type: 'PURCHASE' | 'SALE' | 'AUCTION_WIN' | 'AUCTION_SALE' | 'LISTING' | 'DELISTING';
  price: number;
  card_name: string;
  card_image?: string;
  set_name: string;
  condition: string;
  counterparty_name?: string;
  created_at: string;
  notes?: string;
}

interface TransactionStats {
  total_spent: number;
  total_earned: number;
  net_profit: number;
  total_transactions: number;
  cards_bought: number;
  cards_sold: number;
  average_purchase_price: number;
  average_sale_price: number;
}

interface TransactionTrackerProps {
  userId: number;
}

const mockTransactions: Transaction[] = [
  {
    id: 1,
    user_card_id: 101,
    transaction_type: 'AUCTION_WIN',
    price: 125.50,
    card_name: 'Charizard VMAX',
    set_name: 'Darkness Ablaze',
    condition: 'NM',
    counterparty_name: 'CardMaster92',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    notes: 'Won after intense bidding war!'
  },
  {
    id: 2,
    user_card_id: 102,
    transaction_type: 'SALE',
    price: 89.99,
    card_name: 'Pikachu VMAX',
    set_name: 'Vivid Voltage',
    condition: 'LP',
    counterparty_name: 'PokemonFan2024',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    notes: 'Quick sale'
  },
  {
    id: 3,
    user_card_id: 103,
    transaction_type: 'PURCHASE',
    price: 45.00,
    card_name: 'Blastoise EX',
    set_name: 'XY Evolutions',
    condition: 'NM',
    counterparty_name: 'RetroCards',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
  },
  {
    id: 4,
    user_card_id: 104,
    transaction_type: 'LISTING',
    price: 67.00,
    card_name: 'Venusaur Holo',
    set_name: 'Base Set',
    condition: 'MP',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    notes: 'Listed for fixed price'
  }
];

const mockStats: TransactionStats = {
  total_spent: 295.50,
  total_earned: 156.99,
  net_profit: -138.51,
  total_transactions: 4,
  cards_bought: 2,
  cards_sold: 1,
  average_purchase_price: 85.25,
  average_sale_price: 89.99
};

export default function TransactionTracker({ userId }: TransactionTrackerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState<string>('ALL');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setTransactions(mockTransactions);
        setStats(mockStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, filterType, sortBy, dateRange]);

  const getTransactionIcon = (type: Transaction['transaction_type']) => {
    switch (type) {
      case 'PURCHASE':
      case 'AUCTION_WIN':
        return <ShoppingCartIcon sx={{ color: 'info.main' }} />;
      case 'SALE':
      case 'AUCTION_SALE':
        return <MoneyIcon sx={{ color: 'success.main' }} />;
      case 'LISTING':
        return <VisibilityIcon sx={{ color: 'primary.main' }} />;
      case 'DELISTING':
        return <CancelIcon sx={{ color: 'text.secondary' }} />;
      default:
        return <AssessmentIcon sx={{ color: 'text.secondary' }} />;
    }
  };

  const getTransactionChipColor = (type: Transaction['transaction_type']): 'success' | 'info' | 'primary' | 'default' => {
    switch (type) {
      case 'SALE':
      case 'AUCTION_SALE':
        return 'success';
      case 'PURCHASE':
      case 'AUCTION_WIN':
        return 'info';
      case 'LISTING':
        return 'primary';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number | null) => {
    if (!price) return 'N/A';
    return `$${Number(price).toFixed(2)}`;
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (filterType === 'ALL') return true;
    if (filterType === 'PURCHASES') return ['PURCHASE', 'AUCTION_WIN'].includes(transaction.transaction_type);
    if (filterType === 'SALES') return ['SALE', 'AUCTION_SALE'].includes(transaction.transaction_type);
    if (filterType === 'LISTINGS') return ['LISTING', 'DELISTING'].includes(transaction.transaction_type);
    return transaction.transaction_type === filterType;
  });

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container sx={{ marginTop: 4, marginBottom: 4 }}>
      <Box sx={{ my: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Transaction History
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your card trading activity and performance
          </Typography>
        </Box>
        <IconButton
          onClick={() => setShowFilters(!showFilters)}
          sx={{
            bgcolor: 'action.hover',
            '&:hover': { bgcolor: 'action.selected' }
          }}
        >
          <FilterIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error: {error}
        </Alert>
      )}

      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'error.light' }}>
                    <TrendingDownIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Spent
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {formatPrice(stats.total_spent)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.light' }}>
                    <TrendingUpIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Earned
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {formatPrice(stats.total_earned)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: stats.net_profit >= 0 ? 'success.light' : 'error.light' }}>
                    <MoneyIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Net Profit/Loss
                    </Typography>
                    <Typography
                      variant="h6"
                      color={stats.net_profit >= 0 ? 'success.main' : 'error.main'}
                    >
                      {formatPrice(stats.net_profit)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.light' }}>
                    <AssessmentIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Transactions
                    </Typography>
                    <Typography variant="h6" color="primary.main">
                      {stats.total_transactions}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Collapse in={showFilters}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FilterIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Filters</Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Transaction Type</InputLabel>
                <Select
                  value={filterType}
                  label="Transaction Type"
                  onChange={(e) => setFilterType(e.target.value as string)}
                >
                  <MenuItem value="ALL">All Transactions</MenuItem>
                  <MenuItem value="PURCHASES">Purchases</MenuItem>
                  <MenuItem value="SALES">Sales</MenuItem>
                  <MenuItem value="LISTINGS">Listings</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value as string)}
                >
                  <MenuItem value="date_desc">Newest First</MenuItem>
                  <MenuItem value="date_asc">Oldest First</MenuItem>
                  <MenuItem value="amount_desc">Highest Amount</MenuItem>
                  <MenuItem value="amount_asc">Lowest Amount</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateRange}
                  label="Date Range"
                  onChange={(e) => setDateRange(e.target.value as string)}
                >
                  <MenuItem value="ALL">All Time</MenuItem>
                  <MenuItem value="7DAYS">Last 7 Days</MenuItem>
                  <MenuItem value="30DAYS">Last 30 Days</MenuItem>
                  <MenuItem value="90DAYS">Last 90 Days</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      <Paper sx={{ overflow: 'hidden' }}>
        {filteredTransactions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <AssessmentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No transactions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your filters or make your first transaction
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredTransactions.map((transaction, index) => (
              <React.Fragment key={transaction.id}>
                <ListItem sx={{ py: 2 }}>
                  <ListItemAvatar>
                    <Avatar>
                      {getTransactionIcon(transaction.transaction_type)}
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                            {transaction.card_name}
                          </Typography>
                          <Chip
                            label={transaction.transaction_type.replace('_', ' ')}
                            size="small"
                            color={getTransactionChipColor(transaction.transaction_type)}
                          />
                        </Box>

                        <Typography
                          variant="h6"
                          color={
                            ['SALE', 'AUCTION_SALE'].includes(transaction.transaction_type)
                              ? 'success.main'
                              : ['PURCHASE', 'AUCTION_WIN'].includes(transaction.transaction_type)
                                ? 'error.main'
                                : 'text.primary'
                          }
                        >
                          {['SALE', 'AUCTION_SALE'].includes(transaction.transaction_type) ? '+' : ''}
                          {['PURCHASE', 'AUCTION_WIN'].includes(transaction.transaction_type) ? '-' : ''}
                          {formatPrice(transaction.price)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {transaction.set_name} • {transaction.condition}
                        </Typography>

                        {transaction.counterparty_name && (
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {['PURCHASE', 'AUCTION_WIN'].includes(transaction.transaction_type) ? 'From' : 'To'}: {transaction.counterparty_name}
                          </Typography>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.disabled">
                            {formatDate(transaction.created_at)}
                          </Typography>

                          {transaction.notes && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              {transaction.notes}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {index < filteredTransactions.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
}