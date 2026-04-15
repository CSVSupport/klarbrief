import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase, signUp, signIn, signOut, getSession, getProfile, updateProfile as dbUpdateProfile, getProjects, createProject as dbCreateProject, updateProject as dbUpdateProject, deleteProject as dbDeleteProject, getUsageForMonth, incrementUsage as dbIncrementUsage, adminGetAllUsers, adminGetAllProjects, adminGetAllUsage } from "./lib/supabase";
import { FileText, Shield, Clock, Search, Upload, ChevronRight, Check, X, Menu, Bell, Settings, LogOut, Users, BarChart3, TrendingUp, Eye, Edit3, Trash2, Plus, ArrowLeft, Home, Folder, AlertTriangle, CheckCircle, AlertCircle, Info, Send, Printer, Download, Star, Zap, Lock, Globe, MessageSquare, Phone, Mail, MapPin, Calendar, ChevronDown, ChevronUp, Filter, RefreshCw, Award, Heart, ExternalLink, Cookie, BookOpen, Scale, CreditCard, UserPlus, PieChart, Activity, Layers, Target, ArrowRight, Sparkles, Bot, Camera, Image, FileUp, File } from "lucide-react";

// ============================================
// KLARBRIEF — Complete SaaS Platform
// Behördenbriefe einfach erklärt
// ============================================

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const brand = {
  primary: "#1e5fa8", primaryLight: "#3b82d4", primaryDark: "#15467f",
  accent: "#f97316", accentHover: "#ea580c", accentLight: "#fb923c",
  bg: "#fefdf8", bgWarm: "#fff7ed", bgDark: "#0f1f3a",
  bgCard: "#ffffff", bgMuted: "#eff6ff",
  text: "#1c1917", textMuted: "#6b7280", textLight: "#eff6ff",
  border: "#d1d5db", borderLight: "#e5e7eb",
  success: "#10b981", warning: "#f59e0b", danger: "#ef4444", info: "#3b82f6",
};

const ampel = {
  rot: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "#ef4444", label: "Dringend" },
  gelb: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", icon: "#f59e0b", label: "Wichtig" },
  gruen: { bg: "#f0fdf4", border: "#86efac", text: "#166534", icon: "#10b981", label: "Info" },
};

const demoProjects = [
  { id: 1, name: "Steuerbescheid 2025", category: "Steuern", status: "offen", ampel: "rot", behoerde: "Finanzamt Bonn-Innenstadt", frist: "2026-04-15", letters: [
    { id: 1, date: "10.03.2026", direction: "eingehend", type: "Steuerbescheid", summary: "Nachzahlung von 847,50€ für das Steuerjahr 2025. Frist: 15.04.2026.", analyzed: true },
    { id: 2, date: "18.03.2026", direction: "ausgehend", type: "Einspruch", summary: "Einspruch gegen die Berechnung der Werbungskosten eingelegt.", analyzed: false },
  ]},
  { id: 2, name: "Nebenkostenabrechnung 2025", category: "Miete", status: "wartet", ampel: "gelb", behoerde: "Hausverwaltung Schmidt GmbH", frist: "2026-05-30", letters: [
    { id: 3, date: "28.02.2026", direction: "eingehend", type: "Abrechnung", summary: "Nachzahlung von 312,80€ für Heizkosten und Müllabfuhr. Prüfungsfrist bis 30.05.2026.", analyzed: true },
  ]},
  { id: 3, name: "Kindergeld-Bescheid", category: "Soziales", status: "erledigt", ampel: "gruen", behoerde: "Familienkasse Bonn", frist: null, letters: [
    { id: 4, date: "15.01.2026", direction: "eingehend", type: "Bewilligungsbescheid", summary: "Kindergeld in Höhe von 250€ monatlich bewilligt ab 01.01.2026.", analyzed: true },
  ]},
];

const demoUsers = [
  { id: 1, name: "Max Mustermann", email: "max@beispiel.de", plan: "plus", projects: 5, analyses: 23, lastLogin: "2026-04-02", registered: "2025-11-15" },
  { id: 2, name: "Anna Weber", email: "anna.w@mail.de", plan: "pro", projects: 12, analyses: 67, lastLogin: "2026-04-03", registered: "2025-10-01" },
  { id: 3, name: "Tom Schulz", email: "tom@web.de", plan: "free", projects: 2, analyses: 3, lastLogin: "2026-03-28", registered: "2026-03-20" },
  { id: 4, name: "Lisa Braun", email: "lisa.b@outlook.de", plan: "plus", projects: 8, analyses: 41, lastLogin: "2026-04-01", registered: "2025-12-05" },
  { id: 5, name: "Kerem Yildiz", email: "kerem@gmail.com", plan: "free", projects: 1, analyses: 2, lastLogin: "2026-03-30", registered: "2026-03-25" },
];

// ── File Upload / Camera Component ──
function FileUploader({ onFileContent, onTextContent }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const processFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setProcessing(true);

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    if (isImage || isPdf) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(",")[1];
        const mediaType = file.type;

        if (isImage) {
          setPreview(e.target.result);
        } else {
          setPreview(null);
        }

        // Call Claude Vision API
        try {
          const content = isImage
            ? [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                { type: "text", text: "Extrahiere den vollständigen Text aus diesem Behördenbrief. Gib NUR den extrahierten Text zurück, keine Erklärungen." }
              ]
            : [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
                { type: "text", text: "Extrahiere den vollständigen Text aus diesem Behördenbrief/Dokument. Gib NUR den extrahierten Text zurück, keine Erklärungen." }
              ];

          const resp = await fetch("/api/anthropic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: ANTHROPIC_MODEL,
              max_tokens: 2000,
              messages: [{ role: "user", content }],
            })
          });
          const data = await resp.json();
          const extractedText = data.content?.[0]?.text || "";
          onFileContent?.({ base64, mediaType, extractedText, isImage, isPdf, fileName: file.name });
          onTextContent?.(extractedText);
        } catch (err) {
          console.error("Vision API error:", err);
          onTextContent?.("[Fehler bei der Texterkennung — bitte Text manuell eingeben]");
        }
        setProcessing(false);
      };
      reader.readAsDataURL(file);
    } else {
      // Plain text file
      const reader = new FileReader();
      reader.onload = (e) => {
        onTextContent?.(e.target.result);
        setProcessing(false);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleCameraCapture = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const reset = () => {
    setPreview(null);
    setFileName("");
    setProcessing(false);
    onTextContent?.("");
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Hidden inputs */}
      <input ref={fileRef} type="file" accept="image/*,.pdf,.txt" onChange={handleFileSelect} style={{ display: "none" }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} style={{ display: "none" }} />

      {!fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? brand.primary : brand.borderLight}`,
            borderRadius: 16,
            padding: "32px 20px",
            textAlign: "center",
            background: dragOver ? `${brand.primary}08` : brand.bgMuted,
            transition: "all 0.2s",
            cursor: "pointer",
          }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `${brand.primary}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Upload size={28} style={{ color: brand.primary }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: brand.text, margin: "0 0 6px" }}>
            Brief hochladen
          </p>
          <p style={{ fontSize: 14, color: brand.textMuted, margin: "0 0 20px" }}>
            Foto, PDF oder Textdatei hierher ziehen — oder klicken
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: `1.5px solid ${brand.primary}`, background: "#fff", color: brand.primary, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              <Camera size={18} /> Foto aufnehmen
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: `1.5px solid ${brand.borderLight}`, background: "#fff", color: brand.text, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              <FileUp size={18} /> Datei wählen
            </button>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 16, justifyContent: "center", fontSize: 12, color: brand.textMuted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Image size={14} /> JPG, PNG</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><File size={14} /> PDF</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><FileText size={14} /> TXT</span>
          </div>
        </div>
      ) : (
        <div style={{ border: `1.5px solid ${brand.borderLight}`, borderRadius: 16, padding: 20, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: preview ? 12 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {processing ? (
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${brand.primary}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RefreshCw size={20} style={{ color: brand.primary, animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${brand.success}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle size={20} style={{ color: brand.success }} />
                </div>
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: brand.text }}>{fileName}</div>
                <div style={{ fontSize: 12, color: processing ? brand.primary : brand.success, fontWeight: 600 }}>
                  {processing ? "Text wird erkannt..." : "Text erfolgreich erkannt ✓"}
                </div>
              </div>
            </div>
            <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
              <X size={18} color={brand.textMuted} />
            </button>
          </div>
          {preview && (
            <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", border: `1px solid ${brand.borderLight}`, maxHeight: 200 }}>
              <img src={preview} alt="Vorschau" style={{ width: "100%", height: "auto", display: "block", objectFit: "contain", maxHeight: 200 }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cookie Banner ──
function CookieBanner({ onAccept }) {
  const [show, setShow] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  if (!show) return null;

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px", background: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <Cookie size={24} style={{ color: brand.accent, flexShrink: 0, marginTop: 2 }} />
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: brand.text }}>Datenschutz-Einstellungen</h3>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: brand.textMuted, lineHeight: 1.6 }}>
              Wir verwenden Cookies für den Betrieb der Seite. Technisch notwendige Cookies können nicht deaktiviert werden. Mehr in unserer Datenschutzerklärung.
            </p>
          </div>
        </div>
        {showSettings && (
          <div style={{ margin: "16px 0", padding: 16, background: brand.bgMuted, borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Notwendig", desc: "Session, Sicherheit, Cookie-Consent", checked: true, disabled: true },
              { label: "Funktional", desc: "Spracheinstellungen, UI-Präferenzen", checked: functional, onChange: () => setFunctional(!functional) },
              { label: "Analyse", desc: "Anonymisierte Nutzungsstatistiken", checked: analytics, onChange: () => setAnalytics(!analytics) },
              { label: "Marketing", desc: "Personalisierte Inhalte", checked: marketing, onChange: () => setMarketing(!marketing) },
            ].map((c, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 12, cursor: c.disabled ? "default" : "pointer" }}>
                <div style={{ width: 44, height: 24, borderRadius: 12, background: c.checked ? brand.primary : "#d1d5db", position: "relative", transition: "background 0.2s", opacity: c.disabled ? 0.7 : 1 }}
                  onClick={c.disabled ? undefined : c.onChange}>
                  <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2, left: c.checked ? 22 : 2, transition: "left 0.2s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: brand.text }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: brand.textMuted }}>{c.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => { setShow(false); onAccept?.(); }} style={{ flex: 1, minWidth: 140, padding: "12px 20px", borderRadius: 10, border: `2px solid ${brand.border}`, background: "#fff", color: brand.text, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Nur notwendige</button>
          <button onClick={() => setShowSettings(!showSettings)} style={{ flex: 1, minWidth: 140, padding: "12px 20px", borderRadius: 10, border: `2px solid ${brand.border}`, background: "#fff", color: brand.text, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{showSettings ? "Speichern" : "Einstellungen"}</button>
          <button onClick={() => { setShow(false); onAccept?.(); }} style={{ flex: 1, minWidth: 140, padding: "12px 20px", borderRadius: 10, border: "none", background: brand.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Alle akzeptieren</button>
        </div>
      </div>
    </div>
  );
}

// ── Shared Components ──
function Badge({ children, color = brand.primary, bg = brand.bgMuted }) {
  return <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color }}>{children}</span>;
}
function AmpelBadge({ level }) {
  const a = ampel[level]; if (!a) return null;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: a.bg, color: a.text, border: `1px solid ${a.border}` }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: a.icon }} />{a.label}</span>;
}
function Btn({ children, variant = "primary", size = "md", onClick, style: sx, ...rest }) {
  const base = { border: "none", cursor: "pointer", fontWeight: 600, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s cubic-bezier(0.25,0,0.25,1)", fontFamily: "inherit" };
  const sizes = { sm: { padding: "8px 16px", fontSize: 13 }, md: { padding: "12px 24px", fontSize: 15 }, lg: { padding: "16px 32px", fontSize: 17 } };
  const variants = {
    primary: { background: brand.primary, color: "#fff" }, accent: { background: brand.accent, color: brand.text },
    outline: { background: "transparent", color: brand.primary, border: `2px solid ${brand.primary}` },
    ghost: { background: "transparent", color: brand.textMuted }, danger: { background: brand.danger, color: "#fff" },
    white: { background: "#fff", color: brand.primary, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
  };
  return <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...sx }} {...rest}>{children}</button>;
}
function Card({ children, style: sx, hover, onClick }) {
  const [h, setH] = useState(false);
  return <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{ background: brand.bgCard, borderRadius: 16, border: `1px solid ${brand.borderLight}`, padding: 24, transition: "all 0.25s cubic-bezier(0.25,0,0.25,1)", transform: hover && h ? "translateY(-4px)" : "none", boxShadow: hover && h ? "0 12px 32px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)", cursor: onClick ? "pointer" : "default", ...sx }}>{children}</div>;
}
function Input({ label, type = "text", value, onChange, placeholder, icon: Icon, textarea, style: sx }) {
  const El = textarea ? "textarea" : "input";
  return <div style={{ marginBottom: 16, ...sx }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: brand.text }}>{label}</label>}
    <div style={{ position: "relative" }}>
      {Icon && <Icon size={18} style={{ position: "absolute", left: 14, top: textarea ? 14 : "50%", transform: textarea ? "none" : "translateY(-50%)", color: brand.textMuted }} />}
      <El type={type} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: Icon ? "12px 14px 12px 42px" : "12px 14px", borderRadius: 10, border: `1.5px solid ${brand.borderLight}`, fontSize: 15, fontFamily: "inherit", color: brand.text, background: "#fff", outline: "none", transition: "border 0.2s", resize: textarea ? "vertical" : undefined, minHeight: textarea ? 120 : undefined, boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = brand.primary} onBlur={e => e.target.style.borderColor = brand.borderLight} />
    </div>
  </div>;
}
function StatCard({ icon: Icon, label, value, change, color = brand.primary }) {
  return <Card style={{ flex: "1 1 200px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={22} style={{ color }} /></div>
      {change && <span style={{ fontSize: 12, fontWeight: 600, color: change > 0 ? brand.success : brand.danger }}>{change > 0 ? "+" : ""}{change}%</span>}
    </div>
    <div style={{ marginTop: 16, fontSize: 28, fontWeight: 800, color: brand.text, letterSpacing: "-0.02em" }}>{value}</div>
    <div style={{ fontSize: 13, color: brand.textMuted, marginTop: 4 }}>{label}</div>
  </Card>;
}
function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
    <div onClick={e => e.stopPropagation()} style={{ position: "relative", background: "#fff", borderRadius: 20, padding: 32, maxWidth: wide ? 800 : 520, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.15)", animation: "modalIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: brand.text }}>{title}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}><X size={20} color={brand.textMuted} /></button>
      </div>
      {children}
    </div>
  </div>;
}

// ── KI Analysis Engine ──
async function analyzeWithAI(text, fileData = null) {
  const systemPrompt = `Du bist KlarBrief24, ein KI-Assistent der Behördenbriefe und Dokumente in einfaches Deutsch übersetzt. Antworte IMMER als JSON-Objekt mit genau diesen Feldern:
{
  "klartext": "Einfache Erklärung des Briefs/Dokuments in 2-3 Sätzen",
  "ampel": "rot/gelb/gruen",
  "todos": ["To-Do 1", "To-Do 2"],
  "frist": "Datum im Format TT.MM.JJJJ oder null",
  "kategorie": "Steuern/Miete/Soziales/Bußgeld/Versicherung/Arbeit/Rechnung/Vertrag/Sonstiges",
  "behoerde": "Exakter Name des Absenders/der Firma/der Behörde",
  "betreff": "Präziser Betreff des Dokuments, z.B. 'Rechnung RE-2026-4711 über Handschuhe' oder 'Nutzungsvertrag Messestand Koblenz blüht 2026' oder 'Steuerbescheid 2025'",
  "projektname": "Kurzer, eindeutiger Projektname für die Ablage, z.B. 'Rechnung Rodopi Tools — Handschuhe' oder 'Vertrag Koblenz blüht 2026' oder 'Steuerbescheid 2025 Finanzamt Bonn'",
  "aktenzeichen": "Aktenzeichen, Rechnungsnummer, Vertragsnummer oder ähnliche Referenznummer — oder null",
  "referenzen": ["z.B. 'Rechnungsnr: RE122099', 'Vertragsnr: V-2026-0412'"],
  "dokumenttyp": "Rechnung/Vertrag/Bescheid/Mahnung/Kündigung/Angebot/Mitteilung/Sonstiges"
}

KRITISCH WICHTIG für die Projektzuordnung:
- "behoerde": IMMER den EXAKTEN Firmennamen oder Behördennamen extrahieren. "Rodopi Tools" ist NICHT "Koblenz-Stadtmarketing GmbH"!
- "betreff": MUSS den konkreten Vorgang beschreiben. Jeder Brief/Rechnung/Vertrag hat einen EIGENEN, UNTERSCHIEDLICHEN Betreff.
- "projektname": Soll EINDEUTIG sein. Zwei verschiedene Rechnungen von verschiedenen Firmen = zwei verschiedene Projektnamen. Ein Steuerbescheid und eine Rechnung = zwei verschiedene Projektnamen.
- "dokumenttyp": Hilft bei der Unterscheidung. Eine Rechnung ist kein Vertrag. Ein Bescheid ist keine Mahnung.
- "kategorie": Wurde um "Rechnung" und "Vertrag" erweitert — bitte korrekt zuordnen.

Keine Markdown-Formatierung, kein Präambel, nur das JSON-Objekt.`;

  let messages;
  if (fileData?.base64 && fileData?.isImage) {
    messages = [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: fileData.mediaType, data: fileData.base64 } },
      { type: "text", text: "Analysiere diesen Behördenbrief. Übersetze ihn in einfaches Deutsch und extrahiere alle wichtigen Informationen." }
    ]}];
  } else if (fileData?.base64 && fileData?.isPdf) {
    messages = [{ role: "user", content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData.base64 } },
      { type: "text", text: "Analysiere dieses Behördenschreiben. Übersetze es in einfaches Deutsch und extrahiere alle wichtigen Informationen." }
    ]}];
  } else {
    messages = [{ role: "user", content: `Analysiere diesen Behördenbrief:\n\n${text}` }];
  }

  try {
    const resp = await fetch("/api/anthropic", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1000, system: systemPrompt, messages })
    });
    const data = await resp.json();
    const raw = data.content?.[0]?.text || "{}";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return { klartext: "Das Dokument wurde analysiert. Bitte prüfe die Details manuell.", ampel: "gelb", todos: ["Dokument im Detail prüfen", "Fristen beachten"], frist: null, kategorie: "Sonstiges", behoerde: "Unbekannt", betreff: "Dokument", projektname: "Neuer Vorgang", aktenzeichen: null, referenzen: [], dokumenttyp: "Sonstiges" };
  }
}

