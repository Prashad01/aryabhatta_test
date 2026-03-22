// ============================================================
// ARYABHATTA ADMIN PANEL
// Features: User ID login, content management, PDF uploads,
// Q&A builder, Notes builder — all synced to main website
// via localStorage
// ============================================================
import { db, storage } from '../firebase';

import {
  collection, addDoc, getDocs, doc,
  updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL
} from "firebase/storage";

import { useState, useEffect, useRef } from "react";

// ── DEFAULT ADMIN USERS ──────────────────────────────────────
// Stored in localStorage under "aryabhatta_users"
// Format: [{ id, username, password, role, createdAt }]
const DEFAULT_USERS = [
  { id: "admin-001", username: "admin", password: "admin123", role: "superadmin", name: "Super Admin", createdAt: Date.now() },
];

// ── STORAGE HELPERS (localStorage fallback only for users/categories) ──
const store = {
  get: (key, fallback = []) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { console.warn("Storage full"); } },
};

function initUsers() {
  const existing = store.get("aryabhatta_users", null);
  if (!existing) store.set("aryabhatta_users", DEFAULT_USERS);
  return store.get("aryabhatta_users", DEFAULT_USERS);
}

// ── UTILS ────────────────────────────────────────────────────
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtSize = (b) => { if (!b) return ""; if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(1) + " MB"; };

const CATEGORIES_DEFAULT = ["Class 10", "Class 11", "Class 12", "BA", "B.Sc", "B.COM", "Competitive", "General GK"];
const SUBJECTS = ["Assamese", "Math", "English", "Computer", "Physics", "Chemistry", "Biology", "History", "Geography", "Economics", "Other"];
const CONTENT_TYPES = [
  { id: "notes", icon: "📝", name: "Notes / Article", desc: "Text notes with headings, paragraphs & tips" },
  { id: "qa", icon: "❓", name: "Q&A Sheet", desc: "Question and answer pairs" },
  { id: "pdf", icon: "📄", name: "PDF Upload", desc: "Upload a PDF for students to download" },
  { id: "file", icon: "📎", name: "File / Resource", desc: "Any file: image, doc, zip, etc." },
];
const typeBadge = (t) => ({ notes: "badge-blue", qa: "badge-purple", pdf: "badge-yellow", file: "badge-gray" }[t] || "badge-gray");
const typeLabel = (t) => ({ notes: "Notes", qa: "Q&A", pdf: "PDF", file: "File" }[t] || t);

