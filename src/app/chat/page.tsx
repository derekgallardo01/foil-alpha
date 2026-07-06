"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Container,
} from "@mui/material";
import AppShell from "../components/AppShell";

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
  const [isSending, setIsSending] = useState(false);

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
    <AppShell>
      <Container maxWidth="lg" sx={{ minHeight: "100vh" }}>
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 2, color: "primary.main" }}>
              Foil Alpha Chat
            </Typography>
            {status === "loading" && (
              <Typography sx={{ color: "text.secondary" }}>Loading...</Typography>
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
                bgcolor: "background.default",
                borderRadius: 2,
                p: 2,
                border: 1,
                borderColor: "divider",
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
                        color: "text.primary",
                        py: 1,
                        px: 2,
                        bgcolor: "background.paper",
                        borderRadius: 1,
                        mb: 1,
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <Box component="span" sx={{ color: "primary.main" }}>
                        {msg.author?.username || "Unknown"}
                      </Box>
                      : {displayText}
                    </Typography>
                  );
                })
              ) : (
                <Typography sx={{ color: "text.secondary" }}>
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
                  bgcolor: "background.paper",
                  color: "text.primary",
                  "& fieldset": { borderColor: "divider" },
                  "&:hover fieldset": { borderColor: "primary.main" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
                "& .MuiInputBase-input::placeholder": {
                  color: "text.secondary",
                  opacity: 1,
                },
              }}
              disabled={status !== "authenticated" || isSending}
            />
            <Button
              onClick={sendMessage}
              variant="contained"
              disabled={status !== "authenticated" || !input.trim() || isSending}
            >
              {isSending ? "Sending..." : "Send"}
            </Button>
        </Box>
      </Container>
    </AppShell>
  );
}