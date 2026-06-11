import { useState, useEffect, useRef } from "react";
import { API_BASE } from "../utils/api";

const POLL_INTERVAL_MS = 15_000;
const FETCH_TIMEOUT_MS = 5_000;

async function fetchHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export function useBackendHealth(): { isOffline: boolean } {
  const [isOffline, setIsOffline] = useState(false);
  // firstPollDone prevents flashing the banner before the very first check
  // completes — AuthGate already handles the initial-load failure case.
  const firstPollDone = useRef(false);

  useEffect(() => {
    async function checkHealth(): Promise<void> {
      const ok = await fetchHealth();
      if (firstPollDone.current) {
        setIsOffline(!ok);
      } else {
        firstPollDone.current = true;
        // First failure is intentionally not shown — AuthGate already
        // handles the scenario where the backend is unreachable on startup.
        // Subsequent failures are surfaced by the polling interval.
        if (ok) setIsOffline(false);
      }
    }

    const poll = () => { void checkHealth(); };

    const id = setInterval(poll, POLL_INTERVAL_MS);
    window.addEventListener("online", poll);

    // Kick off an initial check on the next tick so that the first call
    // happens inside a timer callback rather than synchronously in the
    // effect body (satisfies react-hooks/set-state-in-effect).
    const initialTimer = setTimeout(poll, 0);

    return () => {
      clearInterval(id);
      clearTimeout(initialTimer);
      window.removeEventListener("online", poll);
    };
  }, []);

  return { isOffline };
}
