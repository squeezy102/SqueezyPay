const API_BASE = "http://localhost:8000";

export async function getBills() {
  try {
    const response = await fetch(`${API_BASE}/api/bills/`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch bills:", error);
    return [];
  }
}
