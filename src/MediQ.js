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
const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
  { code: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml", label: "മലയാളം", flag: "🇮🇳" },
];

const TABS = [
  { id: "info", icon: "💊", label: "Medicine Info" },
  { id: "interaction", icon: "⚠️", label: "Drug Interaction" },
  { id: "symptom", icon: "🤒", label: "Symptom Check" },
  { id: "dosage", icon: "👤", label: "Age Dosage" },
  { id: "scan", icon: "📷", label: "Scan" },
  { id: "barcode", icon: "📊", label: "Barcode" },
];

const AGE_GROUPS = {
  en: ["Infant (0–2)", "Child (3–12)", "Teen (13–17)", "Adult (18–60)", "Elderly (60+)"],
  ta: ["குழந்தை (0–2)", "சிறுவர் (3–12)", "இளையோர் (13–17)", "பெரியவர் (18–60)", "முதியோர் (60+)"],
  hi: ["शिशु (0–2)", "बच्चा (3–12)", "किशोर (13–17)", "वयस्क (18–60)", "बुजुर्ग (60+)"],
  te: ["శిశువు (0–2)", "పిల్లలు (3–12)", "యుక్తవయస్కుడు (13–17)", "పెద్దలు (18–60)", "వృద్ధులు (60+)"],
  kn: ["ಶಿಶು (0–2)", "ಮಕ್ಕಳು (3–12)", "ಹದಿಹರೆಯ (13–17)", "ವಯಸ್ಕ (18–60)", "ವೃದ್ಧ (60+)"],
  ml: ["ശിശു (0–2)", "കുട്ടി (3–12)", "കൗമാരം (13–17)", "മുതിർന്നവർ (18–60)", "വൃദ്ധർ (60+)"],
};
export default function MediQ() {
  const [tab, setTab] = useState("info");
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [resultWords, setResultWords] = useState([]);
  const [history, setHistory] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [medicineImage, setMedicineImage] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState(-1);
  const [medicineName, setMedicineName] = useState("");
  const [drug1, setDrug1] = useState("");
  const [drug2, setDrug2] = useState("");
  const [symptom, setSymptom] = useState("");
  const [dosageMed, setDosageMed] = useState("");
  const [ageGroup, setAgeGroup] = useState(0);
  const [scanImage, setScanImage] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);

  useEffect(() => {
    fetchHistoryFromBackend().then((data) => {
      if (data && Array.isArray(data)) {
        setBackendOnline(true);
        setHistory(data.map((h) => ({
          id: h.id, tab: h.type,
          query: h.query.slice(0, 60) + "...",
          result: h.result,
        })));
      }
    });
  }, []);

  function switchTab(t) {
    setTab(t);
    setResult("");
    setResultWords([]);
    setMedicineImage(null);
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  async function handleAsk() {
    let prompt = "";

    if (tab === "scan" || tab === "barcode") {
      if (!scanImage) return;
      setLoading(true); setResult("");
      try {
        const res = await callClaudeWithImage(scanImage, lang);
        const structured = parseStructuredResult(res);
        setResult(structured);
        setResultWords(structured.split(" "));
        await saveToBackend(tab, "Image scan", res, lang);
      } catch { setResult("Error scanning. Try again."); }
      setLoading(false);
      return;
    }

    if (tab === "info") {
      if (!medicineName.trim()) return;
      prompt = `Give detailed information about "${medicineName}": uses, dosage, side effects, warnings, drug class.`;
    } else if (tab === "interaction") {
      if (!drug1.trim() || !drug2.trim()) return;
      prompt = `Check drug interaction between "${drug1}" and "${drug2}". Safe together? Explain risks and severity.`;
    } else if (tab === "symptom") {
      if (!symptom.trim()) return;
      prompt = `Patient symptoms: "${symptom}". Suggest common OTC medicines with reasons. Add strong disclaimer.`;
    } else if (tab === "dosage") {
      if (!dosageMed.trim()) return;
      const ag = AGE_GROUPS[lang]?.[ageGroup] || AGE_GROUPS.en[ageGroup];
      prompt = `Recommended dosage of "${dosageMed}" for ${ag}. Include frequency, max dose, special precautions.`;
    }

    setLoading(true); setResult(""); setMedicineImage(null);
    try {
      const res = await callClaude(prompt, lang);
      const structured = parseStructuredResult(res);
      setResult(structured);
      setResultWords(structured.split(" "));
      if (tab === "info") fetchMedicineImage(medicineName).then(setMedicineImage);
      await saveToBackend(tab, prompt, res, lang);
      const fresh = await fetchHistoryFromBackend();
      if (fresh && Array.isArray(fresh)) {
        setBackendOnline(true);
        setHistory(fresh.map((h) => ({ id: h.id, tab: h.type, query: h.query.slice(0, 60) + "...", result: h.result })));
      }
    } catch { setResult("Error. Please try again."); }
    setLoading(false);
  }
const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 9,
    border: "1.5px solid #e0f2fe", fontSize: 14, outline: "none",
    fontFamily: "inherit", color: "#0c4a6e", background: "#f8fcff",
    boxSizing: "border-box", marginTop: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f9ff", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 60%, #0ea5e9 100%)", padding: "24px 20px 20px", color: "#fff" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: "#7dd3fc", textTransform: "uppercase", marginBottom: 2 }}>AI Medicine Assistant</div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>MediQ</h1>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#bae6fd" }}>⚠️ For informational use only. Always consult a doctor.</p>
              <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: backendOnline ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", color: backendOnline ? "#6ee7b7" : "#fca5a5", fontWeight: 600 }}>
                  {backendOnline ? "🟢 Backend Connected" : "🔴 Offline Mode"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              <select value={lang} onChange={(e) => { setLang(e.target.value); setResult(""); }}
                style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code} style={{ color: "#000" }}>{l.flag} {l.label}</option>)}
              </select>
              <div style={{ display: "flex", gap: 4 }}>
                {[{ key: "medical", icon: "💊", label: "Pharmacy" }, { key: "clinic", icon: "🏥", label: "Clinic" }, { key: "hospital", icon: "🏨", label: "Hospital" }].map(({ key, icon, label }) => (
                  <button key={key} onClick={() => {
                    const q = key === "medical" ? "medical shops" : key;
                    navigator.geolocation?.getCurrentPosition(
                      (p) => window.open(`https://www.google.com/maps/search/${q}/@${p.coords.latitude},${p.coords.longitude},15z`, "_blank"),
                      () => window.open(`https://www.google.com/maps/search/${q}+near+me`, "_blank")
                    ) || window.open(`https://www.google.com/maps/search/${q}+near+me`, "_blank");
                  }}
                    style={{ background: "rgba(16,185,129,0.3)", border: "1px solid rgba(16,185,129,0.5)", color: "#fff", borderRadius: 6, padding: "5px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => switchTab(t.id)}
                style={{ background: tab === t.id ? "#fff" : "rgba(255,255,255,0.12)", color: tab === t.id ? "#0369a1" : "#e0f2fe", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
{/* Main Content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px", display: "grid", gridTemplateColumns: "1fr 260px", gap: 18 }}>
        <div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 4px 20px rgba(14,165,233,0.08)", border: "1.5px solid #e0f2fe" }}>

            {/* Medicine Info */}
            {tab === "info" && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0c4a6e", marginBottom: 14 }}>💊 Medicine Info</div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>Medicine Name</label>
                <div style={{ position: "relative" }}>
                  <input style={{ ...inputStyle, paddingRight: 70 }} placeholder="e.g. Paracetamol, Ibuprofen"
                    value={medicineName} onChange={(e) => setMedicineName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAsk()} />
                  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 6, marginTop: 3 }}>
                    <button onClick={() => {
                      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                      if (!SR) { alert("Voice not supported"); return; }
                      const rec = new SR();
                      rec.lang = "en-IN";
                      rec.onstart = () => setIsListening(true);
                      rec.onend = () => setIsListening(false);
                      rec.onresult = (e) => setMedicineName(e.results[0][0].transcript);
                      rec.start();
                    }} style={{ background: isListening ? "#fef2f2" : "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0 }}>
                      {isListening ? "🔴" : "🎤"}
                    </button>
                    <label style={{ cursor: "pointer", fontSize: 16 }}>
                      📷
                      <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files[0]; if (!file) return;
                          const reader = new FileReader();
                          reader.onload = async (ev) => {
                            const base64 = ev.target.result.split(",")[1];
                            setLoading(true); setResult("");
                            try { const r = await callClaudeWithImage(base64, lang); setResult(parseStructuredResult(r)); setResultWords(r.split(" ")); }
                            catch { setResult("Could not identify."); }
                            setLoading(false);
                          };
                          reader.readAsDataURL(file);
                        }} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Drug Interaction */}
            {tab === "interaction" && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0c4a6e", marginBottom: 14 }}>⚠️ Drug Interaction</div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>Medicine 1</label>
                <input style={inputStyle} placeholder="e.g. Aspirin" value={drug1} onChange={(e) => setDrug1(e.target.value)} />
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0284c7", marginTop: 10, display: "block" }}>Medicine 2</label>
                <input style={inputStyle} placeholder="e.g. Warfarin" value={drug2} onChange={(e) => setDrug2(e.target.value)} />
              </div>
            )}

            {/* Symptom */}
            {tab === "symptom" && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0c4a6e", marginBottom: 14 }}>🤒 Symptom Checker</div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>Describe Symptoms</label>
                <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                  placeholder="e.g. fever, headache, body pain" value={symptom} onChange={(e) => setSymptom(e.target.value)} />
              </div>
            )}

            {/* Age Dosage */}
            {tab === "dosage" && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0c4a6e", marginBottom: 14 }}>👤 Age-based Dosage</div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>Medicine Name</label>
                <input style={inputStyle} placeholder="e.g. Amoxicillin" value={dosageMed} onChange={(e) => setDosageMed(e.target.value)} />
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>Age Group</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {(AGE_GROUPS[lang] || AGE_GROUPS.en).map((ag, i) => (
                      <button key={i} onClick={() => setAgeGroup(i)}
                        style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid", borderColor: ageGroup === i ? "#0284c7" : "#e0f2fe", background: ageGroup === i ? "#e0f2fe" : "#fff", color: ageGroup === i ? "#0284c7" : "#94a3b8", fontSize: 11, fontWeight: ageGroup === i ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                        {ag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
{/* Scan */}
            {(tab === "scan" || tab === "barcode") && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0c4a6e", marginBottom: 14 }}>
                  {tab === "scan" ? "📷 Scan Medicine" : "📊 Barcode Scanner"}
                </div>
                <div style={{ border: "2px dashed #bae6fd", borderRadius: 12, padding: 24, textAlign: "center", background: "#f0f9ff", marginBottom: 14 }}>
                  {scanPreview ? (
                    <div>
                      <img src={scanPreview} alt="Medicine" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, marginBottom: 10 }} />
                      <button onClick={() => { setScanImage(null); setScanPreview(null); }}
                        style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
                        🗑 Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>{tab === "scan" ? "📷" : "📊"}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
                        {tab === "scan" ? "Take photo or upload medicine image" : "Scan medicine strip barcode"}
                      </div>
                      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                        <label style={{ background: "#0369a1", color: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          📁 Upload
                          <input type="file" accept="image/*" style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files[0]; if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => { setScanPreview(ev.target.result); setScanImage(ev.target.result.split(",")[1]); };
                              reader.readAsDataURL(file);
                            }} />
                        </label>
                        <label style={{ background: "#10b981", color: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          📷 Camera
                          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files[0]; if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => { setScanPreview(ev.target.result); setScanImage(ev.target.result.split(",")[1]); };
                              reader.readAsDataURL(file);
                            }} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#166534" }}>
                  💡 {tab === "scan" ? "Point camera at medicine label clearly" : "Point camera at barcode on medicine strip"}
                </div>
              </div>
            )}

            {/* Ask Button */}
            <button onClick={handleAsk} disabled={loading}
              style={{ marginTop: 18, width: "100%", background: loading ? "#bae6fd" : "linear-gradient(135deg, #0369a1, #0ea5e9)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {loading ? "⏳ Analyzing..." : "🔍 Ask MediQ"}
            </button>

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#0ea5e9", padding: "12px 0" }}>
                <div style={{ width: 16, height: 16, border: "2.5px solid #bae6fd", borderTop: "2.5px solid #0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 13 }}>AI is analyzing...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}