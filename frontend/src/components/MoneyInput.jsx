import { useState, useEffect } from "react";

export default function MoneyInput({ value, onChange, required, className = "" }) {
  const [raw, setRaw] = useState(() => value > 0 ? value.toFixed(2) : "");

  useEffect(() => {
    const parsed = parseFloat(value);
    setRaw(!isNaN(parsed) && parsed > 0 ? parsed.toFixed(2) : "");
  }, [value]);

  function handleChange(e) {
    const val = e.target.value;
    setRaw(val);
    const parsed = parseFloat(val);
    onChange(!isNaN(parsed) && parsed >= 0 ? parsed : 0);
  }

  function handleBlur() {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      setRaw(parsed.toFixed(2));
    } else {
      setRaw("");
    }
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400 pointer-events-none">$</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="0.00"
        required={required}
        className={`rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 ${className}`}
      />
    </div>
  );
}