// ── Navigation ──
function Navbar({ page, setPage, isLoggedIn, isAdmin, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { id: "home", label: "Start" }, { id: "features", label: "Funktionen" },
    { id: "usecases", label: "Anwendungsfälle" }, { id: "angebot", label: "Angebot", highlight: true },
    { id: "pricing", label: "Preise" }, { id: "blog", label: "Blog" }, { id: "about", label: "Über uns" },
  ];
  return <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${brand.borderLight}`, padding: "0 20px" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
      <div onClick={() => setPage("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
        <img src="/logo.png" alt="KlarBrief24" style={{ height: 38, width: "auto" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }} className="nav-desktop">
        {navItems.map(n => <button key={n.id} onClick={() => setPage(n.id)} style={{ padding: "8px 14px", borderRadius: 8, border: n.highlight ? `1.5px solid ${brand.accent}` : "none", background: n.highlight ? `${brand.accent}08` : (page === n.id ? brand.bgMuted : "transparent"), color: n.highlight ? brand.accentHover : (page === n.id ? brand.primary : brand.textMuted), fontWeight: n.highlight ? 700 : 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit" }}>{n.label}{n.highlight && " ⚡"}</button>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isLoggedIn ? <>
          <Btn variant="ghost" size="sm" onClick={() => setPage("dashboard")}>Dashboard</Btn>
          {isAdmin && <Btn variant="ghost" size="sm" onClick={() => setPage("admin")}>Admin</Btn>}
          <Btn variant="outline" size="sm" onClick={onLogout}>Abmelden</Btn>
        </> : <>
          <Btn variant="ghost" size="sm" onClick={() => setPage("login")}>Anmelden</Btn>
          <Btn variant="primary" size="sm" onClick={() => setPage("register")}>Kostenlos starten</Btn>
        </>}
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: 4 }} className="nav-mobile-btn"><Menu size={24} color={brand.text} /></button>
      </div>
    </div>
    {mobileOpen && <div style={{ padding: "12px 0 20px", borderTop: `1px solid ${brand.borderLight}` }}>
      {navItems.map(n => <button key={n.id} onClick={() => { setPage(n.id); setMobileOpen(false); }} style={{ display: "block", width: "100%", padding: "12px 16px", border: "none", background: page === n.id ? brand.bgMuted : "transparent", color: page === n.id ? brand.primary : brand.text, fontWeight: 600, fontSize: 15, textAlign: "left", cursor: "pointer", borderRadius: 8, fontFamily: "inherit" }}>{n.label}</button>)}
    </div>}
  </nav>;
}

function Footer({ setPage }) {
  return <footer style={{ background: brand.bgDark, color: brand.textLight, padding: "64px 20px 32px" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40, marginBottom: 48 }}>
        <div>
          <div style={{ marginBottom: 16 }}>
            <img src="/logo.png" alt="KlarBrief24" style={{ height: 36, width: "auto", filter: "brightness(10)" }} />
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>Behördenbriefe? Endlich verstanden. KI-gestützte Analyse amtlicher Schreiben in einfaches Deutsch.</p>
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, color: "rgba(255,255,255,0.4)" }}>Produkt</h4>
          {["features", "pricing", "angebot", "usecases", "blog"].map(p => <div key={p}><button onClick={() => setPage(p)} style={{ display: "block", padding: "6px 0", background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{p === "features" ? "Funktionen" : p === "pricing" ? "Preise" : p === "angebot" ? "Lifetime-Angebot ⚡" : p === "usecases" ? "Anwendungsfälle" : "Blog"}</button></div>)}
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, color: "rgba(255,255,255,0.4)" }}>Rechtliches</h4>
          {[["impressum", "Impressum"], ["datenschutz", "Datenschutz"], ["agb", "AGB"], ["widerruf", "Widerrufsbelehrung"]].map(([id, l]) => <div key={id}><button onClick={() => setPage(id)} style={{ display: "block", padding: "6px 0", background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{l}</button></div>)}
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, color: "rgba(255,255,255,0.4)" }}>Kontakt</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Mail size={15} /> info@csv-support.de</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><MapPin size={15} /> Bad Neuenahr-Ahrweiler</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Globe size={15} /> www.csv-support.de</div>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>© 2026 KlarBrief24 — eine Marke der ETONI UG (haftungsbeschränkt)</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.5)" }}><Heart size={14} style={{ color: brand.accent }} /> Mit Herz aus dem Ahrtal</div>
      </div>
    </div>
  </footer>;
}

// ═══════════════════════════════════════════
// MOCKUP COMPONENTS — Realistic Device Frames
// ═══════════════════════════════════════════
function PhoneMockup({ children, scale = 1 }) {
  return <div style={{ width: 260*scale, flexShrink: 0 }}>
    <div style={{ background: "#1a1a1a", borderRadius: 30*scale, padding: `${10*scale}px ${7*scale}px`, boxShadow: "0 25px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.08) inset" }}>
      <div style={{ width: 50*scale, height: 5*scale, borderRadius: 3*scale, background: "#333", margin: `0 auto ${7*scale}px` }} />
      <div style={{ background: "#fff", borderRadius: 22*scale, overflow: "hidden", height: 450*scale }}>{children}</div>
      <div style={{ height: 6*scale }} />
    </div>
  </div>;
}
function LaptopMockup({ children }) {
  return <div style={{ maxWidth: 640, margin: "0 auto" }}>
    <div style={{ background: "#2a2a2a", borderRadius: "14px 14px 0 0", padding: "6px 6px 0" }}>
      <div style={{ display: "flex", gap: 4, padding: "5px 8px", marginBottom: 3 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#febc2e" }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#28c840" }} />
        <div style={{ flex: 1, height: 14, borderRadius: 4, background: "#1a1a1a", marginLeft: 10, display: "flex", alignItems: "center", padding: "0 8px" }}>
          <span style={{ fontSize: 7, color: "#666", fontFamily: "monospace" }}>🔒 klarbrief24.de</span>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: "7px 7px 0 0", overflow: "hidden", height: 340 }}>{children}</div>
    </div>
    <div style={{ background: "linear-gradient(180deg, #e0e0e0, #ccc)", height: 14, borderRadius: "0 0 8px 8px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
  </div>;
}

// Phone Screen: Camera/Upload
function MockScreenCamera() {
  return <div style={{ height: "100%", background: brand.bg, padding: 14, fontSize: 10, fontFamily: "'DM Sans',sans-serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: brand.primary }}>KlarBrief24</span>
      <div style={{ width: 24, height: 24, borderRadius: 7, background: brand.bgMuted, display: "flex", alignItems: "center", justifyContent: "center" }}><Menu size={12} color={brand.primary} /></div>
    </div>
    <div style={{ border: `2px dashed ${brand.primary}40`, borderRadius: 12, padding: "24px 12px", textAlign: "center", background: `${brand.primary}05`, marginBottom: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${brand.primary}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}><Upload size={20} color={brand.primary} /></div>
      <div style={{ fontSize: 12, fontWeight: 700, color: brand.text, marginBottom: 2 }}>Brief hochladen</div>
      <div style={{ fontSize: 9, color: brand.textMuted }}>Foto, PDF oder Textdatei</div>
    </div>
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      <div style={{ flex: 1, padding: "9px 0", borderRadius: 8, background: brand.primary, color: "#fff", fontSize: 9, fontWeight: 700, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Camera size={11} /> Kamera</div>
      <div style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${brand.borderLight}`, background: "#fff", color: brand.textMuted, fontSize: 9, fontWeight: 600, textAlign: "center" }}>📄 Datei</div>
    </div>
    <div style={{ background: "#0f0f0f", borderRadius: 10, height: 150, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 16, border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 6 }} />
      <div style={{ width: "65%", height: "70%", background: "rgba(255,255,255,0.06)", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
        {[80,60,70,50,65].map((w,i) => <div key={i} style={{ width: `${w}%`, height: 2.5, background: `rgba(255,255,255,${0.12+i*0.03})`, borderRadius: 2 }} />)}
      </div>
      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50)", width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.9)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "rgba(255,255,255,0.85)", transform: "scale(0.82)" }} />
      </div>
    </div>
  </div>;
}

