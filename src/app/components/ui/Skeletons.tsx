"use client";

import { Box, Card, CardContent, Skeleton, TableCell, TableRow } from "@mui/material";

/**
 * Fixed-height skeletons that mirror the real content so swapping data in causes
 * no layout shift. Use these instead of full-content CircularProgress.
 */

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Skeleton variant="text" width={90} height={14} />
        <Skeleton variant="text" width={120} height={36} />
      </CardContent>
    </Card>
  );
}

export function CardTileSkeleton() {
  return (
    <Card>
      <Skeleton variant="rectangular" sx={{ width: "100%", aspectRatio: "63 / 88" }} />
      <CardContent>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="text" width="40%" height={30} />
      </CardContent>
    </Card>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" },
        gap: 3,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardTileSkeleton key={i} />
      ))}
    </Box>
  );
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr 1fr", md: `repeat(${count}, 1fr)` },
        gap: 3,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </Box>
  );
}

export function TableRowsSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return <Skeleton variant="rounded" sx={{ width: "100%", height }} />;
}
