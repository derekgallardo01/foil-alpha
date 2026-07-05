"use client";

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Card,
    CardMedia,
    CardContent,
    Chip,
    IconButton,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    CircularProgress,
    Grid
} from '@mui/material';
import {
    NewReleases,
    ChevronLeft,
    ChevronRight,
    CalendarToday,
    LocalOffer,
    ShoppingCart,
    Refresh
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface SetRelease {
    id: string;
    name: string;
    series: string | null;
    release_date: string;
    days_since_added: number | null;
    total_cards: number;
    card_count: number;
    avg_price: number | null;
    min_price: number | null;
    max_price: number | null;
    images: any;
    sample_cards: Array<{
        name: string;
        rarity: string;
        image_url: string | null;
    }>;
    is_new: boolean;
    is_featured: boolean;
}

interface NewReleasesCarouselProps {
    limit?: number;
}

export default function NewReleasesCarousel({ limit = 10 }: NewReleasesCarouselProps) {
    const router = useRouter();
    const [releases, setReleases] = useState<SetRelease[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [releaseType, setReleaseType] = useState<'recent' | 'upcoming' | 'popular'>('recent');
    const [currentIndex, setCurrentIndex] = useState(0);

    const fetchReleases = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log(`Fetching releases: type=${releaseType}, limit=${limit}`);

            const response = await fetch(`/api/dashboard/new-releases?type=${releaseType}&limit=${limit}`);
            const data = await response.json();

            console.log('New releases response:', data);

            if (data.success && data.data) {
                setReleases(data.data);
                setCurrentIndex(0);
                console.log(`Loaded ${data.data.length} releases`);
            } else {
                console.error('Failed to fetch releases:', data.error);
                setError(data.error || 'Failed to load releases');
                setReleases([]);
            }
        } catch (error) {
            console.error('Error fetching releases:', error);
            setError('Network error loading releases');
            setReleases([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReleases();
    }, [releaseType]);

    const handlePrevious = () => {
        setCurrentIndex((prev) => Math.max(0, prev - 3));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => Math.min(releases.length - 3, prev + 3));
    };

    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return `$${price.toFixed(2)}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getSetImage = (set: SetRelease) => {
        // Try to get image from sample cards first
        const cardWithImage = set.sample_cards?.find(card => card.image_url);
        if (cardWithImage?.image_url) {
            return cardWithImage.image_url;
        }

        // Fallback to placeholder
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120' viewBox='0 0 200 120'%3E%3Crect width='200' height='120' fill='%23333' rx='8'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' fill='%23666' font-size='14'%3E" + encodeURIComponent(set.name) + "%3C/text%3E%3C/svg%3E";
    };

    if (loading) {
        return (
            <Paper sx={{
                p: 3,
                bgcolor: 'grey.800',
                border: '1px solid rgba(155, 92, 255, 0.2)'
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: '#9B5Cff' }} />
                </Box>
            </Paper>
        );
    }

    return (
        <Paper sx={{
            p: 3,
            bgcolor: 'grey.800',
            border: '1px solid rgba(155, 92, 255, 0.2)'
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NewReleases sx={{ color: '#9B5Cff' }} />
                    New Releases & Pre-orders
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <ToggleButtonGroup
                        value={releaseType}
                        exclusive
                        onChange={(e, value) => value && setReleaseType(value)}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                color: 'text.secondary',
                                borderColor: 'rgba(155, 92, 255, 0.3)',
                                '&.Mui-selected': {
                                    color: '#000',
                                    bgcolor: '#9B5Cff',
                                    borderColor: '#9B5Cff'
                                },
                                '&:hover': {
                                    bgcolor: 'rgba(155, 92, 255, 0.1)'
                                }
                            }
                        }}
                    >
                        <ToggleButton value="recent">Recent</ToggleButton>
                        <ToggleButton value="upcoming">Upcoming</ToggleButton>
                        <ToggleButton value="popular">Popular</ToggleButton>
                    </ToggleButtonGroup>

                    <IconButton
                        size="small"
                        onClick={fetchReleases}
                        sx={{ color: '#9B5Cff' }}
                    >
                        <Refresh />
                    </IconButton>
                </Box>
            </Box>

            {error ? (
                <Typography color="error" align="center" sx={{ py: 2 }}>
                    {error}
                </Typography>
            ) : releases.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    No releases found for the selected category.
                </Typography>
            ) : (
                <Box sx={{ position: 'relative' }}>
                    <Grid container spacing={2}>
                        {releases.slice(currentIndex, currentIndex + 3).map((set) => (
                            <Grid item xs={12} md={4} key={set.id}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'all 0.2s ease',
                                        bgcolor: 'grey.900',
                                        border: '1px solid rgba(155, 92, 255, 0.1)',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 8px 24px rgba(155, 92, 255, 0.2)',
                                            border: '1px solid rgba(155, 92, 255, 0.3)'
                                        }
                                    }}
                                >
                                    <CardMedia
                                        component="img"
                                        height="200"
                                        image={getSetImage(set)}
                                        alt={set.name}
                                        sx={{
                                            objectFit: 'contain',
                                            bgcolor: 'grey.800',
                                            p: 2,
                                            borderRadius: '8px 8px 0 0'
                                        }}
                                        onError={(e: any) => {
                                            e.target.src = getSetImage(set);
                                        }}
                                    />
                                    <CardContent sx={{ flexGrow: 1, color: 'text.primary' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                            <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                                                {set.name}
                                            </Typography>
                                            {set.is_new && (
                                                <Chip
                                                    label="NEW"
                                                    size="small"
                                                    sx={{
                                                        bgcolor: '#9B5Cff',
                                                        color: '#000',
                                                        fontWeight: 600,
                                                        fontSize: '0.7rem'
                                                    }}
                                                />
                                            )}
                                        </Box>

                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            {set.series || 'Pokemon TCG'} • {set.total_cards} cards
                                        </Typography>

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                                            <CalendarToday fontSize="small" sx={{ color: '#9B5Cff' }} />
                                            <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                                {formatDate(set.release_date)}
                                            </Typography>
                                            {set.days_since_added !== null && set.days_since_added <= 30 && (
                                                <Chip
                                                    label={`${set.days_since_added}d ago`}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: 'rgba(155, 92, 255, 0.2)',
                                                        color: '#9B5Cff',
                                                        fontSize: '0.7rem'
                                                    }}
                                                />
                                            )}
                                        </Box>

                                        {set.card_count > 0 && (
                                            <Box sx={{ mt: 2 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {set.card_count} cards available
                                                </Typography>
                                                {set.min_price && set.max_price && (
                                                    <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                                        Price range: {formatPrice(set.min_price)} - {formatPrice(set.max_price)}
                                                    </Typography>
                                                )}
                                                {set.avg_price && (
                                                    <Typography variant="body2" sx={{ color: '#9B5Cff', fontWeight: 500 }}>
                                                        Avg: {formatPrice(set.avg_price)}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}

                                        {/* Show sample cards if available */}
                                        {set.sample_cards && set.sample_cards.length > 0 && (
                                            <Box sx={{ mt: 2 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                                    Featured Cards:
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                    {set.sample_cards.slice(0, 3).map((card, index) => (
                                                        <Chip
                                                            key={index}
                                                            label={card.name}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: 'rgba(155, 92, 255, 0.1)',
                                                                color: 'text.secondary',
                                                                fontSize: '0.7rem'
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<LocalOffer />}
                                                onClick={() => router.push(`/marketplace?set=${encodeURIComponent(set.name)}`)}
                                                sx={{
                                                    borderColor: '#9B5Cff',
                                                    color: '#9B5Cff',
                                                    flex: 1,
                                                    '&:hover': {
                                                        borderColor: '#9B5Cff',
                                                        bgcolor: 'rgba(155, 92, 255, 0.1)'
                                                    }
                                                }}
                                            >
                                                View Set
                                            </Button>
                                            {set.is_featured && (
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<ShoppingCart />}
                                                    sx={{
                                                        bgcolor: '#9B5Cff',
                                                        color: '#000',
                                                        flex: 1,
                                                        '&:hover': {
                                                            bgcolor: '#7ee683'
                                                        }
                                                    }}
                                                >
                                                    Shop
                                                </Button>
                                            )}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {releases.length > 3 && (
                        <>
                            <IconButton
                                sx={{
                                    position: 'absolute',
                                    left: -20,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    bgcolor: 'rgba(155, 92, 255, 0.1)',
                                    border: '1px solid rgba(155, 92, 255, 0.3)',
                                    color: '#9B5Cff',
                                    '&:hover': {
                                        bgcolor: 'rgba(155, 92, 255, 0.2)',
                                        border: '1px solid rgba(155, 92, 255, 0.5)'
                                    }
                                }}
                                onClick={handlePrevious}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft />
                            </IconButton>
                            <IconButton
                                sx={{
                                    position: 'absolute',
                                    right: -20,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    bgcolor: 'rgba(155, 92, 255, 0.1)',
                                    border: '1px solid rgba(155, 92, 255, 0.3)',
                                    color: '#9B5Cff',
                                    '&:hover': {
                                        bgcolor: 'rgba(155, 92, 255, 0.2)',
                                        border: '1px solid rgba(155, 92, 255, 0.5)'
                                    }
                                }}
                                onClick={handleNext}
                                disabled={currentIndex >= releases.length - 3}
                            >
                                <ChevronRight />
                            </IconButton>
                        </>
                    )}
                </Box>
            )}
        </Paper>
    );
}