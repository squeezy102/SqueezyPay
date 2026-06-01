const API_BASE = "http://localhost:8000";

function formatAmount(amount) {
  if (amount == null) return "Amount varies";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function mapBill(raw) {
  return {
    id:          raw.id,
    name:        raw.name,
    category:    raw.category,
    dayOfMonth:  raw.day_of_month,
    amountLabel: formatAmount(raw.expected_amount),
    url:         raw.url,
    recurring:   raw.recurring,
    active:      raw.active,
    notes:       raw.notes,
  };
}

export async function getBills() {
  try {
    const response = await fetch(`${API_BASE}/api/bills/`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.map(mapBill);
  } catch (error) {
    console.error("Failed to fetch bills:", error);
    return [];
  }
}
