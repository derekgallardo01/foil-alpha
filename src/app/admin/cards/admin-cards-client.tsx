"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    Box,
    Typography,
    CircularProgress,
    Container,
    Paper,
    Backdrop,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    Toolbar,
    IconButton,
    FormControlLabel,
    Checkbox,
    Grid,
    Card,
    Chip,
    InputLabel,
    FormControl,
    CardContent,
    CardMedia,
    Alert,
    Pagination,
    Tabs,
    Tab,
    Tooltip,
    Divider,
    Stack,
    Badge,
    LinearProgress,
    ListItem,
    ListItemText,
    ListItemIcon,
    List
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import {
    Timeline,
    Sync,
    TrendingUp,
    TrendingDown,
    TrendingFlat,
    AttachMoney,
    Inventory,
    Store,
    Category,
    PriceCheck,
    Warning
} from '@mui/icons-material';
import Image from "next/image";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics } from "nextjs-google-analytics";
import sanitizeHtml from "sanitize-html";
import { debounce } from "lodash";
import Sidebar from "../../components/Sidebar";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-Grid";

// Animation variants
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

// Progress tracking interface
interface ProgressState {
    isActive: boolean;
    current: number;
    total: number;
    percentage: number;
    startTime: number;
    elapsedTime: number;
    estimatedTimeRemaining: number;
    currentOperation: string;
    status: 'idle' | 'searching' | 'importing' | 'completed' | 'error';
    completed: number;
    failed: number;
    skipped: number;
}

interface Card {
    id: number;
    name: string;
    set_name: string;
    set_number: string;
    rarity: string;
    card_type: string;
    subtype?: string;
    hp?: number;
    image_url?: string;
    small_image_url?: string;
    tcg_id?: string;
    created_at: string;
    updated_at: string;
    totalOwned: number;
    forSaleCount: number;
    soldCount: number;
    uniqueOwners: number;
    market_price?: number;
    price_trend?: 'up' | 'down' | 'stable';
    price_change_24h?: number;
    last_price_update?: string;
}

interface CardsResponse {
    cards: Card[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// Progress tracking utilities
const useProgressTracker = () => {
    const [progress, setProgress] = useState<ProgressState>({
        isActive: false,
        current: 0,
        total: 0,
        percentage: 0,
        startTime: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        currentOperation: '',
        status: 'idle',
        completed: 0,
        failed: 0,
        skipped: 0
    });

    const startProgress = useCallback((total: number, operation: string) => {
        const startTime = Date.now();
        setProgress({
            isActive: true,
            current: 0,
            total,
            percentage: 0,
            startTime,
            elapsedTime: 0,
            estimatedTimeRemaining: 0,
            currentOperation: operation,
            status: 'searching',
            completed: 0,
            failed: 0,
            skipped: 0
        });
    }, []);

    const updateProgress = useCallback((current: number, operation?: string, status?: 'searching' | 'importing' | 'completed' | 'error') => {
        setProgress(prev => {
            const now = Date.now();
            const elapsedTime = now - prev.startTime;
            const percentage = prev.total > 0 ? Math.round((current / prev.total) * 100) : 0;

            // Calculate estimated time remaining
            let estimatedTimeRemaining = 0;
            if (current > 0 && current < prev.total) {
                const avgTimePerItem = elapsedTime / current;
                estimatedTimeRemaining = avgTimePerItem * (prev.total - current);
            }

            return {
                ...prev,
                current,
                percentage,
                elapsedTime,
                estimatedTimeRemaining,
                currentOperation: operation || prev.currentOperation,
                status: status || prev.status
            };
        });
    }, []);

    const updateStats = useCallback((completed: number, failed: number, skipped: number) => {
        setProgress(prev => ({
            ...prev,
            completed,
            failed,
            skipped
        }));
    }, []);

    const completeProgress = useCallback((finalStats?: { completed: number; failed: number; skipped: number }) => {
        setProgress(prev => ({
            ...prev,
            isActive: false,
            percentage: 100,
            status: 'completed',
            currentOperation: 'Import completed',
            ...(finalStats && {
                completed: finalStats.completed,
                failed: finalStats.failed,
                skipped: finalStats.skipped
            })
        }));
    }, []);

    const resetProgress = useCallback(() => {
        setProgress({
            isActive: false,
            current: 0,
            total: 0,
            percentage: 0,
            startTime: 0,
            elapsedTime: 0,
            estimatedTimeRemaining: 0,
            currentOperation: '',
            status: 'idle',
            completed: 0,
            failed: 0,
            skipped: 0
        });
    }, []);

    return {
        progress,
        startProgress,
        updateProgress,
        updateStats,
        completeProgress,
        resetProgress
    };
};

// Progress Display Component
function ProgressDisplay({ progress }: { progress: ProgressState }) {
    const formatTime = (milliseconds: number) => {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };

    if (!progress.isActive && progress.status === 'idle') return null;

    return (
        <Paper
            elevation={3}
            sx={{
                p: 3,
                mb: 3,
                bgcolor: 'grey.800',
                borderRadius: 2,
                border: '1px solid',
                borderColor: progress.status === 'error' ? 'error.main' :
                    progress.status === 'completed' ? 'success.main' : 'primary.main'
            }}
        >
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ color: 'text.primary' }}>
                        {progress.currentOperation}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {progress.current} / {progress.total} ({progress.percentage}%)
                    </Typography>
                </Box>

                <LinearProgress
                    variant="determinate"
                    value={progress.percentage}
                    sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'grey.700',
                        '& .MuiLinearProgress-bar': {
                            bgcolor: progress.status === 'error' ? 'error.main' :
                                progress.status === 'completed' ? 'success.main' : 'primary.main',
                            borderRadius: 4
                        }
                    }}
                />
            </Box>

            <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Elapsed Time
                            </Typography>
                            <Typography variant="body2" color="text.primary">
                                {formatTime(progress.elapsedTime)}
                            </Typography>
                        </Box>
                    </Box>
                </Grid>

                {progress.estimatedTimeRemaining > 0 && progress.status !== 'completed' && (
                    <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Timeline sx={{ color: 'text.secondary', fontSize: 20 }} />
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Estimated Remaining
                                </Typography>
                                <Typography variant="body2" color="text.primary">
                                    {formatTime(progress.estimatedTimeRemaining)}
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>
                )}

                <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Completed
                            </Typography>
                            <Typography variant="body2" color="success.main">
                                {progress.completed}
                            </Typography>
                        </Box>
                    </Box>
                </Grid>

                {(progress.failed > 0 || progress.skipped > 0) && (
                    <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Issues
                                </Typography>
                                <Typography variant="body2" color="error.main">
                                    {progress.failed + progress.skipped}
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>
                )}
            </Grid>

            {progress.status === 'completed' && (
                <Alert severity="success" sx={{ mt: 2 }}>
                    Import completed! {progress.completed} cards processed successfully
                    {progress.failed > 0 && `, ${progress.failed} failed`}
                    {progress.skipped > 0 && `, ${progress.skipped} skipped`}
                </Alert>
            )}

            {progress.status === 'error' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    Import encountered errors. Please check the details and try again.
                </Alert>
            )}
        </Paper>
    );
}

// Rarity color mapping function
const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
        case 'common': return 'default' as const;
        case 'uncommon': return 'success' as const;
        case 'rare': return 'primary' as const;
        case 'holo rare': return 'secondary' as const;
        case 'ultra rare': return 'error' as const;
        default: return 'default' as const;
    }
};

// Utility function for formatting currency
const formatPrice = (price: number | undefined): string => {
    if (price === undefined || price === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
};

// Utility function for formatting numbers with commas
const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
};

// Price Trend Chip Component
function PriceTrendChip({ trend, change }: { trend?: string; change?: number }) {
    const getTrendIcon = () => {
        switch (trend) {
            case 'up':
                return <TrendingUp sx={{ fontSize: 16 }} />;
            case 'down':
                return <TrendingDown sx={{ fontSize: 16 }} />;
            default:
                return <TrendingFlat sx={{ fontSize: 16 }} />;
        }
    };

    const getTrendColor = () => {
        switch (trend) {
            case 'up':
                return 'success' as const;
            case 'down':
                return 'error' as const;
            default:
                return 'default' as const;
        }
    };

    if (!trend) return null;

    return (
        <Tooltip title={`Price trend: ${trend}${change !== undefined ? ` (${change > 0 ? '+' : ''}${change.toFixed(1)}%)` : ''}`}>
            <Chip
                icon={getTrendIcon()}
                label={change !== undefined ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : trend}
                color={getTrendColor()}
                size="small"
                variant="outlined"
            />
        </Tooltip>
    );
}

