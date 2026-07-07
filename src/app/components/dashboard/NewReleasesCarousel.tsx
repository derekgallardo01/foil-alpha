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
    CircularProgress
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { formatPriceNA as formatPrice } from '../../lib/format';
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
import WidgetHeader from '../ui/WidgetHeader';

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

    // Neutral, themed toggle group — Holo violet reserved for the active state only.
    const toggleSx = {
        '& .MuiToggleButton-root': {
            color: 'text.secondary',
            borderColor: 'divider',
            '&.Mui-selected': {
                color: 'primary.contrastText',
                bgcolor: 'primary.main',
                borderColor: 'primary.main',
                '&:hover': { bgcolor: 'primary.main' }
            },
            '&:hover': {
                bgcolor: 'action.hover'
            }
        }
    } as const;

    if (loading) {
        return (
            <Paper variant="outlined" sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress color="primary" />
                </Box>
            </Paper>
        );
    }

    return (
        <Paper variant="outlined" sx={{ p: 3 }}>
            <WidgetHeader
                icon={<NewReleases sx={{ color: 'primary.main' }} />}
                title="New Releases & Pre-orders"
                actions={
                    <>
                        <ToggleButtonGroup
                            value={releaseType}
                            exclusive
                            onChange={(e, value) => value && setReleaseType(value)}
                            size="small"
                            sx={toggleSx}
                        >
                            <ToggleButton value="recent">Recent</ToggleButton>
                            <ToggleButton value="upcoming">Upcoming</ToggleButton>
                            <ToggleButton value="popular">Popular</ToggleButton>
                        </ToggleButtonGroup>

                        <IconButton
                            size="small"
                            onClick={fetchReleases}
                            sx={{ color: 'primary.main' }}
                        >
                            <Refresh />
                        </IconButton>
                    </>
                }
            />

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
                            <Grid size={{ xs: 12, md: 4 }} key={set.id}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'border-color 0.2s ease, transform 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            borderColor: 'primary.main'
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
                                            bgcolor: 'background.default',
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
                                                    color="primary"
                                                    sx={{
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
                                            <CalendarToday fontSize="small" sx={{ color: 'text.disabled' }} />
                                            <Typography variant="mono" sx={{ fontSize: 13, color: 'text.primary' }}>
                                                {formatDate(set.release_date)}
                                            </Typography>
                                            {set.days_since_added !== null && set.days_since_added <= 30 && (
                                                <Chip
                                                    label={`${set.days_since_added}d ago`}
                                                    size="small"
                                                    variant="outlined"
                                                    color="primary"
                                                    sx={{ fontSize: '0.7rem' }}
                                                />
                                            )}
                                        </Box>

                                        {set.card_count > 0 && (
                                            <Box sx={{ mt: 2 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {set.card_count} cards available
                                                </Typography>
                                                {set.min_price && set.max_price && (
                                                    <Typography variant="mono" component="div" sx={{ fontSize: 13, color: 'text.primary' }}>
                                                        Price range: {formatPrice(set.min_price)} - {formatPrice(set.max_price)}
                                                    </Typography>
                                                )}
                                                {set.avg_price && (
                                                    <Typography variant="mono" component="div" sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600 }}>
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
                                                            variant="outlined"
                                                            sx={{
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
                                                color="primary"
                                                startIcon={<LocalOffer />}
                                                onClick={() => router.push(`/marketplace?set=${encodeURIComponent(set.name)}`)}
                                                sx={{ flex: 1 }}
                                            >
                                                View Set
                                            </Button>
                                            {set.is_featured && (
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="primary"
                                                    startIcon={<ShoppingCart />}
                                                    sx={{ flex: 1 }}
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
                                    bgcolor: 'background.paper',
                                    border: 1,
                                    borderColor: 'divider',
                                    color: 'primary.main',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                        borderColor: 'primary.main'
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
                                    bgcolor: 'background.paper',
                                    border: 1,
                                    borderColor: 'divider',
                                    color: 'primary.main',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                        borderColor: 'primary.main'
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
