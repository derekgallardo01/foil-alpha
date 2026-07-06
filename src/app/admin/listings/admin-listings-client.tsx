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
    Card,
    Chip,
    InputLabel,
    FormControl,
    Autocomplete,
    Tooltip,
    Switch,
    FormLabel,
    Divider
} from "@mui/material";
import Grid from '@mui/material/Grid2';
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import GavelIcon from "@mui/icons-material/Gavel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { debounce } from "lodash";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/StatCard";
import ErrorState from "../../components/ui/ErrorState";
import EmptyState from "../../components/ui/EmptyState";
import { formatPrice, formatTimeLeft, formatDuration, formatDateTime } from "../../lib/format";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

// Small label/value row for the details dialog.
function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.25 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ textAlign: "right" }}>{value}</Typography>
        </Box>
    );
}

// Animation variants
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

interface Card {
    id: number;
    name: string;
    set_name: string;
    set_number: string;
    rarity: string;
    card_type: string;
    image_url?: string;
    small_image_url?: string;
}

interface Listing {
    id: number;
    card: Card;
    owner: { id: number; name: string; role: string };
    condition: string;
    sale_type: 'FIXED' | 'AUCTION';
    fixed_price: number | null;
    reserve_price: number | null;
    auction_end: string | null;
    is_for_sale: boolean;
    is_sold: boolean;
    notes: string | null;
    created_at: string;
    current_highest_bid: number | null;
    bid_count: number;
    time_left_ms: number | null;
    is_auction_active: boolean;
    bids: Array<{
        id: number;
        amount: number;
        bidder: { id: number; name: string };
    }>;
}

