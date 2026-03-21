// ============================================================
// ARYABHATTA – Main Student Website
// ============================================================

import { useState, useEffect } from "react";
import { db } from '../firebase';
import { collection, onSnapshot } from "firebase/firestore";

// ── STORAGE HELPERS ─────────────────────────────────────────
function loadCategories() {
  try {
    const raw = localStorage.getItem("aryabhatta_categories");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── STYLES ──────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=IBM+Plex+Serif:ital,wght@0,400;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f7f4ef;
    --card: #ffffff;
    --primary: #1a3a5c;
    --accent: #e8632a;
    --text: #1c1c1e;
    --muted: #6b7280;
    --border: #e2ddd6;
    --radius: 14px;
    --shadow: 0 2px 16px rgba(0,0,0,0.07);
  }

  html, body { font-family: 'Sora', sans-serif; background: var(--bg); color: var(--text); font-size: 16px; line-height: 1.6; }

  .nav {
    background: var(--primary); padding: 0 24px; display: flex;
    align-items: center; justify-content: space-between; height: 60px;
    position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 12px rgba(0,0,0,0.18);
  }
  .nav-logo { font-size: 1.3rem; font-weight: 800; color: #fff; letter-spacing: -0.5px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .nav-logo span { color: #f9a95a; }
  .nav-links { display: flex; gap: 6px; }
  .nav-link { color: rgba(255,255,255,0.75); font-size: 0.88rem; font-weight: 500; padding: 6px 14px; border-radius: 20px; cursor: pointer; transition: all 0.2s; }
  .nav-link:hover, .nav-link.active { background: rgba(255,255,255,0.15); color: #fff; }

  .page { max-width: 1080px; margin: 0 auto; padding: 0 20px 60px; }

  .hero {
    background: linear-gradient(135deg, var(--primary) 0%, #2563a8 100%);
    color: #fff; padding: 56px 28px 48px; text-align: center;
    border-radius: 0 0 28px 28px; margin-bottom: 36px;
  }
  .hero-badge { display: inline-block; background: rgba(255,255,255,0.15); color: #f9d08e; font-size: 0.78rem; font-weight: 600; padding: 4px 14px; border-radius: 20px; letter-spacing: 0.5px; margin-bottom: 16px; }
  .hero h1 { font-size: clamp(1.9rem, 5vw, 2.8rem); font-weight: 800; letter-spacing: -1px; margin-bottom: 10px; }
  .hero h1 span { color: #f9a95a; }
  .hero p { font-size: 1rem; opacity: 0.85; margin-bottom: 28px; font-family: 'IBM Plex Serif', serif; font-style: italic; }
  .search-wrap { display: flex; gap: 8px; max-width: 520px; margin: 0 auto; }
  .search-input { flex: 1; padding: 12px 18px; border-radius: 40px; border: none; font-size: 0.95rem; font-family: 'Sora', sans-serif; outline: none; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
  .search-btn { padding: 12px 22px; background: var(--accent); color: #fff; border: none; border-radius: 40px; font-weight: 600; font-size: 0.9rem; cursor: pointer; font-family: 'Sora', sans-serif; transition: opacity 0.2s; }
  .search-btn:hover { opacity: 0.9; }

  .section-title { font-size: 1.15rem; font-weight: 700; color: var(--primary); margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
  .section-title::after { content: ''; flex: 1; height: 2px; background: var(--border); border-radius: 2px; }

  .categories { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 40px; }
  .cat-card { background: var(--card); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 18px 14px; text-align: center; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow); }
  .cat-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
  .cat-icon { font-size: 1.8rem; margin-bottom: 8px; }
  .cat-name { font-size: 0.88rem; font-weight: 600; color: var(--primary); }
  .cat-count { font-size: 0.75rem; color: var(--muted); margin-top: 4px; }

  .posts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
  .post-card { background: var(--card); border-radius: var(--radius); border: 1.5px solid var(--border); padding: 22px; cursor: pointer; transition: all 0.22s; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .post-card:hover { border-color: var(--primary); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
  .post-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .tag { font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
  .tag.subject { background: #fef3c7; color: #92400e; }
  .tag.category { background: #d1fae5; color: #065f46; }
  .tag.pdf { background: #fce7f3; color: #9d174d; }
  .tag.file { background: #f3f4f6; color: #374151; }
  .post-date { font-size: 0.72rem; color: var(--muted); margin-left: auto; }
  .post-title { font-size: 1rem; font-weight: 700; color: var(--text); line-height: 1.4; }
  .post-summary { font-size: 0.85rem; color: var(--muted); line-height: 1.5; }
  .read-link { font-size: 0.82rem; font-weight: 600; color: var(--accent); margin-top: auto; }

  .subject-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
  .subject-tab { padding: 7px 16px; border-radius: 20px; border: 1.5px solid var(--border); font-size: 0.84rem; font-weight: 500; cursor: pointer; background: var(--card); transition: all 0.2s; font-family: 'Sora', sans-serif; }
  .subject-tab:hover, .subject-tab.active { background: var(--primary); color: #fff; border-color: var(--primary); }

  .back-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 600; color: var(--primary); cursor: pointer; margin-bottom: 24px; padding: 8px 14px; background: var(--card); border: 1.5px solid var(--border); border-radius: 20px; transition: all 0.2s; }
  .back-btn:hover { background: var(--primary); color: #fff; border-color: var(--primary); }
  .detail-card { background: var(--card); border-radius: 18px; border: 1.5px solid var(--border); padding: 36px; box-shadow: var(--shadow); }
  .detail-header { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1.5px solid var(--border); }
  .detail-title { font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-bottom: 12px; line-height: 1.3; }
  .content-block { margin-bottom: 20px; }
  .content-heading { font-size: 1.05rem; font-weight: 700; color: var(--primary); margin-bottom: 8px; padding-left: 12px; border-left: 3px solid var(--accent); }
  .content-para { font-size: 0.93rem; color: #374151; line-height: 1.75; }
  .content-formula { background: #f0f4ff; border: 1.5px solid #c7d2fe; border-radius: 10px; padding: 16px 20px; font-family: 'IBM Plex Serif', monospace; font-size: 0.95rem; color: #1e3a8a; white-space: pre-wrap; line-height: 1.7; }
  .content-answer { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 14px 18px; font-size: 0.9rem; color: #166534; line-height: 1.7; }
  .content-answer strong { display: block; margin-bottom: 4px; font-weight: 700; }
  .content-tip { background: #fffbeb; border: 1.5px solid #fcd34d; border-radius: 10px; padding: 14px 18px; font-size: 0.88rem; color: #92400e; font-weight: 500; line-height: 1.6; }

  .download-block { background: #fdf4ff; border: 1.5px solid #e9d5ff; border-radius: 12px; padding: 22px; display: flex; align-items: center; gap: 16px; margin-top: 10px; }
  .download-icon { font-size: 2.4rem; }
  .download-info { flex: 1; }
  .download-info h3 { font-size: 1rem; font-weight: 700; color: var(--primary); margin-bottom: 4px; }
  .download-info p { font-size: 0.82rem; color: var(--muted); }
  .download-btn { padding: 10px 20px; background: var(--primary); color: #fff; border: none; border-radius: 20px; font-size: 0.88rem; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; text-decoration: none; display: inline-block; transition: opacity 0.2s; }
  .download-btn:hover { opacity: 0.85; }

  .about-hero { background: linear-gradient(135deg, #0f2d4a, #1d5a8e); color: #fff; padding: 52px 32px; border-radius: 18px; margin-bottom: 28px; text-align: center; }
  .about-hero h1 { font-size: 2.2rem; font-weight: 800; margin-bottom: 10px; letter-spacing: -1px; }
  .about-hero p { font-family: 'IBM Plex Serif', serif; font-style: italic; font-size: 1.05rem; opacity: 0.85; }
  .about-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 24px; }
  .about-card { background: var(--card); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 24px; text-align: center; box-shadow: var(--shadow); }
  .about-card-icon { font-size: 2rem; margin-bottom: 12px; }
  .about-card h3 { font-size: 1rem; font-weight: 700; color: var(--primary); margin-bottom: 8px; }
  .about-card p { font-size: 0.84rem; color: var(--muted); line-height: 1.55; }
  .about-text { background: var(--card); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); }
  .about-text p { font-size: 0.93rem; color: #374151; line-height: 1.8; margin-bottom: 14px; }

  .empty { text-align: center; padding: 60px 20px; color: var(--muted); }
  .empty-icon { font-size: 3rem; margin-bottom: 14px; }

  .site-footer { background: var(--primary); color: rgba(255,255,255,0.5); padding: 24px 28px; font-size: 0.78rem; margin-top: 40px; display: flex; align-items: center; justify-content: space-between; }
  .site-footer a { color: rgba(255,255,255,0.3); text-decoration: none; font-size: 0.7rem; transition: color 0.2s; }
  .site-footer a:hover { color: rgba(255,255,255,0.8); }

  .mobile-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: var(--primary); padding: 10px 0 14px; z-index: 100; justify-content: space-around; border-top: 1px solid rgba(255,255,255,0.1); }
  .mobile-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; color: rgba(255,255,255,0.65); font-size: 0.68rem; font-weight: 500; cursor: pointer; transition: color 0.2s; padding: 4px 12px; }
  .mobile-nav-item .mni { font-size: 1.35rem; }
  .mobile-nav-item.active { color: #f9a95a; }

  @media (max-width: 640px) {
    .nav-links { display: none; }
    .mobile-nav { display: flex; }
    .page { padding-bottom: 90px; }
    .hero { padding: 40px 18px 36px; }
    .detail-card { padding: 22px 16px; }
    .posts-grid { grid-template-columns: 1fr; }
    .download-block { flex-direction: column; text-align: center; }
    .site-footer { flex-direction: column; gap: 8px; align-items: flex-start; }
  }
`;

// ── HASH ROUTER ──────────────────────────────────────────────
function useRoute() {
  const [route, setRoute] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const h = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const navigate = (path) => { window.location.hash = path; };
  return { route, navigate };
}

// ── STYLE INJECTOR ───────────────────────────────────────────
function StyleTag() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

// ── HELPERS ──────────────────────────────────────────────────
const fmtDate = (ts) => ts
  ? new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  : "";

const fmtSize = (b) => {
  if (!b) return "";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
};

// ── NAVBAR ───────────────────────────────────────────────────
function Navbar({ route, navigate }) {
  const links = [
    { label: "Home", hash: "#/" },
    { label: "Notes", hash: "#/notes" },
    { label: "About", hash: "#/about" },
  ];
  return (
    <>
      <nav className="nav">
        <div className="nav-logo" onClick={() => navigate("#/")}>
          <span>Arya</span>bhatta
        </div>
        <div className="nav-links">
          {links.map(l => (
            <span key={l.hash} className={`nav-link${route === l.hash ? " active" : ""}`} onClick={() => navigate(l.hash)}>
              {l.label}
            </span>
          ))}
        </div>
      </nav>
      <div className="mobile-nav">
        {[
          { label: "Home", icon: "🏠", hash: "#/" },
          { label: "Notes", icon: "📚", hash: "#/notes" },
          { label: "About", icon: "ℹ️", hash: "#/about" }
        ].map(l => (
          <div key={l.hash} className={`mobile-nav-item${route === l.hash ? " active" : ""}`} onClick={() => navigate(l.hash)}>
            <span className="mni">{l.icon}</span>{l.label}
          </div>
        ))}
      </div>
    </>
  );
}

// ── POST CARD ─────────────────────────────────────────────────
function PostCard({ post, navigate }) {
  const typeIcon = { notes: "📝", qa: "❓", pdf: "📄", file: "📎" }[post.contentType] || "📄";
  const typeClass = { pdf: "pdf", file: "file" }[post.contentType] || "subject";
  return (
    <div className="post-card" onClick={() => navigate(`#/post/${post.id}`)}>
      <div className="post-meta">
        <span className={`tag ${typeClass}`}>{typeIcon} {post.subject}</span>
        <span className="tag category">{post.category}</span>
        <span className="post-date">{fmtDate(post.createdAt)}</span>
      </div>
      <div className="post-title">{post.title}</div>
      {post.summary && <div className="post-summary">{post.summary}</div>}
      <div className="read-link">
        {post.contentType === "pdf" ? "View PDF →" : post.contentType === "file" ? "Download →" : "Read Notes →"}
      </div>
    </div>
  );
}

// ── HOME PAGE ─────────────────────────────────────────────────
function HomePage({ posts, categories, navigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);

  const published = posts.filter(p => p.status === "published");

  const handleSearch = () => {
    if (!query.trim()) { setResults(null); return; }
    const q = query.toLowerCase();
    setResults(published.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.subject?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.summary?.toLowerCase().includes(q) ||
      p.tags?.toLowerCase().includes(q)
    ));
  };

  const catCounts = {};
  published.forEach(p => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });

  const displayCats = categories.length > 0
    ? categories
    : Object.keys(catCounts).map((name, i) => ({ id: i, name, icon: "📂" }));

  return (
    <>
      <div className="hero">
        <div className="hero-badge">✨ Free Study Material</div>
        <h1>Arya<span>bhatta</span></h1>
        <p>"Learn Simple. Grow Smart."</p>
        <div className="search-wrap">
          <input
            className="search-input"
            placeholder="Search notes, subjects, topics…"
            value={query}
            onChange={e => { setQuery(e.target.value); if (!e.target.value) setResults(null); }}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
          <button className="search-btn" onClick={handleSearch}>Search</button>
        </div>
      </div>

      <div className="page">
        {results !== null ? (
          <>
            <div className="section-title">🔍 Results for "{query}"</div>
            {results.length === 0
              ? <div className="empty"><div className="empty-icon">😕</div><p>No notes found. Try a different keyword.</p></div>
              : <div className="posts-grid">{results.map(p => <PostCard key={p.id} post={p} navigate={navigate} />)}</div>
            }
          </>
        ) : (
          <>
            {displayCats.length > 0 && (
              <>
                <div className="section-title">📂 Browse by Category</div>
                <div className="categories">
                  {displayCats.map((c, i) => (
                    <div key={i} className="cat-card" onClick={() => navigate("#/notes")}>
                      <div className="cat-icon">{c.icon || "📂"}</div>
                      <div className="cat-name">{c.name}</div>
                      <div className="cat-count">{catCounts[c.name] || 0} notes</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="section-title">🕒 Recent Notes</div>
            {published.length === 0
              ? <div className="empty"><div className="empty-icon">📭</div><p>No content published yet. Check back soon!</p></div>
              : <div className="posts-grid">{[...published].sort((a, b) => b.createdAt - a.createdAt).slice(0, 9).map(p => <PostCard key={p.id} post={p} navigate={navigate} />)}</div>
            }
          </>
        )}
      </div>
    </>
  );
}

// ── NOTES PAGE ────────────────────────────────────────────────
function NotesPage({ posts, navigate }) {
  const published = posts.filter(p => p.status === "published");
  const subjects = ["All", ...Array.from(new Set(published.map(p => p.subject).filter(Boolean)))];
  const [active, setActive] = useState("All");
  const filtered = active === "All" ? published : published.filter(p => p.subject === active);

  return (
    <div className="page" style={{ paddingTop: 28 }}>
      <div className="section-title">📚 All Notes</div>
      {subjects.length > 1 && (
        <div className="subject-tabs">
          {subjects.map(s => (
            <button key={s} className={`subject-tab${active === s ? " active" : ""}`} onClick={() => setActive(s)}>{s}</button>
          ))}
        </div>
      )}
      {filtered.length === 0
        ? <div className="empty"><div className="empty-icon">📭</div><p>No notes published yet.</p></div>
        : <div className="posts-grid">{filtered.map(p => <PostCard key={p.id} post={p} navigate={navigate} />)}</div>
      }
    </div>
  );
}

// ── POST DETAIL PAGE ──────────────────────────────────────────
function PostDetailPage({ id, posts, navigate }) {
  const post = posts.find(p => String(p.id) === String(id));

  if (!post) return (
    <div className="page" style={{ paddingTop: 28 }}>
      <div className="empty"><div className="empty-icon">❌</div><p>Post not found.</p></div>
    </div>
  );

  const renderBlock = (b, i) => {
    switch (b.type) {
      case "heading": return <div key={i} className="content-block"><div className="content-heading">{b.text}</div></div>;
      case "para":    return <div key={i} className="content-block"><p className="content-para">{b.text}</p></div>;
      case "formula": return <div key={i} className="content-block"><div className="content-formula">{b.text}</div></div>;
      case "answer":  return <div key={i} className="content-block"><div className="content-answer"><strong>{b.label}</strong> {b.text}</div></div>;
      case "tip":     return <div key={i} className="content-block"><div className="content-tip">{b.text}</div></div>;
      default: return null;
    }
  };

  return (
    <div className="page" style={{ paddingTop: 28 }}>
      <div className="back-btn" onClick={() => navigate("#/notes")}>← Back to Notes</div>
      <div className="detail-card">
        <div className="detail-header">
          <div className="post-meta" style={{ marginBottom: 12 }}>
            <span className="tag subject">{post.subject}</span>
            <span className="tag category">{post.category}</span>
            <span className="post-date">{fmtDate(post.createdAt)}</span>
          </div>
          <div className="detail-title">{post.title}</div>
          {post.summary && <p style={{ fontSize: "0.9rem", color: "#6b7280", fontStyle: "italic" }}>{post.summary}</p>}
        </div>

        {post.contentType === "notes" && post.content?.map(renderBlock)}

        {post.contentType === "qa" && post.qaPairs?.map((pair, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div className="content-heading">Q{i + 1}. {pair.q}</div>
            <div className="content-answer"><strong>Answer:</strong> {pair.a}</div>
          </div>
        ))}

        {(post.contentType === "pdf" || post.contentType === "file") && post.file && (
          <div className="download-block">
            <div className="download-icon">{post.contentType === "pdf" ? "📄" : "📎"}</div>
            <div className="download-info">
              <h3>{post.file.name}</h3>
              <p>{fmtSize(post.file.size)} · Click to download</p>
            </div>
            <a className="download-btn" href={post.file.dataUrl} target="_blank" rel="noreferrer" download={post.file.name}>
              ⬇️ Download
            </a>
          </div>
        )}

        {post.tags && (
          <div style={{ marginTop: 20, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {post.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
              <span key={t} style={{ fontSize: "0.75rem", background: "#f3f4f6", color: "#6b7280", padding: "3px 10px", borderRadius: 20 }}>#{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ABOUT PAGE ────────────────────────────────────────────────
function AboutPage() {
  return (
    <div className="page" style={{ paddingTop: 28 }}>
      <div className="about-hero">
        <h1> About Aryabhatta</h1>
        <p>Your free, simple study companion for students across India</p>
      </div>
      <div className="about-text" style={{ marginBottom: 24 }}>
        <p><strong>Aryabhatta</strong> is a free educational platform named after the legendary Indian mathematician and astronomer — who taught us that knowledge is the greatest treasure.</p>
        <p>Our mission is simple: make studying easy, accessible, and confusion-free for every student — whether you're in Class 10, preparing for board exams, or pursuing a BCA/B.Sc degree.</p>
        <p>We provide clearly written notes, question-answer guides, formulas, and tips so that students from rural and urban areas alike can learn without barriers. No ads, no paywalls — just clean knowledge.</p>
      </div>
      <div className="section-title">✨ Why Aryabhatta?</div>
      <div className="about-grid">
        {[
          { icon: "📖", title: "Simple Notes",     desc: "All notes are written in plain, easy-to-understand language — no jargon, no confusion." },
          { icon: "📱", title: "Mobile Friendly",  desc: "Study on your phone anytime, anywhere. Designed to work on all screen sizes." },
          { icon: "🎯", title: "Exam Focused",     desc: "Content is organized around board exams, entrance tests, and university syllabi." },
          { icon: "🆓", title: "Completely Free",  desc: "Everything on Aryabhatta is free forever. No subscriptions, no hidden fees." },
          { icon: "🔍", title: "Easy Search",      desc: "Find any topic instantly using our search bar." },
          { icon: "🌱", title: "Grow Together",    desc: "New notes are added regularly. We grow with our students." },
        ].map((c, i) => (
          <div key={i} className="about-card">
            <div className="about-card-icon">{c.icon}</div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function AryabhattaSite() {
  const { route, navigate } = useRoute();

  // State declared here, inside AryabhattaSite, before useEffect
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Firebase real-time listener
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "posts"),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        setPosts(data);
      },
      (error) => {
        console.error("Firestore error:", error);
      }
    );
    setCategories(loadCategories());
    return () => unsub();
  }, []);

  // Route parsing
  let page = "home";
  let postId = null;
  if (route === "#/notes") page = "notes";
  else if (route === "#/about") page = "about";
  else if (route.startsWith("#/post/")) { page = "post"; postId = route.replace("#/post/", ""); }

  const navRoute = page === "post" ? "#/notes" : route;

  return (
    <>
      <StyleTag />
      <Navbar route={navRoute} navigate={navigate} />
      {page === "home"  && <HomePage posts={posts} categories={categories} navigate={navigate} />}
      {page === "notes" && <NotesPage posts={posts} navigate={navigate} />}
      {page === "about" && <AboutPage />}
      {page === "post"  && <PostDetailPage id={postId} posts={posts} navigate={navigate} />}
      <footer className="site-footer">
        <a href="/admin">Admin Panel</a>
        <p>© {new Date().getFullYear()} Aryabhatta · Free Study Material</p>
      </footer>
    </>
  );
}