// ── STYLES ───────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0d1117; --surface: #161b22; --surface2: #1c2330; --surface3: #21262d;
    --border: #30363d; --border2: #3d444d;
    --primary: #58a6ff; --primary-dim: rgba(88,166,255,0.15);
    --success: #3fb950; --success-dim: rgba(63,185,80,0.15);
    --warn: #d29922; --warn-dim: rgba(210,153,34,0.15);
    --danger: #f85149; --danger-dim: rgba(248,81,73,0.15);
    --purple: #bc8cff; --purple-dim: rgba(188,140,255,0.12);
    --text: #e6edf3; --text2: #8b949e; --text3: #484f58;
    --radius: 8px; --radius-lg: 12px;
    --shadow: 0 8px 32px rgba(0,0,0,0.4);
    --font: 'DM Sans', sans-serif; --mono: 'DM Mono', monospace;
  }

  html, body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.5; min-height: 100vh; }

  /* LOGIN */
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 20px; }
  .login-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 40px; width: 100%; max-width: 400px; box-shadow: var(--shadow); }
  .login-logo { text-align: center; margin-bottom: 28px; }
  .login-logo h1 { font-size: 1.6rem; font-weight: 800; color: var(--text); }
  .login-logo h1 span { color: var(--primary); }
  .login-logo p { font-size: 0.82rem; color: var(--text2); margin-top: 4px; }
  .login-badge { display: inline-block; background: var(--primary-dim); color: var(--primary); font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(88,166,255,0.3); margin-bottom: 8px; }
  .login-error { background: var(--danger-dim); border: 1px solid rgba(248,81,73,0.3); border-radius: var(--radius); padding: 10px 14px; font-size: 0.84rem; color: var(--danger); margin-bottom: 16px; }

  /* LAYOUT */
  .admin-shell { display: flex; min-height: 100vh; }
  .sidebar { width: 240px; min-width: 240px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .sidebar-logo { padding: 20px 20px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .logo-text { font-size: 1rem; font-weight: 700; color: var(--text); }
  .logo-text span { color: var(--primary); }
  .logo-badge { font-size: 0.6rem; font-weight: 600; background: var(--primary-dim); color: var(--primary); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(88,166,255,0.3); margin-left: auto; }
  .sidebar-section { padding: 14px 12px 8px; }
  .sidebar-label { font-size: 0.68rem; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; padding: 0 8px 6px; }
  .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius); cursor: pointer; transition: all 0.15s; color: var(--text2); font-size: 0.88rem; font-weight: 500; }
  .sidebar-item:hover { background: var(--surface3); color: var(--text); }
  .sidebar-item.active { background: var(--primary-dim); color: var(--primary); }
  .sidebar-item .s-icon { font-size: 1rem; width: 20px; text-align: center; }
  .sidebar-item .s-count { margin-left: auto; font-size: 0.7rem; background: var(--surface3); padding: 1px 7px; border-radius: 10px; color: var(--text2); }
  .sidebar-item.active .s-count { background: rgba(88,166,255,0.2); color: var(--primary); }
  .sidebar-footer { margin-top: auto; padding: 14px 16px; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text3); }
  .sidebar-footer strong { color: var(--text2); display: block; margin-bottom: 2px; }
  .user-pill { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 12px; margin-bottom: 10px; }
  .user-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--primary-dim); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: var(--primary); flex-shrink: 0; }
  .user-info { flex: 1; min-width: 0; }
  .user-name { font-size: 0.82rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .user-role { font-size: 0.68rem; color: var(--text3); text-transform: capitalize; }
  .logout-btn { background: none; border: none; color: var(--text3); font-size: 0.8rem; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
  .logout-btn:hover { color: var(--danger); }

  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .topbar { height: 56px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; gap: 16px; background: var(--surface); position: sticky; top: 0; z-index: 50; }
  .topbar-title { font-size: 1rem; font-weight: 600; color: var(--text); }
  .topbar-title span { color: var(--text2); font-weight: 400; font-size: 0.85rem; margin-left: 6px; }
  .topbar-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .content { padding: 24px; flex: 1; }

  /* BUTTONS */
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--radius); border: 1px solid transparent; font-family: var(--font); font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .btn-primary { background: var(--primary); color: #0d1117; border-color: var(--primary); }
  .btn-primary:hover { opacity: 0.88; }
  .btn-secondary { background: var(--surface3); color: var(--text); border-color: var(--border); }
  .btn-secondary:hover { border-color: var(--border2); }
  .btn-danger { background: var(--danger-dim); color: var(--danger); border-color: rgba(248,81,73,0.3); }
  .btn-danger:hover { background: rgba(248,81,73,0.25); }
  .btn-success { background: var(--success-dim); color: var(--success); border-color: rgba(63,185,80,0.3); }
  .btn-success:hover { background: rgba(63,185,80,0.25); }
  .btn-warn { background: var(--warn-dim); color: var(--warn); border-color: rgba(210,153,34,0.3); }
  .btn-sm { padding: 4px 10px; font-size: 0.78rem; }
  .btn-icon { padding: 6px 8px; }
  .btn-full { width: 100%; justify-content: center; padding: 11px 14px; }

  /* CARDS */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
  .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .card-title { font-size: 0.92rem; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 8px; }
  .card-body { padding: 20px; }

  /* STATS */
  .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 20px; }
  .stat-label { font-size: 0.75rem; color: var(--text2); font-weight: 500; margin-bottom: 8px; }
  .stat-value { font-size: 1.8rem; font-weight: 700; color: var(--text); font-family: var(--mono); line-height: 1; }
  .stat-sub { font-size: 0.72rem; color: var(--text3); margin-top: 4px; }
  .stat-icon { font-size: 1.1rem; float: right; margin-top: -28px; }

  /* TABLE */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 0.72rem; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  td { padding: 11px 14px; border-bottom: 1px solid var(--border); font-size: 0.85rem; color: var(--text); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(255,255,255,0.02); }

  /* BADGES */
  .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
  .badge-blue { background: var(--primary-dim); color: var(--primary); border: 1px solid rgba(88,166,255,0.2); }
  .badge-green { background: var(--success-dim); color: var(--success); border: 1px solid rgba(63,185,80,0.2); }
  .badge-yellow { background: var(--warn-dim); color: var(--warn); border: 1px solid rgba(210,153,34,0.2); }
  .badge-red { background: var(--danger-dim); color: var(--danger); border: 1px solid rgba(248,81,73,0.2); }
  .badge-purple { background: var(--purple-dim); color: var(--purple); border: 1px solid rgba(188,140,255,0.2); }
  .badge-gray { background: var(--surface3); color: var(--text2); border: 1px solid var(--border); }

  /* FORMS */
  .form-grid { display: grid; gap: 16px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text2); }
  .form-label .req { color: var(--danger); margin-left: 2px; }
  .form-input, .form-select, .form-textarea { background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-family: var(--font); font-size: 0.88rem; padding: 8px 12px; outline: none; transition: border-color 0.15s; width: 100%; }
  .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--primary); }
  .form-textarea { resize: vertical; min-height: 90px; line-height: 1.6; }
  .form-select option { background: var(--surface2); }
  .form-hint { font-size: 0.74rem; color: var(--text3); }

  /* Q&A BUILDER */
  .qa-block { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 10px; position: relative; }
  .qa-block-num { position: absolute; top: -10px; left: 12px; font-size: 0.68rem; font-weight: 700; background: var(--primary); color: #0d1117; padding: 1px 8px; border-radius: 10px; }
  .qa-list { display: flex; flex-direction: column; gap: 12px; }
  .add-qa-btn { border: 1px dashed var(--border2); background: transparent; color: var(--text2); border-radius: var(--radius); padding: 10px; font-family: var(--font); font-size: 0.84rem; cursor: pointer; transition: all 0.15s; width: 100%; text-align: center; }
  .add-qa-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-dim); }

  /* DROP ZONE */
  .dropzone { border: 2px dashed var(--border2); border-radius: var(--radius-lg); padding: 32px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--surface2); }
  .dropzone:hover, .dropzone.drag-over { border-color: var(--primary); background: var(--primary-dim); }
  .dropzone-icon { font-size: 2rem; margin-bottom: 10px; }
  .dropzone-text { font-size: 0.88rem; color: var(--text2); }
  .dropzone-text strong { color: var(--primary); }
  .dropzone-hint { font-size: 0.75rem; color: var(--text3); margin-top: 6px; }
  .file-preview { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
  .file-preview-name { font-size: 0.85rem; font-weight: 500; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-preview-size { font-size: 0.75rem; color: var(--text3); }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); animation: fadeIn 0.15s ease; }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow); animation: slideUp 0.2s ease; }
  .modal-sm { max-width: 440px; }
  .modal-header { padding: 18px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: var(--surface); z-index: 1; }
  .modal-title { font-size: 1rem; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
  .modal-body { padding: 22px; }
  .modal-footer { padding: 16px 22px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }
  .close-btn { background: none; border: none; color: var(--text2); font-size: 1.2rem; cursor: pointer; }
  .close-btn:hover { color: var(--text); }

  /* TOAST */
  .toast-wrap { position: fixed; bottom: 20px; right: 20px; z-index: 300; display: flex; flex-direction: column; gap: 8px; }
  .toast { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; font-size: 0.85rem; color: var(--text); box-shadow: var(--shadow); display: flex; align-items: center; gap: 10px; min-width: 260px; animation: slideInRight 0.2s ease; }
  .toast.success { border-left: 3px solid var(--success); }
  .toast.error { border-left: 3px solid var(--danger); }
  .toast.info { border-left: 3px solid var(--primary); }

  /* SEARCH BAR */
  .search-bar { background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 12px; display: flex; align-items: center; gap: 8px; min-width: 200px; }
  .search-bar input { background: none; border: none; outline: none; color: var(--text); font-family: var(--font); font-size: 0.85rem; flex: 1; }
  .search-bar input::placeholder { color: var(--text3); }

  /* TAB STRIP */
  .tab-strip { display: flex; gap: 2px; background: var(--surface2); border-radius: var(--radius); padding: 3px; border: 1px solid var(--border); }
  .tab-btn { padding: 6px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 500; cursor: pointer; background: none; border: none; color: var(--text2); font-family: var(--font); transition: all 0.15s; }
  .tab-btn.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }

  /* EMPTY */
  .empty-state { text-align: center; padding: 48px 20px; color: var(--text2); }
  .empty-state-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; }

  /* TYPE CARDS */
  .type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
  .type-card { background: var(--surface2); border: 1.5px solid var(--border); border-radius: var(--radius-lg); padding: 16px; cursor: pointer; transition: all 0.15s; text-align: center; }
  .type-card:hover { border-color: var(--border2); }
  .type-card.selected { border-color: var(--primary); background: var(--primary-dim); }
  .type-card-icon { font-size: 1.6rem; margin-bottom: 6px; }
  .type-card-name { font-size: 0.84rem; font-weight: 600; color: var(--text); }
  .type-card-desc { font-size: 0.74rem; color: var(--text2); margin-top: 3px; }

  /* PROGRESS */
  .progress-bar { height: 4px; background: var(--surface3); border-radius: 2px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--primary); border-radius: 2px; transition: width 0.3s; }

  /* PREVIEW */
  .preview-note h3 { font-size: 0.95rem; font-weight: 700; color: var(--primary); border-left: 3px solid var(--primary); padding-left: 10px; margin-bottom: 8px; }
  .preview-note p { font-size: 0.85rem; color: var(--text2); line-height: 1.7; margin-bottom: 10px; }
  .preview-formula { background: #1a2040; border: 1px solid #3d4f8c; border-radius: 6px; padding: 10px 14px; font-family: var(--mono); font-size: 0.85rem; color: #a5b4fc; margin-bottom: 10px; white-space: pre-wrap; }
  .preview-answer { background: #0d2018; border: 1px solid #2a5c3a; border-radius: 6px; padding: 10px 14px; font-size: 0.85rem; color: #6ee7b7; margin-bottom: 10px; }
  .preview-tip { background: #1a1400; border: 1px solid #4a3800; border-radius: 6px; padding: 10px 14px; font-size: 0.82rem; color: #fbbf24; margin-bottom: 10px; }

  /* USER MANAGEMENT */
  .user-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; align-items: center; gap: 14px; }
  .user-card-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-dim); display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 700; color: var(--primary); flex-shrink: 0; border: 2px solid rgba(88,166,255,0.3); }
  .user-card-info { flex: 1; }
  .user-card-name { font-size: 0.9rem; font-weight: 600; color: var(--text); }
  .user-card-id { font-size: 0.74rem; color: var(--text3); font-family: var(--mono); }
  .users-grid { display: grid; gap: 10px; }

  /* CAT MANAGER */
  .cat-row { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
  .cat-row-icon { font-size: 1.3rem; }
  .cat-row-name { flex: 1; font-size: 0.88rem; font-weight: 500; }

  /* ANIMATIONS */
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes slideInRight { from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: translateX(0) } }

  @media (max-width: 768px) {
    .sidebar { width: 200px; min-width: 200px; }
    .form-row { grid-template-columns: 1fr; }
    .stats-row { grid-template-columns: repeat(2, 1fr); }
    .type-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 580px) {
    .admin-shell { flex-direction: column; }
    .sidebar { width: 100%; height: auto; position: static; }
    .stats-row { grid-template-columns: 1fr 1fr; }
  }