// Phone Screen: Analysis Result
function MockScreenAnalysis() {
  return <div style={{ height: "100%", background: brand.bg, padding: 14, fontSize: 10, fontFamily: "'DM Sans',sans-serif", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
      <ArrowLeft size={12} color={brand.primary} />
      <span style={{ fontSize: 12, fontWeight: 700, color: brand.text }}>Analyse-Ergebnis</span>
    </div>
    <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
      <span style={{ padding: "3px 8px", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: 8, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }}/>Dringend</span>
      <span style={{ padding: "3px 8px", borderRadius: 10, background: `${brand.info}12`, color: brand.info, fontSize: 8, fontWeight: 600 }}>Steuern</span>
      <span style={{ padding: "3px 8px", borderRadius: 10, background: `${brand.danger}08`, color: brand.danger, fontSize: 8, fontWeight: 600 }}>⏰ 15.04.2026</span>
    </div>
    <div style={{ padding: 10, background: brand.bgMuted, borderRadius: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: brand.primary, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><FileText size={10}/> KlarBrief24-Übersetzung</div>
      <div style={{ fontSize: 9, color: brand.text, lineHeight: 1.7 }}>Du musst 847,50€ an das Finanzamt nachzahlen für 2025. Frist ist der 15.04.2026. Prüfe ob die Berechnung stimmt — besonders die Werbungskosten.</div>
    </div>
    <div style={{ padding: 10, background: `${brand.accent}08`, borderRadius: 8, border: `1px solid ${brand.accent}20` }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: brand.accentHover, marginBottom: 6 }}>✅ Das musst du tun:</div>
      {["Betrag und Berechnung prüfen","Bis 15.04. zahlen oder Einspruch","Belege für Werbungskosten sammeln"].map((t,i) => (
        <div key={i} style={{ display: "flex", gap: 5, padding: "3px 0", alignItems: "flex-start" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: brand.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
          <span style={{ fontSize: 8.5, color: brand.text, lineHeight: 1.5 }}>{t}</span>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 10, padding: "8px 0", borderRadius: 8, background: brand.primary, color: "#fff", fontSize: 10, fontWeight: 700, textAlign: "center" }}>Zum Projekt hinzufügen</div>
  </div>;
}

// Phone Screen: Project Timeline
function MockScreenProject() {
  return <div style={{ height: "100%", background: brand.bg, padding: 14, fontSize: 10, fontFamily: "'DM Sans',sans-serif", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <ArrowLeft size={12} color={brand.primary} />
      <span style={{ fontSize: 8, color: brand.primary, fontWeight: 600 }}>Zurück</span>
    </div>
    <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
      <span style={{ padding: "2px 6px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontSize: 7, fontWeight: 700 }}>🔴 Dringend</span>
      <span style={{ padding: "2px 6px", borderRadius: 8, background: brand.bgMuted, color: brand.textMuted, fontSize: 7 }}>Steuern</span>
    </div>
    <div style={{ fontSize: 13, fontWeight: 800, color: brand.text, marginBottom: 2 }}>Steuerbescheid 2025</div>
    <div style={{ fontSize: 8, color: brand.textMuted, marginBottom: 8 }}>Finanzamt Bonn-Innenstadt</div>
    <div style={{ padding: 6, borderRadius: 6, background: `${brand.danger}08`, border: `1px solid ${brand.danger}20`, marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
      <Clock size={10} color={brand.danger} />
      <span style={{ fontSize: 8, fontWeight: 600, color: brand.danger }}>Frist: 15.04.2026 — 12 Tage</span>
    </div>
    <div style={{ fontSize: 10, fontWeight: 700, color: brand.text, marginBottom: 8 }}>Schriftverkehr</div>
    <div style={{ position: "relative", paddingLeft: 20 }}>
      <div style={{ position: "absolute", left: 7, top: 0, bottom: 0, width: 1.5, background: brand.borderLight }} />
      {[
        { dir: "ein", date: "10.03.2026", type: "Steuerbescheid", text: "Nachzahlung 847,50€", color: brand.info },
        { dir: "aus", date: "18.03.2026", type: "Einspruch", text: "Widerspruch Werbungskosten", color: brand.success },
        { dir: "ein", date: "28.03.2026", type: "Antwort", text: "Einspruch wird geprüft", color: brand.info },
      ].map((l, i) => (
        <div key={i} style={{ position: "relative", marginBottom: 10 }}>
          <div style={{ position: "absolute", left: -20, top: 2, width: 16, height: 16, borderRadius: "50%", background: l.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {l.dir === "ein" ? <Download size={8} color="#fff" /> : <Send size={8} color="#fff" />}
          </div>
          <div style={{ padding: 8, borderRadius: 8, background: "#fff", border: `1px solid ${brand.borderLight}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ padding: "1px 5px", borderRadius: 6, background: `${l.color}12`, color: l.color, fontSize: 7, fontWeight: 600 }}>{l.dir === "ein" ? "Eingehend" : "Ausgehend"}</span>
              <span style={{ fontSize: 7, color: brand.textMuted }}>{l.date}</span>
            </div>
            <div style={{ fontSize: 8, fontWeight: 700, color: brand.text }}>{l.type}</div>
            <div style={{ fontSize: 7, color: brand.textMuted }}>{l.text}</div>
          </div>
        </div>
      ))}
    </div>
  </div>;
}

// Phone Screen: Brief Editor
function MockScreenEditor() {
  return <div style={{ height: "100%", background: brand.bg, padding: 14, fontSize: 10, fontFamily: "'DM Sans',sans-serif", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
      <ArrowLeft size={12} color={brand.primary} />
      <span style={{ fontSize: 11, fontWeight: 700, color: brand.text }}>Antwort erstellen</span>
    </div>
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 8, fontWeight: 600, color: brand.text, marginBottom: 3 }}>Dein Anliegen:</div>
      <div style={{ padding: 8, borderRadius: 6, border: `1.5px solid ${brand.primary}40`, background: `${brand.primary}04`, fontSize: 8, color: brand.text, lineHeight: 1.5 }}>Einspruch einlegen — Werbungskosten falsch berechnet</div>
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
      {["sachlich","fordernd","freundlich"].map((t,i) => <div key={t} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${i===0?brand.primary:brand.borderLight}`, background: i===0?brand.bgMuted:"#fff", color: i===0?brand.primary:brand.textMuted, fontSize: 7, fontWeight: 600 }}>{t}</div>)}
    </div>
    <div style={{ padding: 10, borderRadius: 8, background: "#fff", border: `1px solid ${brand.borderLight}`, fontFamily: "Georgia,serif", fontSize: 7, lineHeight: 1.9, color: brand.text, marginBottom: 8 }}>
      <div style={{ marginBottom: 4 }}>Max Mustermann<br/>Musterstr. 1, 53474 Bad Neuenahr</div>
      <div style={{ marginBottom: 4, fontWeight: 600 }}>Finanzamt Bonn-Innenstadt</div>
      <div style={{ marginBottom: 4 }}>Betreff: Einspruch — StNr. 123/456/78901</div>
      <div>Sehr geehrte Damen und Herren,<br/><br/>hiermit lege ich fristgerecht Einspruch gegen den Steuerbescheid vom 10.03.2026 ein. Die Werbungskosten in Höhe von 2.340€ wurden nicht berücksichtigt...</div>
    </div>
    <div style={{ display: "flex", gap: 6 }}>
      <div style={{ flex: 1, padding: "8px 0", borderRadius: 7, background: brand.accent, color: "#fff", fontSize: 9, fontWeight: 700, textAlign: "center" }}>🖨 Drucken</div>
      <div style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1.5px solid ${brand.primary}`, color: brand.primary, fontSize: 9, fontWeight: 700, textAlign: "center" }}>📥 PDF</div>
    </div>
  </div>;
}

// Desktop Screen: Dashboard
function MockScreenDesktop() {
  return <div style={{ height: "100%", background: brand.bg, padding: 10, fontSize: 8, fontFamily: "'DM Sans',sans-serif", overflow: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px 6px", borderBottom: `1px solid ${brand.borderLight}`, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: brand.primary, display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={8} color="#fff" /></div>
        <span style={{ fontWeight: 800, color: brand.primary, fontSize: 9 }}>KlarBrief24</span>
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 7, color: brand.textMuted }}><span style={{ color: brand.primary, fontWeight: 600 }}>Dashboard</span><span>Projekte</span><span>Archiv</span><span>Einstellungen</span></div>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(135deg, ${brand.primary}, ${brand.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, color: "#fff", fontWeight: 700 }}>M</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5, marginBottom: 8 }}>
      {[{l:"Offene Projekte",v:"3",c:brand.primary},{l:"Dringend",v:"1",c:brand.danger},{l:"Briefe gesamt",v:"7",c:brand.info},{l:"Nächste Frist",v:"12 Tage",c:brand.warning}].map((s,i) => (
        <div key={i} style={{ padding: "6px 8px", borderRadius: 6, background: "#fff", border: `1px solid ${brand.borderLight}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: brand.text }}>{s.v}</div><div style={{ fontSize: 6, color: brand.textMuted }}>{s.l}</div>
        </div>
      ))}
    </div>
    <div style={{ padding: 5, borderRadius: 5, background: "#fef2f2", border: "1px solid #fca5a5", marginBottom: 6, fontSize: 7, color: "#991b1b", fontWeight: 600 }}>⚠️ 1 Projekt mit dringendem Handlungsbedarf!</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
      {[{n:"Steuerbescheid 2025",a:"rot",f:"15.04.",b:"Finanzamt Bonn"},{n:"Nebenkosten 2025",a:"gelb",f:"30.05.",b:"Hausverwaltung"},{n:"Kindergeld",a:"gruen",f:null,b:"Familienkasse"}].map((p,i) => (
        <div key={i} style={{ padding: 6, borderRadius: 6, background: "#fff", border: `1px solid ${brand.borderLight}` }}>
          <span style={{ padding: "1px 4px", borderRadius: 6, background: ampel[p.a].bg, color: ampel[p.a].text, fontSize: 6, fontWeight: 700 }}>{ampel[p.a].label}</span>
          <div style={{ fontSize: 8, fontWeight: 700, color: brand.text, marginTop: 3 }}>{p.n}</div>
          <div style={{ fontSize: 6, color: brand.textMuted }}>{p.b}</div>
          {p.f && <div style={{ fontSize: 6, color: brand.danger, marginTop: 2, fontWeight: 600 }}>Frist: {p.f}</div>}
        </div>
      ))}
    </div>
  </div>;
}

// ═══════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════
function HomePage({ setPage }) {
  const [inputMode, setInputMode] = useState("text"); // text | upload
  const [demoText, setDemoText] = useState("");
  const [fileData, setFileData] = useState(null);
  const [demoResult, setDemoResult] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);

  const exampleBrief = "Gemäß § 35 Abs. 2 SGB X wird der Verwaltungsakt vom 12.03.2026 in Gestalt des Widerspruchsbescheides vom 25.03.2026 hiermit aufgehoben. Die überzahlten Leistungen in Höhe von 1.247,50 EUR sind gemäß § 50 Abs. 1 SGB X zu erstatten.";

  const handleDemo = async () => {
    if (!demoText && !fileData) return;
    setDemoLoading(true);
    const result = await analyzeWithAI(demoText || exampleBrief, fileData);
    setDemoResult(result);
    setDemoLoading(false);
  };

  return <div>
    {/* HERO */}
    <section style={{ background: `linear-gradient(170deg, ${brand.bgMuted} 0%, ${brand.bgWarm} 50%, #fff 100%)`, padding: "80px 20px 60px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -200, right: -200, width: 500, height: 500, borderRadius: "50%", background: `${brand.primary}08` }} />
      <div style={{ position: "absolute", bottom: -150, left: -150, width: 400, height: 400, borderRadius: "50%", background: `${brand.accent}08` }} />
      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 400px", minWidth: 300 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: `${brand.primary}10`, marginBottom: 24 }}>
            <Sparkles size={16} style={{ color: brand.primary }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: brand.primary }}>KI-gestützt · Foto & PDF · DSGVO-konform</span>
          </div>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 58px)", fontWeight: 800, color: brand.text, lineHeight: 1.1, margin: "0 0 20px", letterSpacing: "-0.03em" }}>
            Behördenbriefe?<br /><span style={{ color: brand.primary }}>Endlich verstanden.</span>
          </h1>
          <p style={{ fontSize: "clamp(16px, 2.5vw, 20px)", color: brand.textMuted, lineHeight: 1.7, margin: "0 0 32px", maxWidth: 520 }}>
            Fotografiere deinen Brief oder lade ein PDF hoch. KlarBrief24 erklärt in Sekunden, was er bedeutet und was du tun musst.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Btn size="lg" variant="primary" onClick={() => setPage("register")}><Camera size={20} /> Brief scannen</Btn>
            <Btn size="lg" variant="outline" onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}>Live-Demo</Btn>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
            {[["50.000+", "Briefe analysiert"], ["4,9 ★", "Bewertung"], ["< 5 Sek.", "Analysezeit"], ["📸", "Foto + PDF"]].map(([v, l], i) => (
              <div key={i}><span style={{ fontSize: 18, fontWeight: 800, color: brand.text }}>{v}</span><br /><span style={{ fontSize: 13, color: brand.textMuted }}>{l}</span></div>
            ))}
          </div>
        </div>
        {/* Hero Phone Mockup */}
        <div style={{ flex: "0 1 280px", display: "flex", justifyContent: "center" }}>
          <PhoneMockup><MockScreenAnalysis /></PhoneMockup>
        </div>
      </div>
    </section>

    {/* HOW IT WORKS — with Mockups */}
    <section style={{ padding: "80px 20px", background: "#fff" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: brand.text, marginBottom: 12 }}>So einfach funktioniert's</h2>
        <p style={{ fontSize: 17, color: brand.textMuted, marginBottom: 48 }}>In drei Schritten vom Behördendeutsch zur klaren Handlungsanweisung</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 32 }}>
          {[
            { screen: <MockScreenCamera />, title: "1. Brief fotografieren", desc: "Handy-Kamera öffnen und Brief abfotografieren. Oder PDF hochladen. KI erkennt den Text automatisch.", color: brand.primary },
            { screen: <MockScreenAnalysis />, title: "2. KI analysiert", desc: "Sofortige Übersetzung in einfache Sprache, Ampel-Bewertung, Fristen-Erkennung und To-Do-Liste.", color: brand.accent },
            { screen: <MockScreenEditor />, title: "3. Handeln", desc: "Antwortbriefe mit KI erstellen, Frist-Erinnerungen setzen, drucken oder als PDF versenden.", color: brand.success },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ marginBottom: 20, transform: "scale(0.85)", transformOrigin: "top center" }}>
                <PhoneMockup>{s.screen}</PhoneMockup>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 15, color: brand.textMuted, lineHeight: 1.7, margin: 0, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* LIVE DEMO */}
    <section id="demo" style={{ padding: "80px 20px", background: brand.bgMuted }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: brand.text, marginBottom: 12 }}>Live-Demo: Teste KlarBrief24 jetzt</h2>
          <p style={{ fontSize: 17, color: brand.textMuted }}>Lade ein Foto/PDF hoch oder füge Text ein</p>
        </div>
        <Card style={{ padding: 32 }}>
          {/* Input Mode Toggle */}
          <div style={{ display: "flex", gap: 4, padding: 4, background: brand.bgMuted, borderRadius: 12, marginBottom: 20, width: "fit-content" }}>
            <button onClick={() => setInputMode("upload")} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: inputMode === "upload" ? brand.primary : "transparent", color: inputMode === "upload" ? "#fff" : brand.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
              <Camera size={16} /> Foto / PDF
            </button>
            <button onClick={() => setInputMode("text")} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: inputMode === "text" ? brand.primary : "transparent", color: inputMode === "text" ? "#fff" : brand.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
              <FileText size={16} /> Text eingeben
            </button>
          </div>

          {inputMode === "upload" ? (
            <FileUploader
              onFileContent={(data) => setFileData(data)}
              onTextContent={(text) => setDemoText(text)}
            />
          ) : (
            <textarea value={demoText} onChange={e => setDemoText(e.target.value)} placeholder={exampleBrief} rows={5}
              style={{ width: "100%", padding: 16, borderRadius: 12, border: `1.5px solid ${brand.borderLight}`, fontSize: 15, fontFamily: "inherit", resize: "vertical", color: brand.text, boxSizing: "border-box", outline: "none" }}
              onFocus={e => e.target.style.borderColor = brand.primary} onBlur={e => e.target.style.borderColor = brand.borderLight} />
          )}

          {/* Extracted text preview */}
          {inputMode === "upload" && demoText && (
            <div style={{ marginBottom: 16, padding: 16, background: `${brand.info}08`, borderRadius: 10, border: `1px solid ${brand.info}20` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: brand.info, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <Eye size={14} /> Erkannter Text:
              </div>
              <p style={{ fontSize: 14, color: brand.text, lineHeight: 1.6, margin: 0, maxHeight: 120, overflow: "auto" }}>{demoText}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <Btn onClick={handleDemo} style={{ flex: 1 }}>
              {demoLoading ? <><RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> Analysiere...</> : <><Zap size={18} /> Jetzt analysieren</>}
            </Btn>
            <Btn variant="outline" onClick={() => { setDemoText(""); setDemoResult(null); setFileData(null); }}>Zurücksetzen</Btn>
          </div>

          {demoResult && (
            <div style={{ marginTop: 24, animation: "fadeIn 0.4s" }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                <AmpelBadge level={demoResult.ampel} />
                <Badge color={brand.info} bg={`${brand.info}15`}>{demoResult.kategorie}</Badge>
                {demoResult.frist && <Badge color={brand.danger} bg={`${brand.danger}10`}>⏰ Frist: {demoResult.frist}</Badge>}
              </div>
              <div style={{ padding: 20, background: brand.bgMuted, borderRadius: 12, marginBottom: 16 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: brand.primary, marginTop: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><FileText size={18} /> KlarBrief24-Übersetzung</h4>
                <p style={{ fontSize: 16, color: brand.text, lineHeight: 1.7, margin: 0 }}>{demoResult.klartext}</p>
              </div>
              {demoResult.todos?.length > 0 && (
                <div style={{ padding: 20, background: `${brand.accent}08`, borderRadius: 12, border: `1px solid ${brand.accent}30` }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: brand.accentHover, marginTop: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle size={18} /> Das musst du tun:</h4>
                  {demoResult.todos.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: i < demoResult.todos.length - 1 ? `1px solid ${brand.accent}15` : "none" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: brand.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ fontSize: 15, color: brand.text, lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 20, textAlign: "center" }}>
                <Btn onClick={() => setPage("register")}>Vollzugriff freischalten — kostenlos <ArrowRight size={16} /></Btn>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>

    {/* FEATURES — Alternating with Mockups */}
    <section style={{ padding: "80px 20px", background: "#fff" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: brand.text, marginBottom: 12 }}>Alles was du brauchst</h2>
          <p style={{ fontSize: 17, color: brand.textMuted }}>Von der Foto-Analyse bis zum fertigen Antwortbrief</p>
        </div>

        {/* Feature 1: Foto & PDF */}
        <div style={{ display: "flex", alignItems: "center", gap: 48, marginBottom: 64, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: `${brand.primary}10`, marginBottom: 12 }}><Camera size={14} style={{ color: brand.primary }} /><span style={{ fontSize: 12, fontWeight: 600, color: brand.primary }}>Upload-Funktion</span></div>
            <h3 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 12px" }}>Foto & PDF Upload</h3>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: "0 0 16px" }}>Öffne die Kamera direkt in der App und fotografiere deinen Brief. Oder lade ein PDF, JPG oder PNG hoch. Drag & Drop wird auch unterstützt.</p>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: 0 }}>Die KI erkennt den Text automatisch — auch bei schiefen Fotos und schlechter Bildqualität.</p>
          </div>
          <div style={{ flex: "0 1 260px", display: "flex", justifyContent: "center" }}>
            <PhoneMockup><MockScreenCamera /></PhoneMockup>
          </div>
        </div>

        {/* Feature 2: Analyse */}
        <div style={{ display: "flex", alignItems: "center", gap: 48, marginBottom: 64, flexWrap: "wrap", flexDirection: "row-reverse" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: `${brand.info}10`, marginBottom: 12 }}><Search size={14} style={{ color: brand.info }} /><span style={{ fontSize: 12, fontWeight: 600, color: brand.info }}>KI-Analyse</span></div>
            <h3 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 12px" }}>Brief-Analyse mit Ampel</h3>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: "0 0 16px" }}>Jeder Brief bekommt eine Dringlichkeitsstufe: Rot für sofortigen Handlungsbedarf, Gelb für wichtig, Grün für rein informativ.</p>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: 0 }}>Dazu eine klare KlarBrief24-Übersetzung, extrahierte Fristen und eine konkrete To-Do-Liste.</p>
          </div>
          <div style={{ flex: "0 1 260px", display: "flex", justifyContent: "center" }}>
            <PhoneMockup><MockScreenAnalysis /></PhoneMockup>
          </div>
        </div>

        {/* Feature 3: Projekte */}
        <div style={{ display: "flex", alignItems: "center", gap: 48, marginBottom: 64, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: `${brand.accent}10`, marginBottom: 12 }}><Folder size={14} style={{ color: brand.accent }} /><span style={{ fontSize: 12, fontWeight: 600, color: brand.accent }}>Projekt-System</span></div>
            <h3 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 12px" }}>Schriftverkehr als Projekt</h3>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: "0 0 16px" }}>Jeder Vorgang wird ein eigenes Projekt: Steuerbescheid, Mietstreit, Bußgeld — mit komplettem Schriftverkehr als Timeline.</p>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: 0 }}>Eingehende und ausgehende Briefe chronologisch sortiert. Frist-Tracker, Notizen und Status auf einen Blick.</p>
          </div>
          <div style={{ flex: "0 1 260px", display: "flex", justifyContent: "center" }}>
            <PhoneMockup><MockScreenProject /></PhoneMockup>
          </div>
        </div>

        {/* Feature 4: Brief-Editor */}
        <div style={{ display: "flex", alignItems: "center", gap: 48, marginBottom: 64, flexWrap: "wrap", flexDirection: "row-reverse" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: `${brand.success}10`, marginBottom: 12 }}><Edit3 size={14} style={{ color: brand.success }} /><span style={{ fontSize: 12, fontWeight: 600, color: brand.success }}>Brief-Editor</span></div>
            <h3 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 12px" }}>KI-Antwortbriefe</h3>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: "0 0 16px" }}>Sag in einfachen Worten was du willst. Die KI erstellt einen professionellen Brief im DIN-5008-Format.</p>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: 0 }}>Wähle zwischen sachlich, fordernd oder freundlich. Direkt drucken oder als PDF speichern und versenden.</p>
          </div>
          <div style={{ flex: "0 1 260px", display: "flex", justifyContent: "center" }}>
            <PhoneMockup><MockScreenEditor /></PhoneMockup>
          </div>
        </div>
      </div>
    </section>

    {/* DESKTOP SCREENSHOT — Dashboard */}
    <section style={{ padding: "80px 20px", background: brand.bgMuted }}>
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: brand.text, marginBottom: 12 }}>Volle Kontrolle am Desktop</h2>
        <p style={{ fontSize: 17, color: brand.textMuted, marginBottom: 40 }}>Dashboard, Projekte und Verwaltung — auch am PC optimal nutzbar</p>
        <LaptopMockup><MockScreenDesktop /></LaptopMockup>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 40, flexWrap: "wrap" }}>
          {[
            { icon: Folder, label: "Projekte verwalten" },
            { icon: BarChart3, label: "Statistiken einsehen" },
            { icon: Search, label: "Archiv durchsuchen" },
            { icon: Users, label: "Familien-Modus" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${brand.primary}10`, display: "flex", alignItems: "center", justifyContent: "center" }}><f.icon size={16} style={{ color: brand.primary }} /></div>
              <span style={{ fontSize: 14, fontWeight: 600, color: brand.text }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* SOCIAL PROOF */}
    <section style={{ padding: "80px 20px", background: brand.bgWarm }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: brand.text, marginBottom: 40 }}>Das sagen unsere Nutzer</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {[
            { name: "Sandra K.", role: "Mieterin aus Köln", text: "Endlich verstehe ich meine Nebenkostenabrechnung! KlarBrief24 hat mir gezeigt, dass mein Vermieter 340€ zu viel berechnet hat." },
            { name: "Ahmed B.", role: "Selbstständiger", text: "Einfach den Steuerbescheid abfotografiert und in 5 Sekunden wusste ich was Sache ist. Genial!" },
            { name: "Maria W.", role: "Rentnerin aus München", text: "Meine Enkelin hat mir KlarBrief24 gezeigt. Jetzt kann ich meine Post vom Amt endlich selbst verstehen." },
          ].map((t, i) => (
            <Card key={i} style={{ textAlign: "left" }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>{[1,2,3,4,5].map(s => <Star key={s} size={16} fill={brand.accent} color={brand.accent} />)}</div>
              <p style={{ fontSize: 15, color: brand.text, lineHeight: 1.7, margin: "0 0 16px", fontStyle: "italic" }}>"{t.text}"</p>
              <div style={{ fontSize: 14, fontWeight: 700, color: brand.text }}>{t.name}</div>
              <div style={{ fontSize: 13, color: brand.textMuted }}>{t.role}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section style={{ padding: "80px 20px", background: `linear-gradient(135deg, ${brand.primary}, ${brand.primaryDark})`, textAlign: "center" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Brief fotografieren. Sofort verstehen.</h2>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", marginBottom: 32, lineHeight: 1.7 }}>3 Briefe pro Monat kostenlos. Kein Abo nötig.</p>
        <Btn size="lg" variant="accent" onClick={() => setPage("register")}><Camera size={20} /> Jetzt kostenlos starten</Btn>
      </div>
    </section>
  </div>;
}

// ═══════════════════════════════════════════
// FEATURES / USECASES / PRICING / BLOG / ABOUT
// ═══════════════════════════════════════════
function FeaturesPage() {
  const features = [
    { icon: Camera, title: "Foto & PDF Upload", desc: "Öffne die Kamera direkt in der App und fotografiere deinen Brief. Oder lade ein PDF, JPG oder PNG hoch. Die KI erkennt den Text automatisch — auch bei schiefen Fotos, Handschrift-Anmerkungen und schlechter Bildqualität. Drag & Drop wird ebenfalls unterstützt.", color: brand.primary },
    { icon: Search, title: "KI-Brief-Analyse", desc: "KlarBrief24 nutzt modernste KI-Technologie um Behördendeutsch Satz für Satz zu übersetzen. Fachbegriffe werden erklärt, Paragraphen aufgelöst, und der Gesamtkontext eingeordnet.", color: brand.info },
    { icon: AlertTriangle, title: "Ampel-Bewertung", desc: "Rot für sofortigen Handlungsbedarf mit Frist, Gelb für wichtig aber nicht dringend, Grün für rein informativ. So weißt du sofort, welcher Brief zuerst bearbeitet werden muss.", color: brand.danger },
    { icon: Folder, title: "Projekt-System", desc: "Jeder Vorgang wird ein eigenes Projekt mit chronologischem Schriftverkehr, eingehend und ausgehend. Komplett mit Frist-Tracking, Notizen und Dokumenten-Anhängen.", color: brand.accent },
    { icon: Edit3, title: "Brief-Editor mit KI", desc: "Sag in einfachen Worten was du willst. Die KI erstellt einen professionellen Brief im DIN-5008-Format. Wähle den Ton: sachlich, fordernd oder freundlich. Direkt drucken oder als PDF speichern.", color: brand.success },
    { icon: Clock, title: "Frist-Tracker", desc: "Alle Fristen mit Countdown. Erinnerungen 7, 3 und 1 Tag vor Ablauf. Überfällige Fristen werden rot markiert mit Konsequenz-Hinweis.", color: brand.warning },
    { icon: Layers, title: "Brief-Archiv", desc: "Alle Briefe verschlüsselt gespeichert und durchsuchbar. Volltext-Suche, Filter nach Kategorie, Absender und Datum.", color: brand.primaryLight },
    { icon: Users, title: "Familien-Modus", desc: "Separate Profile für jedes Familienmitglied. Gemeinsame Übersicht, individuelle Benachrichtigungen.", color: "#8b5cf6" },
  ];
  return <div style={{ padding: "80px 20px", maxWidth: 1100, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 60 }}>
      <h1 style={{ fontSize: 44, fontWeight: 800, color: brand.text, marginBottom: 16 }}>Funktionen</h1>
      <p style={{ fontSize: 18, color: brand.textMuted, maxWidth: 600, margin: "0 auto" }}>Von der Foto-Analyse bis zum fertigen Antwortbrief</p>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {features.map((f, i) => (
        <Card key={i} style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: `${f.color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><f.icon size={36} style={{ color: f.color }} /></div>
          <div style={{ flex: 1, minWidth: 250 }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: brand.text, marginTop: 0, marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
          </div>
        </Card>
      ))}
    </div>
  </div>;
}

function UseCasesPage({ setPage }) {
  const cases = [
    { icon: "📊", title: "Steuerbescheid verstehen", desc: "KlarBrief24 erklärt dir deinen Steuerbescheid Zeile für Zeile und zeigt ob sich ein Einspruch lohnt." },
    { icon: "🏠", title: "Nebenkostenabrechnung prüfen", desc: "Jede zweite Abrechnung ist fehlerhaft. KlarBrief24 findet überhöhte Posten und falsche Verteilschlüssel." },
    { icon: "🚗", title: "Bußgeldbescheid", desc: "Geblitzt? KlarBrief24 analysiert den Bescheid, zeigt Fehler und hilft beim Einspruch." },
    { icon: "👨‍👩‍👧", title: "Elterngeld & Kindergeld", desc: "Bewilligungsbescheide und Ablehnungen verständlich erklärt." },
    { icon: "🏥", title: "Krankenkasse lehnt ab?", desc: "Ablehnungsbescheid erklärt, professionellen Widerspruch generieren." },
    { icon: "💼", title: "Jobcenter & Arbeitsagentur", desc: "Bescheide prüfen, Berechnungen nachvollziehen, Widerspruch einlegen." },
    { icon: "📬", title: "Mahnung & Inkasso", desc: "Forderung berechtigt? KlarBrief24 prüft auf Fehler und unberechtigte Gebühren." },
    { icon: "📝", title: "Brief vom Vermieter", desc: "Mieterhöhung, Kündigung, Abmahnung — deine Rechte auf einen Blick." },
  ];
  return <div style={{ padding: "80px 20px", maxWidth: 1100, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 60 }}>
      <h1 style={{ fontSize: 44, fontWeight: 800, color: brand.text, marginBottom: 16 }}>Anwendungsfälle</h1>
      <p style={{ fontSize: 18, color: brand.textMuted }}>Für jede Art von Behördenbrief die passende Lösung</p>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
      {cases.map((c, i) => (
        <Card key={i} hover onClick={() => setPage("register")} style={{ cursor: "pointer" }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>{c.icon}</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, margin: "0 0 8px" }}>{c.title}</h3>
          <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.7, margin: "0 0 16px" }}>{c.desc}</p>
          <span style={{ fontSize: 14, fontWeight: 600, color: brand.primary, display: "flex", alignItems: "center", gap: 6 }}>Brief analysieren <ArrowRight size={14} /></span>
        </Card>
      ))}
    </div>
  </div>;
}

function PricingPage({ setPage }) {
  const [annual, setAnnual] = useState(false);
  const plans = [
    { name: "Free", price: "0", annual: "0", features: ["3 Analysen / Monat", "Foto & PDF Upload", "KlarBrief24-Übersetzung", "Ampel-Bewertung", "To-Do-Liste"], cta: "Kostenlos starten", popular: false },
    { name: "Plus", price: "4,99", annual: "39,99", features: ["Unbegrenzte Analysen", "Foto, PDF & Text", "Komplett-Archiv", "Frist-Erinnerungen", "Antwort-Assistent", "Familien-Modus (3 Pers.)"], cta: "Plus wählen", popular: true },
    { name: "Pro", price: "9,99", annual: "79,99", features: ["Alles aus Plus", "PDF-Antwortbriefe", "KI-Einspruch-Generator", "Vertragsprüfung", "Telefon-Vorbereitung", "Familien-Modus (6 Pers.)", "Priority-Support"], cta: "Pro wählen", popular: false },
  ];
  return <div style={{ padding: "80px 20px", maxWidth: 1100, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 48 }}>
      <h1 style={{ fontSize: 44, fontWeight: 800, color: brand.text, marginBottom: 16 }}>Einfache, faire Preise</h1>
      <p style={{ fontSize: 18, color: brand.textMuted, marginBottom: 24 }}>Starte kostenlos. Upgrade wenn du mehr brauchst.</p>
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: brand.bgMuted, borderRadius: 12 }}>
        <button onClick={() => setAnnual(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: !annual ? brand.primary : "transparent", color: !annual ? "#fff" : brand.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Monatlich</button>
        <button onClick={() => setAnnual(true)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: annual ? brand.primary : "transparent", color: annual ? "#fff" : brand.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Jährlich <span style={{ fontSize: 11, fontWeight: 700, color: annual ? brand.accent : brand.success, marginLeft: 4 }}>-33%</span></button>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "start" }}>
      {plans.map((p, i) => (
        <Card key={i} style={{ position: "relative", border: p.popular ? `2px solid ${brand.primary}` : `1px solid ${brand.borderLight}`, padding: 32 }}>
          {p.popular && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 16px", borderRadius: 20, background: brand.primary, color: "#fff", fontSize: 12, fontWeight: 700 }}>Beliebteste Wahl</div>}
          <h3 style={{ fontSize: 24, fontWeight: 700, color: brand.text, marginTop: p.popular ? 8 : 0 }}>{p.name}</h3>
          <div style={{ margin: "16px 0 24px" }}><span style={{ fontSize: 44, fontWeight: 800, color: brand.text }}>{annual ? p.annual : p.price}€</span><span style={{ fontSize: 15, color: brand.textMuted }}>/{annual ? "Jahr" : "Monat"}</span></div>
          <Btn variant={p.popular ? "primary" : "outline"} onClick={() => setPage("register")} style={{ width: "100%", marginBottom: 24 }}>{p.cta}</Btn>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.features.map((f, j) => <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: brand.text }}><Check size={16} style={{ color: brand.success, flexShrink: 0 }} /> {f}</div>)}
          </div>
        </Card>
      ))}
    </div>
    <div style={{ marginTop: 80, maxWidth: 700, margin: "80px auto 0" }}>
      <h2 style={{ fontSize: 32, fontWeight: 800, color: brand.text, textAlign: "center", marginBottom: 32 }}>Häufige Fragen</h2>
      {[["Kann ich jederzeit kündigen?", "Ja. Monatlich kündbar, wirksam zum Monatsende."],["Was passiert mit meinen Daten?", "30 Tage nach Kündigung vollständig gelöscht. Vorher Datenexport möglich."],["Ist KlarBrief24 eine Rechtsberatung?", "Nein. KlarBrief24 hilft beim Verstehen, ersetzt aber keinen Anwalt."],["Wo werden Daten gespeichert?", "Verschlüsselt auf Servern in Deutschland. DSGVO-konform."],["Welche Dateiformate werden unterstützt?", "Fotos (JPG, PNG), PDF-Dokumente und Textdateien. Kamera-Aufnahme direkt aus der App."]].map(([q, a], i) => <FaqItem key={i} question={q} answer={a} />)}
    </div>
  </div>;
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return <div style={{ borderBottom: `1px solid ${brand.borderLight}`, padding: "16px 0" }}>
    <button onClick={() => setOpen(!open)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: brand.text, textAlign: "left" }}>{question}</span>
      {open ? <ChevronUp size={20} color={brand.textMuted} /> : <ChevronDown size={20} color={brand.textMuted} />}
    </button>
    {open && <p style={{ margin: "12px 0 0", fontSize: 15, color: brand.textMuted, lineHeight: 1.7 }}>{answer}</p>}
  </div>;
}

function BlogPage() {
  const posts = [
    { date: "28.03.2026", cat: "Steuern", title: "Steuerbescheid verstehen: Die 5 häufigsten Fehler", excerpt: "Jeder dritte Steuerbescheid enthält Fehler. So findest du sie." },
    { date: "21.03.2026", cat: "Miete", title: "Nebenkostenabrechnung: Überhöhte Posten erkennen", excerpt: "Jede zweite Abrechnung ist fehlerhaft. Diese Checkliste hilft." },
    { date: "14.03.2026", cat: "Soziales", title: "Bürgergeld-Bescheid: Deine Rechte", excerpt: "Falsche Berechnung? So legst du Widerspruch ein." },
    { date: "07.03.2026", cat: "Versicherung", title: "Krankenkasse lehnt ab? So formulierst du den Widerspruch", excerpt: "Professionell Widerspruch einlegen — mit Musterbrief." },
    { date: "28.02.2026", cat: "Bußgeld", title: "Geblitzt! Wann lohnt sich Einspruch?", excerpt: "Nicht jeder Blitzer ist korrekt. Wann du Einspruch einlegen solltest." },
  ];
  return <div style={{ padding: "80px 20px", maxWidth: 900, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 60 }}><h1 style={{ fontSize: 44, fontWeight: 800, color: brand.text, marginBottom: 16 }}>Blog</h1><p style={{ fontSize: 18, color: brand.textMuted }}>Tipps und Ratgeber rund um Behördenbriefe</p></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {posts.map((p, i) => <Card key={i} hover style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}><Badge>{p.cat}</Badge><span style={{ fontSize: 13, color: brand.textMuted }}>{p.date}</span></div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, margin: "0 0 8px" }}>{p.title}</h3>
        <p style={{ fontSize: 15, color: brand.textMuted, lineHeight: 1.7, margin: "0 0 12px" }}>{p.excerpt}</p>
        <span style={{ fontSize: 14, fontWeight: 600, color: brand.primary, display: "flex", alignItems: "center", gap: 6 }}>Weiterlesen <ArrowRight size={14} /></span>
      </Card>)}
    </div>
  </div>;
}

function AboutPage() {
  return <div style={{ padding: "80px 20px", maxWidth: 800, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 60 }}><h1 style={{ fontSize: 44, fontWeight: 800, color: brand.text, marginBottom: 16 }}>Über KlarBrief24</h1><p style={{ fontSize: 18, color: brand.textMuted }}>Bürokratie darf keine Barriere sein.</p></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: brand.text, marginTop: 0 }}>Unsere Mission</h2>
        <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8 }}>Über die Hälfte aller Deutschen hat Schwierigkeiten, amtliche Schreiben zu verstehen. KlarBrief24 macht Schluss damit — Brief fotografieren, KI analysiert, fertig.</p>
      </Card>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: brand.text, marginTop: 0 }}>Das Team</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg, ${brand.primary}, ${brand.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", fontWeight: 700 }}>TK</div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: brand.text }}>Toni Krell</div><div style={{ fontSize: 15, color: brand.textMuted }}>Geschäftsführer & Gründer</div><div style={{ fontSize: 14, color: brand.primary, marginTop: 4 }}>ETONI UG (haftungsbeschränkt)</div></div>
        </div>
      </Card>
      <Card style={{ padding: 32, background: brand.bgMuted }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><Heart size={20} style={{ color: brand.accent }} /><h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, margin: 0 }}>Aus dem Ahrtal</h3></div>
        <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.8, margin: 0 }}>KlarBrief24 wird entwickelt in Bad Neuenahr-Ahrweiler. Technologie die das Leben einfacher macht.</p>
      </Card>
    </div>
  </div>;
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
// TOTP 2FA UTILITIES
// ═══════════════════════════════════════════
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function generateSecret(len = 20) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let secret = "";
  for (let i = 0; i < bytes.length; i++) secret += BASE32_CHARS[bytes[i] % 32];
  return secret;
}
function base32Decode(str) {
  str = str.replace(/=+$/, "").toUpperCase();
  let bits = "", bytes = [];
  for (const c of str) { const v = BASE32_CHARS.indexOf(c); if (v === -1) continue; bits += v.toString(2).padStart(5, "0"); }
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substring(i, i + 8), 2));
  return new Uint8Array(bytes);
}
async function generateTOTP(secret, timeStep = 30) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  const counterBytes = new Uint8Array(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) { counterBytes[i] = tmp & 0xff; tmp >>= 8; }
  const keyData = base32Decode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, counterBytes);
  const hmac = new Uint8Array(sig);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
  return code.toString().padStart(6, "0");
}
async function verifyTOTP(secret, inputCode) {
  // Check current and ±1 time window for clock drift
  for (const offset of [-1, 0, 1]) {
    const epoch = Math.floor(Date.now() / 1000) + offset * 30;
    const counter = Math.floor(epoch / 30);
    const counterBytes = new Uint8Array(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) { counterBytes[i] = tmp & 0xff; tmp >>= 8; }
    const keyData = base32Decode(secret);
    try {
      const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, counterBytes);
      const hmac = new Uint8Array(sig);
      const off = hmac[hmac.length - 1] & 0x0f;
      const code = ((hmac[off] & 0x7f) << 24 | hmac[off + 1] << 16 | hmac[off + 2] << 8 | hmac[off + 3]) % 1000000;
      if (code.toString().padStart(6, "0") === inputCode) return true;
    } catch { continue; }
  }
  return false;
}
function get2FAConfig(email) {
  try { const s = localStorage.getItem(`kb_2fa_${email}`); return s ? JSON.parse(s) : null; } catch { return null; }
}
function save2FAConfig(email, config) {
  localStorage.setItem(`kb_2fa_${email}`, JSON.stringify(config));
}

