const API_BASE = `http://${window.location.hostname}:8000`;

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
    expectedAmount: raw.expected_amount,
    amountLabel:    formatAmount(raw.expected_amount),
    url:         raw.url,
    recurring:   raw.recurring,
    active:      raw.active,
    notes:       raw.notes,
  };
}

function mapPayment(raw) {
  return {
    id:                 raw.id,
    billId:             raw.bill_id,
    billName:           raw.bill_name,
    paymentDate:        raw.payment_date,
    amountPaid:         raw.amount_paid,
    paymentMethod:      raw.payment_method,
    confirmationNumber: raw.confirmation_number,
    notes:              raw.notes,
    createdAt:          raw.created_at,
  };
}

export async function getPaymentsByBill(billId) {
  try {
    const response = await fetch(`${API_BASE}/api/payment-history/bill/${billId}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.map(mapPayment);
  } catch (error) {
    console.error("Failed to fetch payment history:", error);
    return [];
  }
}

export async function getAllPayments() {
  try {
    const response = await fetch(`${API_BASE}/api/payment-history/`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.map(mapPayment);
  } catch (error) {
    console.error("Failed to fetch all payments:", error);
    return [];
  }
}

export async function logPayment(payload) {
  try {
    const response = await fetch(`${API_BASE}/api/payment-history/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bill_id:             payload.billId,
        payment_date:        payload.paymentDate,
        amount_paid:         payload.amountPaid,
        payment_method:      payload.paymentMethod ?? null,
        confirmation_number: payload.confirmationNumber ?? null,
        notes:               payload.notes ?? null,
      }),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapPayment(await response.json());
  } catch (error) {
    console.error("Failed to log payment:", error);
    return null;
  }
}

export async function getCredentialByBill(billId) {
  try {
    const response = await fetch(`${API_BASE}/api/credentials/by-bill/${billId}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch credential:", error);
    return null;
  }
}

export async function getPaymentMethods() {
  try {
    const response = await fetch(`${API_BASE}/api/payment-methods/`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch payment methods:", error);
    return [];
  }
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

export async function getAllBills() {
  try {
    const response = await fetch(`${API_BASE}/api/bills/?include_inactive=true`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.map(mapBill);
  } catch (error) {
    console.error("Failed to fetch all bills:", error);
    return [];
  }
}

export async function createBill(payload) {
  try {
    const response = await fetch(`${API_BASE}/api/bills/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:            payload.name,
        category:        payload.category,
        url:             payload.url,
        expected_amount: payload.expectedAmount ?? null,
        day_of_month:    payload.dayOfMonth,
        recurring:       payload.recurring,
        notes:           payload.notes ?? null,
      }),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json());
  } catch (error) {
    console.error("Failed to create bill:", error);
    return null;
  }
}

export async function updateBill(billId, payload) {
  try {
    const response = await fetch(`${API_BASE}/api/bills/${billId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:            payload.name,
        category:        payload.category,
        url:             payload.url,
        expected_amount: payload.expectedAmount ?? null,
        day_of_month:    payload.dayOfMonth,
        recurring:       payload.recurring,
        notes:           payload.notes ?? null,
      }),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json());
  } catch (error) {
    console.error("Failed to update bill:", error);
    return null;
  }
}

export async function deactivateBill(billId) {
  try {
    const response = await fetch(`${API_BASE}/api/bills/${billId}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json());
  } catch (error) {
    console.error("Failed to deactivate bill:", error);
    return null;
  }
}

export async function reactivateBill(billId) {
  try {
    const response = await fetch(`${API_BASE}/api/bills/${billId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json());
  } catch (error) {
    console.error("Failed to reactivate bill:", error);
    return null;
  }
}