`;

function StyleTag() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

// ── TOAST ─────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = (msg, type = "success") => {
    const id = genId();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  };
  return { toasts, toast };
}
function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"} {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── LOGIN PAGE ────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [uid, setUid] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setErr("");
    if (!uid.trim() || !pw.trim()) { setErr("Please enter both User ID and password."); return; }
    setLoading(true);
    setTimeout(() => {
      const users = store.get("aryabhatta_users", DEFAULT_USERS);
      const user = users.find(u => (u.username === uid.trim() || u.id === uid.trim()) && u.password === pw);
      if (user) {
        onLogin(user);
      } else {
        setErr("Invalid User ID or password. Try: admin / admin123");
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-badge">🛡️ Admin Access</div>
          <h1><span>Arya</span>bhatta</h1>
          <p>Sign in to manage content</p>
        </div>
        {err && <div className="login-error">⚠️ {err}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">User ID</label>
            <input className="form-input" placeholder="Enter your User ID or username" value={uid}
              onChange={e => setUid(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
            {/* <span className="form-hint">Default: admin</span> */}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Enter password" value={pw}
              onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
            {/* <span className="form-hint">Default: admin123</span> */}
          </div>
          <button className="btn btn-primary btn-full" onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DROP ZONE ─────────────────────────────────────────────────
function DropZone({ accept, onFile, file, onClear }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const handle = (f) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => onFile({ name: f.name, size: f.size, type: f.type, dataUrl: e.target.result });
    reader.readAsDataURL(f);
  };
  if (file) return (
    <div className="file-preview">
      <span style={{ fontSize: "1.4rem" }}>{file.type?.includes("pdf") ? "📄" : "📎"}</span>
      <span className="file-preview-name">{file.name}</span>
      <span className="file-preview-size">{fmtSize(file.size)}</span>
      <button className="btn btn-sm btn-danger btn-icon" onClick={onClear}>✕</button>
    </div>
  );
  return (
    <div className={`dropzone${drag ? " drag-over" : ""}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => ref.current.click()}>
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={e => handle(e.target.files[0])} />
      <div className="dropzone-icon">☁️</div>
      <div className="dropzone-text"><strong>Click to upload</strong> or drag & drop</div>
      <div className="dropzone-hint">{accept || "Any file type"}</div>
    </div>
  );
}

