import { useState } from "react";
import type { ReactNode } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar, MobileTopBar } from "./components/NavBar";
import Dashboard from "./components/Dashboard";
import Bills from "./components/Bills";
import IncomeManagement from "./components/IncomeManagement";
import Settings from "./components/Settings";
import LoginScreen from "./components/LoginScreen";
import SetupScreen from "./components/SetupScreen";
import Accounts from "./components/Accounts";
import SpendingBlame from "./components/SpendingBlame";
import Transactions from "./components/Transactions";

function AppShell() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors">
      <Sidebar active={activeTab} onChange={setActiveTab} />
      <MobileTopBar active={activeTab} onChange={setActiveTab} />

      {/* Content area - offset for sidebar on desktop, top bar on mobile */}
      <div className="lg:pl-56 pt-14 lg:pt-0">
        {activeTab === "dashboard"    && <Dashboard />}
        {activeTab === "bills"        && <Bills />}
        {activeTab === "transactions" && <Transactions />}
        {activeTab === "income"       && <IncomeManagement />}
        {activeTab === "settings"     && <Settings />}
        {activeTab === "accounts"     && <Accounts />}
        {activeTab === "spending"     && <SpendingBlame onNavigate={setActiveTab} />}
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isConfigured, statusError, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-violet-50 dark:bg-slate-950" />;
  if (statusError) {
    return (
      <div className="min-h-screen bg-violet-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Cannot reach the SqueezyPay server</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Make sure the backend is running, then refresh the page.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!isConfigured) return <SetupScreen />;
  if (!isAuthenticated) return <LoginScreen />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <AppShell />
        </AuthGate>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </ThemeProvider>
  );
}
