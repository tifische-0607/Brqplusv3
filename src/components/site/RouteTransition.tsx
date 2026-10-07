import { AnimatePresence, motion } from "motion/react";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

const TRANSITION_MS = 350;

function scrollToHash(hash: string) {
  if (!hash) return;
  const id = hash.replace(/^#/, "");
  if (!id) return;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });

  // After the route transition completes, smoothly scroll to the hash target
  // (or to the top when no hash is present). Defer until exit+enter has run.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (hash) {
        scrollToHash(hash);
      }
    }, TRANSITION_MS + 20);
    return () => window.clearTimeout(t);
  }, [pathname, hash]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: TRANSITION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
