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
    FormControl
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import UploadIcon from "@mui/icons-material/Upload";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics } from "nextjs-google-analytics";
import sanitizeHtml from "sanitize-html";
import { debounce } from "lodash";
import Sidebar from "../../components/Sidebar";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

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
    });
    const editDialogRef = useRef<HTMLDivElement>(null);
    const hasFetchedRef = useRef(false);

    // Role-Based Access Control (RBAC)
    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "admin") {
            router.push("/unauthorized");
        }
    }, [status, session, router]);

    // Fetch cards
    const fetchCards = useCallback(async () => {
        if (!session) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (setFilter) params.append('set', setFilter);
            if (typeFilter) params.append('type', typeFilter);

            const response = await fetch(`/api/admin/cards?${params.toString()}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.accessToken}`,
                },
            });

            if (!response.ok) throw new Error("Failed to fetch cards");

            const data: CardsResponse = await response.json();
            setCards(data.cards || []);
            toast.success("Cards loaded successfully!", { autoClose: 2000 });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to load cards.";
            setError(errorMessage);
            toast.error(errorMessage);
            setCards([]);
        } finally {
            setLoading(false);
        }
    }, [session, searchQuery, setFilter, typeFilter]);

    // Initial fetch
    useEffect(() => {
        if (status === "authenticated" && !hasFetchedRef.current) {
            fetchCards();
            hasFetchedRef.current = true;
        }
    }, [status, fetchCards]);

    // Card Stats
    const stats = useMemo(() => ({
        total: cards.length,
        totalOwned: cards.reduce((sum, card) => sum + card.totalOwned, 0),
        forSale: cards.reduce((sum, card) => sum + card.forSaleCount, 0),
        uniqueSets: new Set(cards.map(card => card.set_name)).size,
    }), [cards]);

    // Debounced Search
    const debouncedSetSearchQuery = debounce((value: string) => setSearchQuery(value), 300);

    const filteredCards = useMemo(() => {
        let result = [...cards];
        if (rarityFilter) result = result.filter(card => card.rarity === rarityFilter);
        return result.filter(Boolean);
    }, [cards, rarityFilter]);

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

    // Table Columns
    const columns: GridColDef[] = [
        ...(visibleColumns.id ? [{ field: "id", headerName: "ID", width: 70, sortable: true }] : []),
        ...(visibleColumns.name ? [{
            field: "name",
            headerName: "Name",
            width: 200,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {params.row.small_image_url && (
                        <Image
                            src={params.row.small_image_url}
                            alt={params.row.name}
                            width={30}
                            height={42}
                            style={{ marginRight: 8, borderRadius: 4 }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    <Typography variant="body2">{params.row.name}</Typography>
                </Box>
            )
        }] : []),
        ...(visibleColumns.set_name ? [{ field: "set_name", headerName: "Set", width: 150, sortable: true }] : []),
        ...(visibleColumns.set_number ? [{ field: "set_number", headerName: "Number", width: 100, sortable: true }] : []),
        ...(visibleColumns.rarity ? [{
            field: "rarity",
            headerName: "Rarity",
            width: 120,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Chip
                    label={params.row.rarity}
                    color={getRarityColor(params.row.rarity)}
                    size="small"
                />
            )
        }] : []),
        ...(visibleColumns.card_type ? [{ field: "card_type", headerName: "Type", width: 100, sortable: true }] : []),
        ...(visibleColumns.totalOwned ? [{ field: "totalOwned", headerName: "Owned", width: 80, sortable: true }] : []),
        ...(visibleColumns.forSaleCount ? [{ field: "forSaleCount", headerName: "For Sale", width: 80, sortable: true }] : []),
        ...(visibleColumns.created_at ? [{
            field: "created_at",
            headerName: "Created",
            width: 150,
            sortable: true,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Typography variant="body2">
                    {new Date(params.row.created_at).toLocaleDateString()}
                </Typography>
            )
        }] : []),
        {
            field: "actions",
            headerName: "Actions",
            width: 150,
            sortable: false,
            renderCell: (params: GridRenderCellParams<Card>) => (
                <Box>
                    <IconButton
                        size="small"
                        onClick={() => handleEditCard(params.row)}
                        disabled={rowLoading[Number(params.id)] || actionLoading}
                        sx={{ mr: 1 }}
                    >
                        <EditIcon />
                    </IconButton>
                    <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteCard(params.id as number)}
                        disabled={rowLoading[Number(params.id)] || actionLoading}
                    >
                        {rowLoading[Number(params.id)] ? <CircularProgress size={20} /> : <DeleteIcon />}
                    </IconButton>
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
            // Parse CSV-like format: name,set_name,set_number,rarity,card_type,image_url
            const lines = bulkCardsText.trim().split('\n');
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

            setCards((prev) => [...result.created, ...prev]);
            setBulkCreateOpen(false);
            setBulkCardsText('');

            toast.success(`Created ${result.created.length} cards! Skipped ${result.skipped.length}, Errors: ${result.errors.length}`);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error bulk creating cards';
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
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
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", my: 3 }}>
                <IconButton onClick={toggleSidebar}>
                    <MenuIcon />
                </IconButton>
            </Box>

            <GoogleAnalytics trackPageViews debugMode={true} />

            <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
                <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <Paper
                        elevation={6}
                        sx={{
                            p: 4,
                            bgcolor: "grey.900",
                            backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                            borderRadius: 2,
                            boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)",
                            overflow: "visible",
                        }}
                    >
                        <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                                <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market Logo" width={200} height={100} />
                            </motion.div>
                        </Box>
                        <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
                            Admin - Card Management
                        </Typography>

                        {/* Card Stats Dashboard */}
                        <motion.div variants={itemVariants}>
                            <Box sx={{ mb: 2, display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 2 }}>
                                <Typography sx={{ color: "text.secondary" }}>Total Cards: {stats.total}</Typography>
                                <Typography sx={{ color: "text.secondary" }}>Total Owned: {stats.totalOwned}</Typography>
                                <Typography sx={{ color: "text.secondary" }}>For Sale: {stats.forSale}</Typography>
                                <Typography sx={{ color: "text.secondary" }}>Sets: {stats.uniqueSets}</Typography>
                            </Box>
                        </motion.div>

                        <motion.div variants={containerVariants} initial="hidden" animate="visible">
                            <motion.div variants={itemVariants}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
                                    <Button
                                        variant="contained"
                                        sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
                                        onClick={handleAddCard}
                                        disabled={actionLoading}
                                        startIcon={<AddIcon />}
                                    >
                                        Add Card
                                    </Button>
                                    <Button
                                        variant="contained"
                                        sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
                                        onClick={() => setBulkCreateOpen(true)}
                                        disabled={actionLoading}
                                        startIcon={<UploadIcon />}
                                    >
                                        Bulk Create
                                    </Button>
                                    <Button
                                        variant="contained"
                                        sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
                                        onClick={fetchCards}
                                        disabled={loading || actionLoading}
                                    >
                                        Refresh
                                    </Button>
                                </Box>
                            </motion.div>

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
                                        label="Search Cards"
                                        variant="outlined"
                                        value={searchQuery}
                                        onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                                        sx={{ flex: 1, minWidth: { xs: "100%", md: 200 } }}
                                        InputLabelProps={{ style: { color: "text.secondary" } }}
                                        inputProps={{ style: { color: "text.primary" } }}
                                    />
                                    <FormControl sx={{ minWidth: { xs: "100%", md: 120 } }}>
                                        <InputLabel sx={{ color: "text.secondary" }}>Set</InputLabel>
                                        <Select
                                            value={setFilter}
                                            onChange={(e) => setSetFilter(e.target.value)}
                                            label="Set"
                                            sx={{ color: "text.primary" }}
                                        >
                                            <MenuItem value="">All Sets</MenuItem>
                                            {Array.from(new Set(cards.map(card => card.set_name))).map(set => (
                                                <MenuItem key={set} value={set}>{set}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <FormControl sx={{ minWidth: { xs: "100%", md: 120 } }}>
                                        <InputLabel sx={{ color: "text.secondary" }}>Type</InputLabel>
                                        <Select
                                            value={typeFilter}
                                            onChange={(e) => setTypeFilter(e.target.value)}
                                            label="Type"
                                            sx={{ color: "text.primary" }}
                                        >
                                            <MenuItem value="">All Types</MenuItem>
                                            <MenuItem value="Pokemon">Pokemon</MenuItem>
                                            <MenuItem value="Trainer">Trainer</MenuItem>
                                            <MenuItem value="Energy">Energy</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl sx={{ minWidth: { xs: "100%", md: 120 } }}>
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
                                            bgcolor: "grey.800",
                                            mb: 2,
                                            borderBottom: "2px solid #96ff9b",
                                        }}
                                    >
                                        <Typography sx={{ flex: "1 1 100%", color: "text.primary" }}>
                                            {selected.length} selected
                                        </Typography>
                                        <IconButton
                                            color="error"
                                            onClick={() => {
                                                // Bulk delete logic here
                                                toast.info("Bulk delete functionality to be implemented");
                                            }}
                                            disabled={actionLoading}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Toolbar>
                                </motion.div>
                            )}

                            {/* Cards DataGrid */}
                            <motion.div variants={itemVariants}>
                                <Box sx={{ height: 600, width: "100%" }}>
                                    <DataGrid
                                        rows={filteredCards}
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
                                            "& .MuiDataGrid-columnHeaders": { bgcolor: "grey.800" },
                                            "& .MuiDataGrid-virtualScroller": { bgcolor: "grey.900" },
                                            "& .MuiDataGrid-footerContainer": { bgcolor: "grey.900" },
                                            "& .MuiDataGrid-row": { "&:hover": { bgcolor: "grey.800" } },
                                            "& .MuiDataGrid-cell": { borderColor: "grey.800" },
                                        }}
                                    />
                                </Box>
                            </motion.div>

                            {filteredCards.length === 0 && !error && (
                                <Typography variant="body1" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
                                    No cards found.
                                </Typography>
                            )}
                        </motion.div>
                    </Paper>
                </motion.div>
            </Container>

            {/* Add/Edit Card Dialog */}
            <Dialog
                open={!!editCard}
                onClose={() => setEditCard(null)}
                maxWidth="md"
                fullWidth
                ref={editDialogRef}
            >
                <DialogTitle>{editCard?.id === 0 ? "Add Card" : "Edit Card"}</DialogTitle>
                <DialogContent>
                    {editCard && (
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Name"
                                    fullWidth
                                    value={editCard.name}
                                    onChange={(e) => setEditCard({ ...editCard, name: e.target.value })}
                                    error={!!validationErrors.name}
                                    helperText={validationErrors.name}
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
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth error={!!validationErrors.rarity}>
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
                                <FormControl fullWidth error={!!validationErrors.card_type}>
                                    <InputLabel>Card Type</InputLabel>
                                    <Select
                                        value={editCard.card_type}
                                        onChange={(e) => setEditCard({ ...editCard, card_type: e.target.value })}
                                        label="Card Type"
                                    >
                                        <MenuItem value="Pokemon">Pokemon</MenuItem>
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
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="HP"
                                    type="number"
                                    fullWidth
                                    value={editCard.hp || ""}
                                    onChange={(e) => setEditCard({ ...editCard, hp: e.target.value ? parseInt(e.target.value) : undefined })}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="TCG ID"
                                    fullWidth
                                    value={editCard.tcg_id || ""}
                                    onChange={(e) => setEditCard({ ...editCard, tcg_id: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    label="Image URL"
                                    fullWidth
                                    value={editCard.image_url || ""}
                                    onChange={(e) => setEditCard({ ...editCard, image_url: e.target.value, small_image_url: e.target.value })}
                                />
                            </Grid>
                            {editCard.image_url && (
                                <Grid item xs={12}>
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                        <Image
                                            src={editCard.image_url}
                                            alt="Card preview"
                                            width={200}
                                            height={280}
                                            style={{ objectFit: 'contain' }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </Box>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditCard(null)} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
                        onClick={handleSaveCard}
                        disabled={actionLoading}
                    >
                        {actionLoading ? <CircularProgress size={24} /> : "Save"}
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
                <DialogTitle>Bulk Create Cards</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
                        Enter cards in CSV format: name,set_name,set_number,rarity,card_type,image_url
                        <br />
                        One card per line. Example:
                        <br />
                        Charizard,Base Set,4/102,Holo Rare,Pokemon,https://images.pokemontcg.io/base1/4.png
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={10}
                        value={bulkCardsText}
                        onChange={(e) => setBulkCardsText(e.target.value)}
                        placeholder="Pikachu,Base Set,58/102,Common,Pokemon,https://images.pokemontcg.io/base1/58.png"
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkCreateOpen(false)} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
                        onClick={handleBulkCreate}
                        disabled={actionLoading || !bulkCardsText.trim()}
                    >
                        {actionLoading ? <CircularProgress size={24} /> : "Create Cards"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}