// ── Q&A BUILDER ───────────────────────────────────────────────
function QABuilder({ pairs, onChange }) {
  const update = (i, f, v) => onChange(pairs.map((p, idx) => idx === i ? { ...p, [f]: v } : p));
  const add = () => onChange([...pairs, { q: "", a: "" }]);
  const remove = (i) => onChange(pairs.filter((_, idx) => idx !== i));
  return (
    <div>
      <div className="qa-list">
        {pairs.map((pair, i) => (
          <div key={i} className="qa-block">
            <span className="qa-block-num">Q{i + 1}</span>
            <div className="form-group" style={{ marginTop: 6 }}>
              <label className="form-label">Question</label>
              <textarea className="form-textarea" style={{ minHeight: 60 }} placeholder="Enter question…" value={pair.q} onChange={e => update(i, "q", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Answer</label>
              <textarea className="form-textarea" style={{ minHeight: 70 }} placeholder="Enter answer…" value={pair.a} onChange={e => update(i, "a", e.target.value)} />
            </div>
            {pairs.length > 1 && <div style={{ textAlign: "right" }}><button className="btn btn-sm btn-danger" onClick={() => remove(i)}>Remove</button></div>}
          </div>
        ))}
      </div>
      <button className="add-qa-btn" style={{ marginTop: 10 }} onClick={add}>＋ Add Q&A Pair</button>
    </div>
  );
}

// ── NOTES BUILDER ─────────────────────────────────────────────
const BLOCK_TYPES = [
  { id: "heading", label: "Heading", icon: "H" },
  { id: "para", label: "Paragraph", icon: "¶" },
  { id: "formula", label: "Formula/Code", icon: "fx" },
  { id: "answer", label: "Answer Box", icon: "✓" },
  { id: "tip", label: "Tip/Note", icon: "💡" },
];
function NotesBuilder({ blocks, onChange }) {
  const update = (i, f, v) => onChange(blocks.map((b, idx) => idx === i ? { ...b, [f]: v } : b));
  const remove = (i) => onChange(blocks.filter((_, idx) => idx !== i));
  const add = (type) => onChange([...blocks, { type, text: "", label: type === "answer" ? "Answer:" : "" }]);
  return (
    <div>
      <div className="qa-list">
        {blocks.map((b, i) => (
          <div key={i} className="qa-block">
            <span className="qa-block-num">{BLOCK_TYPES.find(t => t.id === b.type)?.icon || b.type}</span>
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
              <select className="form-select" style={{ width: 160 }} value={b.type} onChange={e => update(i, "type", e.target.value)}>
                {BLOCK_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {b.type === "answer" && <input className="form-input" style={{ width: 130 }} placeholder="Label" value={b.label} onChange={e => update(i, "label", e.target.value)} />}
              {blocks.length > 1 && <button className="btn btn-sm btn-danger btn-icon" style={{ marginLeft: "auto" }} onClick={() => remove(i)}>✕</button>}
            </div>
            <textarea className="form-textarea" style={{ minHeight: 70 }} placeholder={`Enter ${b.type} content…`} value={b.text} onChange={e => update(i, "text", e.target.value)} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {BLOCK_TYPES.map(t => <button key={t.id} className="btn btn-secondary btn-sm" onClick={() => add(t.id)}>+ {t.label}</button>)}
      </div>
    </div>
  );
}

// ── CONTENT MODAL ─────────────────────────────────────────────
function ContentModal({ mode, initial, customCategories, onClose, onSave }) {
  const isEdit = mode === "edit";
  const [step, setStep] = useState(isEdit ? 1 : 0);
  const [contentType, setContentType] = useState(initial?.contentType || "notes");
  const [form, setForm] = useState({
    title: initial?.title || "",
    subject: initial?.subject || "Select Subject",
    category: initial?.category || (customCategories[0]?.name || "Class 10"),
    summary: initial?.summary || "",
    status: initial?.status || "published",
    tags: initial?.tags || "",
  });
  const [blocks, setBlocks] = useState(initial?.content?.length ? initial.content : [{ type: "heading", text: "" }, { type: "para", text: "" }]);
  const [qaPairs, setQaPairs] = useState(initial?.qaPairs?.length ? initial.qaPairs : [{ q: "", a: "" }]);
  const [file, setFile] = useState(initial?.file || null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const allCats = customCategories.length > 0
    ? customCategories.map(c => c.name)
    : CATEGORIES_DEFAULT;

  const handleSave = () => {
    if (!form.title.trim()) { alert("Title is required."); return; }
    onSave({
      ...form,
      contentType: isEdit ? initial.contentType : contentType,
      content: contentType === "notes" ? blocks : [],
      qaPairs: contentType === "qa" ? qaPairs : [],
      file: (contentType === "pdf" || contentType === "file") ? file : null,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "✏️ Edit Content" : step === 0 ? "➕ Choose Content Type" : `➕ New ${typeLabel(contentType)}`}</div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {step === 0 && !isEdit && (
            <div>
              <p style={{ fontSize: "0.84rem", color: "var(--text2)", marginBottom: 14 }}>What kind of content do you want to add?</p>
              <div className="type-grid">
                {CONTENT_TYPES.map(t => (
                  <div key={t.id} className={`type-card${contentType === t.id ? " selected" : ""}`} onClick={() => setContentType(t.id)}>
                    <div className="type-card-icon">{t.icon}</div>
                    <div className="type-card-name">{t.name}</div>
                    <div className="type-card-desc">{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(step === 1 || isEdit) && (
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Title <span className="req">*</span></label>
                <input className="form-input" placeholder="Enter a descriptive title…" value={form.title} onChange={e => set("title", e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select className="form-select" value={form.subject} onChange={e => set("subject", e.target.value)}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => set("category", e.target.value)}>
                    {allCats.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Summary</label>
                <textarea className="form-textarea" style={{ minHeight: 70 }} placeholder="Brief description shown on cards…" value={form.summary} onChange={e => set("summary", e.target.value)} />
              </div>
              {contentType === "notes" && (
                <div className="form-group">
                  <label className="form-label">Content Blocks</label>
                  <NotesBuilder blocks={blocks} onChange={setBlocks} />
                </div>
              )}
              {contentType === "qa" && (
                <div className="form-group">
                  <label className="form-label">Questions & Answers</label>
                  <QABuilder pairs={qaPairs} onChange={setQaPairs} />
                </div>
              )}
              {contentType === "pdf" && (
                <div className="form-group">
                  <label className="form-label">PDF File</label>
                  <DropZone accept=".pdf,application/pdf" onFile={setFile} file={file} onClear={() => setFile(null)} />
                </div>
              )}
              {contentType === "file" && (
                <div className="form-group">
                  <label className="form-label">File / Resource</label>
                  <DropZone accept="*" onFile={setFile} file={file} onClear={() => setFile(null)} />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tags (comma-separated)</label>
                  <input className="form-input" placeholder="e.g. algebra, chapter3" value={form.tags} onChange={e => set("tags", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => set("status", e.target.value)}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {step === 0 && !isEdit && (
            <><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => setStep(1)}>Continue →</button></>
          )}
          {(step === 1 || isEdit) && (
            <>{!isEdit && <button className="btn btn-secondary" onClick={() => setStep(0)}>← Back</button>}{isEdit && <button className="btn btn-secondary" onClick={onClose}>Cancel</button>}<button className="btn btn-success" onClick={handleSave}>{isEdit ? "💾 Save Changes" : "🚀 Publish"}</button></>
          )}
        </div>
      </div>
    </div>
  );
}

// ── VIEW MODAL ────────────────────────────────────────────────
function ViewModal({ post, onClose }) {
  const renderBlock = (b, i) => {
    switch (b.type) {
      case "heading": return <div key={i} className="preview-note"><h3>{b.text}</h3></div>;
      case "para": return <div key={i} className="preview-note"><p>{b.text}</p></div>;
      case "formula": return <div key={i} className="preview-formula">{b.text}</div>;
      case "answer": return <div key={i} className="preview-answer"><strong style={{ display: "block", marginBottom: 4, fontSize: "0.78rem" }}>{b.label}</strong>{b.text}</div>;
      case "tip": return <div key={i} className="preview-tip">{b.text}</div>;
      default: return null;
    }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">👁️ Preview</div><button className="close-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span className={`badge ${typeBadge(post.contentType)}`}>{typeLabel(post.contentType)}</span>
            <span className="badge badge-blue">{post.subject}</span>
            <span className="badge badge-green">{post.category}</span>
            <span className={`badge ${post.status === "published" ? "badge-green" : "badge-gray"}`}>{post.status}</span>
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>{post.title}</h2>
          {post.summary && <p style={{ fontSize: "0.88rem", color: "var(--text2)", marginBottom: 16, fontStyle: "italic" }}>{post.summary}</p>}
          {post.contentType === "notes" && post.content?.map(renderBlock)}
          {post.contentType === "qa" && post.qaPairs?.map((p, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, color: "var(--primary)", fontSize: "0.9rem", marginBottom: 6 }}>Q{i + 1}. {p.q}</div>
              <div className="preview-answer">{p.a}</div>
            </div>
          ))}
          {(post.contentType === "pdf" || post.contentType === "file") && post.file && (
            <div className="file-preview" style={{ marginTop: 8 }}>
              <span style={{ fontSize: "1.4rem" }}>{post.contentType === "pdf" ? "📄" : "📎"}</span>
              <span className="file-preview-name">{post.file.name}</span>
              <span className="file-preview-size">{fmtSize(post.file.size)}</span>
              {post.file.dataUrl && <a href={post.file.dataUrl} download={post.file.name} className="btn btn-primary btn-sm">Download</a>}
            </div>
          )}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

// ── DELETE MODAL ──────────────────────────────────────────────
function DeleteModal({ title, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header"><div className="modal-title">🗑️ Confirm Delete</div><button className="close-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ background: "var(--danger-dim)", border: "1px solid rgba(248,81,73,0.3)", borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 14 }}>
            <p style={{ fontSize: "0.88rem", color: "var(--danger)" }}>⚠️ This cannot be undone.</p>
          </div>
          <p style={{ fontSize: "0.88rem", color: "var(--text2)" }}>Delete: <strong style={{ color: "var(--text)" }}>"{title}"</strong></p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete Permanently</button>
        </div>
      </div>
    </div>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────
function Sidebar({ page, setPage, counts, currentUser, onLogout }) {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span style={{ fontSize: "1.4rem" }}>🪐</span>
        <div className="logo-text"><span>Arya</span>bhatta</div>
        <span className="logo-badge">Admin</span>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-label">Overview</div>
        {[{ id: "dashboard", icon: "📊", label: "Dashboard" }, { id: "all", icon: "📋", label: "All Content", count: counts.all }].map(i => (
          <div key={i.id} className={`sidebar-item${page === i.id ? " active" : ""}`} onClick={() => setPage(i.id)}>
            <span className="s-icon">{i.icon}</span>{i.label}
            {i.count !== undefined && <span className="s-count">{i.count}</span>}
          </div>
        ))}
      </div>
      <div className="sidebar-section">
        <div className="sidebar-label">Content Types</div>
        {[{ id: "notes", icon: "📝", label: "Notes", count: counts.notes }, { id: "qa", icon: "❓", label: "Q&A", count: counts.qa }, { id: "pdf", icon: "📄", label: "PDFs", count: counts.pdf }, { id: "file", icon: "📎", label: "Files", count: counts.file }].map(i => (
          <div key={i.id} className={`sidebar-item${page === i.id ? " active" : ""}`} onClick={() => setPage(i.id)}>
            <span className="s-icon">{i.icon}</span>{i.label}<span className="s-count">{i.count}</span>
          </div>
        ))}
      </div>
      {currentUser?.role === "superadmin" && (
        <div className="sidebar-section">
          <div className="sidebar-label">Management</div>
          {[{ id: "users", icon: "👥", label: "Users" }, { id: "categories", icon: "📂", label: "Categories" }, { id: "settings", icon: "⚙️", label: "Settings" }].map(i => (
            <div key={i.id} className={`sidebar-item${page === i.id ? " active" : ""}`} onClick={() => setPage(i.id)}>
              <span className="s-icon">{i.icon}</span>{i.label}
            </div>
          ))}
        </div>
      )}
      <div className="sidebar-footer">
        <div className="user-pill">
          <div className="user-avatar">{currentUser?.name?.[0] || currentUser?.username?.[0] || "A"}</div>
          <div className="user-info">
            <div className="user-name">{currentUser?.name || currentUser?.username}</div>
            <div className="user-role">{currentUser?.role}</div>
          </div>
          <button className="logout-btn" title="Sign out" onClick={onLogout}>⏻</button>
        </div>
        <div>ID: <span style={{ fontFamily: "var(--mono)", color: "var(--text2)" }}>{currentUser?.id}</span></div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function DashboardPage({ posts, setPage }) {
  const counts = { all: posts.length, notes: posts.filter(p => p.contentType === "notes").length, qa: posts.filter(p => p.contentType === "qa").length, pdf: posts.filter(p => p.contentType === "pdf").length, file: posts.filter(p => p.contentType === "file").length, published: posts.filter(p => p.status === "published").length, draft: posts.filter(p => p.status === "draft").length };
  const recent = [...posts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  return (
    <div className="content">
      <div className="stats-row">
        {[{ label: "Total Content", value: counts.all, sub: "All types", icon: "📚" }, { label: "Published", value: counts.published, sub: "Live on site", icon: "🟢" }, { label: "Drafts", value: counts.draft, sub: "Not published", icon: "📂" }, { label: "PDFs Uploaded", value: counts.pdf, sub: "File uploads", icon: "📄" }].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
            <div className="stat-icon">{s.icon}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">📊 Breakdown</div></div>
          <div className="card-body">
            {[{ label: "Notes", count: counts.notes, color: "var(--primary)" }, { label: "Q&A", count: counts.qa, color: "var(--purple)" }, { label: "PDFs", count: counts.pdf, color: "var(--warn)" }, { label: "Files", count: counts.file, color: "var(--text2)" }].map((r, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--text2)" }}>{r.label}</span>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>{r.count}</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: counts.all ? `${(r.count / counts.all) * 100}%` : "0%", background: r.color }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">🕒 Recent Content</div><button className="btn btn-secondary btn-sm" onClick={() => setPage("all")}>View All</button></div>
          <div className="card-body" style={{ padding: "10px 20px" }}>
            {recent.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">📭</div><p>No content yet</p></div>
              : recent.map(p => (
                <div key={p.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span>{CONTENT_TYPES.find(t => t.id === p.contentType)?.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.84rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{fmtDate(p.createdAt)}</div>
                  </div>
                  <span className={`badge ${p.status === "published" ? "badge-green" : "badge-gray"}`}>{p.status}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CONTENT LIST ──────────────────────────────────────────────
function ContentPage({ posts, filter, onAdd, onEdit, onDelete, onView }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = posts.filter(p => {
    const matchType = filter === "all" || p.contentType === filter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.title?.toLowerCase().includes(q) || p.subject?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
    return matchType && matchStatus && matchSearch;
  }).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="content">
      <div className="card">
        <div className="card-header">
          <div className="card-title">{CONTENT_TYPES.find(t => t.id === filter)?.icon || "📋"} {filter === "all" ? "All Content" : CONTENT_TYPES.find(t => t.id === filter)?.name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="tab-strip">
              {["all", "published", "draft"].map(s => <button key={s} className={`tab-btn${statusFilter === s ? " active" : ""}`} onClick={() => setStatusFilter(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>)}
            </div>
            <div className="search-bar"><span style={{ color: "var(--text3)" }}>🔍</span><input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={onAdd}>➕ Add New</button>
          </div>
        </div>
        {filtered.length === 0
          ? <div className="empty-state"><div className="empty-state-icon">📭</div><p>{search ? "No results." : "No content yet."}</p></div>
          : <div className="table-wrap"><table>
            <thead><tr><th>Title</th><th>Type</th><th>Subject</th><th>Category</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map(p => (
              <tr key={p.id}>
                <td style={{ maxWidth: 240 }}>
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  {p.summary && <div style={{ fontSize: "0.74rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.summary}</div>}
                </td>
                <td><span className={`badge ${typeBadge(p.contentType)}`}>{CONTENT_TYPES.find(t => t.id === p.contentType)?.icon} {typeLabel(p.contentType)}</span></td>
                <td><span className="badge badge-blue">{p.subject}</span></td>
                <td><span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>{p.category}</span></td>
                <td><span className={`badge ${p.status === "published" ? "badge-green" : "badge-gray"}`}>{p.status === "published" ? "● " : "○ "}{p.status}</span></td>
                <td style={{ color: "var(--text2)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmtDate(p.createdAt)}</td>
                <td><div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onView(p)}>👁️</button>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onEdit(p)}>✏️</button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => onDelete(p)}>🗑️</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        }
      </div>
    </div>
  );
}

// ── USERS PAGE ────────────────────────────────────────────────
function UsersPage({ toast }) {
  const [users, setUsers] = useState(() => initUsers());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "editor" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const saveUsers = (next) => { setUsers(next); store.set("aryabhatta_users", next); };

  const handleAdd = () => {
    if (!form.username.trim() || !form.password.trim()) { toast("Username and password required.", "error"); return; }
    if (users.find(u => u.username === form.username.trim())) { toast("Username already exists.", "error"); return; }
    const newUser = { id: "uid-" + genId(), username: form.username.trim(), name: form.name.trim() || form.username.trim(), password: form.password, role: form.role, createdAt: Date.now() };
    saveUsers([...users, newUser]);
    setForm({ username: "", name: "", password: "", role: "editor" });
    setShowAdd(false);
    toast(`User "${newUser.username}" created. ID: ${newUser.id}`, "success");
  };

  const handleDelete = () => {
    if (deleteTarget.role === "superadmin") { toast("Cannot delete superadmin.", "error"); setDeleteTarget(null); return; }
    saveUsers(users.filter(u => u.id !== deleteTarget.id));
    toast(`User "${deleteTarget.username}" deleted.`, "info");
    setDeleteTarget(null);
  };

  return (
    <div className="content">
      <div style={{ display: "grid", gap: 16, maxWidth: 700 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">👥 Admin Users ({users.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>➕ Add User</button>
          </div>
          {showAdd && (
            <div className="card-body" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="form-grid">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Username <span className="req">*</span></label>
                    <input className="form-input" placeholder="e.g. teacher1" value={form.username} onChange={e => set("username", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" placeholder="Display name" value={form.name} onChange={e => set("name", e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Password <span className="req">*</span></label>
                    <input className="form-input" type="password" placeholder="Set a password" value={form.password} onChange={e => set("password", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-select" value={form.role} onChange={e => set("role", e.target.value)}>
                      <option value="editor">Editor</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-success" onClick={handleAdd}>✅ Create User</button>
                  <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          <div className="card-body">
            <div className="users-grid">
              {users.map(u => (
                <div key={u.id} className="user-card">
                  <div className="user-card-avatar">{(u.name || u.username)[0].toUpperCase()}</div>
                  <div className="user-card-info">
                    <div className="user-card-name">{u.name || u.username} <span className={`badge ${u.role === "superadmin" ? "badge-yellow" : "badge-blue"}`}>{u.role}</span></div>
                    <div className="user-card-id">@{u.username} · ID: {u.id}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>Created: {fmtDate(u.createdAt)}</div>
                  </div>
                  {u.role !== "superadmin" && (
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(u)}>🗑️</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">ℹ️ About User IDs</div></div>
          <div className="card-body">
            <p style={{ fontSize: "0.86rem", color: "var(--text2)", lineHeight: 1.7 }}>Each user gets a unique <strong style={{ color: "var(--primary)", fontFamily: "var(--mono)" }}>User ID</strong> automatically. They can log in using either their <strong style={{ color: "var(--text)" }}>username</strong> or their <strong style={{ color: "var(--text)" }}>User ID</strong> along with their password.</p>
          </div>
        </div>
      </div>
      {deleteTarget && <DeleteModal title={`user "${deleteTarget.username}"`} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
    </div>
  );
}

// ── CATEGORIES PAGE ───────────────────────────────────────────
function CategoriesPage({ categories, setCategories, toast }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📂");
  const icons = ["📂", "📗", "📘", "📙", "📕", "💻", "🔬", "🏆", "🌍", "📐", "🧪", "📖"];

  const save = (next) => { setCategories(next); store.set("aryabhatta_categories", next); };

  const handleAdd = () => {
    if (!name.trim()) { toast("Category name required.", "error"); return; }
    if (categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase())) { toast("Category already exists.", "error"); return; }
    save([...categories, { id: genId(), name: name.trim(), icon }]);
    setName(""); setIcon("📂");
    toast(`Category "${name}" added.`, "success");
  };

  const remove = (id) => { save(categories.filter(c => c.id !== id)); toast("Category removed.", "info"); };

  return (
    <div className="content">
      <div style={{ maxWidth: 560 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">📂 Categories ({categories.length})</div></div>
          <div className="card-body" style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Category Name</label>
                <input className="form-input" placeholder="e.g. Class 11, MBA, UPSC…" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} />
              </div>
              <div className="form-group">
                <label className="form-label">Icon</label>
                <select className="form-select" value={icon} onChange={e => setIcon(e.target.value)}>
                  {icons.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" style={{ marginBottom: 1 }} onClick={handleAdd}>Add</button>
            </div>
          </div>
          <div className="card-body">
            {categories.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">📭</div><p>No categories yet. Add one above.</p></div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {categories.map(c => (
                  <div key={c.id} className="cat-row">
                    <span className="cat-row-icon">{c.icon}</span>
                    <span className="cat-row-name">{c.name}</span>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(c.id)}>✕</button>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS PAGE ─────────────────────────────────────────────
function SettingsPage({ posts, setPosts, toast }) {
  const importRef = useRef();
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(posts, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "aryabhatta-content.json"; a.click();
    URL.revokeObjectURL(url);
    toast("Content exported.", "success");
  };
  const handleImport = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) { setPosts(data); store.set("aryabhatta_posts", data); toast(`Imported ${data.length} items.`, "success"); }
        else toast("Invalid format.", "error");
      } catch { toast("Failed to parse.", "error"); }
    };
    reader.readAsText(f);
  };
  return (
    <div className="content">
      <div style={{ maxWidth: 560 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">💾 Data Management</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", fontSize: "0.86rem", color: "var(--text2)" }}>
              Content is saved in <strong style={{ color: "var(--primary)" }}>browser localStorage</strong> and automatically synced to the main website. Export regularly.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={handleExport}>⬇️ Export JSON</button>
              <button className="btn btn-secondary" onClick={() => importRef.current.click()}>⬆️ Import JSON</button>
              <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <p style={{ fontSize: "0.84rem", color: "var(--text2)", marginBottom: 10 }}>Total items: <strong style={{ color: "var(--text)" }}>{posts.length}</strong></p>
              <button className="btn btn-danger" onClick={() => { if (confirm("Delete ALL content?")) { setPosts([]); store.set("aryabhatta_posts", []); toast("All content cleared.", "info"); } }}>🗑️ Clear All Content</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ADMIN APP ────────────────────────────────────────────
export default function AryabhattaAdmin() {
  const { toasts, toast } = useToast();

  // Auth state
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("aryabhatta_session") || "null"); } catch { return null; }
  });

  // Content state — now from Firebase
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState(() => store.get("aryabhatta_categories", []));
  const [loading, setLoading] = useState(true);

  // Listen to Firestore in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "posts"), (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setPosts(data);
      // Also sync to localStorage so main site can read it
      store.set("aryabhatta_posts", data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const [page, setPage] = useState("dashboard");
  const [addModal, setAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  const handleLogin = (user) => {
    setCurrentUser(user);
    sessionStorage.setItem("aryabhatta_session", JSON.stringify(user));
    toast(`Welcome back, ${user.name || user.username}!`, "success");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem("aryabhatta_session");
  };

  // Upload file to Firebase Storage, return download URL
  const uploadFile = async (file) => {
    if (!file?.dataUrl) return null;
    const blob = await fetch(file.dataUrl).then(r => r.blob());
    const fileRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, blob);
    const url = await getDownloadURL(fileRef);
    return { name: file.name, size: file.size, type: file.type, dataUrl: url };
  };

  // Save new post to Firestore
  const handleSave = async (data) => {
    try {
      let fileData = null;
      if (data.file) {
        toast("Uploading file…", "info");
        fileData = await uploadFile(data.file);
      }
      await addDoc(collection(db, "posts"), {
        ...data,
        file: fileData,
        createdAt: Date.now(),
        createdBy: currentUser?.id,
      });
      setAddModal(false);
      toast(`"${data.title}" ${data.status === "published" ? "published" : "saved as draft"}!`, "success");
    } catch (e) {
      toast("Failed to save. Check Firebase config.", "error");
      console.error(e);
    }
  };

  // Update post in Firestore
  const handleUpdate = async (data) => {
    try {
      let fileData = data.file;
      // If file is a new local upload (has dataUrl as base64), re-upload it
      if (data.file?.dataUrl?.startsWith("data:")) {
        toast("Uploading file…", "info");
        fileData = await uploadFile(data.file);
      }
      await updateDoc(doc(db, "posts", editTarget.id), {
        ...data,
        file: fileData || null,
        updatedAt: Date.now(),
      });
      setEditTarget(null);
      toast("Content updated.", "success");
    } catch (e) {
      toast("Failed to update.", "error");
      console.error(e);
    }
  };

  // Delete post from Firestore
  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "posts", deleteTarget.id));
      toast(`Deleted "${deleteTarget.title}".`, "info");
      setDeleteTarget(null);
    } catch (e) {
      toast("Failed to delete.", "error");
    }
  };

  if (!currentUser) return (
    <>
      <StyleTag />
      <LoginPage onLogin={handleLogin} />
      <Toasts toasts={toasts} />
    </>
  );

  if (loading) return (
    <>
      <StyleTag />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1117", color: "#58a6ff", fontFamily: "DM Sans, sans-serif", fontSize: "1rem" }}>
        🪐 Loading Aryabhatta…
      </div>
    </>
  );

  const counts = { all: posts.length, notes: posts.filter(p => p.contentType === "notes").length, qa: posts.filter(p => p.contentType === "qa").length, pdf: posts.filter(p => p.contentType === "pdf").length, file: posts.filter(p => p.contentType === "file").length };
  const titles = { dashboard: "Dashboard", all: "All Content", notes: "Notes", qa: "Q&A Sheets", pdf: "PDFs", file: "Files", users: "User Management", categories: "Categories", settings: "Settings" };

  return (
    <>
      <StyleTag />
      <div className="admin-shell">
        <Sidebar page={page} setPage={setPage} counts={counts} currentUser={currentUser} onLogout={handleLogout} />
        <div className="main">
          <div className="topbar">
            <div className="topbar-title">{titles[page] || page}<span>Aryabhatta Admin</span></div>
            <div className="topbar-actions">
              <button className="btn btn-primary" onClick={() => setAddModal(true)}>➕ New Content</button>
            </div>
          </div>
          {page === "dashboard" && <DashboardPage posts={posts} setPage={setPage} />}
          {["all", "notes", "qa", "pdf", "file"].includes(page) && (
            <ContentPage posts={posts} filter={page} onAdd={() => setAddModal(true)} onEdit={p => setEditTarget(p)} onDelete={p => setDeleteTarget(p)} onView={p => setViewTarget(p)} />
          )}
          {page === "users" && <UsersPage toast={toast} />}
          {page === "categories" && <CategoriesPage categories={categories} setCategories={setCategories} toast={toast} />}
          {page === "settings" && <SettingsPage posts={posts} setPosts={setPosts} toast={toast} />}
        </div>
      </div>

      {addModal && <ContentModal mode="add" customCategories={categories} onClose={() => setAddModal(false)} onSave={handleSave} />}
      {editTarget && <ContentModal mode="edit" initial={editTarget} customCategories={categories} onClose={() => setEditTarget(null)} onSave={handleUpdate} />}
      {deleteTarget && <DeleteModal title={deleteTarget.title} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
      {viewTarget && <ViewModal post={viewTarget} onClose={() => setViewTarget(null)} />}
      <Toasts toasts={toasts} />
    </>
  );
}