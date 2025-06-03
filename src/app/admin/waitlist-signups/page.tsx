"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
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
import { Delete as DeleteIcon } from "@mui/icons-material";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";

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

  const fetchWaitlistEntries = async () => {
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
    } catch (error) {
      console.error("Error fetching waitlist entries:", error);
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "grey.900",
        p: 3,
        position: "relative",
        background: "linear-gradient(181deg, #000000bd, #031e04, #0000002b, #000000d4)",
        backgroundSize: "200% 200%",
        animation: "gradientShift 15s ease infinite",
        "@keyframes gradientShift": {
          "0%": { backgroundPosition: "0% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
          "100%": { backgroundPosition: "0% 0%" },
        },
        "&:before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle, rgba(150, 255, 155, 0.1) 1px, transparent 1px), radial-gradient(circle, rgba(239, 83, 80, 0.2) 2px, transparent 2px)",
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
          elevation={6}
          sx={{
            p: 4,
            bgcolor: "grey.900",
            backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
            borderRadius: 2,
            boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)",
            position: "relative",
            width: "100%",
          }}
        >
          <Typography
            variant="h4"
            sx={{
              textAlign: "center",
              color: "#96FF9B",
              mb: 3,
              fontWeight: "bold",
              textShadow: "0 0 10px rgba(150, 255, 155, 0.5)",
              "@media (prefers-reduced-motion: reduce)": {
                textShadow: "none",
              },
            }}
          >
            Waitlist Signups
          </Typography>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
              <CircularProgress color="inherit" />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "grey.400" }}>Name</TableCell>
                    <TableCell sx={{ color: "grey.400" }}>Email</TableCell>
                    <TableCell sx={{ color: "grey.400" }}>Status</TableCell>
                    <TableCell sx={{ color: "grey.400" }}>Source</TableCell>
                    <TableCell sx={{ color: "grey.400" }}>Created At</TableCell>
                    <TableCell sx={{ color: "grey.400" }}>Metadata</TableCell>
                    <TableCell sx={{ color: "grey.400" }}>Actions</TableCell>
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
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            bgcolor:
                              entry.status === "PENDING"
                                ? "rgba(255, 193, 7, 0.1)"
                                : "rgba(76, 175, 80, 0.1)",
                            color:
                              entry.status === "PENDING"
                                ? "rgba(255, 193, 7, 1)"
                                : "rgba(76, 175, 80, 1)",
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
                            bgcolor: "rgba(150, 255, 155, 0.1)",
                            color: "rgba(150, 255, 155, 1)",
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
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
    </Box>
  );
}