// Enhanced Stats Card Component
function StatsCard({ icon, title, value, subtitle, color = "primary" }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtitle?: string;
    color?: "primary" | "secondary" | "success" | "error" | "warning" | "info";
}) {
    return (
        <Paper
            elevation={3}
            sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: 'grey.900',
                border: '1px solid',
                borderColor: 'grey.800',
                transition: 'all 0.3s ease',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(150, 255, 155, 0.15)',
                    borderColor: '#96ff9b'
                }
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                    p: 1.5,
                    borderRadius: '50%',
                    bgcolor: `${color}.main`,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {title}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        {value}
                    </Typography>
                    {subtitle && (
                        <Typography variant="caption" color="text.secondary">
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </Box>
        </Paper>
    );
}

// Enhanced Pokemon Card Import Modal Component with Progress Tracking
function PokemonImportModal({ open, onClose, onImportComplete }: {
    open: boolean;
    onClose: () => void;
    onImportComplete?: (results: any) => void;
}) {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');

    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSet, setSelectedSet] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedRarity, setSelectedRarity] = useState('');

    // Results state
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedCards, setSelectedCards] = useState(new Set<string>());
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

    // Sets and filters
    const [availableSets, setAvailableSets] = useState<any[]>([]);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);
    const [availableRarities, setAvailableRarities] = useState<string[]>([]);

    // Progress tracking
    const { progress, startProgress, updateProgress, updateStats, completeProgress, resetProgress } = useProgressTracker();

    // Load sets and filter options
    useEffect(() => {
        if (open) {
            loadFilterOptions();
        }
    }, [open]);

    const loadFilterOptions = async () => {
        try {
            setLoading(true);

            // Load sets
            const setsResponse = await fetch('/api/pokemon-tcg/sets?pageSize=100');
            const setsData = await setsResponse.json();
            if (setsData.success) {
                setAvailableSets(setsData.data);
            }

            // Load types and rarities
            const filtersResponse = await fetch('/api/pokemon-tcg/types', { method: 'POST' });
            const filtersData = await filtersResponse.json();
            if (filtersData.success) {
                setAvailableTypes(filtersData.data.types);
                setAvailableRarities(filtersData.data.rarities);
            }
        } catch (error) {
            console.error('Error loading filter options:', error);
            setError('Failed to load filter options');
        } finally {
            setLoading(false);
        }
    };

    const searchCards = async (page = 1) => {
        try {
            setLoading(true);
            setError('');

            // Start progress tracking for search
            startProgress(1, `Searching Pokémon cards...`);
            updateProgress(0, 'Initiating search request', 'searching');

            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: '20',
            });

            if (searchTerm) params.append('name', searchTerm);
            if (selectedSet) params.append('set', selectedSet);
            if (selectedType) params.append('types', selectedType);
            if (selectedRarity) params.append('rarity', selectedRarity);

            updateProgress(0.5, 'Fetching results from API', 'searching');

            const response = await fetch(`/api/pokemon-tcg/search?${params}`);
            const data = await response.json();

            if (data.success) {
                updateProgress(1, `Found ${data.data.length} cards`, 'completed');
                setSearchResults(data.data);
                setPagination({
                    page: data.pagination.page,
                    totalPages: data.pagination.totalPages,
                });

                setTimeout(() => {
                    completeProgress({ completed: data.data.length, failed: 0, skipped: 0 });
                }, 500);
            } else {
                setError(data.error || 'Search failed');
                updateProgress(1, 'Search failed', 'error');
            }
        } catch (error) {
            console.error('Error searching cards:', error);
            setError('Failed to search cards');
            updateProgress(1, 'Search failed', 'error');
        } finally {
            setLoading(false);
            setTimeout(resetProgress, 3000); // Reset progress after 3 seconds
        }
    };

    const handleCardSelection = (cardId: string, selected: boolean) => {
        const newSelected = new Set(selectedCards);
        if (selected) {
            newSelected.add(cardId);
        } else {
            newSelected.delete(cardId);
        }
        setSelectedCards(newSelected);
    };

    const importSelectedCards = async () => {
        if (selectedCards.size === 0) {
            setError('Please select at least one card to import');
            return;
        }

        try {
            setImporting(true);
            setError('');

            // Start progress tracking
            const cardsToImport = Array.from(selectedCards);
            startProgress(cardsToImport.length, 'Importing selected cards...');

            let completed = 0;
            let failed = 0;
            let skipped = 0;

            // Simulate progress updates during import
            const progressInterval = setInterval(() => {
                if (completed < cardsToImport.length) {
                    updateProgress(completed, `Processing card ${completed + 1} of ${cardsToImport.length}`, 'importing');
                }
            }, 200);

            const response = await fetch('/api/pokemon-tcg/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardIds: cardsToImport,
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();

            if (data.success) {
                completed = data.results?.imported?.length || 0;
                failed = data.results?.errors?.length || 0;
                skipped = data.results?.updated?.length || 0; // Updated cards are "skipped" from new imports

                updateStats(completed, failed, skipped);
                updateProgress(cardsToImport.length, 'Import completed successfully', 'completed');
                completeProgress({ completed, failed, skipped });

                onImportComplete?.(data.results);

                // Close modal after brief delay to show completion
                setTimeout(() => {
                    onClose();
                    setSelectedCards(new Set());
                    setSearchResults([]);
                    resetProgress();
                }, 2000);
            } else {
                setError(data.error || 'Import failed');
                updateProgress(cardsToImport.length, 'Import failed', 'error');
            }
        } catch (error) {
            console.error('Error importing cards:', error);
            setError('Failed to import cards');
            updateProgress(selectedCards.size, 'Import failed', 'error');
        } finally {
            setImporting(false);
        }
    };

    const importEntireSet = async () => {
        if (!selectedSet) {
            setError('Please select a set to import');
            return;
        }

        const selectedSetObj = availableSets.find(set => set.name === selectedSet);
        if (!selectedSetObj) {
            setError('Invalid set selected');
            return;
        }

        try {
            setImporting(true);
            setError('');

            // Start progress tracking for set import
            const estimatedCards = selectedSetObj.total || 100;
            startProgress(estimatedCards, `Importing ${selectedSet} set...`);

            let processed = 0;

            // Simulate progress updates during set import
            const progressInterval = setInterval(() => {
                if (processed < estimatedCards) {
                    processed += Math.floor(Math.random() * 3) + 1; // Random progress simulation
                    processed = Math.min(processed, estimatedCards);
                    updateProgress(processed, `Processing cards from ${selectedSet}...`, 'importing');
                }
            }, 500);

            const response = await fetch('/api/pokemon-tcg/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    setId: selectedSetObj.id,
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();

            if (data.success) {
                const completed = data.results?.imported?.length || 0;
                const failed = data.results?.errors?.length || 0;
                const skipped = data.results?.updated?.length || 0;

                updateStats(completed, failed, skipped);
                updateProgress(estimatedCards, 'Set import completed', 'completed');
                completeProgress({ completed, failed, skipped });

                onImportComplete?.(data.results);

                // Close modal after brief delay
                setTimeout(() => {
                    onClose();
                    resetProgress();
                }, 2000);
            } else {
                setError(data.error || 'Import failed');
                updateProgress(estimatedCards, 'Set import failed', 'error');
            }
        } catch (error) {
            console.error('Error importing set:', error);
            setError('Failed to import set');
            updateProgress(selectedSetObj.total || 100, 'Set import failed', 'error');
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        if (!importing) {
            setSelectedCards(new Set());
            setSearchResults([]);
            setError('');
            setActiveTab(0);
            resetProgress();
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    Import Pokémon Cards from API
                </Typography>
            </DialogTitle>
            <DialogContent>
                {/* Progress Display */}
                <ProgressDisplay progress={progress} />

                <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
                    <Tab label="Search & Import Cards" disabled={importing} />
                    <Tab label="Import Entire Set" disabled={importing} />
                </Tabs>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Tab 1: Search & Import Individual Cards */}
                {activeTab === 0 && (
                    <Box>
                        {/* Search Filters */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    fullWidth
                                    label="Search by Name"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && searchCards(1)}
                                    disabled={importing}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Set</InputLabel>
                                    <Select
                                        value={selectedSet}
                                        label="Set"
                                        onChange={(e) => setSelectedSet(e.target.value)}
                                        disabled={importing}
                                    >
                                        <MenuItem value="">All Sets</MenuItem>
                                        {availableSets.map(set => (
                                            <MenuItem key={set.id} value={set.name}>
                                                {set.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                        value={selectedType}
                                        label="Type"
                                        onChange={(e) => setSelectedType(e.target.value)}
                                        disabled={importing}
                                    >
                                        <MenuItem value="">All Types</MenuItem>
                                        {availableTypes.map(type => (
                                            <MenuItem key={type} value={type}>{type}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Rarity</InputLabel>
                                    <Select
                                        value={selectedRarity}
                                        label="Rarity"
                                        onChange={(e) => setSelectedRarity(e.target.value)}
                                        disabled={importing}
                                    >
                                        <MenuItem value="">All Rarities</MenuItem>
                                        {availableRarities.map(rarity => (
                                            <MenuItem key={rarity} value={rarity}>{rarity}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={() => searchCards(1)}
                                    disabled={loading || importing}
                                    sx={{ height: '56px' }}
                                    startIcon={loading ? <CircularProgress size={20} /> : <Sync />}
                                >
                                    {loading ? 'Searching...' : 'Search'}
                                </Button>
                            </Grid>
                        </Grid>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6">
                                        Search Results
                                    </Typography>
                                    <Chip
                                        label={`${selectedCards.size} cards selected`}
                                        color="primary"
                                        variant="outlined"
                                    />
                                </Box>

                                <Grid container spacing={2} sx={{ mb: 3 }}>
                                    {searchResults.map((card) => (
                                        <Grid item xs={12} sm={6} md={4} lg={3} key={card.id}>
                                            <Card sx={{
                                                height: '100%',
                                                position: 'relative',
                                                transition: 'all 0.3s ease',
                                                border: selectedCards.has(card.id) ? '2px solid #96ff9b' : '1px solid transparent',
                                                opacity: importing ? 0.6 : 1,
                                                '&:hover': {
                                                    transform: importing ? 'none' : 'translateY(-4px)',
                                                    boxShadow: importing ? 'none' : '0 8px 24px rgba(0,0,0,0.2)'
                                                }
                                            }}>
                                                <Checkbox
                                                    checked={selectedCards.has(card.id)}
                                                    onChange={(e) => handleCardSelection(card.id, e.target.checked)}
                                                    disabled={importing}
                                                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'rgba(0,0,0,0.5)' }}
                                                />
                                                <CardMedia
                                                    component="img"
                                                    height="200"
                                                    image={card.images.small}
                                                    alt={card.name}
                                                    sx={{ objectFit: 'contain', p: 1 }}
                                                />
                                                <CardContent>
                                                    <Typography variant="h6" noWrap sx={{ fontWeight: 'bold' }}>
                                                        {card.name}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" noWrap>
                                                        {card.set.name} • #{card.number}
                                                    </Typography>
                                                    <Chip
                                                        label={card.rarity}
                                                        size="small"
                                                        sx={{ mt: 1 }}
                                                        color={getRarityColor(card.rarity)}
                                                    />
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>

                                {/* Pagination */}
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                                    <Pagination
                                        count={pagination.totalPages}
                                        page={pagination.page}
                                        onChange={(e, page) => searchCards(page)}
                                        disabled={loading || importing}
                                        color="primary"
                                    />
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Tab 2: Import Entire Set */}
                {activeTab === 1 && (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 3 }}>
                            Import All Cards from a Set
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={8}>
                                <FormControl fullWidth>
                                    <InputLabel>Select Set to Import</InputLabel>
                                    <Select
                                        value={selectedSet}
                                        label="Select Set to Import"
                                        onChange={(e) => setSelectedSet(e.target.value)}
                                        disabled={importing}
                                    >
                                        {availableSets.map(set => (
                                            <MenuItem key={set.id} value={set.name}>
                                                {set.name} ({formatNumber(set.total)} cards) - Released: {new Date(set.releaseDate).toLocaleDateString()}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={importEntireSet}
                                    disabled={importing || !selectedSet}
                                    sx={{ height: '56px', bgcolor: '#96ff9b', color: 'grey.900' }}
                                    startIcon={importing ? <CircularProgress size={20} /> : <DownloadIcon />}
                                >
                                    {importing ? 'Importing...' : 'Import Entire Set'}
                                </Button>
                            </Grid>
                        </Grid>

                        <Alert severity="info" sx={{ mt: 3 }} icon={<InfoOutlinedIcon />}>
                            <Typography variant="body2">
                                This will import all cards from the selected set. Large sets may take several minutes to process.
                                Progress will be tracked in real-time above.
                            </Typography>
                        </Alert>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 3 }}>
                <Button onClick={handleClose} disabled={importing}>
                    {importing ? 'Cancel' : 'Close'}
                </Button>
                {activeTab === 0 && (
                    <Button
                        variant="contained"
                        onClick={importSelectedCards}
                        disabled={importing || selectedCards.size === 0}
                        sx={{ bgcolor: '#96ff9b', color: 'grey.900' }}
                        startIcon={importing ? <CircularProgress size={20} /> : <DownloadIcon />}
                    >
                        {importing ? 'Importing...' : `Import ${selectedCards.size} Card${selectedCards.size !== 1 ? 's' : ''}`}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

// Enhanced Price Sync Modal Component with Progress Tracking
function PriceSyncModal({ open, onClose, onSyncComplete }: {
    open: boolean;
    onClose: () => void;
    onSyncComplete?: (results: any) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [syncStrategy, setSyncStrategy] = useState('AUTO');
    const [batchSize, setBatchSize] = useState(20);
    const [maxAgeHours, setMaxAgeHours] = useState(24);
    const [syncResults, setSyncResults] = useState<any>(null);
    const [error, setError] = useState('');

    // Progress tracking
    const { progress, startProgress, updateProgress, updateStats, completeProgress, resetProgress } = useProgressTracker();

    const handleStartSync = async () => {
        try {
            setLoading(true);
            setError('');
            setSyncResults(null);

            // Start progress tracking for price sync
            startProgress(100, 'Syncing card prices...');

            let processed = 0;
            const progressInterval = setInterval(() => {
                if (processed < 95) { // Don't complete until we get the actual results
                    processed += Math.floor(Math.random() * 5) + 1;
                    processed = Math.min(processed, 95);
                    updateProgress(processed, 'Fetching price data from APIs...', 'importing');
                }
            }, 300);

            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    force: false,
                    batchSize,
                    maxAgeHours,
                    pricingStrategy: syncStrategy,
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();

            if (data.success) {
                const completed = data.result.successful_updates || 0;
                const failed = data.result.failed_updates || 0;
                const skipped = data.result.skipped_cards || 0;

                updateStats(completed, failed, skipped);
                updateProgress(100, 'Price sync completed', 'completed');
                completeProgress({ completed, failed, skipped });

                setSyncResults(data.result);
                onSyncComplete?.(data.result);
                toast.success(`Price sync completed! ${formatNumber(data.result.successful_updates)} cards updated.`);
            } else {
                setError(data.error || 'Sync failed');
                updateProgress(100, 'Price sync failed', 'error');
                toast.error(data.error || 'Price sync failed');
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMsg);
            updateProgress(100, 'Price sync failed', 'error');
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleForceSync = async () => {
        if (!confirm('Force sync will update ALL cards regardless of last update time. This may take a while. Continue?')) {
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Start progress tracking for force sync
            startProgress(100, 'Force syncing all card prices...');

            let processed = 0;
            const progressInterval = setInterval(() => {
                if (processed < 95) {
                    processed += Math.floor(Math.random() * 3) + 1;
                    processed = Math.min(processed, 95);
                    updateProgress(processed, 'Force updating all card prices...', 'importing');
                }
            }, 500);

            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    force: true,
                    batchSize: 10,
                    pricingStrategy: syncStrategy,
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();

            if (data.success) {
                const completed = data.result.successful_updates || 0;
                const failed = data.result.failed_updates || 0;
                const skipped = data.result.skipped_cards || 0;

                updateStats(completed, failed, skipped);
                updateProgress(100, 'Force sync completed', 'completed');
                completeProgress({ completed, failed, skipped });

                setSyncResults(data.result);
                onSyncComplete?.(data.result);
                toast.success(`Force sync completed! ${formatNumber(data.result.successful_updates)} cards updated.`);
            } else {
                setError(data.error || 'Force sync failed');
                updateProgress(100, 'Force sync failed', 'error');
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMsg);
            updateProgress(100, 'Force sync failed', 'error');
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            resetProgress();
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Sync />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        Sync Card Prices
                    </Typography>
                </Box>
            </DialogTitle>
            <DialogContent>
                {/* Progress Display */}
                <ProgressDisplay progress={progress} />

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {!syncResults ? (
                    <Box>
                        <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                            Update card prices using the Pokémon Price Tracker API for real-time market data.
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Sync Strategy</InputLabel>
                                    <Select
                                        value={syncStrategy}
                                        label="Sync Strategy"
                                        onChange={(e) => setSyncStrategy(e.target.value)}
                                        disabled={loading}
                                    >
                                        <MenuItem value="AUTO">Auto (Price Tracker + TCG API)</MenuItem>
                                        <MenuItem value="PRICE_TRACKER_ONLY">Price Tracker API Only</MenuItem>
                                        <MenuItem value="TCG_API_ONLY">Pokémon TCG API Only</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Batch Size"
                                    type="number"
                                    value={batchSize}
                                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 20)}
                                    inputProps={{ min: 5, max: 50 }}
                                    fullWidth
                                    helperText="Cards processed per API call"
                                    disabled={loading}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    label="Update Cards Older Than (Hours)"
                                    type="number"
                                    value={maxAgeHours}
                                    onChange={(e) => setMaxAgeHours(parseInt(e.target.value) || 24)}
                                    inputProps={{ min: 1, max: 168 }}
                                    fullWidth
                                    helperText="Only update cards that haven't been updated in this time period"
                                    disabled={loading}
                                />
                            </Grid>
                        </Grid>

                        <Alert severity="info" sx={{ mt: 3 }} icon={<InfoOutlinedIcon />}>
                            <Typography variant="body2">
                                <strong>Rate Limits:</strong> The Pokémon Price Tracker API allows 60 requests per minute.
                                Large syncs will be automatically throttled to respect these limits. Progress will be tracked in real-time.
                            </Typography>
                        </Alert>
                    </Box>
                ) : (
                    <Box>
                        <Alert severity="success" sx={{ mb: 3 }}>
                            Price sync completed successfully!
                        </Alert>

                        <Grid container spacing={2}>
                            <Grid item xs={6} md={3}>
                                <StatsCard
                                    icon={<PriceCheck />}
                                    title="Cards Updated"
                                    value={formatNumber(syncResults.successful_updates)}
                                    color="success"
                                />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <StatsCard
                                    icon={<Warning />}
                                    title="Skipped"
                                    value={formatNumber(syncResults.skipped_cards)}
                                    color="warning"
                                />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <StatsCard
                                    icon={<DeleteIcon />}
                                    title="Failed"
                                    value={formatNumber(syncResults.failed_updates)}
                                    color="error"
                                />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <StatsCard
                                    icon={<AttachMoney />}
                                    title="Avg. Price"
                                    value={formatPrice(syncResults.pricing_summary?.avg_market_price)}
                                    color="primary"
                                />
                            </Grid>
                        </Grid>

                        {syncResults.pricing_summary && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>Pricing Summary</Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="body2" color="text.secondary">
                                            API Pricing Success: {formatNumber(syncResults.pricing_summary.api_pricing_success || 0)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Fallback Pricing Used: {formatNumber(syncResults.pricing_summary.fallback_pricing_used || 0)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="body2" color="text.secondary">
                                            Price Range: {formatPrice(syncResults.pricing_summary.price_range?.min)} - {formatPrice(syncResults.pricing_summary.price_range?.max)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Price Increases: {formatNumber(syncResults.pricing_summary.cards_with_increases || 0)}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}

                        {syncResults.errors && syncResults.errors.length > 0 && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" color="error" sx={{ mb: 2 }}>
                                    Errors ({formatNumber(syncResults.errors.length)})
                                </Typography>
                                <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.900', p: 2, borderRadius: 1 }}>
                                    {syncResults.errors.slice(0, 10).map((error: any, index: number) => (
                                        <Alert severity="error" key={index} sx={{ mb: 1 }}>
                                            <Typography variant="body2">
                                                <strong>{error.card_name}:</strong> {error.error}
                                            </Typography>
                                        </Alert>
                                    ))}
                                    {syncResults.errors.length > 10 && (
                                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                                            ... and {formatNumber(syncResults.errors.length - 10)} more errors
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
                <Button onClick={handleClose} disabled={loading}>
                    {syncResults ? 'Close' : 'Cancel'}
                </Button>
                {!syncResults && (
                    <>
                        <Tooltip title="Force update all cards regardless of last update time">
                            <Button
                                variant="outlined"
                                onClick={handleForceSync}
                                disabled={loading}
                                color="warning"
                                startIcon={loading ? <CircularProgress size={20} /> : <Sync />}
                            >
                                Force Sync All
                            </Button>
                        </Tooltip>
                        <Button
                            variant="contained"
                            onClick={handleStartSync}
                            disabled={loading}
                            sx={{ bgcolor: '#96ff9b', color: 'grey.900' }}
                            startIcon={loading ? <CircularProgress size={20} /> : <Sync />}
                        >
                            {loading ? 'Syncing...' : 'Start Sync'}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default function AdminCardsClient() {
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const { data: session, status } = useSession();
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [editCard, setEditCard] = useState<Card | null>(null);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [rowLoading, setRowLoading] = useState<{ [key: number]: boolean }>({});
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [selected, setSelected] = useState<number[]>([]);
    const [setFilter, setSetFilter] = useState<string>("");
    const [typeFilter, setTypeFilter] = useState<string>("");
    const [rarityFilter, setRarityFilter] = useState<string>("");
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
    const [bulkCreateOpen, setBulkCreateOpen] = useState<boolean>(false);
    const [bulkCardsText, setBulkCardsText] = useState<string>("");
    const [pokemonImportOpen, setPokemonImportOpen] = useState<boolean>(false);
    const [priceSyncOpen, setPriceSyncOpen] = useState<boolean>(false);
    const [selectedCardsForPriceCheck, setSelectedCardsForPriceCheck] = useState<number[]>([]);
    const [visibleColumns, setVisibleColumns] = useState({
        id: true,
        name: true,
        set_name: true,
        set_number: true,
        rarity: true,
        card_type: true,
        totalOwned: true,
        forSaleCount: true,
        created_at: true,
        pricing: true,
    });
    const editDialogRef = useRef<HTMLDivElement>(null);
    const hasFetchedRef = useRef(false);

    // Progress tracking for main operations
    const { progress: mainProgress, startProgress: startMainProgress, updateProgress: updateMainProgress, completeProgress: completeMainProgress, resetProgress: resetMainProgress } = useProgressTracker();

    // Role-Based Access Control (RBAC)
    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "admin") {
            router.push("/unauthorized");
        }
    }, [status, session, router]);

    // Enhanced fetch cards with progress tracking
    const fetchCards = useCallback(async () => {
        if (!session) return;

        try {
            setLoading(true);
            startMainProgress(3, 'Loading cards from database...');

            updateMainProgress(1, 'Preparing request parameters');

            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (setFilter) params.append('set', setFilter);
            if (typeFilter) params.append('type', typeFilter);

            updateMainProgress(2, 'Fetching cards from server');

            const response = await fetch(`/api/admin/cards?${params.toString()}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.accessToken}`,
                },
            });

            if (!response.ok) throw new Error("Failed to fetch cards");

            const data: CardsResponse = await response.json();

            updateMainProgress(3, 'Processing card data', 'completed');
            completeMainProgress({ completed: data.cards?.length || 0, failed: 0, skipped: 0 });

            setCards(data.cards || []);
            toast.success("Cards loaded successfully!", { autoClose: 2000 });

            // Reset progress after brief delay
            setTimeout(resetMainProgress, 2000);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to load cards.";
            setError(errorMessage);
            toast.error(errorMessage);
            setCards([]);
            updateMainProgress(3, 'Failed to load cards', 'error');
        } finally {
            setLoading(false);
        }
    }, [session, searchQuery, setFilter, typeFilter, startMainProgress, updateMainProgress, completeMainProgress, resetMainProgress]);

    // Initial fetch
    useEffect(() => {
        if (status === "authenticated" && !hasFetchedRef.current) {
            fetchCards();
            hasFetchedRef.current = true;
        }
    }, [status, fetchCards]);

    // Enhanced Card Stats with pricing
    const stats = useMemo(() => {
        const baseStats = {
            total: cards.length,
            totalOwned: cards.reduce((sum, card) => sum + card.totalOwned, 0),
            forSale: cards.reduce((sum, card) => sum + card.forSaleCount, 0),
            uniqueSets: new Set(cards.map(card => card.set_name)).size,
        };

        const enhancedStats = {
            ...baseStats,
            totalMarketValue: cards.reduce((sum, card) =>
                sum + (card.market_price ? Number(card.market_price) * card.totalOwned : 0), 0
            ),
            avgMarketPrice: cards.filter(c => c.market_price).length > 0 ?
                cards.reduce((sum, card) => sum + (Number(card.market_price) || 0), 0) /
                cards.filter(c => c.market_price).length : 0,
            cardsWithPricing: cards.filter(c => c.market_price && Number(c.market_price) > 0).length,
            stalePrice: cards.filter(c => {
                if (!c.last_price_update) return true;
                const daysSinceUpdate = (Date.now() - new Date(c.last_price_update).getTime()) / (1000 * 60 * 60 * 24);
                return daysSinceUpdate > 7;
            }).length,
        };

        return enhancedStats;
    }, [cards]);

    // Debounced Search
    const debouncedSetSearchQuery = debounce((value: string) => setSearchQuery(value), 300);

    const filteredCards = useMemo(() => {
        let result = [...cards];
        if (rarityFilter) result = result.filter(card => card.rarity === rarityFilter);
        return result.filter(Boolean);
    }, [cards, rarityFilter]);

    // Price sync functions with progress tracking
    const handlePriceSyncComplete = (results: any) => {
        fetchCards();
        toast.success(`Price sync completed: ${formatNumber(results.successful_updates)} cards updated`);
    };

    const handleBulkPriceCheck = async () => {
        if (selected.length === 0) {
            toast.error('Please select cards to check prices');
            return;
        }

        try {
            setActionLoading(true);
            startMainProgress(selected.length, `Updating prices for ${selected.length} selected cards...`);

            let processed = 0;
            const progressInterval = setInterval(() => {
                if (processed < selected.length - 1) {
                    processed++;
                    updateMainProgress(processed, `Processing card ${processed + 1} of ${selected.length}`, 'importing');
                }
            }, 100);

            const response = await fetch('/api/cards/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardIds: selected,
                    force: true,
                    batchSize: 10,
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();
            if (data.success) {
                updateMainProgress(selected.length, 'Bulk price update completed', 'completed');
                completeMainProgress({
                    completed: data.result.successful_updates,
                    failed: data.result.failed_updates || 0,
                    skipped: data.result.skipped_cards || 0
                });

                toast.success(`Updated prices for ${formatNumber(data.result.successful_updates)} cards`);
                fetchCards();
                setSelected([]);

                setTimeout(resetMainProgress, 3000);
            } else {
                toast.error(data.error || 'Failed to update prices');
                updateMainProgress(selected.length, 'Bulk price update failed', 'error');
            }
        } catch (error) {
            toast.error('Failed to update prices');
            updateMainProgress(selected.length, 'Bulk price update failed', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Pricing column definition
    const pricingColumn: GridColDef = {
        field: "pricing",
        headerName: "Market Price",
        width: 220,
        sortable: true,
        renderCell: (params: GridRenderCellParams<Card>) => (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {formatPrice(params.row.market_price)}
                </Typography>
                {params.row.price_trend && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PriceTrendChip
                            trend={params.row.price_trend}
                            change={params.row.price_change_24h}
                        />
                    </Box>
                )}
                {params.row.last_price_update && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        Updated: {new Date(params.row.last_price_update).toLocaleDateString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: 'numeric'
                        })}
                    </Typography>
                )}
            </Box>
        )
    };

    // Table Columns
    const columns: GridColDef[] = [
        ...(visibleColumns.id ? [{
            field: "id",
            headerName: "ID",
            width: 80,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {params.row.id}
                </Typography>
            )
        }] : []),
        ...(visibleColumns.name ? [{
            field: "name",
            headerName: "Name",
            width: 250,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {params.row.small_image_url && (
                        <Box sx={{
                            borderRadius: 1,
                            overflow: 'hidden',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            <Image
                                src={params.row.small_image_url}
                                alt={params.row.name}
                                width={30}
                                height={42}
                                style={{ display: 'block' }}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </Box>
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {params.row.name}
                    </Typography>
                </Box>
            )
        }] : []),
        ...(visibleColumns.set_name ? [{
            field: "set_name",
            headerName: "Set",
            width: 180,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Typography variant="body2">
                    {params.row.set_name}
                </Typography>
            )
        }] : []),
        ...(visibleColumns.set_number ? [{
            field: "set_number",
            headerName: "Number",
            width: 110,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Chip
                    label={params.row.set_number}
                    size="small"
                    variant="outlined"
                />
            )
        }] : []),
        ...(visibleColumns.rarity ? [{
            field: "rarity",
            headerName: "Rarity",
            width: 140,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Chip
                    label={params.row.rarity}
                    color={getRarityColor(params.row.rarity)}
                    size="small"
                />
            )
        }] : []),
        ...(visibleColumns.card_type ? [{
            field: "card_type",
            headerName: "Type",
            width: 120,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Typography variant="body2">
                    {params.row.card_type}
                </Typography>
            )
        }] : []),
        ...(visibleColumns.totalOwned ? [{
            field: "totalOwned",
            headerName: "Owned",
            width: 100,
            sortable: true,
            align: 'center' as const,
            headerAlign: 'center' as const,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Chip
                    label={formatNumber(params.row.totalOwned)}
                    size="small"
                    color="primary"
                    variant="outlined"
                />
            )
        }] : []),
        ...(visibleColumns.forSaleCount ? [{
            field: "forSaleCount",
            headerName: "For Sale",
            width: 110,
            sortable: true,
            align: 'center' as const,
            headerAlign: 'center' as const,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Chip
                    label={formatNumber(params.row.forSaleCount)}
                    size="small"
                    color="success"
                    variant="outlined"
                />
            )
        }] : []),
        ...(visibleColumns.pricing ? [pricingColumn] : []),
        ...(visibleColumns.created_at ? [{
            field: "created_at",
            headerName: "Created",
            width: 160,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Typography variant="body2" color="text.secondary">
                    {new Date(params.row.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })}
                </Typography>
            )
        }] : []),
        {
            field: "actions",
            headerName: "Actions",
            width: 160,
            sortable: false,
            align: 'center' as const,
            headerAlign: 'center' as const,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Tooltip title="Edit Card">
                        <IconButton
                            size="small"
                            onClick={() => handleEditCard(params.row)}
                            disabled={rowLoading[Number(params.id)] || actionLoading}
                            sx={{
                                color: 'primary.main',
                                '&:hover': { bgcolor: 'primary.main', color: 'white' }
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Card">
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteCard(params.id as number)}
                            disabled={rowLoading[Number(params.id)] || actionLoading}
                            sx={{
                                '&:hover': { bgcolor: 'error.main', color: 'white' }
                            }}
                        >
                            {rowLoading[Number(params.id)] ?
                                <CircularProgress size={20} /> :
                                <DeleteIcon fontSize="small" />
                            }
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
        },
    ];

    const handleEditCard = (card: Card) => {
        setEditCard(card);
        setValidationErrors({});
        setTimeout(() => editDialogRef.current?.focus(), 0);
    };

    const handleAddCard = () => {
        setEditCard({
            id: 0,
            name: "",
            set_name: "",
            set_number: "",
            rarity: "Common",
            card_type: "Pokemon",
            subtype: "",
            hp: undefined,
            image_url: "",
            small_image_url: "",
            tcg_id: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            totalOwned: 0,
            forSaleCount: 0,
            soldCount: 0,
            uniqueOwners: 0,
        });
        setValidationErrors({});
        setTimeout(() => editDialogRef.current?.focus(), 0);
    };

    const handleSaveCard = async () => {
        if (!editCard || !session) return;

        const sanitizedCard = {
            ...editCard,
            name: sanitizeHtml(editCard.name),
            set_name: sanitizeHtml(editCard.set_name),
            set_number: sanitizeHtml(editCard.set_number),
        };

        const errors: { [key: string]: string } = {};
        if (!sanitizedCard.name) errors.name = "Name is required";
        if (!sanitizedCard.set_name) errors.set_name = "Set name is required";
        if (!sanitizedCard.set_number) errors.set_number = "Set number is required";
        if (!sanitizedCard.rarity) errors.rarity = "Rarity is required";
        if (!sanitizedCard.card_type) errors.card_type = "Card type is required";

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            toast.error("Please fix the errors before saving");
            return;
        }

        setActionLoading(true);
        try {
            const method = sanitizedCard.id === 0 ? "POST" : "PUT";
            const url = sanitizedCard.id === 0 ? "/api/admin/cards" : `/api/admin/cards/${sanitizedCard.id}`;

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.accessToken}`,
                },
                body: JSON.stringify(sanitizedCard),
            });

            if (!response.ok) throw new Error(`Failed to ${method === "POST" ? "add" : "update"} card`);

            const result = await response.json();

            if (method === "POST") {
                setCards((prev) => [result, ...prev]);
            } else {
                setCards((prev) => prev.map((c) => (c.id === result.id ? result : c)));
            }

            setEditCard(null);
            setValidationErrors({});
            toast.success(`Card ${method === "POST" ? "added" : "updated"} successfully!`);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : `Error ${sanitizedCard.id === 0 ? "adding" : "updating"} card`;
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteCard = async (cardId: number) => {
        if (!session) return;

        setRowLoading((prev) => ({ ...prev, [cardId]: true }));
        try {
            const response = await fetch(`/api/admin/cards/${cardId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${session.accessToken}` },
            });

            if (!response.ok) throw new Error("Failed to delete card");

            setCards((prev) => prev.filter((card) => card.id !== cardId));
            setSelected((prev) => prev.filter((id) => id !== cardId));
            toast.success("Card deleted successfully!");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Error deleting card";
            toast.error(errorMessage);
        } finally {
            setRowLoading((prev) => ({ ...prev, [cardId]: false }));
        }
    };

    const handleBulkCreate = async () => {
        if (!bulkCardsText.trim() || !session) return;

        setActionLoading(true);
        try {
            const lines = bulkCardsText.trim().split('\n');
            startMainProgress(lines.length, `Creating ${lines.length} cards...`);

            const cards = lines.map(line => {
                const [name, set_name, set_number, rarity, card_type, image_url] = line.split(',').map(s => s.trim());
                return {
                    name,
                    set_name,
                    set_number,
                    rarity: rarity || 'Common',
                    card_type: card_type || 'Pokemon',
                    image_url: image_url || '',
                    small_image_url: image_url || ''
                };
            }).filter(card => card.name && card.set_name && card.set_number);

            updateMainProgress(lines.length / 2, 'Processing card data', 'importing');

            const response = await fetch('/api/admin/cards', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.accessToken}`,
                },
                body: JSON.stringify({ cards }),
            });

            if (!response.ok) throw new Error('Failed to bulk create cards');

            const result = await response.json();

            updateMainProgress(lines.length, 'Bulk creation completed', 'completed');
            completeMainProgress({
                completed: result.created.length,
                failed: result.errors.length,
                skipped: result.skipped.length
            });

            setCards((prev) => [...result.created, ...prev]);
            setBulkCreateOpen(false);
            setBulkCardsText('');

            toast.success(`Created ${formatNumber(result.created.length)} cards! Skipped ${result.skipped.length}, Errors: ${result.errors.length}`);

            setTimeout(resetMainProgress, 3000);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error bulk creating cards';
            toast.error(errorMessage);
            updateMainProgress(0, 'Bulk creation failed', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePokemonImportComplete = (results: any) => {
        if (results && results.imported) {
            setCards((prev) => [...results.imported, ...prev]);
            toast.success(`Successfully imported ${formatNumber(results.imported.length)} Pokémon cards!`);
            fetchCards();
        }
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minHeight: "100vh",
                bgcolor: "grey.900",
                p: 3,
                background: "linear-gradient(181deg,rgba(0, 0, 0, 0.74), #031e04,rgba(0, 0, 0, 0.17), #000000d4)",
                backgroundSize: "200% 200%",
                animation: "gradientShift 20s ease infinite",
                "@keyframes gradientShift": {
                    "0%": { backgroundPosition: "0% 0%" },
                    "50%": { backgroundPosition: "100% 100%" },
                    "100%": { backgroundPosition: "0% 0%" },
                },
            }}
        >
            <ToastContainer position="top-right" />
            <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
                <CircularProgress color="inherit" />
            </Backdrop>

            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, width: '100%', maxWidth: 'xl' }}>
                <Tooltip title="Toggle Sidebar">
                    <IconButton onClick={toggleSidebar} sx={{ color: 'text.primary' }}>
                        <MenuIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            <GoogleAnalytics trackPageViews debugMode={true} />

            <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
                <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <Paper
                        elevation={6}
                        sx={{
                            p: 4,
                            bgcolor: "grey.900",
                            backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                            borderRadius: 3,
                            boxShadow: "0 0 20px rgba(150, 255, 155, 0.15)",
                            overflow: "visible",
                        }}
                    >
                        <Box sx={{ mb: 4, display: "flex", justifyContent: "center" }}>
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                                <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market Logo" width={200} height={100} />
                            </motion.div>
                        </Box>

                        <Typography variant="h4" sx={{ mb: 4, textAlign: "center", color: "text.primary", fontWeight: 'bold' }}>
                            Admin - Card Management
                        </Typography>

                        {/* Main Progress Display */}
                        <ProgressDisplay progress={mainProgress} />

                        {/* Enhanced Card Stats Dashboard */}
                        <motion.div variants={itemVariants}>
                            <Grid container spacing={2} sx={{ mb: 4 }}>
                                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                    <StatsCard
                                        icon={<Inventory />}
                                        title="Total Cards"
                                        value={formatNumber(stats.total)}
                                        color="primary"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                    <StatsCard
                                        icon={<Category />}
                                        title="Total Owned"
                                        value={formatNumber(stats.totalOwned)}
                                        subtitle={`${stats.uniqueSets} unique sets`}
                                        color="info"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                    <StatsCard
                                        icon={<Store />}
                                        title="For Sale"
                                        value={formatNumber(stats.forSale)}
                                        color="success"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
                                    <StatsCard
                                        icon={<AttachMoney />}
                                        title="Market Value"
                                        value={formatPrice(stats.totalMarketValue)}
                                        subtitle={`Avg: ${formatPrice(stats.avgMarketPrice)}`}
                                        color="warning"
                                    />
                                </Grid>
                            </Grid>
                        </motion.div>

                        <motion.div variants={containerVariants} initial="hidden" animate="visible">
                            {/* Action Buttons */}
                            <motion.div variants={itemVariants}>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={2}
                                    sx={{ mb: 4 }}
                                    justifyContent="space-between"
                                    flexWrap="wrap"
                                >
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                        <Tooltip title="Add a new card to the collection">
                                            <Button
                                                variant="contained"
                                                sx={{ bgcolor: "#96ff9b", color: "grey.900", '&:hover': { bgcolor: '#7ce682' } }}
                                                onClick={handleAddCard}
                                                disabled={actionLoading}
                                                startIcon={<AddIcon />}
                                            >
                                                Add Card
                                            </Button>
                                        </Tooltip>
                                        <Tooltip title="Import multiple cards at once using CSV format">
                                            <Button
                                                variant="contained"
                                                sx={{ bgcolor: "#96ff9b", color: "grey.900", '&:hover': { bgcolor: '#7ce682' } }}
                                                onClick={() => setBulkCreateOpen(true)}
                                                disabled={actionLoading}
                                                startIcon={<UploadIcon />}
                                            >
                                                Bulk Create
                                            </Button>
                                        </Tooltip>
                                        <Tooltip title="Import cards directly from Pokémon TCG API with progress tracking">
                                            <Button
                                                variant="contained"
                                                sx={{ bgcolor: "#ff9696", color: "grey.900", '&:hover': { bgcolor: '#ff7a7a' } }}
                                                onClick={() => setPokemonImportOpen(true)}
                                                disabled={actionLoading}
                                                startIcon={<DownloadIcon />}
                                            >
                                                Import Pokémon Cards
                                            </Button>
                                        </Tooltip>
                                    </Stack>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                        <Tooltip title="Sync market prices for all cards with progress tracking">
                                            <Button
                                                variant="contained"
                                                sx={{ bgcolor: "#ff9696", color: "grey.900", '&:hover': { bgcolor: '#ff7a7a' } }}
                                                onClick={() => setPriceSyncOpen(true)}
                                                disabled={actionLoading}
                                                startIcon={<Sync />}
                                            >
                                                Sync Prices
                                            </Button>
                                        </Tooltip>
                                        <Tooltip title="Refresh the card list">
                                            <Button
                                                variant="contained"
                                                sx={{ bgcolor: "#96ff9b", color: "grey.900", '&:hover': { bgcolor: '#7ce682' } }}
                                                onClick={fetchCards}
                                                disabled={loading || actionLoading}
                                                startIcon={<RefreshIcon />}
                                            >
                                                Refresh
                                            </Button>
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                            </motion.div>

                            {/* Column Visibility Toggle */}
                            <motion.div variants={itemVariants}>
                                <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.800', borderRadius: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <VisibilityIcon sx={{ color: 'text.secondary' }} />
                                        <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 'medium' }}>
                                            Visible Columns
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                        {Object.keys(visibleColumns).map((col) => {
                                            const formatColumnName = (name: string) => {
                                                const columnNameMap: { [key: string]: string } = {
                                                    'id': 'ID',
                                                    'name': 'Name',
                                                    'set_name': 'Set Name',
                                                    'set_number': 'Set Number',
                                                    'rarity': 'Rarity',
                                                    'card_type': 'Card Type',
                                                    'totalOwned': 'Total Owned',
                                                    'forSaleCount': 'For Sale Count',
                                                    'created_at': 'Created At',
                                                    'pricing': 'Pricing'
                                                };
                                                return columnNameMap[name] || name;
                                            };

                                            return (
                                                <FormControlLabel
                                                    key={col}
                                                    control={
                                                        <Checkbox
                                                            checked={visibleColumns[col as keyof typeof visibleColumns]}
                                                            onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [col]: e.target.checked }))}
                                                            sx={{ color: "text.secondary" }}
                                                        />
                                                    }
                                                    label={formatColumnName(col)}
                                                    sx={{ color: "text.secondary" }}
                                                />
                                            );
                                        })}
                                    </Box>
                                </Paper>
                            </motion.div>

                            {/* Filters */}
                            <motion.div variants={itemVariants}>
                                <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.800', borderRadius: 2 }}>
                                    <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 'medium', mb: 2 }}>
                                        Filters
                                    </Typography>
                                    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, alignItems: "center" }}>
                                        <TextField
                                            label="Search Cards"
                                            variant="outlined"
                                            value={searchQuery}
                                            onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                                            sx={{ flex: 1, minWidth: { xs: "100%", md: 200 } }}
                                            InputLabelProps={{ style: { color: "text.secondary" } }}
                                            inputProps={{ style: { color: "text.primary" } }}
                                            placeholder="Search by name..."
                                        />
                                        <FormControl sx={{ minWidth: { xs: "100%", md: 150 } }}>
                                            <InputLabel sx={{ color: "text.secondary" }}>Set</InputLabel>
                                            <Select
                                                value={setFilter}
                                                onChange={(e) => setSetFilter(e.target.value)}
                                                label="Set"
                                                sx={{ color: "text.primary" }}
                                            >
                                                <MenuItem value="">All Sets</MenuItem>
                                                {Array.from(new Set(cards.map(card => card.set_name))).sort().map(set => (
                                                    <MenuItem key={set} value={set}>{set}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <FormControl sx={{ minWidth: { xs: "100%", md: 150 } }}>
                                            <InputLabel sx={{ color: "text.secondary" }}>Type</InputLabel>
                                            <Select
                                                value={typeFilter}
                                                onChange={(e) => setTypeFilter(e.target.value)}
                                                label="Type"
                                                sx={{ color: "text.primary" }}
                                            >
                                                <MenuItem value="">All Types</MenuItem>
                                                <MenuItem value="Pokemon">Pokémon</MenuItem>
                                                <MenuItem value="Trainer">Trainer</MenuItem>
                                                <MenuItem value="Energy">Energy</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <FormControl sx={{ minWidth: { xs: "100%", md: 150 } }}>
                                            <InputLabel sx={{ color: "text.secondary" }}>Rarity</InputLabel>
                                            <Select
                                                value={rarityFilter}
                                                onChange={(e) => setRarityFilter(e.target.value)}
                                                label="Rarity"
                                                sx={{ color: "text.primary" }}
                                            >
                                                <MenuItem value="">All Rarities</MenuItem>
                                                <MenuItem value="Common">Common</MenuItem>
                                                <MenuItem value="Uncommon">Uncommon</MenuItem>
                                                <MenuItem value="Rare">Rare</MenuItem>
                                                <MenuItem value="Holo Rare">Holo Rare</MenuItem>
                                                <MenuItem value="Ultra Rare">Ultra Rare</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <Button
                                            variant="outlined"
                                            onClick={() => {
                                                setSearchQuery("");
                                                setSetFilter("");
                                                setTypeFilter("");
                                                setRarityFilter("");
                                            }}
                                            sx={{ minWidth: 100 }}
                                        >
                                            Reset
                                        </Button>
                                    </Box>
                                </Paper>
                            </motion.div>

                            {/* Bulk Actions Toolbar */}
                            {selected.length > 0 && (
                                <motion.div variants={itemVariants}>
                                    <Toolbar
                                        sx={{
                                            bgcolor: "grey.800",
                                            mb: 3,
                                            borderRadius: 2,
                                            border: "2px solid #96ff9b",
                                        }}
                                    >
                                        <Typography sx={{ flex: "1 1 100%", color: "text.primary", fontWeight: 'medium' }}>
                                            {formatNumber(selected.length)} {selected.length === 1 ? 'card' : 'cards'} selected
                                        </Typography>
                                        <Stack direction="row" spacing={1}>
                                            <Tooltip title="Update prices for selected cards with progress tracking">
                                                <IconButton
                                                    onClick={handleBulkPriceCheck}
                                                    disabled={actionLoading}
                                                    sx={{ color: 'primary.main' }}
                                                >
                                                    <Badge badgeContent={selected.length} color="primary">
                                                        <Sync />
                                                    </Badge>
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete selected cards">
                                                <IconButton
                                                    color="error"
                                                    onClick={() => {
                                                        toast.info("Bulk delete functionality to be implemented");
                                                    }}
                                                    disabled={actionLoading}
                                                >
                                                    <Badge badgeContent={selected.length} color="error">
                                                        <DeleteIcon />
                                                    </Badge>
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </Toolbar>
                                </motion.div>
                            )}

                            {/* Cards DataGrid */}
                            <motion.div variants={itemVariants}>
                                <Paper
                                    sx={{
                                        bgcolor: 'grey.800',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        border: '1px solid',
                                        borderColor: 'grey.700'
                                    }}
                                >
                                    <Box sx={{
                                        height: 700,
                                        width: "100%",
                                        '& .MuiDataGrid-root': {
                                            border: 'none',
                                        }
                                    }}>
                                        <DataGrid
                                            rows={filteredCards}
                                            columns={columns}
                                            paginationModel={paginationModel}
                                            onPaginationModelChange={(newModel) => {
                                                setPaginationModel(newModel);
                                                setSelected([]);
                                            }}
                                            pageSizeOptions={[10, 25, 50, 100]}
                                            checkboxSelection
                                            onRowSelectionModelChange={(newSelection) => {
                                                const selectedIds = newSelection.map((id) => Number(id));
                                                setSelected(selectedIds);
                                            }}
                                            disableRowSelectionOnClick
                                            density="comfortable"
                                            getRowHeight={() => 'auto'}
                                            sx={{
                                                border: 'none',
                                                color: "text.primary",
                                                fontSize: '0.875rem',
                                                '& .MuiDataGrid-root': {
                                                    fontSize: '0.875rem'
                                                },
                                                "& .MuiDataGrid-columnHeaders": {
                                                    bgcolor: "grey.900",
                                                    borderBottom: '2px solid',
                                                    borderColor: 'grey.700',
                                                    minHeight: '56px !important',
                                                    '& .MuiDataGrid-columnHeader': {
                                                        py: 2,
                                                    },
                                                    '& .MuiDataGrid-columnHeaderTitle': {
                                                        fontWeight: 600,
                                                        fontSize: '0.95rem',
                                                        lineHeight: 1.5
                                                    }
                                                },
                                                "& .MuiDataGrid-virtualScroller": {
                                                    bgcolor: "grey.800",
                                                    '&::-webkit-scrollbar': {
                                                        width: '8px',
                                                        height: '8px',
                                                    },
                                                    '&::-webkit-scrollbar-track': {
                                                        bgcolor: 'grey.900',
                                                    },
                                                    '&::-webkit-scrollbar-thumb': {
                                                        bgcolor: 'grey.600',
                                                        borderRadius: '4px',
                                                        '&:hover': {
                                                            bgcolor: 'grey.500',
                                                        }
                                                    }
                                                },
                                                "& .MuiDataGrid-footerContainer": {
                                                    bgcolor: "grey.900",
                                                    borderTop: '2px solid',
                                                    borderColor: 'grey.700',
                                                    minHeight: '56px',
                                                    '& .MuiTablePagination-toolbar': {
                                                        minHeight: '56px',
                                                    }
                                                },
                                                "& .MuiDataGrid-row": {
                                                    "&:hover": {
                                                        bgcolor: "rgba(150, 255, 155, 0.04)",
                                                        cursor: 'pointer'
                                                    },
                                                    "&.Mui-selected": {
                                                        bgcolor: "rgba(150, 255, 155, 0.08)",
                                                        "&:hover": {
                                                            bgcolor: "rgba(150, 255, 155, 0.12)"
                                                        }
                                                    }
                                                },
                                                "& .MuiDataGrid-cell": {
                                                    borderColor: "grey.700",
                                                    py: 2,
                                                    px: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    lineHeight: 1.5,
                                                    '&:focus': {
                                                        outline: 'none'
                                                    },
                                                    '&:focus-within': {
                                                        outline: 'none'
                                                    }
                                                },
                                                "& .MuiCheckbox-root": {
                                                    color: "text.secondary",
                                                    "&.Mui-checked": {
                                                        color: "#96ff9b"
                                                    }
                                                },
                                                "& .MuiDataGrid-columnSeparator": {
                                                    color: "grey.700",
                                                    '&:hover': {
                                                        color: 'grey.500'
                                                    }
                                                },
                                                "& .MuiTablePagination-root": {
                                                    color: "text.primary"
                                                },
                                                "& .MuiDataGrid-overlay": {
                                                    bgcolor: 'grey.800'
                                                },
                                                "& .MuiDataGrid-row .MuiDataGrid-cell": {
                                                    '&[data-field="name"]': {
                                                        fontWeight: 500
                                                    },
                                                    '&[data-field="pricing"]': {
                                                        py: 1.5
                                                    }
                                                }
                                            }}
                                        />
                                    </Box>
                                </Paper>
                            </motion.div>

                            {filteredCards.length === 0 && !error && (
                                <Box sx={{ textAlign: 'center', py: 8 }}>
                                    <Typography variant="h6" sx={{ color: "text.secondary", mb: 2 }}>
                                        No cards found
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                        Try adjusting your filters or add new cards to the collection
                                    </Typography>
                                </Box>
                            )}
                        </motion.div>
                    </Paper>
                </motion.div>
            </Container>

            {/* Pokemon Import Modal */}
            <PokemonImportModal
                open={pokemonImportOpen}
                onClose={() => setPokemonImportOpen(false)}
                onImportComplete={handlePokemonImportComplete}
            />

            {/* Price Sync Modal */}
            <PriceSyncModal
                open={priceSyncOpen}
                onClose={() => setPriceSyncOpen(false)}
                onSyncComplete={handlePriceSyncComplete}
            />

            {/* Add/Edit Card Dialog */}
            <Dialog
                open={!!editCard}
                onClose={() => setEditCard(null)}
                maxWidth="md"
                fullWidth
                ref={editDialogRef}
            >
                <DialogTitle>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        {editCard?.id === 0 ? "Add New Card" : "Edit Card"}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {editCard && (
                        <Grid container spacing={3} sx={{ mt: 1 }}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Card Name"
                                    fullWidth
                                    value={editCard.name}
                                    onChange={(e) => setEditCard({ ...editCard, name: e.target.value })}
                                    error={!!validationErrors.name}
                                    helperText={validationErrors.name}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Set Name"
                                    fullWidth
                                    value={editCard.set_name}
                                    onChange={(e) => setEditCard({ ...editCard, set_name: e.target.value })}
                                    error={!!validationErrors.set_name}
                                    helperText={validationErrors.set_name}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Set Number"
                                    fullWidth
                                    value={editCard.set_number}
                                    onChange={(e) => setEditCard({ ...editCard, set_number: e.target.value })}
                                    error={!!validationErrors.set_number}
                                    helperText={validationErrors.set_number}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth error={!!validationErrors.rarity} required>
                                    <InputLabel>Rarity</InputLabel>
                                    <Select
                                        value={editCard.rarity}
                                        onChange={(e) => setEditCard({ ...editCard, rarity: e.target.value })}
                                        label="Rarity"
                                    >
                                        <MenuItem value="Common">Common</MenuItem>
                                        <MenuItem value="Uncommon">Uncommon</MenuItem>
                                        <MenuItem value="Rare">Rare</MenuItem>
                                        <MenuItem value="Holo Rare">Holo Rare</MenuItem>
                                        <MenuItem value="Ultra Rare">Ultra Rare</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth error={!!validationErrors.card_type} required>
                                    <InputLabel>Card Type</InputLabel>
                                    <Select
                                        value={editCard.card_type}
                                        onChange={(e) => setEditCard({ ...editCard, card_type: e.target.value })}
                                        label="Card Type"
                                    >
                                        <MenuItem value="Pokemon">Pokémon</MenuItem>
                                        <MenuItem value="Trainer">Trainer</MenuItem>
                                        <MenuItem value="Energy">Energy</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Subtype"
                                    fullWidth
                                    value={editCard.subtype || ""}
                                    onChange={(e) => setEditCard({ ...editCard, subtype: e.target.value })}
                                    placeholder="e.g., Basic, Stage 1, Item"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="HP"
                                    type="number"
                                    fullWidth
                                    value={editCard.hp || ""}
                                    onChange={(e) => setEditCard({ ...editCard, hp: e.target.value ? parseInt(e.target.value) : undefined })}
                                    placeholder="Hit Points (if applicable)"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="TCG ID"
                                    fullWidth
                                    value={editCard.tcg_id || ""}
                                    onChange={(e) => setEditCard({ ...editCard, tcg_id: e.target.value })}
                                    placeholder="Trading Card Game ID"
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    label="Image URL"
                                    fullWidth
                                    value={editCard.image_url || ""}
                                    onChange={(e) => setEditCard({ ...editCard, image_url: e.target.value, small_image_url: e.target.value })}
                                    placeholder="https://example.com/card-image.png"
                                />
                            </Grid>
                            {editCard.image_url && (
                                <Grid item xs={12}>
                                    <Paper sx={{ p: 2, bgcolor: 'grey.800', borderRadius: 2 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                                            Card Preview
                                        </Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                            <Box sx={{
                                                borderRadius: 2,
                                                overflow: 'hidden',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                            }}>
                                                <Image
                                                    src={editCard.image_url}
                                                    alt="Card preview"
                                                    width={200}
                                                    height={280}
                                                    style={{ objectFit: 'contain', display: 'block' }}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Paper>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setEditCard(null)} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        sx={{ bgcolor: "#96ff9b", color: "grey.900", '&:hover': { bgcolor: '#7ce682' } }}
                        onClick={handleSaveCard}
                        disabled={actionLoading}
                        startIcon={actionLoading ? <CircularProgress size={20} /> : null}
                    >
                        {actionLoading ? 'Saving...' : 'Save Card'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Bulk Create Dialog */}
            <Dialog
                open={bulkCreateOpen}
                onClose={() => setBulkCreateOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        Bulk Create Cards
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 3 }} icon={<InfoOutlinedIcon />}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            Enter cards in CSV format: <strong>name,set_name,set_number,rarity,card_type,image_url</strong>
                        </Typography>
                        <Typography variant="body2">
                            One card per line. Example:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                p: 1,
                                bgcolor: 'grey.800',
                                borderRadius: 1,
                                fontFamily: 'monospace',
                                fontSize: '0.85rem'
                            }}
                        >
                            Charizard,Base Set,4/102,Holo Rare,Pokemon,https://images.pokemontcg.io/base1/4.png
                        </Typography>
                    </Alert>
                    <TextField
                        fullWidth
                        multiline
                        rows={12}
                        value={bulkCardsText}
                        onChange={(e) => setBulkCardsText(e.target.value)}
                        placeholder="Pikachu,Base Set,58/102,Common,Pokemon,https://images.pokemontcg.io/base1/58.png"
                        sx={{
                            mt: 2,
                            '& .MuiInputBase-input': {
                                fontFamily: 'monospace',
                                fontSize: '0.9rem'
                            }
                        }}
                    />
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            {bulkCardsText.trim() ? `${bulkCardsText.trim().split('\n').length} cards to import` : 'No cards entered'}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setBulkCreateOpen(false)} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        sx={{ bgcolor: "#96ff9b", color: "grey.900", '&:hover': { bgcolor: '#7ce682' } }}
                        onClick={handleBulkCreate}
                        disabled={actionLoading || !bulkCardsText.trim()}
                        startIcon={actionLoading ? <CircularProgress size={20} /> : <UploadIcon />}
                    >
                        {actionLoading ? 'Creating Cards...' : 'Create Cards'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}