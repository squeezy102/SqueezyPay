import { createContext, useContext, useEffect, useState } from "react";
import { getAuthStatus, logoutAuth } from "../utils/api";

const TOKEN_KEY = "squeezypay_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [isConfigured, setIsConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then((data) => {
        if (!cancelled) setIsConfigured(data.configured);
      })
      .catch(() => {
        // If status check fails, assume configured to avoid blocking the UI
        if (!cancelled) setIsConfigured(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Listen for 401 events dispatched by api.js
  useEffect(() => {
    function handleUnauthorized() {
      setToken(null);
    }
    window.addEventListener("squeezypay:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("squeezypay:unauthorized", handleUnauthorized);
  }, []);

  function login(newToken) {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  async function logout() {
    try {
      await logoutAuth();
    } catch {
      // Ignore logout errors — clear state regardless
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        isConfigured,
        login,
        logout,
        loading,
        setIsConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
