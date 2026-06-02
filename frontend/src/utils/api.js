const API_BASE = `http://${window.location.hostname}:8000`;

function authHeaders() {
  const token = sessionStorage.getItem("squeezypay_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handle401(response) {
  if (response.status === 401) {
    sessionStorage.removeItem("squeezypay_token");
    window.dispatchEvent(new Event("squeezypay:unauthorized"));
  }
  return response;
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export async function getAuthStatus() {
  const response = await fetch(`${API_BASE}/api/auth/status`);
  return response.json(); // { configured: bool }
}

export async function setupAuth(passphrase) {
  const response = await fetch(`${API_BASE}/api/auth/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase }),
  });
  if (!response.ok) throw new Error(`Setup failed: ${response.status}`);
  return response.json(); // { access_token, token_type }
}

export async function loginAuth(passphrase) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase }),
  });
  if (response.status === 401) throw new Error("Incorrect passphrase");
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  return response.json(); // { access_token, token_type }
}

export async function logoutAuth() {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

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
    const response = handle401(await fetch(`${API_BASE}/api/payment-history/bill/${billId}`, { headers: { ...authHeaders() } }));
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
    const response = handle401(await fetch(`${API_BASE}/api/payment-history/`, { headers: { ...authHeaders() } }));
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
    const response = handle401(await fetch(`${API_BASE}/api/payment-history/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        bill_id:             payload.billId,
        payment_date:        payload.paymentDate,
        amount_paid:         payload.amountPaid,
        payment_method:      payload.paymentMethod ?? null,
        confirmation_number: payload.confirmationNumber ?? null,
        notes:               payload.notes ?? null,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapPayment(await response.json());
  } catch (error) {
    console.error("Failed to log payment:", error);
    return null;
  }
}

export async function getCredentialByBill(billId) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/credentials/by-bill/${billId}`, { headers: { ...authHeaders() } }));
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
    const response = handle401(await fetch(`${API_BASE}/api/payment-methods/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch payment methods:", error);
    return [];
  }
}

export async function getBills() {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/`, { headers: { ...authHeaders() } }));
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
    const response = handle401(await fetch(`${API_BASE}/api/bills/?include_inactive=true`, { headers: { ...authHeaders() } }));
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
    const response = handle401(await fetch(`${API_BASE}/api/bills/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        name:            payload.name,
        category:        payload.category,
        url:             payload.url,
        expected_amount: payload.expectedAmount ?? null,
        day_of_month:    payload.dayOfMonth,
        recurring:       payload.recurring,
        notes:           payload.notes ?? null,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json());
  } catch (error) {
    console.error("Failed to create bill:", error);
    return null;
  }
}

export async function updateBill(billId, payload) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/${billId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        name:            payload.name,
        category:        payload.category,
        url:             payload.url,
        expected_amount: payload.expectedAmount ?? null,
        day_of_month:    payload.dayOfMonth,
        recurring:       payload.recurring,
        notes:           payload.notes ?? null,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json());
  } catch (error) {
    console.error("Failed to update bill:", error);
    return null;
  }
}

export async function deactivateBill(billId) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/${billId}`, { method: "DELETE", headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json());
  } catch (error) {
    console.error("Failed to deactivate bill:", error);
    return null;
  }
}

export async function reactivateBill(billId) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/${billId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ active: true }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json());
  } catch (error) {
    console.error("Failed to reactivate bill:", error);
    return null;
  }
}

// ── Income ────────────────────────────────────────────────────────────────────

function mapIncome(raw) {
  return {
    id:               raw.id,
    sourceName:       raw.source_name,
    amount:           raw.amount,
    frequency:        raw.frequency,
    nextExpectedDate: raw.next_expected_date,
    active:           raw.active,
  };
}

export async function getIncome(includeInactive = false) {
  try {
    const qs = includeInactive ? "?include_inactive=true" : "";
    const response = handle401(await fetch(`${API_BASE}/api/income/${qs}`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.map(mapIncome);
  } catch (error) {
    console.error("Failed to fetch income:", error);
    return [];
  }
}

export async function createIncome(payload) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        source_name:        payload.sourceName,
        amount:             payload.amount,
        frequency:          payload.frequency,
        next_expected_date: payload.nextExpectedDate,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapIncome(await response.json());
  } catch (error) {
    console.error("Failed to create income:", error);
    return null;
  }
}

export async function updateIncome(id, payload) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        source_name:        payload.sourceName,
        amount:             payload.amount,
        frequency:          payload.frequency,
        next_expected_date: payload.nextExpectedDate,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapIncome(await response.json());
  } catch (error) {
    console.error("Failed to update income:", error);
    return null;
  }
}

export async function deactivateIncome(id) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/${id}`, { method: "DELETE", headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    // 204 No Content — nothing to return
  } catch (error) {
    console.error("Failed to deactivate income:", error);
    return null;
  }
}

export async function reactivateIncome(id) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/${id}/reactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapIncome(await response.json());
  } catch (error) {
    console.error("Failed to reactivate income:", error);
    return null;
  }
}

export async function getMonthlyTotal() {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/monthly-total`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.monthly_total;
  } catch (error) {
    console.error("Failed to fetch monthly total:", error);
    return null;
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings() {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/settings/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return {
      dueSoonDays:            data.due_soon_days,
      largePaymentThreshold:  data.large_payment_threshold,
    };
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return null;
  }
}

export async function updateSettings(payload) {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/settings/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        due_soon_days:           payload.dueSoonDays,
        large_payment_threshold: payload.largePaymentThreshold,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return {
      dueSoonDays:            data.due_soon_days,
      largePaymentThreshold:  data.large_payment_threshold,
    };
  } catch (error) {
    console.error("Failed to update settings:", error);
    return null;
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories() {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/categories/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json(); // [{ id, name }, ...]
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

export async function createCategory(name) {
  const response = handle401(await fetch(`${API_BASE}/api/categories/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  }));
  if (response.status === 409) return { conflict: true };
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.json(); // { id, name }
}

export async function updateCategory(id, name) {
  const response = handle401(await fetch(`${API_BASE}/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  }));
  if (response.status === 409) return { conflict: true };
  if (response.status === 404) return { notFound: true };
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.json(); // { id, name }
}
