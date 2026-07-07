"use client";

import { useState, useEffect } from "react";
import {
    Box,
    Typography,
    CircularProgress,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    Checkbox,
    Card,
    Chip,
    InputLabel,
    FormControl,
    CardContent,
    CardMedia,
    Alert,
    Pagination,
    Tabs,
    Tab
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import DownloadIcon from "@mui/icons-material/Download";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Sync } from '@mui/icons-material';
import { getRarityColor } from "../../lib/rarity";
import { pokemonPriceTrackerAPI } from "../../lib/pokemon-price-tracker-api";
import { ProgressDisplay, useProgressTracker, formatNumber } from "./admin-cards-client";

// Enhanced Pokemon Card Import Modal Component with Progress Tracking - FIXED FOR V2 API
export default function PokemonImportModal({ open, onClose, onImportComplete }: {
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

            // Load available sets from Pokemon Price Tracker API
            const setsResponse = await pokemonPriceTrackerAPI.getSets();
            if (setsResponse.success && setsResponse.data) {
                const setsArray = Array.isArray(setsResponse.data) ? setsResponse.data : [];

                setAvailableSets(setsArray.map((set: any) => ({
                    id: set.id, // This should be the correct Pokemon Price Tracker set ID
                    name: set.name,
                    total: set.cardCount || 0,
                    releaseDate: set.releaseDate || new Date().toISOString(),
                    // Add debug info
                    tcgPlayerId: set.tcgPlayerId, // Alternative ID if available
                    originalSet: set // Keep original for debugging
                })));
            } else {
                console.warn('Failed to load sets:', setsResponse.error);
                setAvailableSets([]);
            }

            // Common Pokemon values for filtering
            setAvailableTypes(['Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless']);
            setAvailableRarities(['Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Ultra', 'Rare Secret', 'Promo']);
        } catch (error) {
            console.error('Error loading filter options:', error);
            setError('Failed to load filter options');
            setAvailableSets([]);
            setAvailableTypes([]);
            setAvailableRarities([]);
        } finally {
            setLoading(false);
        }
    };

    // Fix for the searchCards function in your admin-cards-client.tsx
    const searchCards = async (page = 1) => {
        try {
            setLoading(true);
            setError('');

            startProgress(1, `Searching Pokemon cards...`);
            updateProgress(0, 'Initiating search request', 'searching');

            const searchParams: any = {
                limit: 50,
                page: page
            };

            // FIXED: Ensure at least one filter parameter is provided
            let hasFilter = false;

            if (searchTerm) {
                searchParams.name = searchTerm;
                hasFilter = true;
            }
            if (selectedSet) {
                const selectedSetObj = availableSets.find(set => set.name === selectedSet);
                if (selectedSetObj) {
                    searchParams.setId = selectedSetObj.id;
                    hasFilter = true;
                }
            }
            if (selectedType) {
                searchParams.cardType = selectedType;
                hasFilter = true;
            }
            if (selectedRarity) {
                searchParams.rarity = selectedRarity;
                hasFilter = true;
            }

            // FIXED: If no filters provided, default to popular cards search
            if (!hasFilter) {
                searchParams.name = 'Pikachu'; // Default search to prevent 400 error
                setSearchTerm('Pikachu'); // Update the UI to show what we're searching for
            }

            updateProgress(0.5, 'Fetching results from Pokemon Price Tracker API', 'searching');

            const searchResponse = await pokemonPriceTrackerAPI.searchCardPricing(searchParams);

            if (searchResponse.success && searchResponse.data) {
                const cardsArray = Array.isArray(searchResponse.data) ? searchResponse.data : [];

                const transformedCards = cardsArray.map((card: any) => ({
                    ...card // Use raw V2 API data
                }));

                updateProgress(1, `Found ${transformedCards.length} cards`, 'completed');
                setSearchResults(transformedCards);
                setPagination({
                    page: page,
                    totalPages: Math.ceil(transformedCards.length / 20) || 1
                });

                setTimeout(() => {
                    completeProgress({ completed: transformedCards.length, failed: 0, skipped: 0 });
                }, 500);
            } else {
                setError(searchResponse.error || 'Search failed');
                updateProgress(1, 'Search failed', 'error');
            }
        } catch (error) {
            console.error('Error searching cards:', error);
            setError('Failed to search cards');
            updateProgress(1, 'Search failed', 'error');
        } finally {
            setLoading(false);
            setTimeout(resetProgress, 3000);
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

            const cardsToImport = Array.from(selectedCards);
            startProgress(cardsToImport.length, 'Importing selected cards...');

            // FIXED: Get only selected cards, not all search results
            const selectedCardData = searchResults.filter(card => selectedCards.has(card.id));

            let processed = 0;
            const progressInterval = setInterval(() => {
                if (processed < cardsToImport.length) {
                    updateProgress(processed, `Processing card ${processed + 1} of ${cardsToImport.length}`, 'importing');
                    processed++;
                }
            }, 200);

            // FIXED: Send only selected cards, not all search results
            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardsData: selectedCardData, // Send only selected cards
                    source: 'pokemon_price_tracker'
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();

            if (data.success) {
                const completed = data.results?.imported || 0;
                const failed = data.results?.errors?.length || 0;
                const skipped = data.results?.updated || 0;

                updateStats(completed, failed, skipped);
                updateProgress(cardsToImport.length, 'Import completed successfully', 'completed');
                completeProgress({ completed, failed, skipped });

                onImportComplete?.({
                    imported: completed,
                    updated: skipped,
                    errors: failed,
                    results: data.results
                });

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

            const estimatedCards = selectedSetObj.total || 100;
            startProgress(estimatedCards, `Importing ${selectedSet} set...`);

            let allSetCards: any[] = [];
            let successMethod = '';

            // Strategy 1: Direct set ID lookup
            try {
                updateProgress(estimatedCards * 0.25, 'Fetching set data from Pokemon Price Tracker...', 'searching');

                const setCardsResponse = await pokemonPriceTrackerAPI.getSetPricing(selectedSetObj.id);

                if (setCardsResponse.success && setCardsResponse.data && Array.isArray(setCardsResponse.data) && setCardsResponse.data.length > 0) {
                    allSetCards = setCardsResponse.data;
                    successMethod = `Direct set ID lookup: ${selectedSetObj.id}`;
                }
            } catch (error) {
                console.error(`Direct set lookup failed:`, error);
            }

            // Strategy 2: Search by set name if direct lookup fails
            if (allSetCards.length === 0) {
                try {
                    updateProgress(estimatedCards * 0.5, 'Searching by set name...', 'searching');

                    const nameSearchResponse = await pokemonPriceTrackerAPI.searchCardPricing({
                        setName: selectedSet,
                        limit: 200
                    });

                    if (nameSearchResponse.success && nameSearchResponse.data && Array.isArray(nameSearchResponse.data) && nameSearchResponse.data.length > 0) {
                        allSetCards = nameSearchResponse.data;
                        successMethod = `Set name search: ${selectedSet}`;
                    }
                } catch (error) {
                    console.error(`Set name search error:`, error);
                }
            }

            // Strategy 3: Broad search with filtering if previous methods fail
            if (allSetCards.length === 0) {
                try {
                    updateProgress(estimatedCards * 0.75, 'Trying broad search approach...', 'searching');

                    // Try searching for common Pokemon names and filter by set
                    const broadSearchResponse = await pokemonPriceTrackerAPI.searchCardPricing({
                        name: 'Pikachu', // Search for a common card
                        limit: 100
                    });

                    if (broadSearchResponse.success && broadSearchResponse.data && Array.isArray(broadSearchResponse.data)) {
                        // Filter results to match our target set
                        const filteredCards = broadSearchResponse.data.filter((card: any) => {
                            if (!card.setName) return false;
                            const cardSetName = card.setName.toLowerCase();
                            const targetSetName = selectedSet.toLowerCase();
                            return cardSetName.includes(targetSetName) || targetSetName.includes(cardSetName);
                        });

                        if (filteredCards.length > 0) {
                            allSetCards = filteredCards;
                            successMethod = `Broad search with filtering: ${selectedSet}`;
                        }
                    }
                } catch (error) {
                    console.error(`Broad search error:`, error);
                }
            }

            updateProgress(estimatedCards, 'Processing import results...', 'importing');

            // If no cards found after all strategies
            if (allSetCards.length === 0) {
                const errorMessage = `No cards found for set "${selectedSet}".

Attempted methods:
1. Direct set ID lookup (${selectedSetObj.id})
2. Set name search ("${selectedSet}")
3. Broad search with filtering

This could mean:
• The set is not available in Pokemon Price Tracker's database
• The set ID format is incorrect
• The set name doesn't match exactly

Please try:
• Selecting a different set from the dropdown
• Checking if the set name is spelled correctly
• Verifying the set exists in Pokemon Price Tracker's database`;

                setError(errorMessage);
                updateProgress(estimatedCards, 'No cards found for import', 'error');
                console.error('All import strategies failed for set:', selectedSet);
                return;
            }

            // Progress animation
            let processed = 0;
            const progressInterval = setInterval(() => {
                if (processed < allSetCards.length - 1) {
                    processed += Math.floor(Math.random() * 3) + 1;
                    processed = Math.min(processed, allSetCards.length - 1);
                    updateProgress(processed, `Importing ${processed} of ${allSetCards.length} cards to MySQL...`, 'importing');
                }
            }, 100);

            // Send to your MySQL-compatible import API
            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardsData: allSetCards,
                    source: 'pokemon_price_tracker',
                    setImport: true,
                    databaseType: 'mysql',
                    importMethod: successMethod
                }),
            });

            clearInterval(progressInterval);

            const data = await response.json();

            if (data.success) {
                const completed = data.results?.imported || 0;
                const failed = data.results?.errors?.length || 0;
                const skipped = data.results?.updated || 0;

                updateStats(completed, failed, skipped);
                updateProgress(allSetCards.length, 'MySQL import completed', 'completed');
                completeProgress({ completed, failed, skipped });

                onImportComplete?.({
                    imported: completed,
                    updated: skipped,
                    errors: failed,
                    results: data.results
                });

                setTimeout(() => {
                    onClose();
                    resetProgress();
                }, 2000);
            } else {
                setError(data.error || 'MySQL import failed');
                updateProgress(estimatedCards, 'MySQL import failed', 'error');
            }
        } catch (error) {
            console.error('MySQL import error:', error);
            setError(`MySQL import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            updateProgress(selectedSetObj.total || 100, 'MySQL import failed', 'error');
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
                            <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                    fullWidth
                                    label="Search by Name"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && searchCards(1)}
                                    disabled={importing}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
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
                            <Grid size={{ xs: 12, md: 2 }}>
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
                            <Grid size={{ xs: 12, md: 2 }}>
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
                            <Grid size={{ xs: 12, md: 2 }}>
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
                                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={card.id}>
                                            <Card sx={{
                                                height: '100%',
                                                position: 'relative',
                                                transition: 'all 0.3s ease',
                                                border: '2px solid',
                                                borderColor: selectedCards.has(card.id) ? 'primary.main' : 'transparent',
                                                opacity: importing ? 0.6 : 1,
                                                '&:hover': {
                                                    transform: importing ? 'none' : 'translateY(-4px)',
                                                    borderColor: importing ? undefined : (selectedCards.has(card.id) ? 'primary.main' : 'divider')
                                                }
                                            }}>
                                                <Checkbox
                                                    checked={selectedCards.has(card.id)}
                                                    onChange={(e) => handleCardSelection(card.id, e.target.checked)}
                                                    disabled={importing}
                                                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'rgba(0,0,0,0.5)' }}
                                                />
                                                {/* FIXED: Use V2 API imageUrl field directly */}
                                                <CardMedia
                                                    component="img"
                                                    height="200"
                                                    image={card.imageUrl || '/placeholder-card.png'}
                                                    alt={card.name}
                                                    sx={{ objectFit: 'contain', p: 1 }}
                                                />
                                                <CardContent>
                                                    <Typography variant="h6" noWrap sx={{ fontWeight: 'bold' }}>
                                                        {card.name}
                                                    </Typography>
                                                    {/* FIXED: Use V2 API field names */}
                                                    <Typography variant="body2" color="text.secondary" noWrap>
                                                        {card.setName} • #{card.cardNumber}
                                                    </Typography>
                                                    <Chip
                                                        label={card.rarity}
                                                        size="small"
                                                        sx={{ mt: 1 }}
                                                        color={getRarityColor(card.rarity)}
                                                    />
                                                    {/* FIXED: Show market price from V2 API */}
                                                    {card.prices?.market && (
                                                        <Typography variant="mono" sx={{ mt: 1, fontWeight: 'bold', color: 'success.main' }}>
                                                            ${card.prices.market.toFixed(2)}
                                                        </Typography>
                                                    )}
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
                            <Grid size={{ xs: 12, md: 8 }}>
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
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={importEntireSet}
                                    disabled={importing || !selectedSet}
                                    color="primary"
                                    sx={{ height: '56px' }}
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
                        color="primary"
                        startIcon={importing ? <CircularProgress size={20} /> : <DownloadIcon />}
                    >
                        {importing ? 'Importing...' : `Import ${selectedCards.size} Card${selectedCards.size !== 1 ? 's' : ''}`}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
