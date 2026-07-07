"use client";

import { useEffect, useState } from "react";
import { IconButton, Tooltip, CircularProgress } from "@mui/material";
import { Favorite, FavoriteBorder } from "@mui/icons-material";
import { toast } from "react-toastify";

/**
 * Heart toggle to watch/unwatch a marketplace listing. Optimistic. Pass
 * `initialWatching` when the parent already knows the state (avoids a fetch);
 * otherwise the button self-fetches its state on mount.
 */
export default function WatchButton({
  userCardId,
  initialWatching,
  size = "small",
  onChange,
}: {
  userCardId: number;
  initialWatching?: boolean;
  size?: "small" | "medium";
  onChange?: (watching: boolean) => void;
}) {
  const [watching, setWatching] = useState<boolean | null>(initialWatching ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialWatching !== undefined) {
      setWatching(initialWatching);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/watch?user_card_id=${userCardId}`);
        if (res.ok) {
          const d = await res.json();
          if (!cancelled) setWatching(!!d.watching);
        }
      } catch {
        /* leave as null (disabled) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userCardId, initialWatching]);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy || watching === null) return;
    const next = !watching;
    setBusy(true);
    setWatching(next); // optimistic
    try {
      const res = next
        ? await fetch("/api/watch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_card_id: userCardId }),
          })
        : await fetch(`/api/watch?user_card_id=${userCardId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      onChange?.(next);
    } catch {
      setWatching(!next); // revert
      toast.error("Couldn't update your watchlist.");
    } finally {
      setBusy(false);
    }
  };

  const active = watching === true;
  return (
    <Tooltip title={active ? "Watching — click to stop" : "Watch this listing"}>
      <span>
        <IconButton
          size={size}
          onClick={toggle}
          disabled={watching === null || busy}
          aria-label={active ? "Stop watching" : "Watch listing"}
          color={active ? "error" : "default"}
        >
          {watching === null ? (
            <CircularProgress size={16} />
          ) : active ? (
            <Favorite fontSize={size} />
          ) : (
            <FavoriteBorder fontSize={size} />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}
