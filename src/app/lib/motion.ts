import type { Variants } from "framer-motion";

/**
 * Shared, tasteful entrance variants. Previously copy-pasted verbatim across
 * pages — import these so motion is one consistent policy.
 */

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};
