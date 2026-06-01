import { useState, useEffect } from "react";

function centsToDisplay(cents) {
  const dollars = Math.floor(cents / 100);
  const c = cents % 100;
  return `$${dollars.toLocaleString()}.${String(c).padStart(2, "0")}`;
}

export default function MoneyInput({ value, onChange, placeholder = "$0.00", required, className = "" }) {
  // value is a float (dollars). internally we work in integer cents.
  const [cents, setCents] = useState(() => Math.round((value ?? 0) * 100));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setCents(Math.round((value ?? 0) * 100));
  }, [value]);

  function handleKeyDown(e) {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const next = Math.min(cents * 10 + Number(e.key), 9999999); // max ~$99,999.99
      setCents(next);
      onChange(next / 100);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const next = Math.floor(cents / 10);
      setCents(next);
      onChange(next / 100);
    } else if (e.key === "Delete") {
      e.preventDefault();
      setCents(0);
      onChange(0);
    }
  }

  const display = focused || cents > 0 ? centsToDisplay(cents) : "";

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      required={required}
      readOnly
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-text ${className}`}
    />
  );
}
