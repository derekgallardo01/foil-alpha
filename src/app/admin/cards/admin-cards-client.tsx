"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRequireAuth } from "../../lib/useRequireAuth";
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
    Chip,
    InputLabel,
    FormControl,
    Alert,
    Tooltip,
    Stack,
    Badge,
    LinearProgress
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
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
    AttachMoney,
    Inventory,
    Store,
    Category
} from '@mui/icons-material';
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { GoogleAnalytics } from "nextjs-google-analytics";
import sanitizeHtml from "sanitize-html";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import { formatPrice, formatCompactPrice } from "../../lib/format";
import { getRarityColor } from "../../lib/rarity";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import PokemonImportModal from './PokemonImportModal';
import PriceSyncModal from './PriceSyncModal';
import PriceTrendChip from './PriceTrendChip';


// Animation variants
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

// Progress tracking interface
export interface ProgressState {
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
export const useProgressTracker = () => {
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
export function ProgressDisplay({ progress }: { progress: ProgressState }) {
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
            variant="outlined"
            sx={{
                p: 3,
                mb: 3,
                bgcolor: 'background.paper',
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
                    <Typography variant="mono" sx={{ color: 'text.secondary' }}>
                        {progress.current} / {progress.total} ({progress.percentage}%)
                    </Typography>
                </Box>

                <LinearProgress
                    variant="determinate"
                    value={progress.percentage}
                    sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'background.default',
                        '& .MuiLinearProgress-bar': {
                            bgcolor: progress.status === 'error' ? 'error.main' :
                                progress.status === 'completed' ? 'success.main' : 'primary.main',
                            borderRadius: 4
                        }
                    }}
                />
            </Box>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Elapsed Time
                            </Typography>
                            <Typography variant="mono" color="text.primary">
                                {formatTime(progress.elapsedTime)}
                            </Typography>
                        </Box>
                    </Box>
                </Grid>

                {progress.estimatedTimeRemaining > 0 && progress.status !== 'completed' && (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Timeline sx={{ color: 'text.secondary', fontSize: 20 }} />
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Estimated Remaining
                                </Typography>
                                <Typography variant="mono" color="text.primary">
                                    {formatTime(progress.estimatedTimeRemaining)}
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>
                )}

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Completed
                            </Typography>
                            <Typography variant="mono" color="success.main">
                                {progress.completed}
                            </Typography>
                        </Box>
                    </Box>
                </Grid>

                {(progress.failed > 0 || progress.skipped > 0) && (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Issues
                                </Typography>
                                <Typography variant="mono" color="error.main">
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

// Plain integer/count formatter (non-currency). Currency uses shared formatPrice from lib/format.
export const formatNumber = (num: number): string => num.toLocaleString();

export default function AdminCardsClient() {
    const { session, status } = useRequireAuth({ admin: true });
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

    // Enhanced fetch cards with progress tracking
    const fetchCards = useCallback(async () => {
        if (!session) return;

        try {
            setLoading(true);
            startMainProgress(3, 'Loading cards from database...');

            updateMainProgress(1, 'Preparing request parameters');

            // Only fetch all cards - no filter parameters needed since we filter client-side
            const params = new URLSearchParams();
            params.append('all', 'true'); // Get all cards
            params.append('limit', '1000'); // Fallback limit

            updateMainProgress(2, 'Fetching cards from server');

            const response = await fetch(`/api/admin/cards?${params.toString()}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) throw new Error("Failed to fetch cards");

            const data: CardsResponse = await response.json();

            updateMainProgress(3, 'Processing card data', 'completed');
            completeMainProgress({ completed: data.cards?.length || 0, failed: 0, skipped: 0 });

            setCards(data.cards || []);

            const totalMessage = `Loaded ${data.cards?.length || 0} cards from database`;
            toast.success(totalMessage, { autoClose: 3000 });

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
    }, [session, startMainProgress, updateMainProgress, completeMainProgress, resetMainProgress]); // Remove filter dependencies

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

    const filteredCards = useMemo(() => {
        let result = [...cards];

        // Search filter - search in name, set_name, and set_number
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(card =>
                card.name.toLowerCase().includes(query) ||
                card.set_name.toLowerCase().includes(query) ||
                (card.set_number && card.set_number.toLowerCase().includes(query)) ||
                (card.rarity && card.rarity.toLowerCase().includes(query)) ||
                (card.card_type && card.card_type.toLowerCase().includes(query))
            );
        }

        // Set filter
        if (setFilter) {
            result = result.filter(card => card.set_name === setFilter);
        }

        // Type filter  
        if (typeFilter) {
            result = result.filter(card => card.card_type === typeFilter);
        }

        // Rarity filter
        if (rarityFilter) {
            result = result.filter(card => card.rarity === rarityFilter);
        }

        return result;
    }, [cards, searchQuery, setFilter, typeFilter, rarityFilter]);

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
                <Typography variant="mono" sx={{ fontWeight: 'bold', color: 'success.main' }}>
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
                <Typography variant="mono" sx={{ fontWeight: 'medium' }}>
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
                headers: {},
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
        if (results) {
            let importedCount = 0;
            let updatedCount = 0;
            let errorCount = 0;

            // Handle the API response structure properly
            if (results.results) {
                // New API response structure
                importedCount = Array.isArray(results.results.imported) ? results.results.imported.length : (results.imported || 0);
                updatedCount = Array.isArray(results.results.updated) ? results.results.updated.length : (results.updated || 0);
                errorCount = Array.isArray(results.results.errors) ? results.results.errors.length : 0;
            } else {
                // Direct count response
                importedCount = typeof results.imported === 'number' ? results.imported : 0;
                updatedCount = typeof results.updated === 'number' ? results.updated : 0;
                errorCount = Array.isArray(results.errors) ? results.errors.length : 0;
            }

            // Show success message with proper counts
            const totalProcessed = importedCount + updatedCount;
            if (totalProcessed > 0) {
                let message = `Successfully processed ${formatNumber(totalProcessed)} cards!`;
                if (importedCount > 0) message += ` ${formatNumber(importedCount)} imported.`;
                if (updatedCount > 0) message += ` ${formatNumber(updatedCount)} updated.`;
                if (errorCount > 0) message += ` ${formatNumber(errorCount)} had errors.`;

                toast.success(message, { autoClose: 5000 });
            } else {
                const noCardsMessage = 'Import completed - No new cards were added. All cards may already exist.';
                toast.info(noCardsMessage);
            }

            // Always refresh the cards list after import to get the most up-to-date data
            fetchCards();
        } else {
            const errorMessage = 'Import completed but no results were returned';
            toast.error(errorMessage);
            console.error(`❌ ${errorMessage}`);
        }
    };

    return (
        <AppShell variant="admin">
        <PageHeader
            title="Cards"
            icon={<Inventory />}
            actions={
                <>
                    <Tooltip title="Import cards directly from Pokémon TCG API with progress tracking">
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => setPokemonImportOpen(true)}
                            disabled={actionLoading}
                            startIcon={<DownloadIcon />}
                        >
                            Import Pokémon Cards
                        </Button>
                    </Tooltip>
                    <Tooltip title="Sync market prices for all cards with progress tracking">
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={() => setPriceSyncOpen(true)}
                            disabled={actionLoading}
                            startIcon={<Sync />}
                        >
                            Sync Prices
                        </Button>
                    </Tooltip>
                    <Tooltip title="Refresh the card list">
                        <Button
                            variant="outlined"
                            onClick={fetchCards}
                            disabled={loading || actionLoading}
                            startIcon={<RefreshIcon />}
                        >
                            Refresh
                        </Button>
                    </Tooltip>
                </>
            }
        />
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minHeight: "100vh",
                p: 3,
            }}
        >
            <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
                <CircularProgress color="inherit" />
            </Backdrop>

            <GoogleAnalytics trackPageViews debugMode={false} />

            <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
                <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 4,
                            bgcolor: "background.paper",
                            borderRadius: 3,
                            border: 1,
                            borderColor: "divider",
                            overflow: "visible",
                        }}
                    >
                        {/* Main Progress Display */}
                        <ProgressDisplay progress={mainProgress} />

                        {/* Enhanced Card Stats Dashboard */}
                        <motion.div variants={itemVariants}>
                            <Grid container spacing={2} sx={{ mb: 4 }}>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
                                    <StatCard
                                        icon={<Inventory />}
                                        label="Total Cards"
                                        value={formatNumber(stats.total)}
                                        accent
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
                                    <StatCard
                                        icon={<Category />}
                                        label="Total Owned"
                                        value={formatNumber(stats.totalOwned)}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
                                    <StatCard
                                        icon={<Store />}
                                        label="For Sale"
                                        value={formatNumber(stats.forSale)}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
                                    <StatCard
                                        icon={<AttachMoney />}
                                        label="Market Value"
                                        value={formatCompactPrice(stats.totalMarketValue)}
                                    />
                                </Grid>
                            </Grid>
                        </motion.div>

                        <motion.div variants={containerVariants} initial="hidden" animate="visible">
                            {/* Column Visibility Toggle */}
                            <motion.div variants={itemVariants}>
                                <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
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
                                <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                                    <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 'medium', mb: 2 }}>
                                        Filters
                                    </Typography>
                                    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, alignItems: "center" }}>
                                        <TextField
                                            label="Search Cards"
                                            variant="outlined"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)} // Direct update instead of debounced
                                            sx={{ flex: 1, minWidth: { xs: "100%", md: 200 } }}
                                            InputLabelProps={{ style: { color: "text.secondary" } }}
                                            inputProps={{ style: { color: "text.primary" } }}
                                            placeholder="Search by name, set, number, rarity, or type..."
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
                                                // No need to refetch since filtering is client-side
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
                                            bgcolor: "background.paper",
                                            mb: 3,
                                            borderRadius: 2,
                                            border: 1,
                                            borderColor: "divider",
                                        }}
                                    >
                                        <Typography sx={{ flex: "1 1 100%", color: "text.primary", fontWeight: 'medium' }}>
                                            <Typography component="span" variant="mono" sx={{ fontWeight: 'medium' }}>{formatNumber(selected.length)}</Typography> {selected.length === 1 ? 'card' : 'cards'} selected
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
                                    variant="outlined"
                                    sx={{
                                        bgcolor: 'background.paper',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        border: '1px solid',
                                        borderColor: 'divider'
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
                                                    bgcolor: "background.paper",
                                                    borderBottom: '2px solid',
                                                    borderColor: 'divider',
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
                                                    bgcolor: "background.default",
                                                    '&::-webkit-scrollbar': {
                                                        width: '8px',
                                                        height: '8px',
                                                    },
                                                    '&::-webkit-scrollbar-track': {
                                                        bgcolor: 'background.default',
                                                    },
                                                    '&::-webkit-scrollbar-thumb': {
                                                        bgcolor: 'divider',
                                                        borderRadius: '4px',
                                                        '&:hover': {
                                                            bgcolor: 'text.disabled',
                                                        }
                                                    }
                                                },
                                                "& .MuiDataGrid-footerContainer": {
                                                    bgcolor: "background.paper",
                                                    borderTop: '2px solid',
                                                    borderColor: 'divider',
                                                    minHeight: '56px',
                                                    '& .MuiTablePagination-toolbar': {
                                                        minHeight: '56px',
                                                    }
                                                },
                                                "& .MuiDataGrid-row": {
                                                    "&:hover": {
                                                        bgcolor: "action.hover",
                                                        cursor: 'pointer'
                                                    },
                                                    "&.Mui-selected": {
                                                        bgcolor: "action.selected",
                                                        "&:hover": {
                                                            bgcolor: "action.selected"
                                                        }
                                                    }
                                                },
                                                "& .MuiDataGrid-cell": {
                                                    borderColor: "divider",
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
                                                        color: "primary.main"
                                                    }
                                                },
                                                "& .MuiDataGrid-columnSeparator": {
                                                    color: "divider",
                                                    '&:hover': {
                                                        color: 'text.disabled'
                                                    }
                                                },
                                                "& .MuiTablePagination-root": {
                                                    color: "text.primary"
                                                },
                                                "& .MuiDataGrid-overlay": {
                                                    bgcolor: 'background.paper'
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
                                <EmptyState
                                    icon={<Inventory />}
                                    title="No cards found"
                                    description="Try adjusting your filters."
                                />
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
                            <Grid size={{ xs: 12, md: 6 }}>
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
                            <Grid size={{ xs: 12, md: 6 }}>
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
                            <Grid size={{ xs: 12, md: 6 }}>
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
                            <Grid size={{ xs: 12, md: 6 }}>
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
                            <Grid size={{ xs: 12, md: 6 }}>
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
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    label="Subtype"
                                    fullWidth
                                    value={editCard.subtype || ""}
                                    onChange={(e) => setEditCard({ ...editCard, subtype: e.target.value })}
                                    placeholder="e.g., Basic, Stage 1, Item"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    label="HP"
                                    type="number"
                                    fullWidth
                                    value={editCard.hp || ""}
                                    onChange={(e) => setEditCard({ ...editCard, hp: e.target.value ? parseInt(e.target.value) : undefined })}
                                    placeholder="Hit Points (if applicable)"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    label="TCG ID"
                                    fullWidth
                                    value={editCard.tcg_id || ""}
                                    onChange={(e) => setEditCard({ ...editCard, tcg_id: e.target.value })}
                                    placeholder="Trading Card Game ID"
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Image URL"
                                    fullWidth
                                    value={editCard.image_url || ""}
                                    onChange={(e) => setEditCard({ ...editCard, image_url: e.target.value, small_image_url: e.target.value })}
                                    placeholder="https://example.com/card-image.png"
                                />
                            </Grid>
                            {editCard.image_url && (
                                <Grid size={{ xs: 12 }}>
                                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
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
                        color="primary"
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
                                bgcolor: 'background.default',
                                borderRadius: 1,
                                border: 1,
                                borderColor: 'divider',
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
                        color="primary"
                        onClick={handleBulkCreate}
                        disabled={actionLoading || !bulkCardsText.trim()}
                        startIcon={actionLoading ? <CircularProgress size={20} /> : <UploadIcon />}
                    >
                        {actionLoading ? 'Creating Cards...' : 'Create Cards'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
        </AppShell>
    );
}
