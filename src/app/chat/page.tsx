"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Container,
  Grid,
  IconButton,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import Image from "next/image";
import Sidebar from "../components/Sidebar";

// Define the Message interface
interface Message {
  id: string;
  content?: string;
  author?: { username: string };
  type?: number;
  attachments?: unknown[];
  embeds?: unknown[];
}

export default function ChatPage() {
  const { status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      setError("Please log in to access the chat.");
      return;
    }

    fetchMessages();

    const eventSource = new EventSource("/api/discord/messages/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
        } else {
          setMessages(data);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError("Failed to parse message stream: " + errorMessage);
      }
    };

    eventSource.onerror = () => {
      setError("Lost connection to message stream. Reconnecting...");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [status]);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/discord/messages", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch messages: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/discord/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to send message: ${res.status} - ${errorText}`);
      }
      await res.json();
      setInput("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <Container maxWidth="lg" sx={{ bgcolor: "#121212", minHeight: "100vh" }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        </Grid>
        <Grid item xs={12} md={9}>
          <Box sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                my: 3,
              }}
            >
              <IconButton onClick={toggleSidebar} sx={{ color: "#fff" }}>
                <MenuIcon />
              </IconButton>
              <Image
                src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
                alt="Logo"
                width={60}
                height={60}
                style={{ objectFit: "contain" }}
              />
            </Box>
            <Typography variant="h4" sx={{ mb: 2, color: "#fff" }}>
              TCG Market Chat
            </Typography>
            {status === "loading" && (
              <Typography sx={{ color: "#b0b0b0" }}>Loading...</Typography>
            )}
            {error && (
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
            <Box
              sx={{
                mb: 2,
                maxHeight: 400,
                overflowY: "auto",
                bgcolor: "#1e1e1e",
                borderRadius: 2,
                p: 2,
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
              }}
            >
              {Array.isArray(messages) && messages.length > 0 ? (
                messages.map((msg) => {
                  let displayText = msg.content;
                  if (!displayText) {
                    if (msg.type === 7) displayText = "[User joined]";
                    else if (msg.attachments && msg.attachments.length > 0) displayText = "[Attachment]";
                    else if (msg.embeds && msg.embeds.length > 0) displayText = "[Embed]";
                    else displayText = "[No text]";
                  }
                  return (
                    <Typography
                      key={msg.id}
                      sx={{
                        color: "#e0e0e0",
                        py: 1,
                        px: 2,
                        bgcolor: "#2c2c2c",
                        borderRadius: 1,
                        mb: 1,
                        "&:hover": { bgcolor: "#353535" },
                      }}
                    >
                      <span style={{ color: "#96ff9b" }}>
                        {msg.author?.username || "Unknown"}
                      </span>
                      : {displayText}
                    </Typography>
                  );
                })
              ) : (
                <Typography sx={{ color: "#b0b0b0" }}>
                  No messages yet.
                </Typography>
              )}
            </Box>
            <TextField
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              fullWidth
              placeholder="Type a message..."
              variant="outlined"
              sx={{
                mb: 1,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#2c2c2c",
                  color: "#e0e0e0",
                  "& fieldset": { borderColor: "#424242" },
                  "&:hover fieldset": { borderColor: "#96ff9b" },
                  "&.Mui-focused fieldset": { borderColor: "#96ff9b" },
                },
                "& .MuiInputBase-input::placeholder": {
                  color: "#b0b0b0",
                  opacity: 1,
                },
              }}
              disabled={status !== "authenticated" || isSending}
            />
            <Button
              onClick={sendMessage}
              variant="contained"
              sx={{
                bgcolor: "#96ff9b",
                color: "#121212",
                "&:hover": { bgcolor: "#7de686" },
                "&:disabled": { bgcolor: "#424242", color: "#b0b0b0" },
              }}
              disabled={status !== "authenticated" || !input.trim() || isSending}
            >
              {isSending ? "Sending..." : "Send"}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}