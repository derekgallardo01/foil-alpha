"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  Box,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
} from "@mui/material";
import { Search as SearchIcon, Style as StyleIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";

export type Command = {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  /** Extra terms to match on beyond the label (e.g. synonyms). */
  keywords?: string;
  run: () => void;
};

/**
 * ⌘K / Ctrl+K command palette. Fully keyboard-driven: type to filter, ↑/↓ to
 * move, Enter to run, Esc to close. Stateless about *what* the commands are —
 * the shell supplies them so the same palette serves user and admin views.
 */
export default function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<Command[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Fresh query + selection each time it opens; focus the input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setResults([]);
      // Defer so the dialog is mounted before we focus.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced card/listing search — results become selectable commands.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = await res.json();
        const cmds: Command[] = (data.cards ?? []).map((c: { id: number; name: string; set_name?: string | null }) => ({
          id: `card:${c.id}`,
          label: c.set_name ? `${c.name} · ${c.set_name}` : c.name,
          group: "Cards & Listings",
          icon: <StyleIcon fontSize="small" />,
          run: () => router.push(`/card/${c.id}`),
        }));
        setResults(cmds);
      } catch {
        /* aborted or offline — leave prior results */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav = q
      ? commands.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q))
      : commands;
    return [...nav, ...results];
  }, [query, commands, results]);

  // Keep the active index in range as the list shrinks.
  useEffect(() => {
    setActive((i) => (i >= filtered.length ? 0 : i));
  }, [filtered.length]);

  // Scroll the active row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    }
  };

  // Flatten to rows while tracking group boundaries for subheaders.
  let lastGroup: string | null = null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          position: "absolute",
          top: { xs: 24, sm: 80 },
          m: 0,
          width: "100%",
          maxHeight: "70vh",
          border: 1,
          borderColor: "divider",
          overflow: "hidden",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <SearchIcon sx={{ color: "text.secondary" }} />
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search pages, actions, and cards…"
          fullWidth
          sx={{ color: "text.primary", fontSize: 16 }}
        />
        <Chip label="ESC" size="small" variant="outlined" sx={{ color: "text.secondary", height: 22 }} />
      </Box>

      {filtered.length === 0 ? (
        <Box sx={{ px: 3, py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No matches for “{query.trim()}”
          </Typography>
        </Box>
      ) : (
        <List ref={listRef} dense sx={{ overflowY: "auto", py: 0.5 }}>
          {filtered.map((cmd, i) => {
            const showHeading = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <React.Fragment key={cmd.id}>
                {showHeading && (
                  <Typography
                    variant="overline"
                    sx={{ display: "block", px: 2, pt: 1, pb: 0.5, color: "text.disabled" }}
                  >
                    {cmd.group}
                  </Typography>
                )}
                <ListItemButton
                  data-idx={i}
                  selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => runAt(i)}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "action.selected" },
                    "& .MuiListItemIcon-root": { color: i === active ? "primary.main" : "text.secondary", minWidth: 36 },
                  }}
                >
                  <ListItemIcon>{cmd.icon}</ListItemIcon>
                  <ListItemText
                    primary={cmd.label}
                    primaryTypographyProps={{ fontSize: 14.5, fontWeight: i === active ? 700 : 500 }}
                  />
                </ListItemButton>
              </React.Fragment>
            );
          })}
        </List>
      )}
    </Dialog>
  );
}
