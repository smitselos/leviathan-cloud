import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';

const FOLDERS = {
  keimena: { name: 'Κείμενα', icon: null, color: '#3b82f6', desc: 'Εκπαιδευτικά κείμενα και υλικό' },
  biblia:  { name: 'Βιβλία', icon: null, color: '#8b5cf6', desc: 'Βιβλία αναφοράς και μελέτης' }
};

// Παράγει νέο μοναδικό id για ερώτηση
const newQid = () => Math.random().toString(36).slice(2, 8);

// Ταξινομεί ερωτήσεις: Α < Β < Γ < Δ < ..., μετά αριθμός
const sortCode = (code) => {
  const m = code.match(/^([Α-Ωα-ω]+)(\d*)$/u);
  if (!m) return code;
  return m[1].charCodeAt(0) * 1000 + (parseInt(m[2]) || 0);
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeView, setActiveView]             = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [currentFolder, setCurrentFolder]       = useState(null);
  const [files, setFiles]                       = useState([]);
  const [currentFile, setCurrentFile]           = useState(null);
  const [loading, setLoading]                   = useState(false);
  const [searchQuery, setSearchQuery]           = useState('');
  const [tools, setTools]                       = useState([]);
  const [currentTool, setCurrentTool]           = useState(null);
  const [favorites, setFavorites]               = useState([]);
  const [recentFiles, setRecentFiles]           = useState([]);
  const [toolsSearchQuery, setToolsSearchQuery] = useState('');
  const [currentToolCategory, setCurrentToolCategory] = useState(null);
  const [modalZoom, setModalZoom]               = useState(100);
  const [favoriteTools, setFavoriteTools]       = useState([]);

  // Networks
  const [networks, setNetworks]                     = useState([]);
  const [currentNetwork, setCurrentNetwork]         = useState(null);
  const [networkSaving, setNetworkSaving]           = useState(false);
  const [networkMsg, setNetworkMsg]                 = useState('');
  const [showNewNetworkForm, setShowNewNetworkForm] = useState(false);
  const [newNetworkName, setNewNetworkName]         = useState('');
  const [pickingFile, setPickingFile]               = useState(false);
  const [allFiles, setAllFiles]                     = useState([]);
  const [pickerSearch, setPickerSearch]             = useState('');
  // accordion open state: { [fileId]: boolean }
  const [openAccordions, setOpenAccordions]         = useState({});

  const zoomIn    = () => setModalZoom(z => Math.min(z + 10, 200));
  const zoomOut   = () => setModalZoom(z => Math.max(z - 10, 50));
  const zoomReset = () => setModalZoom(100);

  const recentTools = [...tools]
    .filter(t => t.addedAt)
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    .slice(0, 5);

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);

  useEffect(() => {
    const sf  = localStorage.getItem('leviathan-favorites');
    const sr  = localStorage.getItem('leviathan-recent');
    const sft = localStorage.getItem('leviathan-favorite-tools');
    if (sf)  setFavorites(JSON.parse(sf));
    if (sr)  setRecentFiles(JSON.parse(sr));
    if (sft) setFavoriteTools(JSON.parse(sft));
  }, []);

  useEffect(() => {
    if (session) { loadTools(); loadNetworks(); loadAllFiles(); }
  }, [session]);

  const loadTools = async () => {
    try { const res = await fetch('/api/tools'); const data = await res.json(); setTools(data.tools || []); } catch (e) { console.error(e); }
  };
  const loadNetworks = async () => {
    try { const res = await fetch('/api/networks'); const data = await res.json(); setNetworks(data.networks || []); } catch (e) { console.error(e); }
  };
  const loadAllFiles = async () => {
    try {
      const results = await Promise.all(Object.keys(FOLDERS).map(fid => fetch(`/api/files/${fid}`).then(r => r.json())));
      setAllFiles(results.flatMap(r => r.files || []));
    } catch (e) { console.error(e); }
  };

  const getToolCategories = () => {
    const cats = {};
    tools.forEach(t => { if (!t.category) return; if (!cats[t.category]) cats[t.category] = []; cats[t.category].push(t); });
    return cats;
  };

  const loadFiles = useCallback(async (folderId) => {
    setLoading(true);
    try { const res = await fetch(`/api/files/${folderId}`); const data = await res.json(); setFiles(data.files || []); }
    catch (e) { setFiles([]); }
    setLoading(false);
  }, []);

  const openFolder      = (id) => { setCurrentFolder(id); setActiveView('folder'); setCurrentFile(null); loadFiles(id); };
  const openTool        = (t)  => setCurrentTool(t);
  const openAllTools    = async () => { setActiveView('allTools'); setCurrentFolder(null); setCurrentFile(null); setCurrentToolCategory(null); await loadTools(); };
  const openToolCategory= (c)  => { setCurrentToolCategory(c); setActiveView('toolCategory'); setCurrentFolder(null); setCurrentFile(null); };
  const goHome          = ()   => { setActiveView('home'); setCurrentFolder(null); setCurrentFile(null); setCurrentTool(null); setCurrentToolCategory(null); setCurrentNetwork(null); };

  const openFile = (file) => {
    setCurrentFile(file);
    const updated = [file, ...recentFiles.filter(f => f.id !== file.id)].slice(0, 5);
    setRecentFiles(updated);
    localStorage.setItem('leviathan-recent', JSON.stringify(updated));
  };
  const toggleFavorite = (file) => {
    const isFav = favorites.some(f => f.id === file.id);
    const updated = isFav ? favorites.filter(f => f.id !== file.id) : [...favorites, file];
    setFavorites(updated); localStorage.setItem('leviathan-favorites', JSON.stringify(updated));
  };
  const toggleFavoriteTool = (tool) => {
    const isFav = favoriteTools.some(t => t.file === tool.file);
    const updated = isFav ? favoriteTools.filter(t => t.file !== tool.file) : [...favoriteTools, tool];
    setFavoriteTools(updated); localStorage.setItem('leviathan-favorite-tools', JSON.stringify(updated));
  };

  const filteredFiles = files.filter(f => { if (!searchQuery) return true; const q = searchQuery.toLowerCase(); return f.title.toLowerCase().includes(q) || f.name.toLowerCase().includes(q); });
  const filteredTools = tools.filter(t => { if (!toolsSearchQuery) return true; return t.name.toLowerCase().includes(toolsSearchQuery.toLowerCase()); });
  const filteredCategoryTools = currentToolCategory
    ? (currentToolCategory === '__recent__' ? recentTools : tools.filter(t => t.category === currentToolCategory))
        .filter(t => !toolsSearchQuery || t.name.toLowerCase().includes(toolsSearchQuery.toLowerCase()))
    : [];

  // ── Network helpers ───────────────────────────────────────────────────────
  const persistNetworks = async (updated) => {
    setNetworkSaving(true); setNetworkMsg('');
    try {
      const res = await fetch('/api/networks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ networks: updated }) });
      setNetworks(updated);
      setNetworkMsg(res.ok ? '✓ Αποθηκεύτηκε' : '✗ Σφάλμα');
    } catch { setNetworkMsg('✗ Σφάλμα σύνδεσης'); }
    setNetworkSaving(false);
    setTimeout(() => setNetworkMsg(''), 2500);
  };

  const createNetwork = () => {
    if (!newNetworkName.trim()) return;
    // items: [{ fileId, title, name, questions: [{id, code, text}] }]
    const newNet = { id: Date.now().toString(), name: newNetworkName.trim(), items: [] };
    const updated = [...networks, newNet];
    setNewNetworkName(''); setShowNewNetworkForm(false);
    persistNetworks(updated);
    setCurrentNetwork(newNet); setActiveView('network');
  };

  const deleteNetwork = (netId) => {
    if (!confirm('Διαγραφή δικτύου;')) return;
    const updated = networks.filter(n => n.id !== netId);
    persistNetworks(updated);
    if (currentNetwork?.id === netId) { setCurrentNetwork(null); setActiveView('networksList'); }
  };

  const addFileToNetwork = (file) => {
    if (!currentNetwork) return;
    if (currentNetwork.items.some(i => i.fileId === file.id)) { setPickingFile(false); return; }
    const item       = { fileId: file.id, title: file.title, name: file.name, questions: [] };
    const updatedNet = { ...currentNetwork, items: [...currentNetwork.items, item] };
    const updatedAll = networks.map(n => n.id === currentNetwork.id ? updatedNet : n);
    setCurrentNetwork(updatedNet); persistNetworks(updatedAll);
    // ανοίγουμε αυτόματα το accordion
    setOpenAccordions(prev => ({ ...prev, [file.id]: true }));
    setPickingFile(false); setPickerSearch('');
  };

  const removeFromNetwork = (fileId) => {
    const updatedNet = { ...currentNetwork, items: currentNetwork.items.filter(i => i.fileId !== fileId) };
    const updatedAll = networks.map(n => n.id === currentNetwork.id ? updatedNet : n);
    setCurrentNetwork(updatedNet); persistNetworks(updatedAll);
  };

  const moveItem = (idx, dir) => {
    const items = [...currentNetwork.items]; const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    [items[idx], items[target]] = [items[target], items[idx]];
    const updatedNet = { ...currentNetwork, items };
    const updatedAll = networks.map(n => n.id === currentNetwork.id ? updatedNet : n);
    setCurrentNetwork(updatedNet); persistNetworks(updatedAll);
  };

  // ── Question helpers ──────────────────────────────────────────────────────
  const addQuestion = (fileId) => {
    const items = currentNetwork.items.map(item => {
      if (item.fileId !== fileId) return item;
      return { ...item, questions: [...item.questions, { id: newQid(), code: '', text: '' }] };
    });
    const updatedNet = { ...currentNetwork, items };
    const updatedAll = networks.map(n => n.id === currentNetwork.id ? updatedNet : n);
    setCurrentNetwork(updatedNet); setNetworks(updatedAll);
  };

  const updateQuestion = (fileId, qid, field, value) => {
    const items = currentNetwork.items.map(item => {
      if (item.fileId !== fileId) return item;
      return { ...item, questions: item.questions.map(q => q.id === qid ? { ...q, [field]: value } : q) };
    });
    const updatedNet = { ...currentNetwork, items };
    const updatedAll = networks.map(n => n.id === currentNetwork.id ? updatedNet : n);
    setCurrentNetwork(updatedNet); setNetworks(updatedAll);
  };

  const removeQuestion = (fileId, qid) => {
    const items = currentNetwork.items.map(item => {
      if (item.fileId !== fileId) return item;
      return { ...item, questions: item.questions.filter(q => q.id !== qid) };
    });
    const updatedNet = { ...currentNetwork, items };
    const updatedAll = networks.map(n => n.id === currentNetwork.id ? updatedNet : n);
    setCurrentNetwork(updatedNet); persistNetworks(updatedAll);
  };

  const saveNetworkState = () => {
    const updatedAll = networks.map(n => n.id === currentNetwork.id ? currentNetwork : n);
    persistNetworks(updatedAll);
  };

  const toggleAccordion = (fileId) => setOpenAccordions(prev => ({ ...prev, [fileId]: !prev[fileId] }));

  // ── Print ─────────────────────────────────────────────────────────────────
  const printNetwork = (net) => {
    const w = window.open('', '_blank');
    if (!w) return;

    // Κείμενα HTML
    const textsHtml = net.items.map((item, idx) => `
      <div class="text-block">
        <h2 class="text-label">Κείμενο ${idx + 1}</h2>
        <div class="text-subtitle">${item.title}</div>
        <div class="pdf-wrapper">
          <iframe src="/api/files/pdf/${item.fileId}" class="pdf-frame"></iframe>
        </div>
      </div>`).join('');

    // Συλλογή όλων των ερωτήσεων — ομαδοποίηση ανά γράμμα κωδικού
    const allQuestions = [];
    net.items.forEach((item, idx) => {
      (item.questions || []).forEach(q => {
        if (q.code.trim() && q.text.trim()) {
          allQuestions.push({ code: q.code.trim(), text: q.text.trim(), sourceIdx: idx + 1, sourceTitle: item.title });
        }
      });
    });

    // Ομαδοποίηση ανά αρχικό γράμμα κωδικού (Α, Β, Γ, Δ...)
    const groups = {};
    allQuestions.forEach(q => {
      const letter = q.code.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(q);
    });

    // Ταξινόμηση γραμμάτων και ερωτήσεων εντός κάθε ομάδας
    const sortedLetters = Object.keys(groups).sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0));
    sortedLetters.forEach(letter => {
      groups[letter].sort((a, b) => sortCode(a.code) - sortCode(b.code));
    });

    const questionsHtml = sortedLetters.map(letter => {
      const qs = groups[letter];
      return qs.map(q => `
        <div class="q-block">
          <div class="q-code">${q.code}</div>
          <div class="q-body">
            <div class="q-source">Κείμενο ${q.sourceIdx}: ${q.sourceTitle}</div>
            <div class="q-text">${q.text.replace(/\n/g, '<br>')}</div>
          </div>
        </div>`).join('');
    }).join('<div class="q-group-divider"></div>');

    const hasQuestions = allQuestions.length > 0;

    w.document.write(`<!DOCTYPE html>
<html lang="el"><head><meta charset="UTF-8"><title>${net.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Georgia", serif; color: #1a1a1a; background: #fff; }

  /* ── Εξώφυλλο ── */
  .cover { padding: 52px 64px 32px; border-bottom: 3px solid #1a1a1a; margin-bottom: 0; }
  .cover-eyebrow { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #888; margin-bottom: 10px; font-family: sans-serif; }
  .cover-title   { font-size: 30px; font-weight: 700; line-height: 1.2; }
  .cover-meta    { margin-top: 8px; font-size: 13px; color: #555; font-family: sans-serif; }

  /* ── Επικεφαλίδα ενότητας ── */
  .section-header { padding: 28px 64px 18px; background: #1a1a1a; color: #fff; margin-bottom: 0; }
  .section-title  { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; font-family: sans-serif; font-weight: 600; }

  /* ── Κείμενα ── */
  .text-block { padding: 32px 64px 48px; page-break-after: always; }
  .text-block:last-of-type { page-break-after: auto; }
  .text-label    { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .text-subtitle { font-size: 13px; color: #555; font-family: sans-serif; margin-bottom: 20px; }
  .pdf-wrapper { width: 100%; height: 860px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #f9f9f8; }
  .pdf-frame   { width: 100%; height: 100%; border: none; }

  /* ── Θέματα ── */
  .themes-wrapper { padding: 32px 64px 64px; }
  .q-group-divider { height: 1px; background: #e8e8e8; margin: 24px 0; }
  .q-block { display: flex; gap: 18px; margin-bottom: 22px; }
  .q-code  { font-size: 15px; font-weight: 700; min-width: 40px; color: #1a1a1a; padding-top: 2px; }
  .q-body  { flex: 1; }
  .q-source{ font-size: 11px; color: #888; font-family: sans-serif; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
  .q-text  { font-size: 14.5px; line-height: 1.85; }

  @media print {
    .cover          { padding: 36px 48px 24px; }
    .section-header { padding: 20px 48px 14px; }
    .text-block     { padding: 24px 48px 40px; }
    .pdf-wrapper    { height: 780px; }
    .themes-wrapper { padding: 24px 48px 48px; }
  }
</style></head><body>

  <div class="cover">
    <div class="cover-eyebrow">ΛΕΒΙΑΘΑΝ Cloud</div>
    <div class="cover-title">ΔΙΚΤΥΟ ΚΕΙΜΕΝΩΝ<br><span style="font-weight:400;font-size:22px">${net.name}</span></div>
    <div class="cover-meta">${net.items.length} κείμενα &nbsp;·&nbsp; ${new Date().toLocaleDateString('el-GR')}</div>
  </div>

  <div class="section-header"><div class="section-title">Κείμενα</div></div>
  ${textsHtml}

  ${hasQuestions ? `
  <div class="section-header" style="page-break-before:always"><div class="section-title">Θέματα</div></div>
  <div class="themes-wrapper">${questionsHtml}</div>
  ` : ''}

  <script>
    const frames = document.querySelectorAll('iframe');
    let loaded = 0;
    if (!frames.length) { window.print(); }
    else {
      frames.forEach(f => f.addEventListener('load', () => { if (++loaded === frames.length) window.print(); }));
      setTimeout(() => window.print(), 6000);
    }
  <\/script>
</body></html>`);
    w.document.close();
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div style={S.loadingScreen}><div style={S.spinner}></div><div style={S.loadingText}>Φόρτωση ΛΕΒΙΑΘΑΝ Cloud...</div></div>
  );
  if (!session) return null;

  const toolCategories = getToolCategories();

  return (
    <div style={S.app}>
      <style>{`
        * { box-sizing: border-box; }
        .ch:hover  { border-color: #c4b5fd !important; }
        .cht:hover { border-color: #fcd34d !important; }
        .chf:hover { border-color: #c4b5fd !important; }
        .chn:hover { border-color: #6ee7b7 !important; }
        .nav-h:hover   { background: rgba(255,255,255,0.06) !important; color: #ececec !important; }
        .ri-h:hover    { background: #f9f9f8 !important; }
        .picker-h:hover{ background: #f0fdf4 !important; }
        .net-h:hover   { background: #f4fdf9 !important; }
        input:focus, textarea:focus { border-color: #8b5cf6 !important; outline: none; box-shadow: 0 0 0 3px rgba(139,92,246,0.1) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .acc-toggle { cursor:pointer; user-select:none; }
        .acc-toggle:hover { background: #f0fdf4 !important; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ ...S.sidebar, width: sidebarCollapsed ? '70px' : '260px' }}>
        <div style={S.sidebarHeader}>
          {!sidebarCollapsed && <span style={S.logoText}>ΛΕΒΙΑΘΑΝ</span>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={S.collapseBtn}>
            {sidebarCollapsed
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>}
          </button>
        </div>
        <nav style={S.nav}>
          <button onClick={goHome} className="nav-h" style={{ ...S.navItem, ...(activeView === 'home' ? S.navActive : {}) }}>
            <span style={S.navIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg></span>
            {!sidebarCollapsed && <span>Αρχική</span>}
          </button>
          <div style={S.navDiv}></div>
          <button className="nav-h" onClick={() => { setActiveView('allDocs'); setCurrentFolder(null); }}
            style={{ ...S.navItem, ...(['allDocs','folder','favorites','recent'].includes(activeView) ? S.navActive : {}) }}>
            <span style={S.navIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/><rect x="1" y="3" width="4" height="4" rx="0.5"/><rect x="1" y="9" width="4" height="4" rx="0.5"/><rect x="1" y="15" width="4" height="4" rx="0.5"/></svg></span>
            {!sidebarCollapsed && <span>Κείμενα &amp; Βιβλία</span>}
          </button>
          <div style={S.navDiv}></div>
          <button className="nav-h" onClick={() => { setActiveView('networksList'); setCurrentFolder(null); setCurrentFile(null); }}
            style={{ ...S.navItem, ...(['networksList','network'].includes(activeView) ? S.navActive : {}) }}>
            <span style={S.navIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/>
              </svg>
            </span>
            {!sidebarCollapsed && <><span style={{ flex:1, textAlign:'left' }}>Δίκτυα Κειμένων</span>{networks.length > 0 && <span style={S.badge}>{networks.length}</span>}</>}
          </button>
          <div style={S.navDiv}></div>
          {tools.length > 0 && (
            <button className="nav-h" onClick={openAllTools}
              style={{ ...S.navItem, ...(['allTools','toolCategory'].includes(activeView) ? S.navActive : {}) }}>
              <span style={S.navIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>
              {!sidebarCollapsed && <><span style={{ flex:1, textAlign:'left' }}>Εφαρμογές</span><span style={S.badge}>{tools.length}</span></>}
            </button>
          )}
        </nav>
        <div style={S.sidebarFooter}>
          <div style={S.userCard}>
            <div style={S.userAvatar}>{session.user?.email?.charAt(0).toUpperCase()}</div>
            {!sidebarCollapsed && (
              <div style={S.userInfo}>
                <div style={S.userName}>{session.user?.email?.split('@')[0]}</div>
                <button onClick={() => signOut()} style={S.logoutLink}>Αποσύνδεση</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ ...S.main, marginLeft: sidebarCollapsed ? '70px' : '260px' }}>
        <div style={S.container}>

          {/* Home */}
          {activeView === 'home' && (
            <>
              <div style={S.welcomeSec}>
                <h1 style={S.welcomeTitle}>Γεια σου, {session.user?.email?.split('@')[0]}! 👋</h1>
                <p style={S.welcomeSub}>Ας συνεχίσουμε από εκεί που σταματήσαμε</p>
              </div>
              <div style={S.statsGrid}>
                {[
                  { label:'Αγαπημένα', value:favorites.length,  sub:'Επιλεγμένα αρχεία', view:'favorites',    bg:'#f0f0f0', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
                  { label:'Πρόσφατα',  value:recentFiles.length, sub:'Τελευταία αρχεία',  view:'recent',       bg:'#f0f0f0', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                  { label:'Δίκτυα',    value:networks.length,    sub:'Ομάδες κειμένων',  view:'networksList', bg:'#f0fdf4', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/></svg> },
                ].map(s => (
                  <div key={s.view} className="ch" style={{ ...S.statCard, cursor:'pointer' }} onClick={() => setActiveView(s.view)}>
                    <div style={S.statInner}>
                      <div><div style={S.statLabel}>{s.label}</div><div style={S.statVal}>{s.value}</div><div style={S.statSub}>{s.sub}</div></div>
                      <div style={{ ...S.statIcon, background:s.bg }}>{s.icon}</div>
                    </div>
                  </div>
                ))}
              </div>
              <section style={S.section}>
                <h2 style={S.secTitle}>Φάκελοι Εγγράφων</h2>
                <div style={S.cardsGrid}>
                  {Object.entries(FOLDERS).map(([id, f]) => (
                    <div key={id} className="ch" style={S.folderCard} onClick={() => openFolder(id)}>
                      <div style={S.folderCardTop}><div style={S.folderIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div></div>
                      <h3 style={S.folderTitle}>{f.name}</h3><p style={S.folderDesc}>{f.desc}</p>
                      <div style={S.folderFoot}><button style={S.linkBtn}>Προβολή →</button></div>
                    </div>
                  ))}
                </div>
              </section>
              {recentFiles.length > 0 && (
                <section style={S.section}>
                  <h2 style={S.secTitle}>Πρόσφατα Αρχεία</h2>
                  <div style={S.recentList}>
                    {recentFiles.map(file => (
                      <div key={file.id} className="ri-h" style={S.recentItem} onClick={() => openFile(file)}>
                        <div style={S.recentInfo}><div style={S.recentTitle}>{file.title}</div><div style={S.recentMeta}>{file.name}</div></div>
                        <button style={S.quickBtn}>Άνοιγμα →</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* All Docs */}
          {activeView === 'allDocs' && (
            <>
              <div style={S.pageHeader}><button onClick={goHome} style={S.backBtn}>← Πίσω</button><div><h1 style={S.pageTitle}>Όλα τα Έγγραφα</h1></div></div>
              <div style={S.cardsGrid}>
                {Object.entries(FOLDERS).map(([id, f]) => (
                  <div key={id} className="ch" style={S.folderCard} onClick={() => openFolder(id)}>
                    <div style={S.folderCardTop}><div style={S.folderIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div></div>
                    <h3 style={S.folderTitle}>{f.name}</h3><p style={S.folderDesc}>{f.desc}</p>
                    <div style={S.folderFoot}><button style={S.linkBtn}>Προβολή →</button></div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Folder */}
          {activeView === 'folder' && currentFolder && (
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <div><h1 style={S.pageTitle}>{FOLDERS[currentFolder].name}</h1><p style={S.pageSub}>{filteredFiles.length} αρχεία</p></div>
              </div>
              <div style={S.searchBar}><input type="search" placeholder="Αναζήτηση..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={S.searchInput} /></div>
              <div style={S.filesGrid}>
                {loading ? <div style={S.empty}>Φόρτωση...</div>
                  : filteredFiles.length === 0 ? <div style={S.empty}>Δεν βρέθηκαν αρχεία</div>
                  : filteredFiles.map(file => (
                    <div key={file.id} className="ch chf" style={{ ...S.fileCard, ...(currentFile?.id === file.id ? S.fileCardActive : {}) }} onClick={() => openFile(file)}>
                      <div style={S.fileCardTop}>
                        <div style={S.filePreview}><img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>'; }} /></div>
                        <button onClick={e => { e.stopPropagation(); toggleFavorite(file); }} style={S.favBtn}>{favorites.some(f => f.id === file.id) ? '★' : '☆'}</button>
                      </div>
                      <div style={S.fileCardBody}><h3 style={S.fileCardTitle}>{file.title}</h3><p style={S.fileCardMeta}>{file.name}</p></div>
                      <div style={S.fileCardFoot}><button style={S.yellowSmall}>Προβολή →</button></div>
                    </div>
                  ))}
              </div>
            </>
          )}

          {/* Networks List */}
          {activeView === 'networksList' && (
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <div style={{ flex:1 }}><h1 style={S.pageTitle}>Δίκτυα Κειμένων</h1><p style={S.pageSub}>Κείμενα · Ερωτήσεις · Εκτύπωση ενιαία</p></div>
                <button onClick={() => setShowNewNetworkForm(true)} style={S.greenBtn}>+ Νέο Δίκτυο</button>
              </div>
              {showNewNetworkForm && (
                <div style={S.newNetForm}>
                  <input autoFocus type="text" placeholder="Όνομα δικτύου (π.χ. Ενότητα 3 — Περιβάλλον)"
                    value={newNetworkName} onChange={e => setNewNetworkName(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') createNetwork(); if (e.key==='Escape') setShowNewNetworkForm(false); }}
                    style={S.newNetInput} />
                  <button onClick={createNetwork} style={S.greenBtn}>Δημιουργία</button>
                  <button onClick={() => setShowNewNetworkForm(false)} style={S.cancelBtn}>Ακύρωση</button>
                </div>
              )}
              {networks.length === 0 ? (
                <div style={{ ...S.emptyBlock, paddingTop:'60px' }}>
                  <div style={{ fontSize:'48px', marginBottom:'16px' }}>🕸️</div>
                  <div style={S.emptyTxt}>Δεν υπάρχουν δίκτυα ακόμα</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {networks.map(net => (
                    <div key={net.id} className="ch chn" style={S.netListCard}>
                      <div style={S.netListLeft}>
                        <div style={S.netListIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/></svg></div>
                        <div><div style={S.netListName}>{net.name}</div><div style={S.netListMeta}>{net.items.length} {net.items.length===1?'κείμενο':'κείμενα'}</div></div>
                      </div>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <button onClick={() => { setCurrentNetwork(net); setActiveView('network'); }} style={S.greenSmall}>Επεξεργασία →</button>
                        {net.items.length > 0 && <button onClick={() => printNetwork(net)} style={S.printSmall}>🖨️</button>}
                        <button onClick={() => deleteNetwork(net.id)} style={S.deleteSmall}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Network Editor */}
          {activeView === 'network' && currentNetwork && (
            <>
              <div style={S.pageHeader}>
                <button onClick={() => setActiveView('networksList')} style={S.backBtn}>← Δίκτυα</button>
                <div style={{ flex:1 }}>
                  <h1 style={S.pageTitle}>{currentNetwork.name}</h1>
                  <p style={S.pageSub}>
                    {currentNetwork.items.length} {currentNetwork.items.length===1?'κείμενο':'κείμενα'}
                    {networkSaving && <span style={{ marginLeft:'10px', color:'#16a34a', fontSize:'12px' }}>· Αποθήκευση…</span>}
                    {networkMsg   && <span style={{ marginLeft:'10px', color: networkMsg.startsWith('✓')?'#16a34a':'#dc2626', fontSize:'12px' }}>{networkMsg}</span>}
                  </p>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => setPickingFile(true)} style={S.greenBtn}>+ Προσθήκη κειμένου</button>
                  {currentNetwork.items.length > 0 && <button onClick={() => printNetwork(currentNetwork)} style={S.printBtn}>🖨️ Εκτύπωση</button>}
                </div>
              </div>

              {currentNetwork.items.length === 0 ? (
                <div style={{ ...S.emptyBlock, paddingTop:'40px' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px' }}>📎</div>
                  <div style={S.emptyTxt}>Πάτησε «+ Προσθήκη κειμένου» για να ξεκινήσεις</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {currentNetwork.items.map((item, idx) => {
                    const isOpen = !!openAccordions[item.fileId];
                    return (
                      <div key={item.fileId} style={S.netItemCard}>
                        {/* Header */}
                        <div style={S.netItemHeader}>
                          <div style={S.netItemNum}>{idx + 1}</div>
                          <div style={S.netItemTitle}>{item.title}</div>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
                            <button onClick={() => moveItem(idx,-1)} disabled={idx===0} style={{ ...S.moveBtn, opacity:idx===0?0.3:1 }}>↑</button>
                            <button onClick={() => moveItem(idx,1)} disabled={idx===currentNetwork.items.length-1} style={{ ...S.moveBtn, opacity:idx===currentNetwork.items.length-1?0.3:1 }}>↓</button>
                            <button onClick={() => openFile({ id:item.fileId, title:item.title, name:item.name })} style={S.viewSmall}>👁</button>
                            <button onClick={() => removeFromNetwork(item.fileId)} style={S.deleteSmall}>✕</button>
                          </div>
                        </div>

                        {/* Accordion toggle */}
                        <div className="acc-toggle" style={{ ...S.accToggle, background: isOpen ? '#f0fdf4' : '#fafaf9' }}
                          onClick={() => toggleAccordion(item.fileId)}>
                          <span style={S.accLabel}>Ερωτήσεις</span>
                          <span style={S.accCount}>{item.questions.length} {item.questions.length===1?'ερώτηση':'ερωτήσεις'}</span>
                          <span style={{ fontSize:'12px', color:'#6b6b80', marginLeft:'6px' }}>{isOpen ? '▲' : '▼'}</span>
                        </div>

                        {/* Accordion body */}
                        {isOpen && (
                          <div style={S.accBody}>
                            {item.questions.length === 0 && (
                              <div style={{ fontSize:'13px', color:'#aeaeb8', marginBottom:'12px' }}>
                                Δεν υπάρχουν ερωτήσεις ακόμα. Πάτησε «+ Ερώτηση».
                              </div>
                            )}
                            {item.questions.map((q, qi) => (
                              <div key={q.id} style={S.qRow}>
                                <input
                                  type="text"
                                  placeholder="Κωδ. (π.χ. Α1)"
                                  value={q.code}
                                  onChange={e => updateQuestion(item.fileId, q.id, 'code', e.target.value)}
                                  onBlur={saveNetworkState}
                                  style={S.qCodeInput}
                                />
                                <textarea
                                  rows={3}
                                  placeholder="Κείμενο ερώτησης…"
                                  value={q.text}
                                  onChange={e => updateQuestion(item.fileId, q.id, 'text', e.target.value)}
                                  onBlur={saveNetworkState}
                                  style={S.qTextInput}
                                />
                                <button onClick={() => removeQuestion(item.fileId, q.id)} style={S.qDelBtn} title="Διαγραφή">✕</button>
                              </div>
                            ))}
                            <button onClick={() => addQuestion(item.fileId)} style={S.addQBtn}>+ Ερώτηση</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Favorites */}
          {activeView === 'favorites' && (
            <>
              <div style={S.pageHeader}><button onClick={goHome} style={S.backBtn}>← Πίσω</button><div><h1 style={S.pageTitle}>Αγαπημένα</h1><p style={S.pageSub}>{favorites.length} αρχεία</p></div></div>
              <div style={S.filesGrid}>
                {favorites.length === 0 ? <div style={S.empty}>Δεν έχεις αγαπημένα ακόμα</div>
                  : favorites.map(file => (
                    <div key={file.id} className="ch chf" style={S.fileCard} onClick={() => openFile(file)}>
                      <div style={S.fileCardTop}><div style={S.filePreview}><img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{ width:'100%',height:'100%',objectFit:'cover' }} onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>';}}/></div><button onClick={e=>{e.stopPropagation();toggleFavorite(file);}} style={S.favBtn}>★</button></div>
                      <div style={S.fileCardBody}><h3 style={S.fileCardTitle}>{file.title}</h3><p style={S.fileCardMeta}>{file.name}</p></div>
                      <div style={S.fileCardFoot}><button style={S.yellowSmall}>Προβολή →</button></div>
                    </div>
                  ))}
              </div>
            </>
          )}

          {/* Recent */}
          {activeView === 'recent' && (
            <>
              <div style={S.pageHeader}><button onClick={goHome} style={S.backBtn}>← Πίσω</button><div><h1 style={S.pageTitle}>Πρόσφατα</h1><p style={S.pageSub}>{recentFiles.length} αρχεία</p></div></div>
              <div style={S.filesGrid}>
                {recentFiles.length === 0 ? <div style={S.empty}>Δεν έχεις ανοίξει αρχεία ακόμα</div>
                  : recentFiles.map(file => (
                    <div key={file.id} className="ch chf" style={S.fileCard} onClick={() => openFile(file)}>
                      <div style={S.fileCardTop}><div style={S.filePreview}><img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{ width:'100%',height:'100%',objectFit:'cover' }} onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>';}}/></div><button onClick={e=>{e.stopPropagation();toggleFavorite(file);}} style={S.favBtn}>{favorites.some(f=>f.id===file.id)?'★':'☆'}</button></div>
                      <div style={S.fileCardBody}><h3 style={S.fileCardTitle}>{file.title}</h3><p style={S.fileCardMeta}>{file.name}</p></div>
                      <div style={S.fileCardFoot}><button style={S.yellowSmall}>Προβολή →</button></div>
                    </div>
                  ))}
              </div>
            </>
          )}

          {/* All Tools */}
          {activeView === 'allTools' && (
            <>
              <div style={S.pageHeader}><button onClick={goHome} style={S.backBtn}>← Πίσω</button><div><h1 style={S.pageTitle}>Όλα τα Εργαλεία</h1><p style={S.pageSub}>{filteredTools.length} εργαλεία</p></div></div>
              <div style={S.searchBar}><input type="search" placeholder="Αναζήτηση εργαλείων..." value={toolsSearchQuery} onChange={e=>setToolsSearchQuery(e.target.value)} style={S.searchInput}/></div>
              {Object.entries(toolCategories).map(([cat, catTools]) => {
                const vis = catTools.filter(t => !toolsSearchQuery || t.name.toLowerCase().includes(toolsSearchQuery.toLowerCase()));
                if (!vis.length) return null;
                return (
                  <section key={cat} style={S.section}>
                    <h2 style={S.secTitle}>{cat}</h2>
                    <div style={S.filesGrid}>
                      {vis.map(tool => (
                        <div key={tool.file} className="ch cht" style={S.toolCard} onClick={() => openTool(tool)}>
                          <div style={S.toolAccent}></div>
                          <div style={S.toolContent}>
                            <div style={S.toolThumb}><img src={`/api/thumbnail/${tool.driveId||tool.file}`} alt={tool.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.style.background='#fffbeb';e.target.parentNode.innerHTML=`<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${tool.icon||'🔧'}</span>`;}}/></div>
                            <h3 style={S.toolTitle}>{tool.name}</h3>
                            <button style={S.yellowSmall}>Εκκίνηση →</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {filteredTools.length===0 && <div style={S.empty}>Δεν βρέθηκαν εργαλεία</div>}
            </>
          )}

          {/* Tool Category */}
          {activeView === 'toolCategory' && currentToolCategory && (
            <>
              <div style={S.pageHeader}><button onClick={openAllTools} style={S.backBtn}>← Εργαλεία</button><div><h1 style={S.pageTitle}>{currentToolCategory==='__recent__'?'Πρόσφατα':currentToolCategory}</h1></div></div>
              <div style={S.filesGrid}>
                {filteredCategoryTools.map(tool => (
                  <div key={tool.file} className="ch cht" style={S.toolCard} onClick={() => openTool(tool)}>
                    <div style={S.toolAccent}></div>
                    <div style={S.toolContent}>
                      <div style={S.toolThumb}><img src={`/api/thumbnail/${tool.driveId||tool.file}`} alt={tool.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.style.background='#fffbeb';e.target.parentNode.innerHTML=`<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${tool.icon||'🔧'}</span>`;}} /></div>
                      <h3 style={S.toolTitle}>{tool.name}</h3>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <button style={S.yellowSmall}>Εκκίνηση →</button>
                        <button onClick={e=>{e.stopPropagation();toggleFavoriteTool(tool);}} style={S.favBtn}>{favoriteTools.some(t=>t.file===tool.file)?'★':'☆'}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </main>

      {/* PDF Modal */}
      {currentFile && (
        <div style={S.modal} onClick={() => { setCurrentFile(null); zoomReset(); }}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h2 style={S.modalTitle}>{currentFile.title}</h2>
              <div style={S.modalBtns}>
                <button onClick={zoomOut} style={S.zoomBtn}>−</button>
                <span style={S.zoomLabel} onClick={zoomReset}>{modalZoom}%</span>
                <button onClick={zoomIn} style={S.zoomBtn}>+</button>
                <div style={S.modalDiv}></div>
                <button onClick={() => window.open(`/api/files/pdf/${currentFile.id}`,'_blank')} style={S.iconBtn}>↗</button>
                <button onClick={() => { setCurrentFile(null); zoomReset(); }} style={S.closeBtn}>✕</button>
              </div>
            </div>
            <div style={{ ...S.modalBody, overflow:'auto' }}>
              <div style={{ transform:`scale(${modalZoom/100})`, transformOrigin:'top center', height:modalZoom>100?`${modalZoom}%`:'100%', width:modalZoom>100?`${10000/modalZoom}%`:'100%' }}>
                <iframe src={`/api/files/pdf/${currentFile.id}`} style={S.iframe} title="PDF Viewer" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tool Modal */}
      {currentTool && !currentFile && (
        <div style={S.modal} onClick={() => { setCurrentTool(null); zoomReset(); }}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h2 style={S.modalTitle}>{currentTool.name}</h2>
              <div style={S.modalBtns}>
                <button onClick={zoomOut} style={S.zoomBtn}>−</button>
                <span style={S.zoomLabel} onClick={zoomReset}>{modalZoom}%</span>
                <button onClick={zoomIn} style={S.zoomBtn}>+</button>
                <div style={S.modalDiv}></div>
                <button onClick={() => window.open(`/api/tool/${currentTool.driveId||currentTool.file}`,'_blank')} style={S.iconBtn}>↗</button>
                <button onClick={() => { setCurrentTool(null); zoomReset(); }} style={S.closeBtn}>✕</button>
              </div>
            </div>
            <div style={{ ...S.modalBody, overflow:'auto' }}>
              <div style={{ transform:`scale(${modalZoom/100})`, transformOrigin:'top center', height:modalZoom>100?`${modalZoom}%`:'100%', width:modalZoom>100?`${10000/modalZoom}%`:'100%' }}>
                <iframe src={`/api/tool/${currentTool.driveId||currentTool.file}`} style={S.iframe} title={currentTool.name} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Picker Modal */}
      {pickingFile && (
        <div style={S.modal} onClick={() => { setPickingFile(false); setPickerSearch(''); }}>
          <div style={{ ...S.modalBox, maxWidth:'580px', height:'65vh' }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h2 style={S.modalTitle}>Επιλογή κειμένου</h2>
              <button onClick={() => { setPickingFile(false); setPickerSearch(''); }} style={S.closeBtn}>✕</button>
            </div>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid #ebebeb' }}>
              <input type="search" placeholder="Αναζήτηση κειμένου..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} style={{ ...S.searchInput, width:'100%' }} autoFocus />
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
              {allFiles.filter(f => !pickerSearch || f.title.toLowerCase().includes(pickerSearch.toLowerCase())).map(file => {
                const already = currentNetwork?.items.some(i => i.fileId === file.id);
                return (
                  <div key={file.id} className="picker-h"
                    style={{ ...S.pickerItem, opacity:already?0.45:1, cursor:already?'default':'pointer' }}
                    onClick={() => !already && addFileToNetwork(file)}>
                    <div style={{ fontSize:'20px', flexShrink:0 }}>📄</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={S.pickerTitle}>{file.title}</div>
                      <div style={S.pickerMeta}>{file.name}</div>
                    </div>
                    {already
                      ? <span style={{ fontSize:'11px', color:'#16a34a', fontWeight:500, flexShrink:0 }}>✓ Έχει προστεθεί</span>
                      : <span style={{ fontSize:'12px', color:'#16a34a', flexShrink:0 }}>+ Προσθήκη</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  loadingScreen:{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#1a1a1a', color:'#ececec', fontFamily:'"Söhne",ui-sans-serif,system-ui,-apple-system,sans-serif' },
  spinner:{ width:'36px', height:'36px', border:'2px solid rgba(255,255,255,0.12)', borderTop:'2px solid #c5b4e3', borderRadius:'50%', animation:'spin 0.9s linear infinite', marginBottom:'16px' },
  loadingText:{ fontSize:'14px', color:'#8e8ea0' },
  app:{ display:'flex', minHeight:'100vh', background:'#f9f9f8', fontFamily:'"Söhne",ui-sans-serif,system-ui,-apple-system,sans-serif', color:'#1a1a1a' },
  sidebar:{ position:'fixed', left:0, top:0, bottom:0, background:'#1a1a1a', display:'flex', flexDirection:'column', transition:'width 0.2s ease', zIndex:100, borderRight:'1px solid rgba(255,255,255,0.06)' },
  sidebarHeader:{ padding:'16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)' },
  logoText:{ fontSize:'15px', fontWeight:'500', color:'#ececec' },
  collapseBtn:{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#8e8ea0', width:'28px', height:'28px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  nav:{ flex:1, padding:'8px', overflowY:'auto' },
  navItem:{ width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', background:'transparent', border:'none', borderRadius:'8px', color:'#8e8ea0', fontSize:'13px', cursor:'pointer', marginBottom:'1px', textAlign:'left' },
  navActive:{ background:'rgba(255,255,255,0.08)', color:'#ececec' },
  navIcon:{ flexShrink:0, width:'18px', display:'flex', alignItems:'center', justifyContent:'center' },
  badge:{ marginLeft:'auto', background:'rgba(255,255,255,0.07)', color:'#8e8ea0', fontSize:'11px', padding:'1px 6px', borderRadius:'10px' },
  navDiv:{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'8px 4px' },
  sidebarFooter:{ padding:'10px', borderTop:'1px solid rgba(255,255,255,0.06)' },
  userCard:{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', background:'rgba(255,255,255,0.04)', borderRadius:'8px' },
  userAvatar:{ width:'30px', height:'30px', borderRadius:'50%', background:'#c5b4e3', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'500', color:'#1a1a1a', flexShrink:0 },
  userInfo:{ flex:1, minWidth:0 },
  userName:{ fontSize:'12px', color:'#ececec', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  logoutLink:{ fontSize:'11px', color:'#555560', background:'none', border:'none', padding:0, cursor:'pointer', textDecoration:'underline' },
  main:{ flex:1, transition:'margin-left 0.2s ease' },
  container:{ maxWidth:'1280px', margin:'0 auto', padding:'32px 40px' },
  welcomeSec:{ marginBottom:'32px' },
  welcomeTitle:{ fontSize:'24px', fontWeight:'500', color:'#1a1a1a', marginBottom:'6px' },
  welcomeSub:{ fontSize:'14px', color:'#6b6b80', lineHeight:'1.5' },
  statsGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'12px', marginBottom:'36px' },
  statCard:{ background:'#fff', borderRadius:'10px', padding:'18px', border:'1px solid #ebebeb', transition:'border-color 0.15s' },
  statInner:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  statLabel:{ fontSize:'12px', color:'#6b6b80', marginBottom:'6px' },
  statVal:{ fontSize:'28px', fontWeight:'500', color:'#1a1a1a', marginBottom:'2px' },
  statSub:{ fontSize:'11px', color:'#aeaeb8' },
  statIcon:{ width:'36px', height:'36px', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center' },
  section:{ marginBottom:'40px' },
  secTitle:{ fontSize:'16px', fontWeight:'500', color:'#1a1a1a', marginBottom:'16px' },
  cardsGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'12px' },
  folderCard:{ background:'#fff', borderRadius:'10px', padding:'18px', border:'1px solid #ebebeb', cursor:'pointer', transition:'border-color 0.15s' },
  folderCardTop:{ marginBottom:'12px' },
  folderIcon:{ width:'40px', height:'40px', borderRadius:'8px', background:'#f4f4f4', color:'#444', display:'flex', alignItems:'center', justifyContent:'center' },
  folderTitle:{ fontSize:'15px', fontWeight:'500', color:'#1a1a1a', marginBottom:'4px' },
  folderDesc:{ fontSize:'13px', color:'#6b6b80', lineHeight:'1.55', marginBottom:'14px' },
  folderFoot:{ display:'flex', justifyContent:'flex-end', paddingTop:'12px', borderTop:'1px solid #f0f0f0' },
  linkBtn:{ background:'transparent', border:'none', color:'#8b5cf6', fontSize:'12px', fontWeight:'500', cursor:'pointer' },
  filesGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'12px' },
  fileCard:{ background:'#fff', borderRadius:'10px', overflow:'hidden', border:'1px solid #ebebeb', cursor:'pointer', transition:'border-color 0.15s' },
  fileCardActive:{ borderColor:'#8b5cf6' },
  fileCardTop:{ position:'relative' },
  filePreview:{ height:'120px', background:'#f9f9f8', display:'flex', alignItems:'center', justifyContent:'center' },
  favBtn:{ position:'absolute', top:'8px', right:'8px', background:'rgba(255,255,255,0.9)', border:'none', width:'28px', height:'28px', borderRadius:'50%', fontSize:'13px', cursor:'pointer' },
  fileCardBody:{ padding:'12px 12px 8px' },
  fileCardTitle:{ fontSize:'13px', fontWeight:'500', color:'#1a1a1a', marginBottom:'3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  fileCardMeta:{ fontSize:'11px', color:'#aeaeb8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  fileCardFoot:{ padding:'8px 12px 12px', borderTop:'1px solid #f0f0f0' },
  toolCard:{ position:'relative', background:'#fff', borderRadius:'10px', overflow:'hidden', border:'1px solid #ebebeb', cursor:'pointer', transition:'border-color 0.15s' },
  toolAccent:{ height:'3px', background:'#e0e0e0' },
  toolContent:{ padding:'18px' },
  toolThumb:{ width:'calc(100% + 36px)', height:'120px', marginLeft:'-18px', marginRight:'-18px', marginTop:'-18px', background:'#f4f4f4', overflow:'hidden', marginBottom:'12px' },
  toolTitle:{ fontSize:'14px', fontWeight:'500', color:'#1a1a1a', marginBottom:'12px' },
  recentList:{ background:'#fff', borderRadius:'10px', border:'1px solid #ebebeb' },
  recentItem:{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', cursor:'pointer', borderRadius:'8px' },
  recentInfo:{ flex:1, minWidth:0 },
  recentTitle:{ fontSize:'13px', fontWeight:'500', color:'#1a1a1a', marginBottom:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  recentMeta:{ fontSize:'11px', color:'#aeaeb8' },
  quickBtn:{ background:'transparent', border:'1px solid #ebebeb', color:'#8b5cf6', padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', flexShrink:0 },
  pageHeader:{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'24px', flexWrap:'wrap' },
  backBtn:{ background:'#fff', border:'1px solid #ebebeb', color:'#6b6b80', padding:'7px 14px', borderRadius:'8px', fontSize:'13px', cursor:'pointer' },
  pageTitle:{ fontSize:'20px', fontWeight:'500', color:'#1a1a1a', marginBottom:'2px' },
  pageSub:{ fontSize:'13px', color:'#6b6b80' },
  searchBar:{ display:'flex', gap:'8px', marginBottom:'20px' },
  searchInput:{ flex:1, padding:'10px 14px', border:'1px solid #ebebeb', borderRadius:'8px', fontSize:'13px', background:'#fff', color:'#1a1a1a' },
  empty:{ gridColumn:'1/-1', textAlign:'center', padding:'48px 20px', color:'#aeaeb8', fontSize:'13px' },
  emptyBlock:{ textAlign:'center', padding:'48px 20px' },
  emptyTxt:{ color:'#aeaeb8', fontSize:'13px' },
  yellowSmall:{ background:'transparent', color:'#d97706', border:'1px solid #d97706', padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer' },
  // Network
  greenBtn:     { background:'#16a34a', color:'#fff', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer', whiteSpace:'nowrap' },
  greenSmall:   { background:'transparent', color:'#16a34a', border:'1px solid #16a34a', padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', whiteSpace:'nowrap' },
  printBtn:     { background:'#1a1a1a', color:'#fff', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer', whiteSpace:'nowrap' },
  printSmall:   { background:'transparent', border:'1px solid #ddd', padding:'5px 10px', borderRadius:'7px', fontSize:'13px', cursor:'pointer' },
  deleteSmall:  { background:'transparent', border:'1px solid #fca5a5', color:'#dc2626', padding:'5px 10px', borderRadius:'7px', fontSize:'12px', cursor:'pointer' },
  cancelBtn:    { background:'transparent', border:'1px solid #ebebeb', color:'#6b6b80', padding:'8px 14px', borderRadius:'8px', fontSize:'13px', cursor:'pointer' },
  moveBtn:      { background:'#f4f4f4', border:'1px solid #e0e0e0', color:'#444', width:'28px', height:'28px', borderRadius:'6px', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  viewSmall:    { background:'#f4f4f4', border:'1px solid #e0e0e0', padding:'5px 8px', borderRadius:'7px', fontSize:'13px', cursor:'pointer' },
  newNetForm:   { display:'flex', gap:'10px', alignItems:'center', marginBottom:'24px', padding:'16px', background:'#f0fdf4', borderRadius:'10px', border:'1px solid #bbf7d0', flexWrap:'wrap' },
  newNetInput:  { flex:1, minWidth:'200px', padding:'9px 14px', border:'1px solid #bbf7d0', borderRadius:'8px', fontSize:'14px', background:'#fff', color:'#1a1a1a' },
  netListCard:  { background:'#fff', borderRadius:'10px', padding:'16px 18px', border:'1px solid #ebebeb', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', transition:'border-color 0.15s' },
  netListLeft:  { display:'flex', alignItems:'center', gap:'12px', flex:1, minWidth:0 },
  netListIcon:  { width:'36px', height:'36px', borderRadius:'8px', background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  netListName:  { fontSize:'14px', fontWeight:'500', color:'#1a1a1a', marginBottom:'2px' },
  netListMeta:  { fontSize:'12px', color:'#6b6b80' },
  netItemCard:  { background:'#fff', borderRadius:'10px', border:'1px solid #ebebeb', overflow:'hidden' },
  netItemHeader:{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', borderBottom:'1px solid #f0f0f0', background:'#fafaf9' },
  netItemNum:   { width:'24px', height:'24px', borderRadius:'50%', background:'#1a1a1a', color:'#fff', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  netItemTitle: { flex:1, fontSize:'14px', fontWeight:'500', color:'#1a1a1a', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  // Accordion
  accToggle:    { display:'flex', alignItems:'center', gap:'8px', padding:'10px 16px', borderBottom:'1px solid #f0f0f0', transition:'background 0.12s' },
  accLabel:     { fontSize:'12px', fontWeight:'600', color:'#16a34a', textTransform:'uppercase', letterSpacing:'0.08em', flex:1 },
  accCount:     { fontSize:'11px', color:'#6b6b80' },
  accBody:      { padding:'14px 16px 16px' },
  // Questions
  qRow:    { display:'flex', gap:'8px', alignItems:'flex-start', marginBottom:'10px' },
  qCodeInput:{ width:'72px', flexShrink:0, padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:'7px', fontSize:'13px', fontWeight:'600', color:'#1a1a1a', background:'#fff', textAlign:'center' },
  qTextInput:{ flex:1, padding:'8px 10px', border:'1px solid #e0e0e0', borderRadius:'7px', fontSize:'13px', lineHeight:'1.6', color:'#1a1a1a', background:'#fafaf9', resize:'vertical', fontFamily:'inherit' },
  qDelBtn:   { background:'transparent', border:'1px solid #fca5a5', color:'#dc2626', width:'28px', height:'28px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'4px' },
  addQBtn:   { background:'transparent', color:'#16a34a', border:'1px dashed #86efac', padding:'6px 14px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', marginTop:'4px' },
  // Picker
  pickerItem: { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', marginBottom:'2px' },
  pickerTitle:{ fontSize:'13px', fontWeight:'500', color:'#1a1a1a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  pickerMeta: { fontSize:'11px', color:'#aeaeb8' },
  // Modals
  modal:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'20px' },
  modalBox:  { background:'#fff', borderRadius:'12px', width:'90vw', maxWidth:'1400px', height:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', border:'1px solid #e5e5e5' },
  modalHead: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #ebebeb', minHeight:'46px' },
  modalTitle:{ fontSize:'14px', fontWeight:'500', color:'#1a1a1a', flex:1, marginRight:'14px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  modalBtns: { display:'flex', gap:'6px', alignItems:'center' },
  iconBtn:   { background:'#f4f4f4', color:'#444', border:'1px solid #e0e0e0', width:'28px', height:'28px', borderRadius:'6px', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  closeBtn:  { background:'transparent', border:'1px solid #ebebeb', fontSize:'14px', color:'#8e8ea0', cursor:'pointer', width:'28px', height:'28px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center' },
  zoomBtn:   { background:'#1a1a1a', color:'#fff', border:'none', width:'28px', height:'28px', borderRadius:'6px', fontSize:'14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  zoomLabel: { fontSize:'11px', color:'#6b6b80', minWidth:'36px', textAlign:'center', cursor:'pointer', userSelect:'none' },
  modalDiv:  { width:'1px', height:'18px', background:'#ebebeb', margin:'0 2px' },
  modalBody: { flex:1, overflow:'hidden' },
  iframe:    { width:'100%', height:'100%', border:'none' },
};
