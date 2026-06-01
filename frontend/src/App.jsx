import { ThemeProvider } from "./context/ThemeContext";
import BillDashboard from "./components/BillDashboard";

export default function App() {
  return (
    <ThemeProvider>
      <BillDashboard />
    </ThemeProvider>
  );
}