// ═══════════════════════════════════════════
// AUTH with 2FA
// ═══════════════════════════════════════════
function AuthPage({ mode, setPage, onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState("credentials"); // credentials | 2fa
  const [totpInput, setTotpInput] = useState("");
  const [totpError, setTotpError] = useState("");
  const [pendingUser, setPendingUser] = useState(null);

  const ADMIN_EMAIL = "info@csv-support.de";

  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const handleSubmit = async () => {
    const normEmail = email.trim().toLowerCase();
    if (!normEmail || !pass) return;
    if (mode === "register" && !name) return;
    setAuthError(""); setAuthLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await signUp(normEmail, pass, name.trim());
        if (error) { setAuthError(error.message); setAuthLoading(false); return; }
        if (!data.session) {
          setAuthError("Bitte bestätige deine E-Mail-Adresse. Ein Bestätigungslink wurde dir zugesandt.");
          setAuthLoading(false);
          return;
        }
        onLogin({ id: data.user.id, name: name.trim(), email: normEmail, isAdmin: normEmail === ADMIN_EMAIL });
        setPage("dashboard");
      } else {
        const { data, error } = await signIn(normEmail, pass);
        if (error) { setAuthError("E-Mail oder Passwort falsch."); setAuthLoading(false); return; }

        const userData = { id: data.user.id, name: data.user.user_metadata?.name || normEmail.split("@")[0], email: normEmail, isAdmin: normEmail === ADMIN_EMAIL };

        // Check if 2FA is enabled
        const twoFA = get2FAConfig(normEmail);
        if (twoFA?.enabled) {
          setPendingUser(userData);
          setStep("2fa");
          setTotpInput("");
          setTotpError("");
          setAuthLoading(false);
        } else {
          onLogin(userData);
          setPage("dashboard");
        }
      }
    } catch (e) {
      setAuthError("Verbindungsfehler. Bitte versuche es erneut.");
      setAuthLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!totpInput || totpInput.length !== 6) { setTotpError("Bitte 6-stelligen Code eingeben"); return; }
    const twoFA = get2FAConfig(email.trim().toLowerCase());
    if (!twoFA?.secret) { setTotpError("2FA-Konfiguration nicht gefunden"); return; }
    const valid = await verifyTOTP(twoFA.secret, totpInput);
    if (valid) {
      onLogin(pendingUser);
      setPage("dashboard");
    } else {
      setTotpError("Ungültiger Code. Bitte erneut versuchen.");
      setTotpInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (step === "2fa") handleVerify2FA();
      else handleSubmit();
    }
  };

  // 2FA Verification Step
  if (step === "2fa") return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: brand.bgMuted }}>
    <Card style={{ maxWidth: 420, width: "100%", padding: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${brand.primary}, ${brand.accent})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Shield size={28} color="#fff" /></div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: brand.text, margin: "0 0 4px" }}>Zwei-Faktor-Authentifizierung</h1>
        <p style={{ fontSize: 14, color: brand.textMuted, margin: 0 }}>Gib den 6-stelligen Code aus deiner Authenticator-App ein</p>
      </div>
      <div onKeyDown={handleKeyDown}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <input value={totpInput} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setTotpInput(v); setTotpError(""); }}
            placeholder="000000" maxLength={6} autoFocus
            style={{ width: 200, textAlign: "center", fontSize: 32, fontWeight: 800, letterSpacing: "0.3em", padding: "14px 16px", borderRadius: 12, border: `2px solid ${totpError ? brand.danger : brand.borderLight}`, fontFamily: "'DM Sans', monospace", color: brand.text, outline: "none", transition: "border 0.2s" }}
            onFocus={e => e.target.style.borderColor = totpError ? brand.danger : brand.primary}
            onBlur={e => e.target.style.borderColor = totpError ? brand.danger : brand.borderLight} />
        </div>
        {totpError && <p style={{ textAlign: "center", color: brand.danger, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{totpError}</p>}
      </div>
      <Btn onClick={handleVerify2FA} style={{ width: "100%", marginBottom: 12 }}><Shield size={16} /> Verifizieren</Btn>
      <button onClick={() => { setStep("credentials"); setTotpInput(""); setTotpError(""); setPendingUser(null); }}
        style={{ width: "100%", padding: "10px 0", background: "none", border: "none", color: brand.textMuted, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
        ← Zurück zum Login
      </button>
    </Card>
  </div>;

  // Normal Login/Register
  return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: brand.bgMuted }}>
    <Card style={{ maxWidth: 440, width: "100%", padding: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <img src="/logo.png" alt="KlarBrief24" style={{ height: 48, width: "auto", margin: "0 auto 16px", display: "block" }} />
        <h1 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 4px" }}>{mode === "login" ? "Willkommen zurück" : "Account erstellen"}</h1>
        <p style={{ fontSize: 15, color: brand.textMuted, margin: 0 }}>{mode === "login" ? "Melde dich bei KlarBrief24 an" : "3 kostenlose Analysen — sofort los"}</p>
      </div>
      <button onClick={() => alert("Google-Login wird bald verfügbar sein. Bitte registriere dich mit E-Mail und Passwort.")} style={{ width: "100%", padding: "12px 20px", borderRadius: 10, border: `1.5px solid ${brand.borderLight}`, background: "#f9fafb", color: brand.textMuted, fontWeight: 600, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24, fontFamily: "inherit", position: "relative" }}>
        <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Mit Google {mode === "login" ? "anmelden" : "registrieren"}
        <span style={{ position: "absolute", top: -8, right: -8, padding: "2px 8px", borderRadius: 10, background: brand.accent, color: "#fff", fontSize: 10, fontWeight: 700 }}>Bald</span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 24px" }}><div style={{ flex: 1, height: 1, background: brand.borderLight }} /><span style={{ fontSize: 13, color: brand.textMuted }}>oder mit E-Mail</span><div style={{ flex: 1, height: 1, background: brand.borderLight }} /></div>
      <div onKeyDown={handleKeyDown}>
      {mode === "register" && <Input label="Name" value={name} onChange={setName} placeholder="Dein Name" icon={Users} />}
      <Input label="E-Mail" type="email" value={email} onChange={setEmail} placeholder="name@beispiel.de" icon={Mail} />
      <Input label="Passwort" type="password" value={pass} onChange={setPass} placeholder="••••••••" icon={Lock} />
      </div>
      {authError && <div style={{ padding: 12, borderRadius: 8, background: `${brand.danger}10`, border: `1px solid ${brand.danger}30`, marginBottom: 12, color: brand.danger, fontSize: 13, fontWeight: 600, textAlign: "center" }}>{authError}</div>}
      <Btn onClick={handleSubmit} disabled={authLoading} style={{ width: "100%", marginTop: 8, opacity: authLoading ? 0.6 : 1 }}>{authLoading ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Einen Moment...</> : (mode === "login" ? "Anmelden" : "Kostenlos registrieren")}</Btn>
      <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: brand.textMuted }}>
        {mode === "login" ? "Noch kein Account? " : "Bereits registriert? "}
        <span onClick={() => setPage(mode === "login" ? "register" : "login")} style={{ color: brand.primary, fontWeight: 600, cursor: "pointer" }}>{mode === "login" ? "Registrieren" : "Anmelden"}</span>
      </p>
    </Card>
  </div>;
}

// ═══════════════════════════════════════════
// 2FA SETUP COMPONENT
// ═══════════════════════════════════════════
function TwoFactorSetup({ email }) {
  const [config, setConfig] = useState(() => get2FAConfig(email));
  const [setupStep, setSetupStep] = useState("idle"); // idle | setup | verify
  const [secret, setSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");

  const isEnabled = config?.enabled;

  const startSetup = () => {
    const newSecret = generateSecret(20);
    setSecret(newSecret);
    setSetupStep("setup");
    setVerifyCode("");
    setError("");
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) { setError("Bitte 6-stelligen Code eingeben"); return; }
    const valid = await verifyTOTP(secret, verifyCode);
    if (valid) {
      const newConfig = { enabled: true, secret, enabledAt: new Date().toISOString() };
      save2FAConfig(email, newConfig);
      setConfig(newConfig);
      setSetupStep("idle");
      setError("");
      alert("2FA erfolgreich aktiviert! Ab dem nächsten Login wird der Code abgefragt.");
    } else {
      setError("Ungültiger Code. Bitte prüfe die Uhrzeit deines Geräts und versuche es erneut.");
      setVerifyCode("");
    }
  };

  const handleDisable = () => {
    if (confirm("Zwei-Faktor-Authentifizierung wirklich deaktivieren? Dein Account ist dann weniger geschützt.")) {
      save2FAConfig(email, { enabled: false });
      setConfig({ enabled: false });
      setSetupStep("idle");
    }
  };

  const otpauthUrl = `otpauth://totp/KlarBrief24:${encodeURIComponent(email)}?secret=${secret}&issuer=KlarBrief24&digits=6&period=30`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

  if (isEnabled && setupStep === "idle") {
    return <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, background: `${brand.success}08`, border: `1px solid ${brand.success}25`, marginBottom: 16 }}>
        <Shield size={20} style={{ color: brand.success }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: brand.success }}>2FA ist aktiviert</div>
          <div style={{ fontSize: 12, color: brand.textMuted }}>Dein Account ist durch Zwei-Faktor-Authentifizierung geschützt</div>
        </div>
      </div>
      <Btn variant="outline" size="sm" onClick={handleDisable}><Shield size={14} /> 2FA deaktivieren</Btn>
    </div>;
  }

  if (setupStep === "setup") {
    return <div>
      <div style={{ padding: 20, borderRadius: 12, background: brand.bgMuted, marginBottom: 16 }}>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: brand.text, margin: "0 0 12px" }}>Schritt 1: Authenticator-App einrichten</h4>
        <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: "0 0 16px" }}>
          Scanne den QR-Code mit deiner Authenticator-App (Google Authenticator, Authy, Microsoft Authenticator oder ähnliche).
        </p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${brand.borderLight}`, background: "#fff", padding: 8 }}>
            <img src={qrUrl} alt="2FA QR Code" width={180} height={180} style={{ display: "block" }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 13, color: brand.textMuted, margin: "0 0 8px" }}>Oder gib diesen Schlüssel manuell ein:</p>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fff", border: `1px solid ${brand.borderLight}`, fontFamily: "monospace", fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", color: brand.text, wordBreak: "break-all", marginBottom: 8 }}>
              {secret.match(/.{1,4}/g)?.join(" ")}
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(secret); }} style={{ fontSize: 12, color: brand.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Schlüssel kopieren</button>
          </div>
        </div>
      </div>

      <div style={{ padding: 20, borderRadius: 12, background: "#fff", border: `1px solid ${brand.borderLight}` }}>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: brand.text, margin: "0 0 8px" }}>Schritt 2: Code verifizieren</h4>
        <p style={{ fontSize: 14, color: brand.textMuted, margin: "0 0 16px" }}>Gib den 6-stelligen Code aus deiner Authenticator-App ein:</p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <input value={verifyCode} onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter") handleVerify(); }}
            placeholder="000000" maxLength={6}
            style={{ width: 160, textAlign: "center", fontSize: 24, fontWeight: 800, letterSpacing: "0.25em", padding: "12px 14px", borderRadius: 10, border: `2px solid ${error ? brand.danger : brand.borderLight}`, fontFamily: "'DM Sans', monospace", color: brand.text, outline: "none" }} />
          <Btn onClick={handleVerify}>Aktivieren</Btn>
        </div>
        {error && <p style={{ color: brand.danger, fontSize: 13, fontWeight: 600, marginTop: 8 }}>{error}</p>}
      </div>

      <button onClick={() => setSetupStep("idle")} style={{ marginTop: 12, fontSize: 13, color: brand.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Abbrechen</button>
    </div>;
  }

  // Not enabled, idle
  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, background: `${brand.warning}08`, border: `1px solid ${brand.warning}25`, marginBottom: 16 }}>
      <AlertTriangle size={20} style={{ color: brand.warning }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: brand.accentHover }}>2FA ist nicht aktiviert</div>
        <div style={{ fontSize: 12, color: brand.textMuted }}>Aktiviere 2FA für zusätzliche Sicherheit</div>
      </div>
    </div>
    <Btn size="sm" onClick={startSetup}><Shield size={14} /> 2FA jetzt einrichten</Btn>
  </div>;
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
function DashboardPage({ user, setUser, setPage }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [view, setView] = useState("overview");
  const [npName, setNpName] = useState(""); const [npCat, setNpCat] = useState("Steuern");
  const [analyzeText, setAnalyzeText] = useState(""); const [analyzeResult, setAnalyzeResult] = useState(null); const [analyzing, setAnalyzing] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [editorIntent, setEditorIntent] = useState(""); const [editorTone, setEditorTone] = useState("sachlich"); const [editorResult, setEditorResult] = useState(""); const [editorLoading, setEditorLoading] = useState(false);
  const [editorAktenzeichen, setEditorAktenzeichen] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refineLoading, setRefineLoading] = useState(false);
  const [letterSaved, setLetterSaved] = useState(false);
  const [showDocument, setShowDocument] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile loaded from Supabase
  const [profile, setProfile] = useState({
    vorname: "", nachname: "", strasse: "", plz: "", ort: "",
    email: user?.email || "", telefon: "", plan: "free",
  });

  // ── Load initial data from Supabase ──
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      try {
        const [profileRes, projectsRes] = await Promise.all([
          getProfile(user.id),
          getProjects(user.id),
        ]);
        if (!mounted) return;

        // Critical: If profile doesn't exist, the trigger failed.
        // Try to create it manually so projects can be saved.
        if (!profileRes.data && !profileRes.error?.code === "PGRST116") {
          console.warn("Profile missing — attempting manual creation");
          try {
            await supabase.from('profiles').insert([{
              id: user.id,
              email: user.email,
              is_admin: user.email === "info@csv-support.de",
            }]);
            const retry = await getProfile(user.id);
            if (retry.data) profileRes.data = retry.data;
          } catch (e) { console.error("Manual profile creation failed:", e); }
        }

        if (profileRes.data) {
          setProfile({
            vorname: profileRes.data.vorname || user?.name?.split(" ")[0] || "",
            nachname: profileRes.data.nachname || user?.name?.split(" ").slice(1).join(" ") || "",
            strasse: profileRes.data.strasse || "",
            plz: profileRes.data.plz || "",
            ort: profileRes.data.ort || "",
            email: profileRes.data.email || user.email,
            telefon: profileRes.data.telefon || "",
            plan: profileRes.data.plan || "free",
            mollieCustomerId: profileRes.data.mollie_customer_id || null,
            mollieSubscription: profileRes.data.subscription_active ? { active: true, subscriptionId: profileRes.data.mollie_subscription_id, nextPaymentDate: profileRes.data.next_payment_date } : null,
          });
        } else {
          console.error("⚠️ KEIN PROFIL GEFUNDEN für User", user.id, "— Speicherung wird fehlschlagen!");
        }
        if (projectsRes.error) {
          console.error("⚠️ Projekte konnten nicht geladen werden:", projectsRes.error);
          alert("Projekte konnten nicht aus der Datenbank geladen werden.\n\nFehler: " + (projectsRes.error.message || JSON.stringify(projectsRes.error)) + "\n\nBitte prüfe die Supabase-Verbindung.");
        }
        if (projectsRes.data) {
          setProjects(projectsRes.data.map(p => ({
            ...p,
            referenzen: p.referenzen || [],
            letters: p.letters || [],
          })));
        }
      } catch (e) {
        console.error("Load error:", e);
        alert("Fehler beim Laden der Daten: " + e.message);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // ── Persist profile to Supabase on change ──
  const updateProfile = async (key, val) => {
    const updated = { ...profile, [key]: val };
    setProfile(updated);
    if (user?.id) {
      const dbField = { vorname: "vorname", nachname: "nachname", strasse: "strasse", plz: "plz", ort: "ort", telefon: "telefon", plan: "plan", mollieCustomerId: "mollie_customer_id" }[key];
      if (dbField) { try { await dbUpdateProfile(user.id, { [dbField]: val }); } catch {} }
      else if (key === "mollieSubscription") {
        try { await dbUpdateProfile(user.id, { subscription_active: val?.active || false, mollie_subscription_id: val?.subscriptionId || null, next_payment_date: val?.nextPaymentDate || null }); } catch {}
      }
    }
  };

  // ── Usage Tracking & Limits ──
  const PLAN_LIMITS = { free: 3, plus: Infinity, pro: Infinity, business: Infinity, lifetime: Infinity };
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [monthlyCount, setMonthlyCount] = useState(0);
  const planLimit = PLAN_LIMITS[profile.plan] || 3;
  const canAnalyze = monthlyCount < planLimit;
  const remainingAnalyses = Math.max(0, planLimit - monthlyCount);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getUsageForMonth(user.id, currentMonth).then(({ count }) => setMonthlyCount(count));
  }, [user?.id, currentMonth]);

  const incrementUsage = async () => {
    setMonthlyCount(c => c + 1);
    if (user?.id) { try { await dbIncrementUsage(user.id, currentMonth); } catch {} }
  };

  // Handle return from Mollie checkout
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("payment-success")) {
      const params = new URLSearchParams(hash.split("?")[1] || "");
      const plan = params.get("plan");
      const customerId = params.get("customerId");
      if (plan && customerId) {
        updateProfile("plan", plan);
        updateProfile("mollieCustomerId", customerId);
        updateProfile("pendingPlan", null);
        // Check subscription status after short delay (webhook needs time)
        setTimeout(async () => {
          try {
            const resp = await fetch("/api/mollie/status", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ customerId }),
            });
            const data = await resp.json();
            if (data.active) {
              updateProfile("mollieSubscription", { active: true, subscriptionId: data.subscriptionId, nextPaymentDate: data.nextPaymentDate });
            }
          } catch (e) { console.warn("Status check failed:", e); }
        }, 3000);
        window.location.hash = "";
        alert("Zahlung erfolgreich! Dein " + (plan === "pro" ? "Pro" : "Plus") + "-Abo ist jetzt aktiv.");
      }
    }
  }, []);

  // Periodic subscription status check (on mount)
  useEffect(() => {
    if (profile.mollieCustomerId && profile.plan !== "free") {
      fetch("/api/mollie/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: profile.mollieCustomerId }),
      }).then(r => r.json()).then(data => {
        if (data.active) {
          updateProfile("mollieSubscription", { active: true, subscriptionId: data.subscriptionId, nextPaymentDate: data.nextPaymentDate });
        } else if (!data.active && profile.mollieSubscription?.active) {
          updateProfile("mollieSubscription", { active: false });
          updateProfile("plan", "free");
        }
      }).catch(() => {});
    }
  }, []);
  const fullName = `${profile.vorname} ${profile.nachname}`.trim() || user?.name || "Nutzer";
  const fullAddress = [profile.strasse, `${profile.plz} ${profile.ort}`].filter(s => s.trim()).join("\n");

  const handleGenerateLetter = async () => {
    if (!editorIntent.trim()) return;
    setEditorLoading(true);
    const senderBlock = fullAddress
      ? `${fullName}\n${fullAddress}${profile.telefon ? "\nTel.: " + profile.telefon : ""}\nE-Mail: ${profile.email}`
      : `${fullName}\n[Adresse in Einstellungen hinterlegen]\nE-Mail: ${profile.email}`;
    const empfaenger = activeProject?.behoerde || "[Empfänger]";
    const akz = editorAktenzeichen || activeProject?.aktenzeichen || "";
    const datum = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const projectCtx = activeProject ? `\nPROJEKT: ${activeProject.name}, Behörde: ${activeProject.behoerde}, Aktenzeichen: ${akz || "unbekannt"}\nSchriftverkehr: ${activeProject.letters.map(l => `${l.date}: ${l.direction} — ${l.summary}`).join("; ")}` : "";

    const sysPrompt = `Du bist KlarBrief24, ein professioneller Briefgenerator für Behördenkorrespondenz.

STRIKTE FORMAT-VORGABEN (DIN 5008):
1. ABSENDER (oben links): ${senderBlock}
2. EMPFÄNGER: ${empfaenger}
3. DATUM (rechtsbündig): ${datum}
4. ZEICHEN: ${akz ? "Ihr Zeichen: " + akz : "Wenn Aktenzeichen bekannt, IMMER als 'Ihr Zeichen:' aufführen"}
5. BETREFF: Immer konkrete Betreffzeile mit Bezug zum Vorgang
6. ANREDE: "Sehr geehrte Damen und Herren,"
7. BRIEFTEXT:
   - Sachlich, klar, professionell
   - IMMER Rechtsgrundlagen und §§ wo anwendbar (z.B. § 33 AO, § 70 SGG, § 556 BGB, § 355 BGB, § 536 BGB)
   - Bei Widersprüchen: Rechtsbehelf benennen, Frist referenzieren
   - Konkretes Ergebnis fordern
   - Antwortfrist setzen (14 Tage üblich)
   - Hinweis auf Rechtsbehelfsbelehrung wo zutreffend
