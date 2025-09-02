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
    ShoppingCart
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface SetRelease {
    id: string;
    name: string;
    series: string;
    release_date: string;
    days_until_release: number | null;
    total_cards: number;
    card_count: number;
    avg_price: number | null;
    min_price: number | null;
    max_price: number | null;
    images: any;
    is_released: boolean;
    preorder_available: boolean;
}

interface NewReleasesCarouselProps {
    limit?: number;
}

export default function NewReleasesCarousel({ limit = 10 }: NewReleasesCarouselProps) {
    const router = useRouter();
    const [releases, setReleases] = useState<SetRelease[]>([]);
    const [loading, setLoading] = useState(true);
    const [releaseType, setReleaseType] = useState<'recent' | 'upcoming' | 'preorder'>('recent');
    const [currentIndex, setCurrentIndex] = useState(0);

    const fetchReleases = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/dashboard/new-releases?type=${releaseType}&limit=${limit}`);
            const data = await response.json();

            if (data.success) {
                setReleases(data.data);
                setCurrentIndex(0);
            }
        } catch (error) {
            console.error('Error fetching releases:', error);
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

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NewReleases sx={{ color: '#96ff9b' }} />
                    New Releases & Pre-orders
                </Typography>

                <ToggleButtonGroup
                    value={releaseType}
                    exclusive
                    onChange={(e, value) => value && setReleaseType(value)}
                    size="small"
                >
                    <ToggleButton value="recent">Recent</ToggleButton>
                    <ToggleButton value="upcoming">Upcoming</ToggleButton>
                    <ToggleButton value="preorder">Pre-order</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
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
                                        transition: 'transform 0.2s',
                                        '&:hover': { transform: 'translateY(-4px)' }
                                    }}
                                >
                                    <CardMedia
                                        component="img"
                                        height="200"
                                        image={set.images?.logo || '/placeholder-set.png'}
                                        alt={set.name}
                                        sx={{ objectFit: 'contain', bgcolor: 'grey.900', p: 2 }}
                                    />
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        <Typography variant="h6" gutterBottom>
                                            {set.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            {set.series} • {set.total_cards} cards
                                        </Typography>

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                                            <CalendarToday fontSize="small" sx={{ color: 'text.secondary' }} />
                                            <Typography variant="body2">
                                                {formatDate(set.release_date)}
                                            </Typography>
                                            {set.days_until_release && set.days_until_release > 0 && (
                                                <Chip
                                                    label={`${set.days_until_release}d`}
                                                    size="small"
                                                    color="warning"
                                                />
                                            )}
                                        </Box>

                                        {set.card_count > 0 && (
                                            <Box sx={{ mt: 2 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {set.card_count} cards available
                                                </Typography>
                                                <Typography variant="body2">
                                                    Price range: {formatPrice(set.min_price)} - {formatPrice(set.max_price)}
                                                </Typography>
                                            </Box>
                                        )}

                                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<LocalOffer />}
                                                onClick={() => router.push(`/marketplace?set=${set.name}`)}
                                                sx={{
                                                    borderColor: '#96ff9b',
                                                    color: '#96ff9b',
                                                    flex: 1
                                                }}
                                            >
                                                View Set
                                            </Button>
                                            {set.preorder_available && (
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<ShoppingCart />}
                                                    sx={{
                                                        bgcolor: '#96ff9b',
                                                        color: '#000',
                                                        flex: 1
                                                    }}
                                                >
                                                    Pre-order
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
                                    '&:hover': { bgcolor: 'action.hover' }
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
                                    '&:hover': { bgcolor: 'action.hover' }
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