import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBackendHealth } from "../hooks/useBackendHealth";

export function OfflineBanner() {
  const { isOffline } = useBackendHealth();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (wasOffline.current && !isOffline) {
      // Came back online — refetch all active queries so data is fresh
      void queryClient.invalidateQueries();
    }
    wasOffline.current = isOffline;
  }, [isOffline, queryClient]);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium shadow-md"
    >
      <span>Backend offline — retrying…</span>
    </div>
  );
}