8. GRUSSFORMEL: "Mit freundlichen Grüßen" + Name
9. ANLAGEN: wenn relevant
STIL: ${editorTone === "sachlich" ? "Formal, nüchtern, respektvoll" : editorTone === "fordernd" ? "Bestimmt, mit Nachdruck, Fristsetzungen und Konsequenzen" : "Freundlich, kooperativ, lösungsorientiert"}
${projectCtx}
NUR fertigen Brieftext ausgeben. Kein JSON, kein Markdown außer **Betreff:**. Aktenzeichen der Gegenseite MUSS referenziert werden.`;

    try {
      const resp = await fetch("/api/anthropic", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1500, system: sysPrompt,
          messages: [{ role: "user", content: `Erstelle einen professionellen Brief. Anliegen: ${editorIntent}` }] })
      });
      const data = await resp.json();
      setEditorResult(data.content?.[0]?.text || "Brief konnte nicht generiert werden.");
      setLetterSaved(false);
    } catch {
      setEditorResult(`${senderBlock}\n\n${empfaenger}\n\n${datum}\n${akz ? "Ihr Zeichen: " + akz + "\n" : ""}\n**Betreff: ${editorIntent}**\n\nSehr geehrte Damen und Herren,\n\nhiermit möchte ich ${editorIntent.toLowerCase()}.\n\nIch bitte um Bearbeitung innerhalb von 14 Tagen.\n\nMit freundlichen Grüßen\n\n${fullName}`);
      setLetterSaved(false);
    }
    setEditorLoading(false);
  };

  const handleRefineLetter = async () => {
    if (!refineInstruction.trim() || !editorResult) return;
    setRefineLoading(true);
    const sysPrompt = `Du bist KlarBrief24, ein professioneller Briefgenerator. Du bekommst einen bestehenden Brief und eine Änderungsanweisung. Gib den überarbeiteten Brief im gleichen DIN-5008-Format zurück. NUR den fertigen Brieftext, kein Markdown außer **Betreff:**, keine Erklärungen.`;
    try {
      const resp = await fetch("/api/anthropic", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1500, system: sysPrompt,
          messages: [{ role: "user", content: `Hier ist der bestehende Brief:\n\n${editorResult}\n\n---\n\nÄnderungswunsch: ${refineInstruction}\n\nGib den überarbeiteten Brief zurück.` }] })
      });
      const data = await resp.json();
      const newText = data.content?.[0]?.text;
      if (newText) {
        setEditorResult(newText);
        setRefineInstruction("");
        setLetterSaved(false);
      }
    } catch (e) { alert("Fehler bei der Überarbeitung. Bitte versuche es erneut."); }
    setRefineLoading(false);
  };

  const handleSaveLetterToProject = async () => {
    if (!editorResult || !activeProject) return;
    // Extract betreff from letter (looks for "**Betreff:" or "Betreff:")
    const betreffMatch = editorResult.match(/\*?\*?Betreff:\*?\*?\s*([^\n]+)/i);
    const betreff = betreffMatch ? betreffMatch[1].replace(/\*+/g, "").trim() : `Antwort an ${activeProject.behoerde}`;

    const newLetter = {
      id: Date.now(),
      date: new Date().toLocaleDateString("de-DE"),
      direction: "ausgehend",
      type: "Antwortschreiben",
      summary: editorResult.substring(0, 200) + (editorResult.length > 200 ? "..." : ""),
      betreff,
      letterText: editorResult,
      analyzed: false,
      document: null,
      originalText: null,
    };

    const updatedLetters = [...activeProject.letters, newLetter];
    const updatedProject = { ...activeProject, letters: updatedLetters };
    setProjects(projects.map(p => p.id === activeProject.id ? updatedProject : p));
    setActiveProject(updatedProject);

    if (user?.id) {
      // Strip base64 from existing letters for DB
      const dbLetters = updatedLetters.map(l => ({ ...l, document: l.document ? { mediaType: l.document.mediaType, isImage: l.document.isImage, isPdf: l.document.isPdf, fileName: l.document.fileName } : null }));
      try { await dbUpdateProject(activeProject.id, { letters: dbLetters }); } catch (e) { console.warn("Save letter failed:", e); }
    }
    setLetterSaved(true);
  };

  const [savedToProject, setSavedToProject] = useState(null);

  const findMatchingProject = (result) => {
    if (!result?.behoerde || !result?.betreff) return null;
    const rBehoerde = result.behoerde.toLowerCase().trim();
    const rBetreff = result.betreff.toLowerCase().trim();
    const rTyp = (result.dokumenttyp || "").toLowerCase();
    const rAkz = (result.aktenzeichen || "").toLowerCase().trim();

    return projects.find(p => {
      const pBehoerde = (p.behoerde || "").toLowerCase().trim();
      const pName = (p.name || "").toLowerCase();
      const pAkz = (p.aktenzeichen || "").toLowerCase().trim();

      // Rule 1: If same Aktenzeichen exists and is not empty → same project
      if (rAkz && pAkz && rAkz === pAkz) return true;

      // Rule 2: Behörde must match (strict)
      const behoerdeMatch = pBehoerde === rBehoerde ||
        (pBehoerde.length > 5 && rBehoerde.length > 5 && (pBehoerde.includes(rBehoerde) || rBehoerde.includes(pBehoerde)));
      if (!behoerdeMatch) return false;

      // Rule 3: Even with same Behörde, the subject/betreff must be similar
      // Extract key terms from betreff (remove common filler words)
      const stopWords = ["der","die","das","ein","eine","für","von","vom","und","über","zur","zum","auf","aus","mit","nach","bei","bis","in","an","am","im"];
      const getKeyWords = (str) => str.split(/[\s,.\-—–\/]+/).filter(w => w.length > 2 && !stopWords.includes(w));
      const rKeyWords = getKeyWords(rBetreff);
      const pKeyWords = getKeyWords(pName);

      // Need at least 2 matching key words for same-subject match
      const keyWordOverlap = rKeyWords.filter(rw => pKeyWords.some(pw => pw.includes(rw) || rw.includes(pw)));
      if (keyWordOverlap.length >= 2) return true;

      // Rule 4: Same Behörde + same Dokumenttyp + very recent (within same month) → might be follow-up
      // But only for Bescheide/Mahnungen, NOT for Rechnungen (each Rechnung = own project)
      if (rTyp === "rechnung" || rTyp === "vertrag" || rTyp === "angebot") return false;

      return false;
    });
  };

  const handleAnalyze = async () => {
    if (!analyzeText.trim() && !fileData) return;
    if (!canAnalyze) { setShowUpgrade(true); return; }
    if (!user?.id) { alert("Bitte melde dich an um Briefe zu speichern."); return; }
    setAnalyzing(true); setSavedToProject(null);

    let result;
    try {
      result = await analyzeWithAI(analyzeText, fileData);
    } catch (e) {
      console.error("Analysis failed:", e);
      alert("Analyse fehlgeschlagen: " + e.message);
      setAnalyzing(false);
      return;
    }
    setAnalyzeResult(result);

    if (result) {
      try { await incrementUsage(); } catch (e) { console.warn("Usage tracking failed:", e); }

      const nl = {
        id: Date.now(), date: new Date().toLocaleDateString("de-DE"), direction: "eingehend",
        type: result.dokumenttyp || result.kategorie || "Brief", summary: result.klartext, analyzed: true,
        betreff: result.betreff || null,
        document: fileData ? { base64: fileData.base64, mediaType: fileData.mediaType, isImage: fileData.isImage, isPdf: fileData.isPdf, fileName: fileData.fileName || "Dokument" } : null,
        originalText: analyzeText || null,
      };
      const nlForDb = { ...nl, document: nl.document ? { mediaType: nl.document.mediaType, isImage: nl.document.isImage, isPdf: nl.document.isPdf, fileName: nl.document.fileName } : null };

      try {
        if (activeProject) {
          const stateFields = { letters: [...activeProject.letters, nl], ampel: result.ampel, frist: result.frist || activeProject.frist, behoerde: result.behoerde || activeProject.behoerde, aktenzeichen: result.aktenzeichen || activeProject.aktenzeichen || "", referenzen: [...(activeProject.referenzen || []), ...(result.referenzen || [])].filter((v, i, a) => a.indexOf(v) === i) };
          const dbFields = { ...stateFields, letters: [...(activeProject.letters || []).map(l => ({ ...l, document: l.document ? { mediaType: l.document.mediaType, isImage: l.document.isImage, isPdf: l.document.isPdf, fileName: l.document.fileName } : null })), nlForDb] };

          const { error } = await dbUpdateProject(activeProject.id, dbFields);
          if (error) {
            console.error("DB save failed:", error);
            alert("⚠️ Speicherung fehlgeschlagen!\n\nFehler: " + (error.message || JSON.stringify(error)) + "\n\nDer Brief ist nur lokal gespeichert und geht beim Reload verloren!");
          }
          setProjects(projects.map(p => p.id === activeProject.id ? { ...p, ...stateFields } : p));
          setActiveProject(prev => ({ ...prev, ...stateFields }));
          setSavedToProject(activeProject);
        } else {
          const match = findMatchingProject(result);
          if (match) {
            const stateFields = { letters: [...match.letters, nl], ampel: result.ampel, frist: result.frist || match.frist, behoerde: result.behoerde || match.behoerde, aktenzeichen: result.aktenzeichen || match.aktenzeichen || "", referenzen: [...(match.referenzen || []), ...(result.referenzen || [])].filter((v, i, a) => a.indexOf(v) === i) };
            const dbFields = { ...stateFields, letters: [...(match.letters || []).map(l => ({ ...l, document: l.document ? { mediaType: l.document.mediaType, isImage: l.document.isImage, isPdf: l.document.isPdf, fileName: l.document.fileName } : null })), nlForDb] };

            const { error } = await dbUpdateProject(match.id, dbFields);
            if (error) {
              console.error("DB save failed:", error);
              alert("⚠️ Speicherung fehlgeschlagen!\n\nFehler: " + (error.message || JSON.stringify(error)));
            }
            setProjects(projects.map(p => p.id === match.id ? { ...p, ...stateFields } : p));
            setSavedToProject(match);
          } else {
            const newProject = {
              name: result.projektname || (result.betreff ? `${result.betreff}` : `${result.dokumenttyp || result.kategorie} — ${result.behoerde}`),
              category: result.kategorie || "Sonstiges",
              status: "offen", ampel: result.ampel || "gelb",
              behoerde: result.behoerde || "Unbekannt",
              frist: result.frist || null, aktenzeichen: result.aktenzeichen || "", referenzen: result.referenzen || [],
              dokumenttyp: result.dokumenttyp || null,
              letters: [nlForDb],
            };
            const { data, error } = await dbCreateProject(user.id, newProject);
            if (data) {
              const saved = { ...data, referenzen: data.referenzen || [], letters: [nl] };
              setProjects(prev => [saved, ...prev]);
              setSavedToProject(saved);
            } else {
              const errMsg = error?.message || error?.code || JSON.stringify(error) || "Unbekannter Fehler";
              console.error("DB create failed:", error);
              alert("⚠️ Projekt konnte nicht in der Datenbank gespeichert werden!\n\nFehler: " + errMsg + "\n\nMögliche Ursachen:\n• Supabase ENV-Variablen fehlen in Vercel\n• RLS-Policies in Supabase nicht korrekt\n• User-Profil nicht angelegt (Trigger-Problem)\n\nDer Brief geht beim Reload verloren!");
              // Show in UI but mark as local
              const local = { ...newProject, id: "LOCAL_" + Date.now(), letters: [nl], _isLocal: true };
              setProjects(prev => [local, ...prev]);
              setSavedToProject(local);
            }
          }
        }
      } catch (e) {
        console.error("Project save error:", e);
        alert("⚠️ Schwerer Fehler beim Speichern: " + e.message);
      }
    }
    setAnalyzing(false);
  };

  const createProject = async () => {
    if (!npName) return;
    const newProject = { name: npName, category: npCat, status: "offen", ampel: "gruen", behoerde: "Noch nicht zugeordnet", frist: null, aktenzeichen: "", referenzen: [], letters: [] };
    if (user?.id) {
      const { data } = await dbCreateProject(user.id, newProject);
      if (data) {
        const saved = { ...data, referenzen: data.referenzen || [], letters: data.letters || [] };
        setProjects([saved, ...projects]);
        setActiveProject(saved);
      }
    } else {
      const local = { ...newProject, id: Date.now() };
      setProjects([local, ...projects]);
      setActiveProject(local);
    }
    setNpName("");
    setShowNewProject(false);
    setView("project");
  };

  const dashTabs = [["overview","Übersicht"],["settings","Einstellungen"]];

  // ═══ SETTINGS ═══
  if (view === "settings") return <div style={{ padding: "32px 20px", maxWidth: 900, margin: "0 auto" }}>
    <h1 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 4px" }}>Einstellungen</h1>
    <p style={{ fontSize: 15, color: brand.textMuted, margin: "0 0 24px" }}>Profil, Absender-Daten und Abo verwalten</p>
    <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
      {dashTabs.map(([id, l]) => <button key={id} onClick={() => setView(id)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: view === id ? brand.primary : "transparent", color: view === id ? "#fff" : brand.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
    </div>
    <Card style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, marginTop: 0, marginBottom: 4 }}>Persönliche Daten & Absender</h3>
      <p style={{ fontSize: 14, color: brand.textMuted, marginBottom: 20 }}>Diese Daten werden als Absender in deinen Briefen verwendet (DIN 5008).</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Input label="Vorname" value={profile.vorname} onChange={v => updateProfile("vorname", v)} placeholder="Max" icon={Users} />
        <Input label="Nachname" value={profile.nachname} onChange={v => updateProfile("nachname", v)} placeholder="Mustermann" icon={Users} />
      </div>
      <Input label="Straße und Hausnummer" value={profile.strasse} onChange={v => updateProfile("strasse", v)} placeholder="Musterstraße 1" icon={MapPin} />
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0 16px" }}>
        <Input label="PLZ" value={profile.plz} onChange={v => updateProfile("plz", v)} placeholder="53474" />
        <Input label="Ort" value={profile.ort} onChange={v => updateProfile("ort", v)} placeholder="Bad Neuenahr-Ahrweiler" icon={MapPin} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Input label="E-Mail" type="email" value={profile.email} onChange={v => updateProfile("email", v)} placeholder="name@beispiel.de" icon={Mail} />
        <Input label="Telefon (optional)" value={profile.telefon} onChange={v => updateProfile("telefon", v)} placeholder="+49 123 456789" icon={Phone} />
      </div>
      <Btn onClick={() => { setUser?.({ ...user, name: fullName, email: profile.email }); alert("Profil gespeichert!"); }}>Profil speichern</Btn>
      {!profile.strasse && <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: `${brand.warning}10`, border: `1px solid ${brand.warning}30`, display: "flex", alignItems: "center", gap: 10 }}><AlertTriangle size={16} style={{ color: brand.warning }} /><span style={{ fontSize: 13, color: brand.accentHover }}>Bitte hinterlege deine Adresse für den Briefversand.</span></div>}
    </Card>
    <Card style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, marginTop: 0, marginBottom: 20 }}>Abo-Verwaltung</h3>
      {profile.mollieSubscription?.active && (
        <div style={{ padding: 14, borderRadius: 10, background: `${brand.success}08`, border: `1px solid ${brand.success}25`, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle size={18} style={{ color: brand.success }} />
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: brand.success }}>Abo aktiv: {profile.plan === "pro" ? "Pro" : profile.plan === "business" ? "Business" : "Plus"}</span>
            {profile.mollieSubscription.nextPaymentDate && <div style={{ fontSize: 12, color: brand.textMuted }}>Nächste Abbuchung: {profile.mollieSubscription.nextPaymentDate}</div>}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[{ id: "free", name: "Free", price: "0€", desc: "3 Analysen/Monat", mo: "" },{ id: "plus", name: "Plus", price: "4,99€", desc: "Unbegrenzt + Archiv", mo: "/Monat" },{ id: "pro", name: "Pro", price: "9,99€", desc: "Alles + Briefe + Vertragsprüfung", mo: "/Monat" },{ id: "lifetime", name: "Lifetime ⚡", price: "59€", desc: "Einmalzahlung — für immer", mo: " einmalig" }].map(p => (
          <div key={p.id} style={{ flex: "1 1 160px", padding: 16, borderRadius: 12, border: profile.plan === p.id ? `2px solid ${brand.primary}` : `1.5px solid ${brand.borderLight}`, background: profile.plan === p.id ? brand.bgMuted : "#fff", position: "relative" }}>
            {profile.plan === p.id && <div style={{ position: "absolute", top: -10, right: 12, padding: "2px 10px", borderRadius: 10, background: brand.primary, color: "#fff", fontSize: 10, fontWeight: 700 }}>Aktiv</div>}
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{p.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: brand.primary }}>{p.price}<span style={{ fontSize: 12, fontWeight: 400, color: brand.textMuted }}>{p.mo}</span></div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4, marginBottom: 12 }}>{p.desc}</div>
            {profile.plan !== p.id && p.id !== "free" && (
              <Btn size="sm" variant={p.id === "lifetime" ? "accent" : p.id === "pro" ? "accent" : "primary"} onClick={async () => {
                // All plans (including Lifetime) → Mollie
                try {
                  const resp = await fetch("/api/mollie/checkout", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: profile.email, name: fullName, plan: p.id }),
                  });
                  const data = await resp.json();
                  if (data.checkoutUrl) {
                    updateProfile("mollieCustomerId", data.customerId);
                    updateProfile("pendingPlan", p.id);
                    window.location.href = data.checkoutUrl;
                  } else {
                    alert("Fehler beim Erstellen der Zahlung: " + (data.error || "Unbekannt"));
                  }
                } catch (e) { alert("Verbindungsfehler. Bitte versuche es erneut."); }
              }} style={{ width: "100%" }}>
                <CreditCard size={14} /> {p.id === "lifetime" ? "Kaufen" : profile.plan === "free" ? "Upgraden" : "Wechseln"}
              </Btn>
            )}
            {profile.plan === p.id && p.id === "free" && <span style={{ fontSize: 12, color: brand.textMuted }}>Aktueller Tarif</span>}
          </div>
        ))}
      </div>
      {profile.plan !== "free" && profile.mollieSubscription?.active && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Btn variant="outline" size="sm" onClick={async () => {
            if (!confirm("Abo wirklich kündigen? Du behältst den Zugang bis zum Ende des Abrechnungszeitraums.")) return;
            try {
              const resp = await fetch("/api/mollie/cancel", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId: profile.mollieCustomerId, subscriptionId: profile.mollieSubscription.subscriptionId }),
              });
              const data = await resp.json();
              if (data.success) {
                updateProfile("plan", "free");
                updateProfile("mollieSubscription", { active: false });
                alert("Abo gekündigt. Du behältst den Zugang bis zum Ende des aktuellen Abrechnungszeitraums.");
              } else { alert("Fehler: " + (data.error || "Unbekannt")); }
            } catch { alert("Verbindungsfehler."); }
          }}>Abo kündigen</Btn>
          <span style={{ fontSize: 12, color: brand.textMuted }}>Kündigung wirkt zum Ende des Abrechnungszeitraums</span>
        </div>
      )}
      {profile.plan !== "free" && !profile.mollieSubscription?.active && (
        <div style={{ padding: 12, borderRadius: 8, background: `${brand.warning}08`, border: `1px solid ${brand.warning}25`, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} style={{ color: brand.warning }} />
          <span style={{ fontSize: 13, color: brand.accentHover }}>Zahlung ausstehend oder Abo nicht aktiv. Bitte Tarif erneut auswählen.</span>
        </div>
      )}
    </Card>
    {/* 2FA Setup */}
    <Card style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, marginTop: 0, marginBottom: 4 }}>Zwei-Faktor-Authentifizierung (2FA)</h3>
      <p style={{ fontSize: 14, color: brand.textMuted, marginBottom: 20 }}>Schütze deinen Account mit einem zusätzlichen Sicherheitscode beim Login.</p>
      <TwoFactorSetup email={profile.email} />
    </Card>
    <Card>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, marginTop: 0, marginBottom: 16 }}>Datenschutz & Account</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn variant="outline" size="sm" style={{ justifyContent: "flex-start" }} onClick={() => alert("Datenexport wird per E-Mail zugestellt.")}><Download size={14} /> Meine Daten exportieren (Art. 15 DSGVO)</Btn>
        <Btn variant="danger" size="sm" style={{ justifyContent: "flex-start" }} onClick={() => { if(confirm("Account wirklich löschen?")) alert("Account wird in 30 Tagen gelöscht."); }}><Trash2 size={14} /> Account löschen</Btn>
      </div>
    </Card>
  </div>;

  // ═══ OVERVIEW ═══
  if (view === "overview") return <div style={{ padding: "32px 20px", maxWidth: 1200, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
      <div><h1 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: 0 }}>Hallo, {fullName} 👋</h1><p style={{ fontSize: 15, color: brand.textMuted, margin: "4px 0 0" }}>Dein Briefverkehr auf einen Blick</p></div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {profile.plan === "free" && <span style={{ fontSize: 12, color: remainingAnalyses > 0 ? brand.textMuted : brand.danger, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: remainingAnalyses > 0 ? brand.bgMuted : `${brand.danger}10` }}>{remainingAnalyses}/3 Analysen</span>}
        <Btn size="sm" onClick={() => { if (!canAnalyze) { setShowUpgrade(true); } else { setShowAnalyze(true); } }}><Camera size={16} /> Brief scannen</Btn>
        <Btn size="sm" variant="outline" onClick={() => setShowNewProject(true)}><Plus size={16} /> Neues Projekt</Btn>
      </div>
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
      {dashTabs.map(([id, l]) => <button key={id} onClick={() => setView(id)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: view === id ? brand.primary : "transparent", color: view === id ? "#fff" : brand.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
    </div>
    {!profile.strasse && <div style={{ padding: 14, borderRadius: 10, background: `${brand.info}08`, border: `1px solid ${brand.info}25`, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Info size={18} style={{ color: brand.info }} /><span style={{ fontSize: 14, color: brand.info }}>Hinterlege deine Adresse in den Einstellungen für den Briefversand.</span></div>
      <Btn size="sm" variant="outline" onClick={() => setView("settings")}>Einstellungen</Btn>
    </div>}
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
      <StatCard icon={Folder} label="Offene Projekte" value={projects.filter(p => p.status !== "erledigt").length} color={brand.primary} />
      <StatCard icon={AlertTriangle} label="Dringend" value={projects.filter(p => p.ampel === "rot").length} color={brand.danger} />
      <StatCard icon={FileText} label="Briefe gesamt" value={projects.reduce((s, p) => s + p.letters.length, 0)} color={brand.info} />
      <StatCard icon={Clock} label="Nächste Frist" value={projects.filter(p => p.frist).sort((a, b) => new Date(a.frist) - new Date(b.frist))[0]?.frist?.split("-").reverse().join(".") || "—"} color={brand.warning} />
    </div>
    {projects.some(p => p.ampel === "rot") && <div style={{ padding: 16, borderRadius: 12, background: `${brand.danger}08`, border: `1px solid ${brand.danger}30`, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}><AlertTriangle size={20} style={{ color: brand.danger }} /><span style={{ fontSize: 14, color: brand.danger, fontWeight: 600 }}>Achtung: {projects.filter(p => p.ampel === "rot").length} dringende(s) Projekt(e)!</span></div>}
    <h2 style={{ fontSize: 20, fontWeight: 700, color: brand.text, marginBottom: 16 }}>Deine Projekte</h2>
    {projects.length === 0 ? (
      <Card style={{ padding: 48, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: `${brand.primary}10`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><FileText size={32} style={{ color: brand.primary }} /></div>
        <h3 style={{ fontSize: 22, fontWeight: 700, color: brand.text, margin: "0 0 8px" }}>Willkommen bei KlarBrief24!</h3>
        <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.7, margin: "0 0 24px", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>Fotografiere oder lade deinen ersten Behördenbrief hoch.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}><Btn onClick={() => { if (!canAnalyze) { setShowUpgrade(true); } else { setShowAnalyze(true); } }}><Camera size={18} /> Brief scannen</Btn><Btn variant="outline" onClick={() => setShowNewProject(true)}><Plus size={18} /> Neues Projekt</Btn></div>
      </Card>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {projects.map(p => (
          <Card key={p.id} hover onClick={() => { setActiveProject(p); setView("project"); }} style={{ cursor: "pointer", border: p._isLocal ? `2px solid ${brand.warning}` : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}><AmpelBadge level={p.ampel} /><div style={{ display: "flex", gap: 4 }}>{p._isLocal && <Badge color={brand.warning} bg={`${brand.warning}15`}>⚠ Nicht gespeichert</Badge>}<Badge color={brand.textMuted} bg={brand.bgMuted}>{p.category}</Badge></div></div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: brand.text, margin: "0 0 6px" }}>{p.name}</h3>
            <p style={{ fontSize: 13, color: brand.textMuted, margin: "0 0 12px" }}>{p.behoerde}{p.aktenzeichen ? ` · Az: ${p.aktenzeichen}` : ""}</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: brand.textMuted }}><span>{p.letters.length} Brief(e)</span>{p.frist && <span style={{ color: brand.danger, fontWeight: 600 }}>Frist: {p.frist.split("-").reverse().join(".")}</span>}</div>
          </Card>
        ))}
      </div>
    )}
    <Modal open={showNewProject} onClose={() => setShowNewProject(false)} title="Neues Projekt">
      <Input label="Projektname" value={npName} onChange={setNpName} placeholder="z.B. Steuerbescheid 2025" icon={Folder} />
      <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Kategorie</label><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["Steuern","Miete","Soziales","Bußgeld","Versicherung","Arbeit","Sonstiges"].map(c => <button key={c} onClick={() => setNpCat(c)} style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${npCat === c ? brand.primary : brand.borderLight}`, background: npCat === c ? brand.bgMuted : "#fff", color: npCat === c ? brand.primary : brand.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>)}</div></div>
      <Btn onClick={createProject} style={{ width: "100%" }}>Projekt erstellen</Btn>
    </Modal>
    <Modal open={showAnalyze} onClose={() => { setShowAnalyze(false); setAnalyzeText(""); setAnalyzeResult(null); setFileData(null); }} title="Brief analysieren" wide>
      <FileUploader onFileContent={d => setFileData(d)} onTextContent={t => setAnalyzeText(t)} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 16px" }}><div style={{ flex: 1, height: 1, background: brand.borderLight }} /><span style={{ fontSize: 13, color: brand.textMuted }}>oder Text eingeben</span><div style={{ flex: 1, height: 1, background: brand.borderLight }} /></div>
      <Input textarea value={analyzeText} onChange={setAnalyzeText} placeholder="Text des Behördenbriefs..." icon={FileText} />
      <Btn onClick={handleAnalyze} style={{ width: "100%" }}>{analyzing ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Analysiere...</> : <><Zap size={16} /> Analysieren</>}</Btn>
      {analyzeResult && <div style={{ marginTop: 20 }}>
        {savedToProject && <div style={{ padding: 14, borderRadius: 10, background: `${brand.success}08`, border: `1px solid ${brand.success}30`, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle size={20} style={{ color: brand.success }} />
          <div><span style={{ fontSize: 14, fontWeight: 600, color: brand.success }}>Automatisch gespeichert in: </span><span style={{ fontSize: 14, fontWeight: 700, color: brand.text }}>{savedToProject.name}</span>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 2 }}>{projects.find(p => p.id === savedToProject.id) && findMatchingProject(analyzeResult) ? "Bestehendes Projekt erkannt" : "Neues Projekt erstellt"}</div>
          </div>
        </div>}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}><AmpelBadge level={analyzeResult.ampel} />{analyzeResult.dokumenttyp && <Badge color="#8b5cf6" bg="#8b5cf612">{analyzeResult.dokumenttyp}</Badge>}<Badge>{analyzeResult.kategorie}</Badge>{analyzeResult.frist && <Badge color={brand.danger} bg={`${brand.danger}10`}>Frist: {analyzeResult.frist}</Badge>}{analyzeResult.aktenzeichen && <Badge color={brand.info} bg={`${brand.info}10`}>Az: {analyzeResult.aktenzeichen}</Badge>}</div>
        {analyzeResult.betreff && <div style={{ fontSize: 15, fontWeight: 700, color: brand.text, marginBottom: 8 }}>{analyzeResult.betreff}</div>}
        {analyzeResult.referenzen?.length > 0 && <div style={{ padding: 10, background: `${brand.info}06`, borderRadius: 8, border: `1px solid ${brand.info}15`, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: brand.info, marginBottom: 4 }}>Erkannte Referenznummern:</div>
          {analyzeResult.referenzen.map((r, i) => <div key={i} style={{ fontSize: 13, color: brand.text, padding: "2px 0" }}>{r}</div>)}
        </div>}
        <div style={{ padding: 16, background: brand.bgMuted, borderRadius: 10, marginBottom: 12 }}><p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>{analyzeResult.klartext}</p></div>
        {analyzeResult.todos?.map((t, i) => <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", fontSize: 14 }}><CheckCircle size={16} style={{ color: brand.success, flexShrink: 0 }} />{t}</div>)}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {savedToProject && <Btn variant="primary" onClick={() => { setShowAnalyze(false); setAnalyzeText(""); setAnalyzeResult(null); setFileData(null); setSavedToProject(null); setActiveProject(savedToProject); setView("project"); }}>Projekt öffnen <ArrowRight size={14} /></Btn>}
          <Btn variant="outline" onClick={() => { setAnalyzeText(""); setAnalyzeResult(null); setFileData(null); setSavedToProject(null); }}>Nächsten Brief scannen</Btn>
        </div>
      </div>}
    </Modal>
    {/* Upgrade Modal */}
    <Modal open={showUpgrade} onClose={() => setShowUpgrade(false)} title="Analyse-Limit erreicht">
      <div style={{ textAlign: "center", padding: "12px 0 24px" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: `${brand.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Zap size={28} style={{ color: brand.accent }} /></div>
        <h3 style={{ fontSize: 22, fontWeight: 800, color: brand.text, margin: "0 0 8px" }}>Dein Free-Kontingent ist aufgebraucht</h3>
        <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.7, margin: "0 0 4px" }}>Du hast diesen Monat bereits <strong>{monthlyCount} von {planLimit} Analysen</strong> genutzt.</p>
        <p style={{ fontSize: 14, color: brand.textMuted, marginBottom: 24 }}>Upgrade auf Plus oder Pro für unbegrenzte Analysen.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn variant="primary" onClick={() => { setShowUpgrade(false); setView("settings"); }}><CreditCard size={16} /> Auf Plus upgraden — 4,99€/Mo</Btn>
          <Btn variant="accent" onClick={() => { setShowUpgrade(false); setView("settings"); }}><Zap size={16} /> Pro — 9,99€/Mo</Btn>
        </div>
        <p style={{ fontSize: 12, color: brand.textMuted, marginTop: 16 }}>Dein Kontingent wird am 1. {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("de-DE", { month: "long" })} zurückgesetzt.</p>
      </div>
    </Modal>
  </div>;

  // ═══ PROJECT DETAIL ═══
  if (view === "project" && activeProject) return <div style={{ padding: "32px 20px", maxWidth: 1000, margin: "0 auto" }}>
    <button onClick={() => { setView("overview"); setActiveProject(null); }} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: brand.primary, fontWeight: 600, fontSize: 14, padding: 0, marginBottom: 24, fontFamily: "inherit" }}><ArrowLeft size={16} /> Zurück</button>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
      <div><div style={{ display: "flex", gap: 10, marginBottom: 8 }}><AmpelBadge level={activeProject.ampel} /><Badge>{activeProject.category}</Badge></div><h1 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 4px" }}>{activeProject.name}</h1><p style={{ fontSize: 14, color: brand.textMuted, margin: 0 }}>{activeProject.behoerde}</p></div>
      <div style={{ display: "flex", gap: 10 }}><Btn size="sm" onClick={() => { if (!canAnalyze) { setShowUpgrade(true); } else { setShowAnalyze(true); } }}><Camera size={14} /> Brief hinzufügen</Btn><Btn size="sm" variant="accent" onClick={() => { setEditorAktenzeichen(activeProject.aktenzeichen || ""); setShowEditor(true); }}><Edit3 size={14} /> Antwort schreiben</Btn></div>
    </div>
    <Card style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: activeProject.referenzen?.length > 0 ? 12 : 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Aktenzeichen:</span>
        <input value={activeProject.aktenzeichen || ""} onChange={e => { const v = e.target.value; setActiveProject(p => ({...p, aktenzeichen: v})); setProjects(ps => ps.map(p => p.id === activeProject.id ? {...p, aktenzeichen: v} : p)); if (user?.id) dbUpdateProject(activeProject.id, { aktenzeichen: v }); }} placeholder="z.B. 205/12345/2026" style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${brand.borderLight}`, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        {activeProject.aktenzeichen && <span style={{ fontSize: 11, color: brand.success, fontWeight: 600 }}>✓ Wird im Antwortbrief verwendet</span>}
      </div>
      {activeProject.referenzen?.length > 0 && (
        <div style={{ padding: 10, background: `${brand.info}06`, borderRadius: 8, border: `1px solid ${brand.info}12` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: brand.info, marginBottom: 4 }}>Alle erkannten Referenznummern:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {activeProject.referenzen.map((r, i) => (
              <span key={i} onClick={() => { setActiveProject(p => ({...p, aktenzeichen: r.split(":").pop()?.trim() || r})); setProjects(ps => ps.map(p => p.id === activeProject.id ? {...p, aktenzeichen: r.split(":").pop()?.trim() || r} : p)); }}
                style={{ padding: "4px 10px", borderRadius: 6, background: "#fff", border: `1px solid ${brand.info}25`, fontSize: 12, color: brand.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                title="Klicken um als Aktenzeichen zu übernehmen">
                {r} <span style={{ color: brand.info, fontSize: 10 }}>↗</span>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 6 }}>Klicke auf eine Nummer um sie als Aktenzeichen zu übernehmen</div>
        </div>
      )}
    </Card>
    {activeProject.frist && <div style={{ padding: 16, borderRadius: 12, background: `${brand.danger}08`, border: `1px solid ${brand.danger}20`, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}><Clock size={18} style={{ color: brand.danger }} /><span style={{ fontSize: 14, fontWeight: 600, color: brand.danger }}>Frist: {activeProject.frist.split("-").reverse().join(".")} — {Math.max(0, Math.ceil((new Date(activeProject.frist) - new Date()) / 86400000))} Tage</span></div>}
    <h2 style={{ fontSize: 20, fontWeight: 700, color: brand.text, marginBottom: 20 }}>Schriftverkehr</h2>
    <div style={{ position: "relative", paddingLeft: 32 }}>
      <div style={{ position: "absolute", left: 11, top: 0, bottom: 0, width: 2, background: brand.borderLight }} />
      {activeProject.letters.map(l => (
        <div key={l.id} style={{ position: "relative", marginBottom: 20 }}>
          <div style={{ position: "absolute", left: -32, top: 4, width: 24, height: 24, borderRadius: "50%", background: l.direction === "eingehend" ? brand.info : brand.success, display: "flex", alignItems: "center", justifyContent: "center" }}>{l.direction === "eingehend" ? <Download size={12} color="#fff" /> : <Send size={12} color="#fff" />}</div>
          <Card><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><div style={{ display: "flex", gap: 6 }}><Badge color={l.direction === "eingehend" ? brand.info : brand.success} bg={l.direction === "eingehend" ? `${brand.info}15` : `${brand.success}15`}>{l.direction === "eingehend" ? "Eingehend" : "Ausgehend"}</Badge><Badge color="#8b5cf6" bg="#8b5cf610">{l.type}</Badge></div><span style={{ fontSize: 13, color: brand.textMuted }}>{l.date}</span></div><h4 style={{ fontSize: 16, fontWeight: 700, color: brand.text, margin: "0 0 6px" }}>{l.betreff || l.type}</h4><p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: "0 0 8px" }}>{l.summary}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {l.document && <button onClick={(e) => { e.stopPropagation(); setShowDocument(l.document); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: `1px solid ${brand.borderLight}`, background: brand.bgMuted, color: brand.primary, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l.document.isImage ? <Image size={13} /> : <File size={13} />} {l.document.fileName || "Dokument anzeigen"}</button>}
              {l.letterText && <button onClick={(e) => { e.stopPropagation(); setEditorResult(l.letterText); setEditorIntent(""); setEditorAktenzeichen(activeProject.aktenzeichen || ""); setLetterSaved(true); setEditMode(false); setShowEditor(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: `1px solid ${brand.success}30`, background: `${brand.success}08`, color: brand.success, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Eye size={13} /> Brief anzeigen / bearbeiten</button>}
            </div>
          </Card>
        </div>
      ))}
    </div>
    {activeProject.letters.length === 0 && <Card style={{ textAlign: "center", padding: 40 }}><Camera size={40} style={{ color: brand.borderLight, marginBottom: 12 }} /><p style={{ color: brand.textMuted }}>Noch keine Briefe. Lade den ersten Brief hoch!</p></Card>}
    <Modal open={showEditor} onClose={() => { setShowEditor(false); setEditorResult(""); setEditorIntent(""); setEditMode(false); setRefineInstruction(""); setLetterSaved(false); }} title="Professionellen Antwortbrief erstellen (DIN 5008)" wide>
      {!profile.strasse && <div style={{ padding: 12, borderRadius: 8, background: `${brand.warning}08`, border: `1px solid ${brand.warning}25`, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={16} style={{ color: brand.warning }} /><span style={{ fontSize: 13, color: brand.accentHover }}>Absender fehlt! <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => { setShowEditor(false); setView("settings"); }}>Einstellungen öffnen</span></span></div>}
      {!editorResult && <>
        <Input label="Aktenzeichen / Geschäftszeichen" value={editorAktenzeichen} onChange={setEditorAktenzeichen} placeholder="z.B. 205/12345/2026" icon={FileText} />
        <Input label="Dein Anliegen (so detailliert wie möglich)" textarea value={editorIntent} onChange={setEditorIntent} placeholder="z.B. Einspruch gegen den Steuerbescheid — Werbungskosten in Höhe von 2.340€ wurden nicht berücksichtigt. Belege liegen bei." />
        <div style={{ marginBottom: 16 }}><label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Ton:</label><div style={{ display: "flex", gap: 8 }}>{[["sachlich","Sachlich & formal"],["fordernd","Bestimmt & fordernd"],["freundlich","Freundlich & kooperativ"]].map(([t,l]) => <button key={t} onClick={() => setEditorTone(t)} style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${editorTone === t ? brand.primary : brand.borderLight}`, background: editorTone === t ? brand.bgMuted : "#fff", color: editorTone === t ? brand.primary : brand.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}</div></div>
        <div style={{ padding: 12, borderRadius: 8, background: brand.bgMuted, marginBottom: 16, fontSize: 13, color: brand.textMuted }}>
          <strong style={{ color: brand.text }}>Absender:</strong> {fullName}{fullAddress ? `, ${profile.strasse}, ${profile.plz} ${profile.ort}` : " (nicht hinterlegt)"} · <strong style={{ color: brand.text }}>An:</strong> {activeProject?.behoerde || "—"} · <strong style={{ color: brand.text }}>Format:</strong> DIN 5008 mit Rechtsverweisen
        </div>
        <Btn onClick={handleGenerateLetter} style={{ width: "100%" }}>{editorLoading ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Wird erstellt...</> : <><Scale size={16} /> Brief generieren (DIN 5008)</>}</Btn>
      </>}

      {editorResult && <div>
        {/* Status badge */}
        {letterSaved && <div style={{ padding: 12, borderRadius: 8, background: `${brand.success}08`, border: `1px solid ${brand.success}30`, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle size={18} style={{ color: brand.success }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: brand.success }}>Brief im Projekt "{activeProject?.name}" gespeichert</span>
        </div>}

        {/* Editor or Preview */}
        {editMode ? (
          <textarea value={editorResult} onChange={e => { setEditorResult(e.target.value); setLetterSaved(false); }}
            style={{ width: "100%", minHeight: 500, padding: 28, background: "#fff", border: `2px solid ${brand.primary}`, borderRadius: 4, fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.9, color: brand.text, outline: "none", resize: "vertical", fontWeight: "normal" }} />
        ) : (
          <div style={{ padding: 28, background: "#fff", border: `1px solid ${brand.borderLight}`, borderRadius: 4, fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.9, whiteSpace: "pre-wrap", color: brand.text, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>{editorResult}</div>
        )}

        {/* KI Refinement Box */}
        {!editMode && <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: `${brand.accent}06`, border: `1px solid ${brand.accent}25` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Sparkles size={16} style={{ color: brand.accent }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: brand.text }}>Per KI anpassen</span>
          </div>
          <Input value={refineInstruction} onChange={setRefineInstruction} textarea
            placeholder="z.B. 'Mach den Ton etwas freundlicher' oder 'Füge einen Hinweis auf § 355 BGB hinzu' oder 'Verkürze den Brief um die Hälfte'" />
          <Btn variant="accent" size="sm" onClick={handleRefineLetter} disabled={refineLoading || !refineInstruction.trim()} style={{ marginTop: 4 }}>
            {refineLoading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Überarbeite...</> : <><Sparkles size={14} /> Brief anpassen</>}
          </Btn>
        </div>}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <Btn variant={editMode ? "primary" : "outline"} size="sm" onClick={() => setEditMode(!editMode)}>
            <Edit3 size={14} /> {editMode ? "Bearbeitung abschließen" : "Manuell bearbeiten"}
          </Btn>
          {!letterSaved && <Btn variant="primary" size="sm" onClick={handleSaveLetterToProject}>
            <CheckCircle size={14} /> Im Projekt speichern
          </Btn>}
          <Btn variant="accent" size="sm" onClick={() => window.print()}><Printer size={14} /> Drucken</Btn>
          <Btn variant="outline" size="sm" onClick={() => { const b = new Blob([editorResult], { type: "text/plain;charset=utf-8" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `Brief_${activeProject?.name?.replace(/\s/g,"_") || "Antwort"}_${new Date().toISOString().split("T")[0]}.txt`; a.click(); }}><Download size={14} /> Datei</Btn>
          <Btn variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(editorResult); alert("Kopiert!"); }}><FileText size={14} /> Kopieren</Btn>
          <Btn variant="ghost" size="sm" onClick={() => { setEditorResult(""); setEditorIntent(""); setEditMode(false); setLetterSaved(false); }}>Neuen Brief</Btn>
        </div>
      </div>}
    </Modal>
    <Modal open={showAnalyze} onClose={() => { setShowAnalyze(false); setAnalyzeText(""); setAnalyzeResult(null); setFileData(null); }} title="Brief hinzufügen" wide>
      <FileUploader onFileContent={d => setFileData(d)} onTextContent={t => setAnalyzeText(t)} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 16px" }}><div style={{ flex: 1, height: 1, background: brand.borderLight }} /><span style={{ fontSize: 13, color: brand.textMuted }}>oder Text</span><div style={{ flex: 1, height: 1, background: brand.borderLight }} /></div>
      <Input textarea value={analyzeText} onChange={setAnalyzeText} placeholder="Brief-Text..." icon={FileText} />
      <Btn onClick={handleAnalyze} style={{ width: "100%" }}>{analyzing ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Analysiere...</> : <><Zap size={16} /> Analysieren</>}</Btn>
      {analyzeResult && <div style={{ marginTop: 20 }}>
        <div style={{ padding: 14, borderRadius: 10, background: `${brand.success}08`, border: `1px solid ${brand.success}30`, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}><CheckCircle size={18} style={{ color: brand.success }} /><span style={{ fontSize: 14, fontWeight: 600, color: brand.success }}>Brief gespeichert in: {activeProject.name}</span></div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}><AmpelBadge level={analyzeResult.ampel} />{analyzeResult.dokumenttyp && <Badge color="#8b5cf6" bg="#8b5cf612">{analyzeResult.dokumenttyp}</Badge>}</div>
        {analyzeResult.betreff && <div style={{ fontSize: 14, fontWeight: 700, color: brand.text, marginBottom: 8 }}>{analyzeResult.betreff}</div>}
        <div style={{ padding: 16, background: brand.bgMuted, borderRadius: 10, marginBottom: 12 }}><p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>{analyzeResult.klartext}</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="primary" onClick={() => { setShowAnalyze(false); setAnalyzeText(""); setAnalyzeResult(null); setFileData(null); setSavedToProject(null); }}>Fertig</Btn>
          <Btn variant="outline" onClick={() => { setAnalyzeText(""); setAnalyzeResult(null); setFileData(null); setSavedToProject(null); }}>Nächsten Brief</Btn>
        </div>
      </div>}
    </Modal>
    {/* Document Viewer */}
    <Modal open={!!showDocument} onClose={() => setShowDocument(null)} title={showDocument?.fileName || "Dokument"} wide>
      {showDocument && <div>
        {showDocument.isImage && showDocument.base64 && (
          <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${brand.borderLight}`, marginBottom: 16 }}>
            <img src={`data:${showDocument.mediaType};base64,${showDocument.base64}`} alt="Dokument" style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
        )}
        {showDocument.isPdf && showDocument.base64 && (
          <div style={{ marginBottom: 16 }}>
            <iframe src={`data:application/pdf;base64,${showDocument.base64}`} style={{ width: "100%", height: 500, border: `1px solid ${brand.borderLight}`, borderRadius: 8 }} title="PDF Vorschau" />
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          {showDocument.base64 && <Btn variant="outline" size="sm" onClick={() => {
            const link = document.createElement("a");
            link.href = `data:${showDocument.mediaType};base64,${showDocument.base64}`;
            link.download = showDocument.fileName || "dokument";
            link.click();
          }}><Download size={14} /> Herunterladen</Btn>}
        </div>
      </div>}
    </Modal>
  </div>;
}

// ═══════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════
function AdminPage() {
  const [tab, setTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dbData, setDbData] = useState({ users: [], projects: [], usage: [] });
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ plan: "free", discount_percent: 0, custom_limit: "", admin_notes: "", granted_until: "", subscription_active: false });
  const [editSaving, setEditSaving] = useState(false);

  const openEditUser = (u) => {
    setEditUser(u);
    setEditForm({
      plan: u.plan || "free",
      discount_percent: u.discount_percent || 0,
      custom_limit: u.custom_limit || "",
      admin_notes: u.admin_notes || "",
      granted_until: u.granted_until || "",
      subscription_active: u.subscription_active || false,
    });
  };

  const handleSaveEditUser = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const updates = {
        plan: editForm.plan,
        discount_percent: parseInt(editForm.discount_percent) || 0,
        custom_limit: editForm.custom_limit ? parseInt(editForm.custom_limit) : null,
        admin_notes: editForm.admin_notes || null,
        granted_until: editForm.granted_until || null,
        subscription_active: editForm.subscription_active,
      };
      const { error } = await supabase.from('profiles').update(updates).eq('id', editUser.id);
      if (error) {
        alert("Fehler beim Speichern: " + (error.message || JSON.stringify(error)));
      } else {
        setEditUser(null);
        setRefreshKey(k => k + 1);
      }
    } catch (e) {
      alert("Fehler: " + e.message);
    }
    setEditSaving(false);
  };

  // ── Load REAL data from Supabase ──
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const [usersRes, projectsRes, usageRes] = await Promise.all([
          adminGetAllUsers(),
          adminGetAllProjects(),
          adminGetAllUsage(),
        ]);
        if (!mounted) return;
        setDbData({
          users: usersRes.data || [],
          projects: projectsRes.data || [],
          usage: usageRes.data || [],
        });
      } catch (e) { console.error("Admin load error:", e); }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshKey]);

  // ── Aggregate ──
  const realData = React.useMemo(() => {
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const planPrices = { free: 0, plus: 4.99, pro: 9.99, business: 29.99, lifetime: 0 };
    const planCounts = { free: 0, plus: 0, pro: 0, business: 0, lifetime: 0 };
    let mrr = 0, totalAnalyses = 0, analysesThisMonth = 0;

    // Group usage by user
    const usageByUser = {};
    dbData.usage.forEach(u => {
      if (!usageByUser[u.user_id]) usageByUser[u.user_id] = { total: 0, month: 0 };
      usageByUser[u.user_id].total += u.count || 0;
      if (u.month === currentMonth) usageByUser[u.user_id].month += u.count || 0;
      totalAnalyses += u.count || 0;
      if (u.month === currentMonth) analysesThisMonth += u.count || 0;
    });

    // Projects by user
    const projectsByUser = {};
    dbData.projects.forEach(p => {
      projectsByUser[p.user_id] = (projectsByUser[p.user_id] || 0) + 1;
    });

    // Build user list
    const users = dbData.users.map(u => {
      const plan = u.plan || "free";
      planCounts[plan] = (planCounts[plan] || 0) + 1;
      mrr += planPrices[plan] || 0;
      return {
        id: u.id,
        email: u.email,
        name: `${u.vorname || ""} ${u.nachname || ""}`.trim() || u.email?.split("@")[0] || "Nutzer",
        plan,
        projects: projectsByUser[u.id] || 0,
        analyses: usageByUser[u.id]?.total || 0,
        analysesThisMonth: usageByUser[u.id]?.month || 0,
        registered: u.created_at ? new Date(u.created_at).toLocaleDateString("de-DE") : "—",
        is_admin: u.is_admin,
        subscription_active: u.subscription_active,
        discount_percent: u.discount_percent || 0,
        custom_limit: u.custom_limit,
        admin_notes: u.admin_notes,
        granted_until: u.granted_until,
      };
    });

    return { users, planCounts, mrr, totalAnalyses, analysesThisMonth, currentMonth };
  }, [dbData]);

  const totalUsers = realData.users.length;
  const totalProjects = dbData.projects.length;
  const filtered = realData.users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  const conversionRate = totalUsers > 0 ? ((totalUsers - (realData.planCounts.free || 0)) / totalUsers * 100).toFixed(1) : "0.0";

  const handleResetAll = async () => {
    if (!confirm("WARNUNG: Alle Projekte und Nutzungsdaten ALLER Nutzer werden gelöscht. Nutzer-Accounts bleiben erhalten. Fortfahren?")) return;
    if (!confirm("Wirklich sicher? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    try {
      // Delete all projects and usage (admin has RLS access)
      await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('usage_tracking').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      alert("Statistiken zurückgesetzt.");
      setRefreshKey(k => k + 1);
    } catch (e) { alert("Fehler: " + e.message); }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!confirm(`Nutzer ${email} und alle zugehörigen Daten wirklich löschen?`)) return;
    try {
      await supabase.from('projects').delete().eq('user_id', userId);
      await supabase.from('usage_tracking').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      alert("Nutzerdaten gelöscht. Der Auth-Account muss separat in Supabase (Authentication → Users) gelöscht werden.");
      setRefreshKey(k => k + 1);
    } catch (e) { alert("Fehler: " + e.message); }
  };


  if (loading) return <div style={{ padding: 60, textAlign: "center" }}>
    <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: brand.primary }} />
    <p style={{ marginTop: 16, color: brand.textMuted }}>Lade Daten aus Supabase...</p>
  </div>;

  return <div style={{ padding: "32px 20px", maxWidth: 1200, margin: "0 auto" }}>
    <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 4px" }}>Admin-Dashboard</h1>
        <p style={{ fontSize: 15, color: brand.textMuted, margin: 0 }}>Live-Daten aus Supabase</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}><RefreshCw size={14} /> Aktualisieren</Btn>
        <Btn variant="danger" size="sm" onClick={handleResetAll}><Trash2 size={14} /> Statistiken zurücksetzen</Btn>
      </div>
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 32, overflowX: "auto" }}>
      {[["overview","Übersicht"],["users","Nutzer"],["system","System"]].map(([id, l]) => <button key={id} onClick={() => setTab(id)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: tab === id ? brand.primary : "transparent", color: tab === id ? "#fff" : brand.textMuted, fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>{l}</button>)}
    </div>

    {tab === "overview" && <>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard icon={Users} label="Gesamtnutzer" value={totalUsers.toString()} color={brand.primary} />
        <StatCard icon={TrendingUp} label="MRR" value={`${realData.mrr.toFixed(2)}€`} color={brand.success} />
        <StatCard icon={Activity} label="Analysen (Monat)" value={realData.analysesThisMonth.toString()} color={brand.info} />
        <StatCard icon={Target} label="Conversion" value={`${conversionRate}%`} color={brand.accent} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        <Card>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: brand.text, marginTop: 0 }}>Abo-Verteilung</h3>
          {totalUsers === 0 ? <p style={{ color: brand.textMuted, fontSize: 14, marginTop: 16 }}>Noch keine Nutzer registriert.</p> :
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {[["Free","free"],["Plus","plus"],["Pro","pro"],["Lifetime","lifetime"],["Business","business"]].map(([n, key]) => {
              const c = realData.planCounts[key] || 0;
              const p = totalUsers > 0 ? Math.round((c / totalUsers) * 100) : 0;
              return <div key={n}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}><span style={{ fontWeight: 600, color: brand.text }}>{n}</span><span style={{ color: brand.textMuted }}>{c} ({p}%)</span></div><div style={{ height: 8, borderRadius: 4, background: brand.borderLight }}><div style={{ height: "100%", borderRadius: 4, background: brand.primary, width: `${p}%`, transition: "width 0.4s" }} /></div></div>;
            })}
          </div>}
        </Card>
        <Card>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: brand.text, marginTop: 0 }}>Gesamt-Statistik</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
            {[["Projekte gesamt", totalProjects],["Analysen gesamt", realData.totalAnalyses],["Analysen diesen Monat", realData.analysesThisMonth],["Aktive Abos", totalUsers - (realData.planCounts.free || 0)]].map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${brand.borderLight}` }}><span style={{ fontSize: 14, color: brand.textMuted }}>{l}</span><span style={{ fontSize: 18, fontWeight: 800, color: brand.primary }}>{v}</span></div>)}
          </div>
        </Card>
        <Card>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: brand.text, marginTop: 0 }}>Neueste Nutzer</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {realData.users.slice(0, 5).map(u => <div key={u.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${brand.borderLight}` }}>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: brand.text }}>{u.name}</div><div style={{ fontSize: 12, color: brand.textMuted }}>{u.email}</div></div>
              <Badge color={u.plan === "pro" ? brand.accent : u.plan === "plus" ? brand.primary : brand.textMuted} bg={u.plan === "pro" ? `${brand.accent}15` : u.plan === "plus" ? brand.bgMuted : `${brand.textMuted}10`}>{u.plan.toUpperCase()}</Badge>
            </div>)}
            {realData.users.length === 0 && <p style={{ color: brand.textMuted, fontSize: 14 }}>Noch keine Nutzer.</p>}
          </div>
        </Card>
      </div>
    </>}

    {tab === "users" && <>
      <Card style={{ marginBottom: 24 }}><div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Input value={searchTerm} onChange={setSearchTerm} placeholder="Nutzer suchen..." icon={Search} style={{ flex: 1, minWidth: 200, marginBottom: 0 }} /></div></Card>
      {filtered.length === 0 ? <Card style={{ textAlign: "center", padding: 48 }}><Users size={40} style={{ color: brand.borderLight, marginBottom: 12 }} /><p style={{ color: brand.textMuted, margin: 0 }}>{totalUsers === 0 ? "Noch keine Nutzer registriert." : "Keine Treffer."}</p></Card> :
      <Card style={{ padding: 0, overflow: "hidden" }}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ background: brand.bgMuted }}>{["Name","E-Mail","Plan","Projekte","Analysen","Registriert",""].map(h => <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 700, color: brand.text, borderBottom: `2px solid ${brand.borderLight}` }}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map(u => <tr key={u.id} style={{ borderBottom: `1px solid ${brand.borderLight}` }}>
          <td style={{ padding: "14px 16px", fontWeight: 600 }}>{u.name}{u.is_admin && <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: brand.accent, color: "#fff", fontWeight: 700 }}>ADMIN</span>}</td>
          <td style={{ padding: "14px 16px", color: brand.textMuted }}>{u.email}</td>
          <td style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <Badge color={u.plan === "lifetime" ? brand.accent : u.plan === "pro" ? brand.accent : u.plan === "plus" ? brand.primary : brand.textMuted} bg={u.plan === "lifetime" ? `${brand.accent}15` : u.plan === "pro" ? `${brand.accent}15` : u.plan === "plus" ? brand.bgMuted : `${brand.textMuted}10`}>{u.plan.toUpperCase()}</Badge>
              {u.discount_percent > 0 && <Badge color={brand.warning} bg={`${brand.warning}15`}>-{u.discount_percent}%</Badge>}
              {u.granted_until && <span title={`Gültig bis ${u.granted_until}`} style={{ fontSize: 10, color: brand.textMuted }}>⏱</span>}
              {u.admin_notes && <span title={u.admin_notes} style={{ fontSize: 10, cursor: "help" }}>📝</span>}
            </div>
          </td>
          <td style={{ padding: "14px 16px" }}>{u.projects}</td>
          <td style={{ padding: "14px 16px" }}>{u.analyses} <span style={{ color: brand.textMuted, fontSize: 12 }}>({u.analysesThisMonth} Mo.)</span></td>
          <td style={{ padding: "14px 16px", color: brand.textMuted, fontSize: 12 }}>{u.registered}</td>
          <td style={{ padding: "14px 16px" }}><div style={{ display: "flex", gap: 8 }}><button onClick={() => openEditUser(u)} title="Bearbeiten" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Edit3 size={16} color={brand.primary} /></button>{!u.is_admin && <button onClick={() => handleDeleteUser(u.id, u.email)} title="Löschen" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Trash2 size={16} color={brand.danger} /></button>}</div></td>
        </tr>)}</tbody>
      </table></div></Card>}
    </>}

    {tab === "system" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
      <Card><h3 style={{ fontSize: 18, fontWeight: 700, color: brand.text, marginTop: 0 }}>API-Kosten (geschätzt)</h3><div style={{ fontSize: 32, fontWeight: 800, color: brand.primary, margin: "12px 0" }}>{(realData.analysesThisMonth * 0.066).toFixed(2)}€</div><p style={{ fontSize: 14, color: brand.textMuted, margin: 0 }}>Aktueller Monat · ∅ 0,066€/Analyse</p></Card>
      <Card><h3 style={{ fontSize: 18, fontWeight: 700, color: brand.text, marginTop: 0 }}>System-Status</h3><div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>{[["Frontend","Online"],["Supabase DB","Online"],["Anthropic API","Online"],["Mollie","Online"]].map(([s,st]) => <div key={s} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{s}</span><span style={{ display: "flex", alignItems: "center", gap: 6, color: brand.success, fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: brand.success }} />{st}</span></div>)}</div></Card>
      <Card><h3 style={{ fontSize: 18, fontWeight: 700, color: brand.text, marginTop: 0 }}>Datenbank</h3><div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>{[["Nutzer", totalUsers],["Projekte", totalProjects],["Usage-Einträge", dbData.usage.length]].map(([l,v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: brand.textMuted }}>{l}</span><span style={{ fontWeight: 700 }}>{v}</span></div>)}</div></Card>
    </div>}

    {/* ── EDIT USER MODAL ── */}
    <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Nutzer bearbeiten: ${editUser?.name || ""}`} wide>
      {editUser && <div>
        <div style={{ padding: 14, borderRadius: 10, background: brand.bgMuted, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: brand.textMuted, marginBottom: 4 }}>E-Mail</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: brand.text, marginBottom: 8 }}>{editUser.email}</div>
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: brand.textMuted, flexWrap: "wrap" }}>
            <span><strong style={{ color: brand.text }}>{editUser.projects}</strong> Projekte</span>
            <span><strong style={{ color: brand.text }}>{editUser.analyses}</strong> Analysen gesamt</span>
            <span><strong style={{ color: brand.text }}>{editUser.analysesThisMonth}</strong> diesen Monat</span>
            <span>Registriert: <strong style={{ color: brand.text }}>{editUser.registered}</strong></span>
          </div>
        </div>

        <h4 style={{ fontSize: 16, fontWeight: 700, color: brand.text, margin: "0 0 12px" }}>Plan zuweisen</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 16 }}>
          {[["free","Free","0€"],["plus","Plus","4,99€/Mo"],["pro","Pro","9,99€/Mo"],["business","Business","29,99€/Mo"],["lifetime","Lifetime","Einmalig"]].map(([id, name, price]) => (
            <button key={id} onClick={() => setEditForm(f => ({ ...f, plan: id, subscription_active: id !== "free" }))} style={{ padding: "12px 8px", borderRadius: 10, border: `2px solid ${editForm.plan === id ? brand.primary : brand.borderLight}`, background: editForm.plan === id ? brand.bgMuted : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: editForm.plan === id ? brand.primary : brand.text }}>{name}</div>
              <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{price}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: brand.text }}>Rabatt für nächste Zahlung (%)</label>
            <input type="number" min="0" max="100" value={editForm.discount_percent} onChange={e => setEditForm(f => ({ ...f, discount_percent: e.target.value }))} placeholder="0" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${brand.borderLight}`, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            <p style={{ fontSize: 11, color: brand.textMuted, margin: "4px 0 0" }}>Wird bei nächster Mollie-Zahlung angewandt</p>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: brand.text }}>Individuelles Limit (Analysen/Monat)</label>
            <input type="number" min="0" value={editForm.custom_limit} onChange={e => setEditForm(f => ({ ...f, custom_limit: e.target.value }))} placeholder="leer = Plan-Standard" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${brand.borderLight}`, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            <p style={{ fontSize: 11, color: brand.textMuted, margin: "4px 0 0" }}>Überschreibt das Plan-Limit</p>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: brand.text }}>Premium-Zugang gültig bis (optional)</label>
          <input type="date" value={editForm.granted_until} onChange={e => setEditForm(f => ({ ...f, granted_until: e.target.value }))} style={{ padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${brand.borderLight}`, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          <p style={{ fontSize: 11, color: brand.textMuted, margin: "4px 0 0" }}>Bei Lifetime leer lassen. Bei Test-Zugang: Ablaufdatum setzen.</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600, color: brand.text }}>Admin-Notizen (intern, für dich)</label>
          <textarea value={editForm.admin_notes} onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))} placeholder="z.B. 'Test-Account', 'VIP-Kunde — 50% Rabatt versprochen', 'Beschwerde am 15.04.'" rows="3" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${brand.borderLight}`, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
        </div>

        <div style={{ padding: 10, borderRadius: 8, background: `${brand.warning}10`, border: `1px solid ${brand.warning}30`, marginBottom: 20, fontSize: 12, color: brand.text }}>
          ⚠️ <strong>Hinweis:</strong> Plan-Änderungen hier umgehen Mollie. Bei "Lifetime" oder kostenpflichtigen Plänen erfolgt KEINE Abbuchung — der Zugang wird einfach freigeschaltet (z.B. für Test-Accounts oder Kulanz). Bestehende Mollie-Abos müssen separat in Mollie verwaltet werden.
        </div>

        <h4 style={{ fontSize: 16, fontWeight: 700, color: brand.text, margin: "0 0 12px" }}>Schnellaktionen</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <Btn variant="accent" size="sm" onClick={() => setEditForm(f => ({ ...f, plan: "lifetime", subscription_active: true, granted_until: "", admin_notes: (f.admin_notes ? f.admin_notes + "\n" : "") + `Lifetime geschenkt am ${new Date().toLocaleDateString("de-DE")}` }))} disabled={editSaving}>
            🎁 Lifetime schenken
          </Btn>
          <Btn variant="outline" size="sm" onClick={() => setEditForm(f => ({ ...f, plan: "pro", subscription_active: true, granted_until: new Date(Date.now() + 30*24*60*60*1000).toISOString().split("T")[0], admin_notes: (f.admin_notes ? f.admin_notes + "\n" : "") + `30-Tage Pro-Test ab ${new Date().toLocaleDateString("de-DE")}` }))} disabled={editSaving}>
            🆓 30-Tage Pro-Test
          </Btn>
          <Btn variant="outline" size="sm" onClick={() => setEditForm(f => ({ ...f, discount_percent: 50 }))} disabled={editSaving}>
            💰 50% Rabatt setzen
          </Btn>
          <Btn variant="outline" size="sm" onClick={async () => {
            if (!confirm("Analysen-Zähler dieses Nutzers für aktuellen Monat auf 0 setzen?")) return;
            const cm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
            try {
              await supabase.from('usage_tracking').delete().eq('user_id', editUser.id).eq('month', cm);
              alert("Zähler zurückgesetzt.");
              setRefreshKey(k => k + 1);
            } catch (e) { alert("Fehler: " + e.message); }
          }} disabled={editSaving}>
            <RefreshCw size={14} /> Zähler zurücksetzen
          </Btn>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 16, borderTop: `1px solid ${brand.borderLight}` }}>
          <Btn variant="ghost" onClick={() => setEditUser(null)} disabled={editSaving}>Abbrechen</Btn>
          <Btn variant="primary" onClick={handleSaveEditUser} disabled={editSaving}>
            {editSaving ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Speichere...</> : <><CheckCircle size={14} /> Änderungen speichern</>}
          </Btn>
        </div>
      </div>}
    </Modal>
  </div>;
}


// ═══════════════════════════════════════════
// OFFER / VERKAUFSSEITE
// ═══════════════════════════════════════════
function OfferPage({ setPage }) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const startCheckout = async (plan) => {
    // Check if user is logged in
    const session = await getSession();
    if (!session?.user) {
      alert("Bitte registriere dich zuerst kostenlos, um den Kauf abzuschließen.");
      setPage("register");
      return;
    }
    setCheckoutLoading(true);
    try {
      const resp = await fetch("/api/mollie/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.user.email, name: session.user.user_metadata?.name || session.user.email, plan }),
      });
      const data = await resp.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert("Fehler beim Erstellen der Zahlung: " + (data.error || "Unbekannt"));
        setCheckoutLoading(false);
      }
    } catch (e) {
      alert("Verbindungsfehler. Bitte versuche es erneut.");
      setCheckoutLoading(false);
    }
  };

  return <div style={{ background: brand.bg }}>
    {/* Hero */}
    <section style={{ padding: "60px 20px 40px", textAlign: "center", background: `linear-gradient(180deg, ${brand.bgMuted} 0%, ${brand.bg} 100%)` }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: `${brand.accent}15`, marginBottom: 20 }}>
          <Zap size={14} style={{ color: brand.accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: brand.accentHover }}>ZEITLICH BEGRENZTES ANGEBOT</span>
        </div>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 52px)", fontWeight: 900, lineHeight: 1.1, color: brand.text, margin: "0 0 20px" }}>
          Nie wieder <span style={{ color: brand.accent }}>Behörden-Stress.</span><br/>
          Einmal zahlen. <span style={{ color: brand.primary }}>Für immer nutzen.</span>
        </h1>
        <p style={{ fontSize: 20, color: brand.textMuted, lineHeight: 1.6, margin: "0 auto 32px", maxWidth: 700 }}>
          Schluss mit unverständlichem Amtsdeutsch. Foto machen, KI erklärt's. Mit dem <strong style={{ color: brand.text }}>KlarBrief24 Lifetime-Zugang</strong> bekommst du unbegrenzte Analysen — ein Leben lang, ohne monatliche Kosten.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <Btn size="lg" variant="accent" onClick={() => startCheckout("lifetime")}><Zap size={18} /> Jetzt für 59€ sichern</Btn>
          <Btn size="lg" variant="outline" onClick={() => { document.getElementById("offer-details")?.scrollIntoView({ behavior: "smooth" }); }}>Mehr erfahren ↓</Btn>
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", fontSize: 13, color: brand.textMuted }}>
          <span>✓ 14 Tage Geld-zurück-Garantie</span>
          <span>✓ Sichere Zahlung mit Mollie</span>
          <span>✓ Sofortiger Zugang</span>
        </div>
      </div>
    </section>

    {/* Pain Points */}
    <section style={{ padding: "60px 20px", background: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: brand.text, textAlign: "center", margin: "0 0 40px" }}>Kennst du das?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {[
            { icon: AlertTriangle, t: "Briefe verstehst du nicht", d: "Behördendeutsch wirkt wie eine Fremdsprache. Du liest drei Mal und bist trotzdem verunsichert." },
            { icon: Clock, t: "Fristen verpasst du", d: "Wichtige Deadlines gehen unter — und plötzlich kommen Mahngebühren, Zinsen oder Bußgelder." },
            { icon: CreditCard, t: "Anwälte sind zu teuer", d: "Für jede kleine Frage 200€ zahlen? Nicht realistisch. Du bleibst auf dem Problem sitzen." },
          ].map((p, i) => (
            <div key={i} style={{ padding: 24, borderRadius: 12, background: brand.bg, border: `1px solid ${brand.borderLight}` }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${brand.danger}10`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><p.icon size={24} style={{ color: brand.danger }} /></div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: brand.text, margin: "0 0 8px" }}>{p.t}</h3>
              <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: 0 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Solution */}
    <section id="offer-details" style={{ padding: "80px 20px", background: brand.bgMuted }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: brand.text, margin: "0 0 12px" }}>KlarBrief24 macht's einfach.</h2>
          <p style={{ fontSize: 18, color: brand.textMuted, maxWidth: 600, margin: "0 auto" }}>Foto machen. KI arbeitet. Klarheit bekommen. In 30 Sekunden.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {[
            { n: "1", t: "Brief fotografieren", d: "Mit dem Handy oder per PDF-Upload — egal ob Steuerbescheid, Rechnung oder Mietvertrag." },
            { n: "2", t: "KI analysiert", d: "In Sekunden bekommst du: Übersetzung in einfaches Deutsch, Ampel-Bewertung und To-Do-Liste." },
            { n: "3", t: "Antwortbrief erstellen", d: "Professionelle DIN-5008-Antwort mit Rechtsverweisen und Aktenzeichen — druckfertig." },
          ].map((s, i) => (
            <div key={i} style={{ padding: 28, borderRadius: 16, background: "#fff", border: `1px solid ${brand.borderLight}`, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${brand.primary}, ${brand.primaryLight})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#fff", fontSize: 22, fontWeight: 800 }}>{s.n}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, margin: "0 0 10px" }}>{s.t}</h3>
              <p style={{ fontSize: 15, color: brand.textMuted, lineHeight: 1.6, margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Offer Box */}
    <section style={{ padding: "80px 20px", background: "#fff" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ borderRadius: 24, overflow: "hidden", border: `3px solid ${brand.accent}`, boxShadow: `0 20px 60px ${brand.accent}25` }}>
          <div style={{ padding: "16px 24px", background: brand.accent, color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            ⚡ Lifetime-Deal — nur jetzt
          </div>
          <div style={{ padding: "40px 32px", background: "#fff", textAlign: "center" }}>
            <h3 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 8px" }}>KlarBrief24 Lifetime</h3>
            <p style={{ fontSize: 15, color: brand.textMuted, margin: "0 0 24px" }}>Einmalzahlung — keine monatlichen Kosten</p>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20, color: brand.textMuted, textDecoration: "line-through" }}>179€</span>
              <span style={{ fontSize: 64, fontWeight: 900, color: brand.primary, lineHeight: 1 }}>59€</span>
            </div>
            <p style={{ fontSize: 14, color: brand.success, fontWeight: 700, marginBottom: 32 }}>Du sparst 120€ gegenüber Jahresabo</p>

            <div style={{ textAlign: "left", marginBottom: 32, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Unbegrenzte Brief-Analysen (für immer)",
                "Foto- und PDF-Upload mit KI-Texterkennung",
                "Übersetzung in einfaches Deutsch",
                "Ampel-Bewertung und automatische Fristen",
                "Vollständiges Projektarchiv",
                "Aktenzeichen-Extraktion",
                "2-Faktor-Authentifizierung",
                "Alle zukünftigen Updates inklusive",
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <CheckCircle size={18} style={{ color: brand.success, flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 15, color: brand.text }}>{f}</span>
                </div>
              ))}
            </div>

            <Btn size="lg" variant="accent" onClick={() => startCheckout("lifetime")} style={{ width: "100%", padding: "18px 24px", fontSize: 18 }}>
              <Zap size={20} /> Jetzt für 59€ sichern
            </Btn>

            <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: brand.bgMuted }}>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>
                <span>🔒 SSL-verschlüsselt</span>
                <span>💳 Alle Zahlungsarten</span>
                <span>⚡ Sofort-Zugang</span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: brand.textMuted, marginTop: 12 }}>Zahlungsabwicklung sicher über Mollie — SEPA, Kreditkarte, PayPal & mehr</p>
          </div>
        </div>
      </div>
    </section>

    {/* Guarantee */}
    <section style={{ padding: "60px 20px", background: brand.bgMuted, textAlign: "center" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#fff", border: `3px solid ${brand.success}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><Shield size={36} style={{ color: brand.success }} /></div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: brand.text, margin: "0 0 12px" }}>14 Tage Geld-zurück-Garantie</h2>
        <p style={{ fontSize: 16, color: brand.textMuted, lineHeight: 1.7, margin: 0 }}>
          Du gehst kein Risiko ein. Wenn KlarBrief24 nicht deine Erwartungen erfüllt, bekommst du innerhalb von 14 Tagen <strong>100% deines Geldes zurück</strong> — ohne Rückfragen.
        </p>
      </div>
    </section>

    {/* Final CTA */}
    <section style={{ padding: "80px 20px", background: "#fff", textAlign: "center" }}>
      <h2 style={{ fontSize: 36, fontWeight: 800, color: brand.text, margin: "0 0 16px" }}>Bereit, Behördenbriefe endlich zu verstehen?</h2>
      <p style={{ fontSize: 18, color: brand.textMuted, margin: "0 auto 32px", maxWidth: 600 }}>Einmal 59€ zahlen. Für immer nutzen. Alle Updates inklusive.</p>
      <Btn size="lg" variant="accent" onClick={() => startCheckout("lifetime")} style={{ padding: "18px 36px", fontSize: 18 }}><Zap size={20} /> Jetzt Lifetime-Zugang sichern</Btn>
      <p style={{ fontSize: 13, color: brand.textMuted, marginTop: 20 }}>
        Schon Kunde? <span onClick={() => setPage("login")} style={{ color: brand.primary, cursor: "pointer", fontWeight: 600 }}>Hier anmelden</span>
      </p>
    </section>
  </div>;
}

// ═══════════════════════════════════════════
// THANK YOU PAGE
// ═══════════════════════════════════════════
function ThankYouPage({ setPage }) {
  useEffect(() => {
    // Parse Mollie return params if present
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id") || params.get("payment_id");
    if (orderId) {
      console.log("Mollie Bestellung:", orderId);
    }
  }, []);

  return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", background: `linear-gradient(180deg, ${brand.bgMuted} 0%, ${brand.bg} 100%)` }}>
    <div style={{ maxWidth: 640, width: "100%", textAlign: "center" }}>
      <div style={{ width: 100, height: 100, borderRadius: "50%", background: `${brand.success}15`, border: `3px solid ${brand.success}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px", animation: "fadeIn 0.6s ease" }}>
        <CheckCircle size={52} style={{ color: brand.success }} />
      </div>
      <h1 style={{ fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 900, color: brand.text, margin: "0 0 16px" }}>Vielen Dank für deinen Kauf! 🎉</h1>
      <p style={{ fontSize: 18, color: brand.textMuted, lineHeight: 1.7, margin: "0 0 32px" }}>
        Deine Bestellung wurde erfolgreich abgeschlossen. Du hast jetzt <strong style={{ color: brand.primary }}>unbegrenzten Lifetime-Zugang</strong> zu KlarBrief24.
      </p>

      <Card style={{ padding: 32, marginBottom: 32, textAlign: "left" }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: brand.text, margin: "0 0 20px" }}>So geht's weiter:</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { n: "1", t: "Bestätigung erhalten", d: "Du erhältst eine Zahlungsbestätigung per E-Mail mit deinem Rechnungsbeleg." },
            { n: "2", t: "Account erstellen", d: "Registriere dich mit der E-Mail-Adresse, die du beim Kauf verwendet hast." },
            { n: "3", t: "Losschreiben", d: "Fotografiere deinen ersten Brief — die KI übersetzt ihn in Sekunden." },
          ].map(s => (
            <div key={s.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: brand.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
              <div><h4 style={{ fontSize: 16, fontWeight: 700, color: brand.text, margin: "0 0 4px" }}>{s.t}</h4><p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: 0 }}>{s.d}</p></div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <Btn size="lg" onClick={() => setPage("register")}><UserPlus size={18} /> Jetzt Account erstellen</Btn>
        <Btn size="lg" variant="outline" onClick={() => setPage("home")}>Zur Startseite</Btn>
      </div>

      <p style={{ fontSize: 13, color: brand.textMuted }}>
        Fragen oder Probleme? Schreib uns an <a href="mailto:info@csv-support.de" style={{ color: brand.primary, fontWeight: 600 }}>info@csv-support.de</a>
      </p>
    </div>
  </div>;
}
// ═══════════════════════════════════════════
// LEGAL PAGES
// ═══════════════════════════════════════════
function LegalPage({ page }) {
  const W = ({ children }) => <div style={{ padding: "60px 20px", maxWidth: 800, margin: "0 auto" }}><article style={{ fontSize: 15, color: brand.text, lineHeight: 1.8 }}>{children}</article></div>;
  const H1 = ({ children }) => <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 32 }}>{children}</h1>;
  const H2 = ({ children }) => <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>{children}</h2>;
  const P = ({ children }) => <p style={{ marginBottom: 12 }}>{children}</p>;

  if (page === "impressum") return <W><H1>Impressum</H1>
    <H2>Angaben gemäß § 5 TMG</H2><P><strong>Anbieter</strong><br/>KlarBrief24 – eine Marke der ETONI UG (haftungsbeschränkt)<br/>Kiefernweg 1<br/>53474 Bad Neuenahr-Ahrweiler<br/>Deutschland</P>
    <H2>Kontakt</H2><P>E-Mail: info@csv-support.de<br/>Web: www.csv-support.de</P>
    <H2>Handelsregister</H2><P>Registergericht: Amtsgericht Koblenz<br/>Registernummer: HRB 31805</P>
    <H2>Vertreten durch</H2><P>Geschäftsführer: Toni Krell</P>
    <H2>Umsatzsteuer</H2><P>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG wird nach Zuteilung ergänzt.</P>
    <H2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</H2><P>ETONI UG (haftungsbeschränkt)<br/>Kiefernweg 1<br/>53474 Bad Neuenahr-Ahrweiler</P>
    <H2>EU-Streitschlichtung</H2><P>Plattform der EU: <a href="https://ec.europa.eu/consumers/odr" style={{ color: brand.primary }}>https://ec.europa.eu/consumers/odr</a>. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</P>
    <H2>Haftung für Inhalte</H2><P>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte verantwortlich. Nach §§ 8 bis 10 TMG sind wir nicht verpflichtet, fremde Informationen zu überwachen.</P>
    <H2>Haftung für Links</H2><P>Für Inhalte verlinkter Seiten ist stets der jeweilige Anbieter verantwortlich.</P>
    <H2>Urheberrecht</H2><P>Inhalte unterliegen dem deutschen Urheberrecht. Vervielfältigung bedarf der schriftlichen Zustimmung.</P>
    <div style={{ marginTop: 40, padding: 20, background: brand.bgMuted, borderRadius: 12, textAlign: "center" }}><p style={{ fontSize: 14, color: brand.textMuted, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Heart size={16} style={{ color: brand.accent }} /> Mit Herz aus dem Ahrtal — <a href="https://csv-support.de" style={{ color: brand.primary }}>csv-support.de</a></p></div>
    <P><em>Stand: März 2026</em></P>
  </W>;

  if (page === "datenschutz") return <W><H1>Datenschutzerklärung</H1>
    <H2>1. Verantwortlicher</H2><P>ETONI UG (haftungsbeschränkt), Kiefernweg 1, 53474 Bad Neuenahr-Ahrweiler, info@csv-support.de</P>
    <H2>2. Datenverarbeitung</H2><P>Wir verarbeiten personenbezogene Daten nur zur Bereitstellung unserer Dienste oder mit Einwilligung.</P>
    <H2>3. Zwecke und Rechtsgrundlagen</H2><P><strong>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):</strong> Account-Daten, hochgeladene Briefe und Fotos, generierte Schreiben, Zahlungsdaten.</P><P><strong>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f):</strong> Fehleranalyse, Missbrauchsprävention.</P><P><strong>Einwilligung (Art. 6 Abs. 1 lit. a):</strong> Analyse-Cookies, Newsletter.</P><P><strong>Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c):</strong> Rechnungsdaten (10 Jahre).</P>
    <H2>4. Besonderer Hinweis: Foto-/PDF-Upload</H2><P>Hochgeladene Fotos und PDFs werden ausschließlich zur Texterkennung und Analyse verarbeitet. Die Verarbeitung erfolgt über die Anthropic Claude API (Vision). Bilder werden nicht dauerhaft auf Anthropic-Servern gespeichert. Die Übertragung ist durch TLS 1.3 verschlüsselt.</P>
    <H2>5. Empfänger</H2><P>Anthropic (KI-Analyse/Vision, USA — EU-Standardvertragsklauseln), Stripe (Zahlungen), EU-Hosting.</P>
    <H2>6. Speicherdauer</H2><P>Account-Daten: bis Löschung. Briefe/Fotos: bis Löschung durch Nutzer. Zahlungsdaten: 10 Jahre. Logs: 7 Tage.</P>
    <H2>7. Cookies</H2><P>Technisch notwendige Cookies immer aktiv. Analyse/Marketing nur mit Einwilligung. Widerruf über "Cookie-Einstellungen" im Footer.</P>
    <H2>8. Ihre Rechte</H2><P>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21). Aufsichtsbehörde: LfDI Rheinland-Pfalz.</P>
    <P><em>Stand: März 2026</em></P>
  </W>;

  if (page === "agb") return <W><H1>Allgemeine Geschäftsbedingungen</H1>
    <H2>§ 1 Geltungsbereich</H2><P>Diese AGB gelten für „KlarBrief24" der ETONI UG (haftungsbeschränkt), Kiefernweg 1, 53474 Bad Neuenahr-Ahrweiler.</P>
    <H2>§ 2 Leistungsbeschreibung</H2><P>KlarBrief24 bietet KI-gestützte Analyse amtlicher Schreiben inkl. Foto-/PDF-Erkennung. Leistungsumfang variiert je nach Tarif.</P>
    <H2>§ 3 Vertragsschluss</H2><P>Vertrag durch Registrierung. Bei Bezahl-Tarifen zusätzlich durch Zahlungsabschluss.</P>
    <H2>§ 4 Preise und Zahlung</H2><P>Preise inkl. MwSt. Zahlung über Stripe.</P>
    <H2>§ 5 Kündigung</H2><P>Monatsabos jederzeit zum Monatsende kündbar. Jahresabos verlängern sich automatisch (30 Tage Kündigungsfrist).</P>
    <H2>§ 6 Haftung</H2><P><strong>KlarBrief24 ist keine Rechtsberatung.</strong> Keine Haftung für inhaltliche Richtigkeit der KI-Analysen. Bei komplexen Rechtsfragen wird ein Anwalt empfohlen.</P>
    <H2>§ 7 Datenschutz</H2><P>Siehe Datenschutzerklärung unter /datenschutz.</P>
    <H2>§ 8 Schlussbestimmungen</H2><P>Deutsches Recht. Salvatorische Klausel.</P>
    <P><em>Stand: März 2026</em></P>
  </W>;

  if (page === "widerruf") return <W><H1>Widerrufsbelehrung</H1>
    <H2>Widerrufsrecht</H2><P>14 Tage Widerrufsfrist ab Vertragsschluss ohne Angabe von Gründen.</P><P>An: ETONI UG (haftungsbeschränkt), Kiefernweg 1, 53474 Bad Neuenahr-Ahrweiler, info@csv-support.de</P>
    <H2>Folgen des Widerrufs</H2><P>Rückzahlung aller Zahlungen innerhalb von 14 Tagen nach Widerruf.</P>
    <H2>Muster-Widerrufsformular</H2>
    <div style={{ padding: 20, background: brand.bgMuted, borderRadius: 12 }}><P>An: ETONI UG, Kiefernweg 1, 53474 Bad Neuenahr-Ahrweiler</P><P>Hiermit widerrufe ich den Vertrag über: KlarBrief24 [Tarif]</P><P>Bestellt am: ___ / Name: ___ / Anschrift: ___ / Datum: ___</P></div>
    <P><em>Stand: März 2026</em></P>
  </W>;
  return null;
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showCookies, setShowCookies] = useState(() => !localStorage.getItem("kb_cookies_accepted"));
  const isLoggedIn = !!user;
  const isAdmin = user?.isAdmin;
  const ADMIN_EMAIL = "info@csv-support.de";

  // ── Supabase session check on mount + listener ──
  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        if (session?.user) {
          const { data: profile } = await getProfile(session.user.id);
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: profile ? `${profile.vorname || ""} ${profile.nachname || ""}`.trim() || session.user.email.split("@")[0] : session.user.email.split("@")[0],
            isAdmin: session.user.email === ADMIN_EMAIL || profile?.is_admin,
          });
        }
      } catch (e) { console.warn("Session check failed:", e); }
      setAuthLoading(false);
    })();

    // Listen for auth changes (login/logout across tabs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setUser(null);
      if (event === "SIGNED_IN" && session?.user) {
        getProfile(session.user.id).then(({ data: profile }) => {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: profile ? `${profile.vorname || ""} ${profile.nachname || ""}`.trim() || session.user.email.split("@")[0] : session.user.email.split("@")[0],
            isAdmin: session.user.email === ADMIN_EMAIL || profile?.is_admin,
          });
        });
      }
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setPage("home");
  };
  const handleCookieAccept = () => { setShowCookies(false); localStorage.setItem("kb_cookies_accepted", "1"); };

  if (authLoading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: brand.bg }}>
    <div style={{ textAlign: "center" }}>
      <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: brand.primary }} />
      <p style={{ marginTop: 16, color: brand.textMuted, fontSize: 14 }}>Lade...</p>
    </div>
  </div>;

  const renderPage = () => {
    switch (page) {
      case "home": return <HomePage setPage={setPage} />;
      case "features": return <FeaturesPage />;
      case "usecases": return <UseCasesPage setPage={setPage} />;
      case "pricing": return <PricingPage setPage={setPage} />;
      case "blog": return <BlogPage />;
      case "about": return <AboutPage />;
      case "login": return <AuthPage mode="login" setPage={setPage} onLogin={setUser} />;
      case "register": return <AuthPage mode="register" setPage={setPage} onLogin={setUser} />;
      case "dashboard": return isLoggedIn ? <DashboardPage user={user} setUser={setUser} setPage={setPage} /> : <AuthPage mode="login" setPage={setPage} onLogin={setUser} />;
      case "admin": return isLoggedIn && isAdmin ? <AdminPage /> : <AuthPage mode="login" setPage={setPage} onLogin={setUser} />;
      case "angebot": return <OfferPage setPage={setPage} />;
      case "danke": return <ThankYouPage setPage={setPage} />;
      case "impressum": case "datenschutz": case "agb": case "widerruf": return <LegalPage page={page} />;
      default: return <HomePage setPage={setPage} />;
    }
  };

  return <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", minHeight: "100vh", background: page === "login" || page === "register" ? brand.bgMuted : brand.bg, color: brand.text }}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body { background: ${brand.bg}; }
      ::selection { background: ${brand.primary}25; color: ${brand.primary}; }
      a { color: ${brand.primary}; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @media (max-width: 768px) { .nav-desktop { display: none !important; } .nav-mobile-btn { display: block !important; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      @media print { nav, footer, button, .no-print { display: none !important; } }
    `}</style>
    <Navbar page={page} setPage={setPage} isLoggedIn={isLoggedIn} isAdmin={isAdmin} onLogout={handleLogout} />
    {renderPage()}
    {!["login","register"].includes(page) && <Footer setPage={setPage} />}
    {showCookies && <CookieBanner onAccept={handleCookieAccept} />}
  </div>;
}
