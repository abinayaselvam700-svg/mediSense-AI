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
async function callClaude(prompt, lang) {
  const langInstructions = {
    en: "Respond in English. Structure with sections: Uses, Dosage, Side Effects, Warning. Always end with 'Consult a doctor before use.'",
    ta: "தமிழில் மட்டும் பதிலளிக்கவும். பிரிவுகள்: பயன்கள், அளவு, பக்க விளைவுகள், எச்சரிக்கை. இறுதியில் 'மருத்துவரை அணுகவும்'.",
    hi: "हिंदी में जवाब दें। खंड: उपयोग, खुराक, दुष्प्रभाव, चेतावनी। अंत में 'डॉक्टर से सलाह लें'।",
    te: "తెలుగులో సమాధానం ఇవ్వండి. విభాగాలు: వినియోగాలు, మోతాదు, దుష్ప్రభావాలు, హెచ్చరిక.",
    kn: "ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ. ವಿಭಾಗಗಳು: ಉಪಯೋಗಗಳು, ಮಾತ್ರೆ, ಅಡ್ಡ ಪರಿಣಾಮಗಳು, ಎಚ್ಚರಿಕೆ.",
    ml: "മലയാളത്തിൽ മറുപടി നൽകുക. വിഭാഗങ്ങൾ: ഉപയോഗങ്ങൾ, അളവ്, പാർശ്വഫലങ്ങൾ, മുന്നറിയിപ്പ്.",
  };
  const systemPrompt = `You are MediQ, an AI medicine assistant. ${langInstructions[lang] || langInstructions.en} Plain text only, no markdown.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "Something went wrong. Try again.";
}

async function callClaudeWithImage(base64Image, lang) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: "You are MediQ. Identify the medicine in the image and provide: name, uses, dosage, side effects, warnings. End with 'Consult a doctor before use.'",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
          { type: "text", text: "Identify this medicine and provide complete information." }
        ]
      }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "Could not identify. Try a clearer image.";
}

function parseStructuredResult(text) {
  return text
    .replace(/uses?:/gi, "💊 USES:")
    .replace(/dosage:|dose:/gi, "📏 DOSAGE:")
    .replace(/side effects?:/gi, "⚠️ SIDE EFFECTS:")
    .replace(/warning[s]?:/gi, "🚨 WARNING:")
    .replace(/drug class:/gi, "🔬 DRUG CLASS:")
    .replace(/consult a doctor/gi, "👨‍⚕️ Consult a doctor");
}

function speakText(text, lang, onWord, onEnd) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const langMap = { en: "en-IN", ta: "ta-IN", hi: "hi-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN" };
  utterance.lang = langMap[lang] || "en-IN";
  utterance.rate = 0.9;
  let wordIndex = 0;
  utterance.onboundary = (e) => { if (e.name === "word") { onWord(wordIndex); wordIndex++; } };
  utterance.onend = () => { onWord(-1); onEnd(); };
  window.speechSynthesis.speak(utterance);
}