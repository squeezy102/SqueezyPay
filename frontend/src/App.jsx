import { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { Sidebar, MobileTopBar } from "./components/NavBar";
import BillDashboard from "./components/BillDashboard";
import BillManagement from "./components/BillManagement";
import PaymentHistory from "./components/PaymentHistory";
import IncomeManagement from "./components/IncomeManagement";
import Settings from "./components/Settings";

function AppShell() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors">
      <Sidebar active={activeTab} onChange={setActiveTab} />
      <MobileTopBar active={activeTab} onChange={setActiveTab} />

      {/* Content area - offset for sidebar on desktop, top bar on mobile */}
      <div className="lg:pl-56 pt-14 lg:pt-0">
        {activeTab === "home"    && <BillDashboard />}
        {activeTab === "bills"   && <BillManagement />}
        {activeTab === "history" && <PaymentHistory />}
        {activeTab === "income"   && <IncomeManagement />}
        {activeTab === "settings" && <Settings />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
