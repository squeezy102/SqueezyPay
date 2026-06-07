import { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPlaidLinkToken, exchangePlaidPublicToken } from "../utils/api";

interface Props {
  onConnected?: () => void;
  label?: string;
  className?: string;
  hideIcon?: boolean;
}

export default function PlaidLinkButton({ onConnected, label = "Connect Bank Account", className, hideIcon }: Props) {
  const queryClient = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const exchangeMutation = useMutation({
    mutationFn: (publicToken: string) => exchangePlaidPublicToken(publicToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plaid"] });
      setLinkToken(null);
      onConnected?.();
    },
  });

  const onSuccess = useCallback(
    (publicToken: string) => {
      exchangeMutation.mutate(publicToken);
    },
    [exchangeMutation],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  // Once we have a token and Link is ready, open immediately
  if (linkToken && ready) {
    open();
  }

  async function handleClick() {
    setTokenError(null);
    setFetchingToken(true);
    try {
      const token = await createPlaidLinkToken();
      setLinkToken(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTokenError(`Could not open Plaid: ${msg}`);
    } finally {
      setFetchingToken(false);
    }
  }

  const busy = fetchingToken || exchangeMutation.isPending;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => { void handleClick(); }}
        disabled={busy}
        className={
          className ??
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
        }
      >
        {busy ? (
          <>
            <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {exchangeMutation.isPending ? "Connecting…" : "Loading…"}
          </>
        ) : (
          <>
            {!hideIcon && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )}
            {label}
          </>
        )}
      </button>
      {tokenError && (
        <p className="text-xs text-red-600 dark:text-red-400">{tokenError}</p>
      )}
    </div>
  );
}
