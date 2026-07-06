"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Delete as DeleteIcon, PeopleAlt as PeopleAltIcon } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { toast } from "react-toastify";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/ui/PageHeader";
import ErrorState from "../../components/ui/ErrorState";

// Define the WaitlistEntry interface
interface WaitlistEntry {
  id: number;
  name: string;
  email: string;
  status: string;
  source: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export default function WaitlistSignupsPage() {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWaitlistEntries = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/waitlist", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch waitlist entries");
      }
      setWaitlistEntries(data.entries);
      setError(null);
    } catch (error) {
      console.error("Error fetching waitlist entries:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch waitlist entries. Please try again later.";
      setError(message);
      toast.error("Failed to fetch waitlist entries. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      const response = await fetch("/api/admin/waitlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete entry");
      }

      toast.success("Entry deleted successfully");
      fetchWaitlistEntries();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    }
  };

  useEffect(() => {
    fetchWaitlistEntries();
  }, []);

  return (
    <AppShell variant="admin">
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        p: 3,
        position: "relative",
        "&:before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle, rgba(155, 92, 255, 0.1) 1px, transparent 1px), radial-gradient(circle, rgba(239, 83, 80, 0.2) 2px, transparent 2px)",
          backgroundSize: "20px 20px, 30px 30px",
          backgroundPosition: "0 0, 15px 15px",
          opacity: 0.3,
          animation: "particleShift 30s linear infinite",
        },
        "@keyframes particleShift": {
          "0%": { backgroundPosition: "0 0, 15px 15px" },
          "100%": { backgroundPosition: "100px 100px, 115px 115px" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
          "&:before": {
            animation: "none",
          },
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            borderRadius: 2,
            position: "relative",
            width: "100%",
          }}
        >
          <PageHeader title="Waitlist Signups" icon={<PeopleAltIcon />} />

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
              <CircularProgress color="inherit" />
            </Box>
          ) : error ? (
            <Box sx={{ my: 3 }}>
              <ErrorState
                variant="inline"
                message={error}
                onRetry={fetchWaitlistEntries}
              />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary" }}>Name</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>Email</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>Status</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>Source</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>Created At</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>Metadata</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {waitlistEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.name}</TableCell>
                      <TableCell>{entry.email}</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: "inline-block",
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            fontFamily: (theme) => theme.typography.mono?.fontFamily,
                            bgcolor: (theme) =>
                              alpha(
                                entry.status === "PENDING"
                                  ? theme.palette.warning.main
                                  : theme.palette.success.main,
                                0.14
                              ),
                            color:
                              entry.status === "PENDING"
                                ? "warning.main"
                                : "success.main",
                          }}
                        >
                          {entry.status}
                        </Box>
                      </TableCell>
                      <TableCell>{entry.source}</TableCell>
                      <TableCell>
                        {new Date(entry.created_at).toLocaleString("en-US", {
                          timeZone: "America/New_York",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                          second: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            border: 1,
                            borderColor: "divider",
                            bgcolor: "background.default",
                            color: "text.secondary",
                            fontFamily: (theme) => theme.typography.mono?.fontFamily,
                            fontSize: "0.75rem",
                            whiteSpace: "pre-wrap",
                            maxHeight: "100px",
                            overflow: "auto",
                          }}
                        >
                          {JSON.stringify(entry.metadata, null, 2)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={() => handleDelete(entry.id)}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>
    </Box>
    </AppShell>
  );
}