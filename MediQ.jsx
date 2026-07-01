import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

async function saveToBackend(type, query, result, language) {
  try {
    await fetch(`${API_BASE}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, query, result, language }),
    });
  } catch {
    console.warn("Backend not connected.");
  }
}

async function fetchHistoryFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/history?limit=5`);
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteFromBackend(id) {
  try {
    await fetch(`${API_BASE}/history/${id}`, { method: "DELETE" });
  } catch {
    console.warn("Backend not connected.");
  }
}

async function fetchMedicineImage(medicineName) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(medicineName)}`);
    const data = await res.json();
    if (data.thumbnail?.source) return data.thumbnail.source;
    return null;
  } catch {
    return null;
  }
}