interface ListingsResponse {
    listings: Listing[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export default function AdminListingsClient() {
    const { session, status } = useRequireAuth({ admin: true });
    const [listings, setListings] = useState<Listing[]>([]);
    const [allCards, setAllCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [createListingOpen, setCreateListingOpen] = useState<boolean>(false);
    const [editListingOpen, setEditListingOpen] = useState<boolean>(false);
    const [editData, setEditData] = useState<{
        id: number;
        cardName: string;
        sale_type: 'FIXED' | 'AUCTION';
        fixed_price: string;
        reserve_price: string;
        auction_duration_hours: string;
        notes: string;
        is_for_sale: boolean;
    } | null>(null);
    const [viewOpen, setViewOpen] = useState<boolean>(false);
    const [viewListing, setViewListing] = useState<Listing | null>(null);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [rowLoading, setRowLoading] = useState<{ [key: number]: boolean }>({});
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [selected, setSelected] = useState<number[]>([]);
    const [saleTypeFilter, setSaleTypeFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
    const [newListing, setNewListing] = useState({
        card_id: '',
        condition: 'NM',
        sale_type: 'FIXED',
        fixed_price: '',
        reserve_price: '',
        auction_duration_hours: '168',
        notes: '',
        quantity: 1
    });
    const [visibleColumns, setVisibleColumns] = useState({
        id: true,
        card_name: true,
        condition: true,
        sale_type: true,
        price: true,
        status: true,
        bids: true,
        created_at: true,
    });
    const createDialogRef = useRef<HTMLDivElement>(null);
    const hasFetchedRef = useRef(false);

    // Fetch listings
    const fetchListings = useCallback(async () => {
        if (!session) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (saleTypeFilter) params.append('saleType', saleTypeFilter);
            if (statusFilter) params.append('status', statusFilter);

            const response = await fetch(`/api/admin/listings?${params.toString()}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Unauthorized access. Please log in again.");
                } else if (response.status === 500) {
                    throw new Error("Server error. Please try again later.");
                }
                throw new Error("Failed to fetch listings");
            }

            const data: ListingsResponse = await response.json();
            setListings(data.listings || []);
            toast.success("Listings loaded successfully!", { autoClose: 2000 });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to load listings.";
            setError(errorMessage);
            toast.error(errorMessage);
            setListings([]);
        } finally {
            setLoading(false);
        }
    }, [session, searchQuery, saleTypeFilter, statusFilter]);

    // Fetch available cards for listing creation
    const fetchCards = useCallback(async () => {
        if (!session) return;

        try {
            const response = await fetch('/api/admin/cards', {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Unauthorized access. Please log in again.");
                } else if (response.status === 500) {
                    throw new Error("Server error. Please try again later.");
                }
                throw new Error("Failed to fetch cards");
            }

            const data = await response.json();
            setAllCards(data.cards || []);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Error fetching cards";
            console.error(errorMessage);
            toast.error(errorMessage);
        }
    }, [session]);

    // Initial fetch
    useEffect(() => {
        if (status === "authenticated" && !hasFetchedRef.current) {
            fetchListings();
            fetchCards();
            hasFetchedRef.current = true;
        }
    }, [status, fetchListings, fetchCards]);

    // Listing Stats
    const stats = useMemo(() => ({
        total: listings.length,
        active: listings.filter(l => l.is_for_sale && !l.is_sold).length,
        sold: listings.filter(l => l.is_sold).length,
        totalBids: listings.reduce((sum, listing) => sum + listing.bid_count, 0),
    }), [listings]);

    // Debounced Search
    const debouncedSetSearchQuery = debounce((value: string) => setSearchQuery(value), 300);

    const getStatusColor = useCallback((listing: Listing) => {
        if (listing.is_sold) return 'success';
        if (!listing.is_for_sale) return 'default';
        if (listing.sale_type === 'AUCTION' && !listing.is_auction_active) return 'error';
        return 'primary';
    }, []);

    const getStatusText = useCallback((listing: Listing) => {
        if (listing.is_sold) return 'Sold';
        if (!listing.is_for_sale) return 'Inactive';
        if (listing.sale_type === 'AUCTION' && !listing.is_auction_active) return 'Auction Ended';
        return 'Active';
    }, []);

    // Moved handleEditListing and handleDeleteListing before columns
    const handleEditListing = useCallback((listing: Listing) => {
        setEditData({
            id: listing.id,
            cardName: listing.card.name,
            sale_type: listing.sale_type,
            fixed_price: listing.fixed_price != null ? String(listing.fixed_price) : '',
            reserve_price: listing.reserve_price != null ? String(listing.reserve_price) : '',
            auction_duration_hours: '168',
            notes: listing.notes ?? '',
            is_for_sale: listing.is_for_sale,
        });
        setEditListingOpen(true);
    }, []);

    const handleDeleteListing = useCallback(async (listingId: number) => {
        if (!session) return;

        setRowLoading((prev) => ({ ...prev, [listingId]: true }));
        try {
            // Persist the delete server-side before updating local state, otherwise
            // the row reappears on the next refresh.
            const res = await fetch(`/api/admin/listings/${listingId}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to remove listing");
            }
            setListings((prev) => prev.filter((listing) => listing.id !== listingId));
            setSelected((prev) => prev.filter((id) => id !== listingId));
            toast.success("Listing removed successfully!");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Error removing listing";
            toast.error(errorMessage);
        } finally {
            setRowLoading((prev) => ({ ...prev, [listingId]: false }));
        }
    }, [session]);

    // Table Columns
    const columns = useMemo<GridColDef[]>(() => [
        ...(visibleColumns.id ? [{ field: "id", headerName: "ID", width: 70, sortable: true }] : []),
        ...(visibleColumns.card_name ? [{
            field: "card_name",
            headerName: "Card",
            width: 250,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Listing>) => (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {params.row.card.small_image_url && (
                        <Image
                            src={params.row.card.small_image_url}
                            alt={params.row.card.name}
                            width={30}
                            height={42}
                            style={{ marginRight: 8, borderRadius: 4 }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    <Box>
                        <Typography variant="body2" fontWeight="bold">{params.row.card.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {params.row.card.set_name} • {params.row.card.set_number}
                        </Typography>
                    </Box>
                </Box>
            )
        }] : []),
        ...(visibleColumns.condition ? [{ field: "condition", headerName: "Condition", width: 80, sortable: true }] : []),
        ...(visibleColumns.sale_type ? [{
            field: "sale_type",
            headerName: "Type",
            width: 100,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Listing>) => (
                <Chip
                    icon={params.row.sale_type === 'AUCTION' ? <GavelIcon /> : <AttachMoneyIcon />}
                    label={params.row.sale_type}
                    color={params.row.sale_type === 'AUCTION' ? 'secondary' : 'primary'}
                    size="small"
                />
            )
        }] : []),
        ...(visibleColumns.price ? [{
            field: "price",
            headerName: "Price",
            width: 120,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Listing>) => (
                <Box>
                    {params.row.sale_type === 'FIXED' ? (
                        <Typography variant="mono" fontWeight="bold" color="success.main">
                            {formatPrice(params.row.fixed_price)}
                        </Typography>
                    ) : (
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Reserve: {formatPrice(params.row.reserve_price)}
                            </Typography>
                            {params.row.current_highest_bid && (
                                <Typography variant="mono" fontWeight="bold" color="success.main">
                                    Current: {formatPrice(params.row.current_highest_bid)}
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            )
        }] : []),
        ...(visibleColumns.status ? [{
            field: "status",
            headerName: "Status",
            width: 120,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Listing>) => (
                <Chip
                    label={getStatusText(params.row)}
                    color={getStatusColor(params.row)}
                    size="small"
                />
            )
        }] : []),
        ...(visibleColumns.bids ? [{
            field: "bids",
            headerName: "Bids",
            width: 100,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Listing>) => (
                <Box>
                    <Typography variant="mono" color="text.primary">{params.row.bid_count}</Typography>
                    {params.row.sale_type === 'AUCTION' && params.row.time_left_ms && (
                        <Typography variant="caption" color="text.secondary">
                            {formatTimeLeft(params.row.auction_end)}
                        </Typography>
                    )}
                </Box>
            )
        }] : []),
        ...(visibleColumns.created_at ? [{
            field: "created_at",
            headerName: "Created",
            width: 120,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Listing>) => (
                <Typography variant="mono" color="text.secondary">
                    {new Date(params.row.created_at).toLocaleDateString()}
                </Typography>
            )
        }] : []),
        {
            field: "actions",
            headerName: "Actions",
            width: 150,
            sortable: false,
            renderCell: (params: GridRenderCellParams<Listing>) => (
                <Box>
                    <IconButton
                        size="small"
                        onClick={() => handleEditListing(params.row)}
                        disabled={rowLoading[Number(params.id)] || actionLoading}
                        sx={{ mr: 1 }}
                        aria-label="Edit listing"
                    >
                        <EditIcon />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => {
                            setViewListing(params.row);
                            setViewOpen(true);
                        }}
                        disabled={rowLoading[Number(params.id)] || actionLoading}
                        sx={{ mr: 1 }}
                        aria-label="View listing details"
                    >
                        <VisibilityIcon />
                    </IconButton>
                    <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteListing(params.id as number)}
                        disabled={rowLoading[Number(params.id)] || actionLoading}
                        aria-label="Delete listing"
                    >
                        {rowLoading[Number(params.id)] ? <CircularProgress size={20} /> : <DeleteIcon />}
                    </IconButton>
                </Box>
            ),
        },
    ], [visibleColumns, getStatusText, getStatusColor, rowLoading, actionLoading, handleEditListing, handleDeleteListing]);

    const handleCreateListing = useCallback(() => {
        setNewListing({
            card_id: '',
            condition: 'NM',
            sale_type: 'FIXED',
            fixed_price: '',
            reserve_price: '',
            auction_duration_hours: '168',
            notes: '',
            quantity: 1
        });
        setValidationErrors({});
        setCreateListingOpen(true);
        setTimeout(() => createDialogRef.current?.focus(), 0);
    }, []);

    const handleSaveListing = useCallback(async () => {
        if (!session) return;

        // Validation
        const errors: { [key: string]: string } = {};
        if (!newListing.card_id) errors.card_id = "Card is required";
        if (!newListing.condition) errors.condition = "Condition is required";
        if (newListing.sale_type === 'FIXED' && (!newListing.fixed_price || parseFloat(newListing.fixed_price) <= 0)) {
            errors.fixed_price = "Fixed price is required and must be greater than 0";
        }
        if (newListing.sale_type === 'AUCTION' && !newListing.auction_duration_hours) {
            errors.auction_duration_hours = "Auction duration is required";
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            toast.error("Please fix the errors before saving");
            return;
        }

        setActionLoading(true);
        try {
            const response = await fetch('/api/admin/listings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newListing),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Unauthorized access. Please log in again.");
                } else if (response.status === 500) {
                    throw new Error("Server error. Please try again later.");
                }
                throw new Error('Failed to create listing');
            }

            const result = await response.json();
            setListings((prev) => [...result.listings, ...prev]);
            setCreateListingOpen(false);
            setValidationErrors({});
            toast.success(result.message);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error creating listing';
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
        }
    }, [session, newListing]);

    const handleUpdateListing = useCallback(async () => {
        if (!session || !editData) return;

        if (editData.sale_type === 'FIXED' && (!editData.fixed_price || parseFloat(editData.fixed_price) <= 0)) {
            toast.error("Fixed price is required and must be greater than 0");
            return;
        }

        setActionLoading(true);
        try {
            const body: Record<string, unknown> = {
                is_for_sale: editData.is_for_sale,
                sale_type: editData.sale_type,
                notes: editData.notes,
            };
            if (editData.sale_type === 'FIXED') {
                body.fixed_price = parseFloat(editData.fixed_price) || 0;
            } else {
                body.reserve_price = editData.reserve_price ? parseFloat(editData.reserve_price) : null;
                body.auction_duration_hours = parseInt(editData.auction_duration_hours) || 168;
            }

            const response = await fetch(`/api/admin/listings/${editData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to update listing');
            }

            setEditListingOpen(false);
            setEditData(null);
            toast.success('Listing updated successfully!');
            await fetchListings(); // Re-sync canonical state (e.g. new auction end).
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Error updating listing');
        } finally {
            setActionLoading(false);
        }
    }, [session, editData, fetchListings]);

    const handleBulkDelete = useCallback(async () => {
        if (!session || selected.length === 0) return;
        if (!confirm(`Delete ${selected.length} selected listing(s)? This cannot be undone.`)) return;

        setActionLoading(true);
        const ids = [...selected];
        try {
            const results = await Promise.allSettled(
                ids.map((id) =>
                    fetch(`/api/admin/listings/${id}`, { method: 'DELETE' }).then((r) => {
                        if (!r.ok) throw new Error(String(id));
                        return id;
                    })
                )
            );
            const deleted = results
                .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
                .map((r) => r.value);
            const failed = ids.length - deleted.length;

            if (deleted.length > 0) {
                setListings((prev) => prev.filter((l) => !deleted.includes(l.id)));
                setSelected((prev) => prev.filter((id) => !deleted.includes(id)));
                toast.success(`Deleted ${deleted.length} listing(s)`);
            }
            if (failed > 0) {
                toast.error(`${failed} listing(s) could not be deleted`);
            }
        } finally {
            setActionLoading(false);
        }
    }, [session, selected]);

    return (
        <AppShell variant="admin">
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

            <GoogleAnalytics trackPageViews debugMode={true} />

            <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
                <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 4,
                            bgcolor: "background.paper",
                            borderRadius: 2,
                            border: 1,
                            borderColor: "divider",
                            overflow: "visible",
                        }}
                    >
                        <PageHeader
                            title="Listings"
                            icon={<GavelIcon />}
                            actions={
                                <>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleCreateListing}
                                        disabled={actionLoading}
                                        startIcon={<AddIcon />}
                                    >
                                        Create Listing
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={fetchListings}
                                        disabled={loading || actionLoading}
                                    >
                                        Refresh
                                    </Button>
                                </>
                            }
                        />

                        {/* Listing Stats Dashboard */}
                        <motion.div variants={itemVariants}>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <StatCard label="Total Listings" value={stats.total} accent />
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <StatCard label="Active" value={stats.active} />
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <StatCard label="Sold" value={stats.sold} />
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <StatCard label="Total Bids" value={stats.totalBids} />
                                </Grid>
                            </Grid>
                        </motion.div>

                        <motion.div variants={containerVariants} initial="hidden" animate="visible">
                            {/* Column Visibility Toggle */}
                            <motion.div variants={itemVariants}>
                                <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
                                    {Object.keys(visibleColumns).map((col) => (
                                        <FormControlLabel
                                            key={col}
                                            control={
                                                <Checkbox
                                                    checked={visibleColumns[col as keyof typeof visibleColumns]}
                                                    onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [col]: e.target.checked }))}
                                                    sx={{ color: "text.secondary" }}
                                                />
                                            }
                                            label={col.charAt(0).toUpperCase() + col.slice(1).replace('_', ' ')}
                                            sx={{ color: "text.secondary" }}
                                        />
                                    ))}
                                </Box>
                            </motion.div>

                            {/* Filters */}
                            <motion.div variants={itemVariants}>
                                <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, mb: 2, alignItems: "center" }}>
                                    <TextField
                                        label="Search Listings"
                                        variant="outlined"
                                        value={searchQuery}
                                        onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                                        sx={{ flex: 1, minWidth: { xs: "100%", md: 200 } }}
                                        InputLabelProps={{ style: { color: "text.secondary" } }}
                                        inputProps={{ style: { color: "text.primary" } }}
                                    />
                                    <FormControl sx={{ minWidth: { xs: "100%", md: 120 } }}>
                                        <InputLabel sx={{ color: "text.secondary" }}>Sale Type</InputLabel>
                                        <Select
                                            value={saleTypeFilter}
                                            onChange={(e) => setSaleTypeFilter(e.target.value)}
                                            label="Sale Type"
                                            sx={{ color: "text.primary" }}
                                        >
                                            <MenuItem value="">All Types</MenuItem>
                                            <MenuItem value="FIXED">Fixed Price</MenuItem>
                                            <MenuItem value="AUCTION">Auction</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl sx={{ minWidth: { xs: "100%", md: 120 } }}>
                                        <InputLabel sx={{ color: "text.secondary" }}>Status</InputLabel>
                                        <Select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            label="Status"
                                            sx={{ color: "text.primary" }}
                                        >
                                            <MenuItem value="">All Status</MenuItem>
                                            <MenuItem value="active">Active</MenuItem>
                                            <MenuItem value="sold">Sold</MenuItem>
                                            <MenuItem value="inactive">Inactive</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSaleTypeFilter("");
                                            setStatusFilter("");
                                        }}
                                    >
                                        Reset
                                    </Button>
                                </Box>
                            </motion.div>

                            {/* Bulk Actions Toolbar */}
                            {selected.length > 0 && (
                                <motion.div variants={itemVariants}>
                                    <Toolbar
                                        sx={{
                                            bgcolor: "background.paper",
                                            mb: 2,
                                            border: 1,
                                            borderColor: "divider",
                                            borderRadius: 1,
                                        }}
                                    >
                                        <Typography sx={{ flex: "1 1 100%", color: "text.primary" }}>
                                            <Typography component="span" variant="mono" sx={{ color: "primary.main" }}>{selected.length}</Typography> selected
                                        </Typography>
                                        <Tooltip title="Delete selected">
                                            <span>
                                                <IconButton
                                                    color="error"
                                                    onClick={handleBulkDelete}
                                                    disabled={actionLoading}
                                                    aria-label="Delete selected listings"
                                                >
                                                    {actionLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Toolbar>
                                </motion.div>
                            )}

                            {/* Fetch error surface */}
                            {error && (
                                <motion.div variants={itemVariants}>
                                    <Box sx={{ mb: 2 }}>
                                        <ErrorState
                                            variant="inline"
                                            message={error}
                                            onRetry={fetchListings}
                                        />
                                    </Box>
                                </motion.div>
                            )}

                            {/* Listings DataGrid */}
                            <motion.div variants={itemVariants}>
                                <Box sx={{ height: 600, width: "100%" }}>
                                    <DataGrid
                                        rows={listings}
                                        columns={columns}
                                        paginationModel={paginationModel}
                                        onPaginationModelChange={(newModel) => {
                                            setPaginationModel(newModel);
                                            setSelected([]);
                                        }}
                                        pageSizeOptions={[5, 10, 25, 50]}
                                        checkboxSelection
                                        onRowSelectionModelChange={(newSelection) => {
                                            const selectedIds = newSelection.map((id) => Number(id));
                                            setSelected(selectedIds);
                                        }}
                                        disableRowSelectionOnClick
                                        sx={{
                                            color: "text.secondary",
                                            border: 1,
                                            borderColor: "divider",
                                            "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper", color: "text.primary" },
                                            "& .MuiDataGrid-virtualScroller": { bgcolor: "background.default" },
                                            "& .MuiDataGrid-footerContainer": { bgcolor: "background.paper", borderColor: "divider" },
                                            "& .MuiDataGrid-row": { "&:hover": { bgcolor: "action.hover" } },
                                            "& .MuiDataGrid-cell": { borderColor: "divider" },
                                        }}
                                    />
                                </Box>
                            </motion.div>

                            {listings.length === 0 && !error && (
                                <EmptyState
                                    icon={<GavelIcon />}
                                    title="No listings found"
                                    description="Create your first marketplace listing to get started."
                                />
                            )}
                        </motion.div>
                    </Paper>
                </motion.div>
            </Container>

            {/* Create Listing Dialog */}
            <Dialog
                open={createListingOpen}
                onClose={() => setCreateListingOpen(false)}
                maxWidth="md"
                fullWidth
                ref={createDialogRef}
            >
                <DialogTitle>Create Marketplace Listing</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12 }}>
                            <Autocomplete
                                options={allCards}
                                getOptionLabel={(option) => `${option.name} - ${option.set_name} (${option.set_number})`}
                                value={allCards.find(card => card.id.toString() === newListing.card_id) || null}
                                onChange={(event, newValue) => {
                                    setNewListing({ ...newListing, card_id: newValue ? newValue.id.toString() : '' });
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Select Card"
                                        error={!!validationErrors.card_id}
                                        helperText={validationErrors.card_id}
                                    />
                                )}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center' }}>
                                        {option.small_image_url && (
                                            <Image
                                                src={option.small_image_url}
                                                alt={option.name}
                                                width={30}
                                                height={42}
                                                style={{ marginRight: 8, borderRadius: 4 }}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        )}
                                        <Box>
                                            <Typography variant="body2">{option.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {option.set_name} • {option.set_number} • {option.rarity}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl fullWidth error={!!validationErrors.condition}>
                                <InputLabel>Condition</InputLabel>
                                <Select
                                    value={newListing.condition}
                                    onChange={(e) => setNewListing({ ...newListing, condition: e.target.value })}
                                    label="Condition"
                                >
                                    <MenuItem value="NM">Near Mint</MenuItem>
                                    <MenuItem value="LP">Lightly Played</MenuItem>
                                    <MenuItem value="MP">Moderately Played</MenuItem>
                                    <MenuItem value="HP">Heavily Played</MenuItem>
                                    <MenuItem value="DMG">Damaged</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl fullWidth>
                                <InputLabel>Sale Type</InputLabel>
                                <Select
                                    value={newListing.sale_type}
                                    onChange={(e) => setNewListing({ ...newListing, sale_type: e.target.value as 'FIXED' | 'AUCTION' })}
                                    label="Sale Type"
                                >
                                    <MenuItem value="FIXED">Fixed Price</MenuItem>
                                    <MenuItem value="AUCTION">Auction</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {newListing.sale_type === 'FIXED' && (
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    label="Fixed Price ($)"
                                    type="number"
                                    fullWidth
                                    value={newListing.fixed_price}
                                    onChange={(e) => setNewListing({ ...newListing, fixed_price: e.target.value })}
                                    error={!!validationErrors.fixed_price}
                                    helperText={validationErrors.fixed_price}
                                />
                            </Grid>
                        )}

                        {newListing.sale_type === 'AUCTION' && (
                            <>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Reserve Price ($)"
                                        type="number"
                                        fullWidth
                                        value={newListing.reserve_price}
                                        onChange={(e) => setNewListing({ ...newListing, reserve_price: e.target.value })}
                                        helperText="Optional minimum price"
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <FormControl fullWidth error={!!validationErrors.auction_duration_hours}>
                                        <InputLabel>Auction Duration</InputLabel>
                                        <Select
                                            value={newListing.auction_duration_hours}
                                            onChange={(e) => setNewListing({ ...newListing, auction_duration_hours: e.target.value })}
                                            label="Auction Duration"
                                        >
                                            <MenuItem value="24">1 Day</MenuItem>
                                            <MenuItem value="72">3 Days</MenuItem>
                                            <MenuItem value="168">7 Days</MenuItem>
                                            <MenuItem value="336">14 Days</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </>
                        )}

                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label="Quantity"
                                type="number"
                                fullWidth
                                value={newListing.quantity}
                                onChange={(e) => setNewListing({ ...newListing, quantity: parseInt(e.target.value) || 1 })}
                                inputProps={{ min: 1, max: 10 }}
                                helperText="Create multiple identical listings"
                            />
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label="Notes"
                                fullWidth
                                multiline
                                rows={3}
                                value={newListing.notes}
                                onChange={(e) => setNewListing({ ...newListing, notes: e.target.value })}
                                placeholder="Add any additional information about this listing..."
                            />
                        </Grid>

                        {/* Preview selected card */}
                        {newListing.card_id && (
                            <Grid size={{ xs: 12 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                    {(() => {
                                        const selectedCard = allCards.find(card => card.id.toString() === newListing.card_id);
                                        return selectedCard && selectedCard.image_url ? (
                                            <Image
                                                src={selectedCard.image_url}
                                                alt="Card preview"
                                                width={200}
                                                height={280}
                                                style={{ objectFit: 'contain' }}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : null;
                                    })()}
                                </Box>
                            </Grid>
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateListingOpen(false)} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveListing}
                        disabled={actionLoading}
                    >
                        {actionLoading ? <CircularProgress size={24} /> : `Create ${newListing.quantity > 1 ? `${newListing.quantity} Listings` : 'Listing'}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Listing Dialog */}
            <Dialog
                open={editListingOpen}
                onClose={() => setEditListingOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Edit Listing{editData ? ` — ${editData.cardName}` : ''}</DialogTitle>
                <DialogContent>
                    {editData && (
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid size={{ xs: 12 }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={editData.is_for_sale}
                                            onChange={(e) => setEditData({ ...editData, is_for_sale: e.target.checked })}
                                        />
                                    }
                                    label={editData.is_for_sale ? "Active (listed for sale)" : "Inactive (hidden)"}
                                />
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Sale Type</InputLabel>
                                    <Select
                                        value={editData.sale_type}
                                        label="Sale Type"
                                        onChange={(e) => setEditData({ ...editData, sale_type: e.target.value as 'FIXED' | 'AUCTION' })}
                                    >
                                        <MenuItem value="FIXED">Fixed Price</MenuItem>
                                        <MenuItem value="AUCTION">Auction</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            {editData.sale_type === 'FIXED' ? (
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Fixed Price ($)"
                                        type="number"
                                        fullWidth
                                        value={editData.fixed_price}
                                        onChange={(e) => setEditData({ ...editData, fixed_price: e.target.value })}
                                        inputProps={{ min: 0, step: 0.01 }}
                                    />
                                </Grid>
                            ) : (
                                <>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            label="Reserve Price ($)"
                                            type="number"
                                            fullWidth
                                            value={editData.reserve_price}
                                            onChange={(e) => setEditData({ ...editData, reserve_price: e.target.value })}
                                            helperText="Optional minimum price"
                                            inputProps={{ min: 0, step: 0.01 }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <FormControl fullWidth>
                                            <InputLabel>Auction Duration</InputLabel>
                                            <Select
                                                value={editData.auction_duration_hours}
                                                label="Auction Duration"
                                                onChange={(e) => setEditData({ ...editData, auction_duration_hours: e.target.value })}
                                            >
                                                <MenuItem value="24">1 Day</MenuItem>
                                                <MenuItem value="72">3 Days</MenuItem>
                                                <MenuItem value="168">7 Days</MenuItem>
                                                <MenuItem value="336">14 Days</MenuItem>
                                            </Select>
                                            <FormLabel sx={{ mt: 0.5, fontSize: 12 }}>Resets the auction end time</FormLabel>
                                        </FormControl>
                                    </Grid>
                                </>
                            )}

                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Notes"
                                    fullWidth
                                    multiline
                                    rows={3}
                                    value={editData.notes}
                                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                                />
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditListingOpen(false)} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleUpdateListing}
                        disabled={actionLoading}
                    >
                        {actionLoading ? <CircularProgress size={24} /> : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* View Listing Details Dialog */}
            <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Listing Details{viewListing ? ` — ${viewListing.card.name}` : ''}</DialogTitle>
                <DialogContent dividers>
                    {viewListing && (
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                {(viewListing.card.small_image_url || viewListing.card.image_url) && (
                                    <Image
                                        src={viewListing.card.small_image_url || viewListing.card.image_url || ''}
                                        alt={viewListing.card.name}
                                        width={180}
                                        height={252}
                                        style={{ width: '100%', height: 'auto', borderRadius: 8 }}
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                )}
                            </Grid>
                            <Grid size={{ xs: 12, sm: 8 }}>
                                <Typography variant="h6">{viewListing.card.name}</Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    {viewListing.card.set_name} • {viewListing.card.set_number} • {viewListing.card.rarity}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
                                    <Chip size="small" label={getStatusText(viewListing)} color={getStatusColor(viewListing)} />
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        icon={viewListing.sale_type === 'AUCTION' ? <GavelIcon /> : <AttachMoneyIcon />}
                                        label={viewListing.sale_type}
                                        color={viewListing.sale_type === 'AUCTION' ? 'secondary' : 'primary'}
                                    />
                                    <Chip size="small" variant="outlined" label={`Condition: ${viewListing.condition}`} />
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <DetailRow label="Owner" value={`${viewListing.owner.name} (${viewListing.owner.role})`} />
                                {viewListing.sale_type === 'FIXED' ? (
                                    <DetailRow label="Price" value={formatPrice(viewListing.fixed_price)} />
                                ) : (
                                    <>
                                        <DetailRow label="Reserve" value={formatPrice(viewListing.reserve_price)} />
                                        <DetailRow label="Highest Bid" value={viewListing.current_highest_bid != null ? formatPrice(viewListing.current_highest_bid) : '—'} />
                                        <DetailRow label="Bids" value={String(viewListing.bid_count)} />
                                        <DetailRow label="Time Left" value={viewListing.is_auction_active ? formatDuration(viewListing.time_left_ms) : 'Ended'} />
                                        <DetailRow label="Auction End" value={viewListing.auction_end ? formatDateTime(viewListing.auction_end) : '—'} />
                                    </>
                                )}
                                <DetailRow label="Created" value={formatDateTime(viewListing.created_at)} />
                                {viewListing.notes && <DetailRow label="Notes" value={viewListing.notes} />}
                            </Grid>
                            {viewListing.sale_type === 'AUCTION' && viewListing.bids.length > 0 && (
                                <Grid size={{ xs: 12 }}>
                                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>Bids</Typography>
                                    {[...viewListing.bids].sort((a, b) => b.amount - a.amount).map((bid) => (
                                        <Box key={bid.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                                            <Typography variant="body2">{bid.bidder.name}</Typography>
                                            <Typography variant="mono" sx={{ fontWeight: 700 }}>{formatPrice(bid.amount)}</Typography>
                                        </Box>
                                    ))}
                                </Grid>
                            )}
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" onClick={() => { setViewOpen(false); if (viewListing) handleEditListing(viewListing); }}>
                        Edit
                    </Button>
                    <Button onClick={() => setViewOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
        </AppShell>
    );
}