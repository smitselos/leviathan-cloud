import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback, useRef } from 'react';

// ── Energy Insights palette ───────────────────────────────────────────────
// Πιστή μεταφορά της παλέτας από το mockup: κρεμ, ροδακινί, ώχρα
const PALETTE = {
  cream:   { bg:'#f5f0e1', bgSoft:'#faf6ea', accent:'#e8dfc4', text:'#3d3a2e', deep:'#8a7d4a' },
  peach:   { bg:'#f9e4d4', bgSoft:'#fcf0e5', accent:'#f0c9a8', text:'#5c3826', deep:'#c97b5a' },
  mustard: { bg:'#efe5b8', bgSoft:'#f7f0d0', accent:'#d4b348', text:'#4a3f1a', deep:'#a68a2e' },
};

const FOLDERS = {
  keimena: { name: 'Κείμενα', icon: null, color: '#3b82f6', desc: 'Εκπαιδευτικά κείμενα και υλικό', tone:'cream' },
  biblia:  { name: 'Βιβλία', icon: null, color: '#8b5cf6', desc: 'Βιβλία αναφοράς και μελέτης', tone:'peach' },
  diktya:  { name: 'Δίκτυα Κειμένων', icon: null, color: '#16a34a', desc: 'Έτοιμα δίκτυα κειμένων', tone:'mustard' },
};

const SUGGESTED_TAGS = [
  'Γλώσσα','Λογοτεχνία','Ιστορία','Αρχαία','Λατινικά',
  'Έκθεση','Γραμματική','Λεξιλόγιο','Ανάλυση','Αξιολόγηση',
  'Α΄ Λυκείου','Β΄ Λυκείου','Γ΄ Λυκείου',
];

const TAG_COLORS = [
  { bg:'#ede9fe', text:'#6d28d9' },
  { bg:'#dcfce7', text:'#15803d' },
  { bg:'#fef3c7', text:'#b45309' },
  { bg:'#dbeafe', text:'#1d4ed8' },
  { bg:'#fce7f3', text:'#9d174d' },
  { bg:'#e0f2fe', text:'#0369a1' },
  { bg:'#f3f4f6', text:'#374151' },
];

const tagColor = (tag) => TAG_COLORS[Math.abs([...tag].reduce((a,c)=>a+c.charCodeAt(0),0)) % TAG_COLORS.length];
const newQid   = () => Math.random().toString(36).slice(2,8);
const sortCode = (code) => { const m=code.match(/^([Α-Ωα-ω]+)(\d*)$/u); if(!m)return 9999; return m[1].charCodeAt(0)*1000+(parseInt(m[2])||0); };

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

  // Tags + comments
  const [metadata, setMetadata]               = useState({});
  const [metaSaving, setMetaSaving]           = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [tagInput, setTagInput]               = useState('');
  const [showTagSuggest, setShowTagSuggest]   = useState(false);
  const tagInputRef = useRef(null);
  const saveTimer   = useRef(null);

  // Linked app for diktya modal (split view)
  const [linkedApp, setLinkedApp]         = useState(null);
  const [showLinkedApp, setShowLinkedApp] = useState(false);
  const [showAppPicker, setShowAppPicker] = useState(false);

  // Network builder state
  const [netBuilderActive, setNetBuilderActive]   = useState(false);
  const [networks, setNetworks]                   = useState([]);
  const [currentNetwork, setCurrentNetwork]       = useState(null);
  const [netSaving, setNetSaving]                 = useState(false);
  const [netMsg, setNetMsg]                       = useState('');
  const [merging, setMerging]                     = useState(false);
  const [showNewNetForm, setShowNewNetForm]        = useState(false);
  const [newNetName, setNewNetName]               = useState('');
  const [pickingFile, setPickingFile]             = useState(false);
  const [allFiles, setAllFiles]                   = useState([]);
  const [pickerSearch, setPickerSearch]           = useState('');
  const [openAccordions, setOpenAccordions]       = useState({});

  const zoomIn    = () => setModalZoom(z=>Math.min(z+10,200));
  const zoomOut   = () => setModalZoom(z=>Math.max(z-10,50));
  const zoomReset = () => setModalZoom(100);

  const recentTools = [...tools].filter(t=>t.addedAt).sort((a,b)=>new Date(b.addedAt)-new Date(a.addedAt)).slice(0,5);

  useEffect(()=>{ if(status==='unauthenticated') router.push('/login'); },[status,router]);

  useEffect(()=>{
    const sf=localStorage.getItem('leviathan-favorites');
    const sr=localStorage.getItem('leviathan-recent');
    const sft=localStorage.getItem('leviathan-favorite-tools');
    if(sf) setFavorites(JSON.parse(sf));
    if(sr) setRecentFiles(JSON.parse(sr));
    if(sft) setFavoriteTools(JSON.parse(sft));
  },[]);

  useEffect(()=>{ if(session){ loadTools(); loadMetadata(); loadAllFiles(); loadNetworks(); } },[session]);

  const loadTools = async()=>{ try{ const r=await fetch('/api/tools'); const d=await r.json(); setTools(d.tools||[]); }catch(e){} };
  const loadMetadata = async()=>{ try{ const r=await fetch('/api/metadata'); const d=await r.json(); setMetadata(d.metadata||{}); }catch(e){} };
  const loadAllFiles = async()=>{ try{ const results=await Promise.all(['keimena','biblia','diktya'].map(fid=>fetch(`/api/files/${fid}`).then(r=>r.json()))); setAllFiles(results.flatMap(r=>r.files||[])); }catch(e){} };
  const loadNetworks = async()=>{ try{ const r=await fetch('/api/networks'); const d=await r.json(); setNetworks(d.networks||[]); }catch(e){} };

  const persistMetadata = useCallback(async(updated)=>{
    setMetaSaving(true);
    try{ await fetch('/api/metadata',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({metadata:updated})}); setMetadata(updated); }catch(e){}
    setMetaSaving(false);
  },[]);

  const scheduleMetaSave=(updated)=>{ setMetadata(updated); if(saveTimer.current)clearTimeout(saveTimer.current); saveTimer.current=setTimeout(()=>persistMetadata(updated),900); };

  const getToolCategories=()=>{ const cats={}; tools.forEach(t=>{ if(!t.category)return; if(!cats[t.category])cats[t.category]=[]; cats[t.category].push(t); }); return cats; };

  const loadFiles=useCallback(async(folderId)=>{
    setLoading(true);
    try{ const r=await fetch(`/api/files/${folderId}`); const d=await r.json(); setFiles(d.files||[]); }catch(e){ setFiles([]); }
    setLoading(false);
  },[]);

  const openFolder=(id)=>{ setCurrentFolder(id); setActiveView('folder'); setCurrentFile(null); setActiveTagFilter(null); setNetBuilderActive(false); loadFiles(id); };
  const openTool=(t)=>setCurrentTool(t);
  const openAllTools=async()=>{ setActiveView('allTools'); setCurrentFolder(null); setCurrentFile(null); setCurrentToolCategory(null); setNetBuilderActive(false); await loadTools(); };
  const openToolCategory=(c)=>{ setCurrentToolCategory(c); setActiveView('toolCategory'); setCurrentFolder(null); setCurrentFile(null); };

  const goHome=()=>{
    setActiveView('home'); setCurrentFolder(null); setCurrentFile(null); setCurrentTool(null);
    setCurrentToolCategory(null); setActiveTagFilter(null); setNetBuilderActive(false); setCurrentNetwork(null);
  };

  const openFile=(file)=>{
    setCurrentFile(file); setShowCommentPanel(false); setShowLinkedApp(false); setLinkedApp(null);
    const saved=localStorage.getItem(`linked-app-${file.id}`);
    if(saved){ try{ setLinkedApp(JSON.parse(saved)); }catch(e){ setLinkedApp(null); } }
    const updated=[file,...recentFiles.filter(f=>f.id!==file.id)].slice(0,5);
    setRecentFiles(updated); localStorage.setItem('leviathan-recent',JSON.stringify(updated));
  };

  const toggleFavorite=(file)=>{ const isFav=favorites.some(f=>f.id===file.id); const updated=isFav?favorites.filter(f=>f.id!==file.id):[...favorites,file]; setFavorites(updated); localStorage.setItem('leviathan-favorites',JSON.stringify(updated)); };
  const toggleFavoriteTool=(tool)=>{ const isFav=favoriteTools.some(t=>t.file===tool.file); const updated=isFav?favoriteTools.filter(t=>t.file!==tool.file):[...favoriteTools,tool]; setFavoriteTools(updated); localStorage.setItem('leviathan-favorite-tools',JSON.stringify(updated)); };

  // Tag helpers
  const fileMeta=(id)=>metadata[id]||{tags:[],comment:''};
  const fileTags=(id)=>fileMeta(id).tags||[];
  const fileComment=(id)=>fileMeta(id).comment||'';
  const addTag=(fileId,tag)=>{ const t=tag.trim(); if(!t)return; const cur=fileMeta(fileId); if(cur.tags.includes(t))return; const updated={...metadata,[fileId]:{...cur,tags:[...cur.tags,t]}}; persistMetadata(updated); setTagInput(''); setShowTagSuggest(false); };
  const removeTag=(fileId,tag)=>{ const cur=fileMeta(fileId); const updated={...metadata,[fileId]:{...cur,tags:cur.tags.filter(t=>t!==tag)}}; persistMetadata(updated); };
  const updateComment=(fileId,value)=>{ const cur=fileMeta(fileId); scheduleMetaSave({...metadata,[fileId]:{...cur,comment:value}}); };
  const allTagsInFolder=()=>{ const set=new Set(); files.forEach(f=>fileTags(f.id).forEach(t=>set.add(t))); return[...set].sort(); };

  const filteredFiles=files.filter(f=>{ const matchQ=!searchQuery||f.title.toLowerCase().includes(searchQuery.toLowerCase())||f.name.toLowerCase().includes(searchQuery.toLowerCase()); const matchTag=!activeTagFilter||fileTags(f.id).includes(activeTagFilter); return matchQ&&matchTag; });
  const filteredTools=tools.filter(t=>!toolsSearchQuery||t.name.toLowerCase().includes(toolsSearchQuery.toLowerCase()));
  const filteredCategoryTools=currentToolCategory?(currentToolCategory==='__recent__'?recentTools:tools.filter(t=>t.category===currentToolCategory)).filter(t=>!toolsSearchQuery||t.name.toLowerCase().includes(toolsSearchQuery.toLowerCase())):[];
  const suggestedTags=SUGGESTED_TAGS.filter(t=>t.toLowerCase().includes(tagInput.toLowerCase())&&!fileTags(currentFile?.id||'').includes(t));

  const linkAppToFile=(tool)=>{
    setLinkedApp(tool);
    if(currentFile) localStorage.setItem(`linked-app-${currentFile.id}`,JSON.stringify(tool));
    setShowAppPicker(false);
  };
  const unlinkApp=()=>{ setLinkedApp(null); setShowLinkedApp(false); if(currentFile) localStorage.removeItem(`linked-app-${currentFile.id}`); };

  // ── Network builder ───────────────────────────────────────────────────────
  const saveNetwork=async(net)=>{
    setNetSaving(true); setNetMsg('');
    try{
      const r=await fetch('/api/networks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(net)});
      const d=await r.json();
      if(r.ok){ setNetMsg('✓ Αποθηκεύτηκε'); setTimeout(()=>setNetMsg(''),2000); return d.driveFileId; }
      else setNetMsg('✗ Σφάλμα');
    }catch{ setNetMsg('✗ Σφάλμα'); }
    setNetSaving(false);
  };

  const createNetwork=async()=>{
    if(!newNetName.trim())return;
    const net={id:Date.now().toString(),name:newNetName.trim(),items:[],pdfFileId:null};
    setNewNetName(''); setShowNewNetForm(false);
    const driveFileId=await saveNetwork(net);
    const newNet={...net,driveFileId};
    setNetworks(prev=>[newNet,...prev]);
    setCurrentNetwork(newNet);
    setNetSaving(false);
  };

  const deleteNetwork=async(net)=>{
    if(!confirm(`Διαγραφή δικτύου «${net.name}»;`))return;
    try{ await fetch('/api/networks',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({driveFileId:net.driveFileId})}); setNetworks(prev=>prev.filter(n=>n.id!==net.id)); if(currentNetwork?.id===net.id)setCurrentNetwork(null); }catch(e){ alert('Σφάλμα διαγραφής'); }
  };

  const updateNet=(updated)=>{ setCurrentNetwork(updated); setNetworks(prev=>prev.map(n=>n.id===updated.id?updated:n)); };

  const addFileToNetwork=(file)=>{
    if(!currentNetwork)return;
    if(currentNetwork.items.some(i=>i.fileId===file.id)){ setPickingFile(false); return; }
    const item={fileId:file.id,title:file.title,name:file.name,questions:[]};
    const updated={...currentNetwork,items:[...currentNetwork.items,item]};
    updateNet(updated); saveNetwork(updated);
    setOpenAccordions(prev=>({...prev,[file.id]:true}));
    setPickingFile(false); setPickerSearch('');
  };

  const removeFromNetwork=(fileId)=>{ const updated={...currentNetwork,items:currentNetwork.items.filter(i=>i.fileId!==fileId)}; updateNet(updated); saveNetwork(updated); };

  const moveItem=(idx,dir)=>{ const items=[...currentNetwork.items]; const target=idx+dir; if(target<0||target>=items.length)return; [items[idx],items[target]]=[items[target],items[idx]]; const updated={...currentNetwork,items}; updateNet(updated); saveNetwork(updated); };

  const addQuestion=(fileId)=>{ const items=currentNetwork.items.map(item=>item.fileId!==fileId?item:{...item,questions:[...item.questions,{id:newQid(),code:'',text:''}]}); const updated={...currentNetwork,items}; updateNet(updated); };
  const updateQuestion=(fileId,qid,field,value)=>{ const items=currentNetwork.items.map(item=>item.fileId!==fileId?item:{...item,questions:item.questions.map(q=>q.id===qid?{...q,[field]:value}:q)}); const updated={...currentNetwork,items}; updateNet(updated); };
  const removeQuestion=(fileId,qid)=>{ const items=currentNetwork.items.map(item=>item.fileId!==fileId?item:{...item,questions:item.questions.filter(q=>q.id!==qid)}); const updated={...currentNetwork,items}; updateNet(updated); saveNetwork(updated); };
  const saveQuestionsNow=()=>{ if(currentNetwork){ const all=networks.map(n=>n.id===currentNetwork.id?currentNetwork:n); setNetworks(all); saveNetwork(currentNetwork); } };
  const toggleAccordion=(fileId)=>setOpenAccordions(prev=>({...prev,[fileId]:!prev[fileId]}));

  const mergeAndSave=async()=>{
    if(!currentNetwork?.items?.length){ alert('Προσθέστε κείμενα πρώτα.'); return; }
    setMerging(true); setNetMsg('');
    try{
      const r=await fetch('/api/networks/merge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({network:currentNetwork})});
      const d=await r.json();
      if(r.ok){ const updated={...currentNetwork,pdfFileId:d.pdfFileId,pdfFilename:d.pdfFilename}; updateNet(updated); setNetMsg('✓ PDF αποθηκεύτηκε'); }
      else setNetMsg(`✗ ${d.error||'Σφάλμα'}`);
    }catch{ setNetMsg('✗ Σφάλμα σύνδεσης'); }
    setMerging(false); setTimeout(()=>setNetMsg(''),4000);
  };

  // ─────────────────────────────────────────────────────────────────────────
if(status==='loading') 
  return (
    <div style={S.loadingScreen}>

      <img 
        src="/logo-white.png"
        alt="Leviathan"
        style={{ 
          height: '120px', 
          marginBottom: '56px',
          objectFit: 'contain'
        }}
      />

      <div style={S.spinner}/>
      
      <div style={S.loadingText}>
        Φόρτωση ΛΕΒΙΑΘΑΝ Cloud...
      </div>

    </div>
  );
  if(!session) return null;

  const toolCategories=getToolCategories();
  const modalFile=currentFile;
  const isDiktya=currentFolder==='diktya';

  // Stat cards config με τους τρεις τόνους
  const statConfig = [
    { label:'Αγαπημένα', value:favorites.length, sub:'Επιλεγμένα αρχεία', view:'favorites', tone:'cream',
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
    { label:'Πρόσφατα', value:recentFiles.length, sub:'Τελευταία αρχεία', view:'recent', tone:'peach',
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'Ετικέτες', value:Object.values(metadata).flatMap(m=>m.tags||[]).filter((v,i,a)=>a.indexOf(v)===i).length, sub:'Μοναδικές ετικέτες', view:'allDocs', tone:'mustard',
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
  ];

  return (
    <div style={S.app}>
      <style>{`
        *{box-sizing:border-box;}
        .ch:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,0.04)!important;}
        .nav-h:hover{background:rgba(255,255,255,0.06)!important;color:#ececec!important;}
        .ri-h:hover{background:#fcf0e5!important;}
        .picker-h:hover{background:#fcf0e5!important;}
        .tag-chip:hover .tag-x{opacity:1!important;}
        .acc-h:hover{background:#fcf0e5!important;}
        input:focus,textarea:focus{border-color:#c97b5a!important;outline:none;box-shadow:0 0 0 3px rgba(201,123,90,0.12)!important;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .suggest-item:hover{background:#faf6ea!important;cursor:pointer;}
        .tag-filter:hover{opacity:0.85;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
      `}</style>

      {/* ── Sidebar (αμετάβλητο, σκούρο) ── */}
      <aside style={{...S.sidebar,width:sidebarCollapsed?'70px':'260px'}}>
        <div style={S.sidebarHeader}>
          {!sidebarCollapsed&&<img 
  src="/logo-white.png" 
  alt="Leviathan"
  style={{ height:'86px', objectFit:'contain' }}
/>}
          <button onClick={()=>setSidebarCollapsed(!sidebarCollapsed)} style={S.collapseBtn}>
            {sidebarCollapsed?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>}
          </button>
        </div>
        <nav style={S.nav}>
          <button onClick={goHome} className="nav-h" style={{...S.navItem,...(activeView==='home'?S.navActive:{})}}>
            <span style={S.navIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg></span>
            {!sidebarCollapsed&&<span>Αρχική</span>}
          </button>
          <div style={S.navDiv}/>
          <button className="nav-h" onClick={()=>{setActiveView('allDocs');setCurrentFolder(null);setNetBuilderActive(false);}}
            style={{...S.navItem,...(['allDocs','favorites','recent'].includes(activeView)||(activeView==='folder'&&currentFolder!=='diktya')?S.navActive:{})}}>
            <span style={S.navIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/><rect x="1" y="3" width="4" height="4" rx="0.5"/><rect x="1" y="9" width="4" height="4" rx="0.5"/><rect x="1" y="15" width="4" height="4" rx="0.5"/></svg></span>
            {!sidebarCollapsed&&<span>Κείμενα &amp; Βιβλία</span>}
          </button>
          <div style={S.navDiv}/>
          <button className="nav-h" onClick={()=>{ openFolder('diktya'); }}
            style={{...S.navItem,...(activeView==='folder'&&currentFolder==='diktya'?S.navActive:{})}}>
            <span style={S.navIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/>
              </svg>
            </span>
            {!sidebarCollapsed&&<span>Δίκτυα Κειμένων</span>}
          </button>
          <button className="nav-h" onClick={()=>{ setNetBuilderActive(true); setActiveView('netBuilder'); setCurrentFolder(null); setCurrentFile(null); }}
            style={{...S.navItem,...(activeView==='netBuilder'?S.navActive:{})}}>
            <span style={S.navIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                <circle cx="12" cy="12" r="9"/>
              </svg>
            </span>
            {!sidebarCollapsed&&<span>Δημιουργία Δικτύου</span>}
          </button>
          <div style={S.navDiv}/>
          {tools.length>0&&(
            <button className="nav-h" onClick={openAllTools}
              style={{...S.navItem,...(['allTools','toolCategory'].includes(activeView)?S.navActive:{})}}>
              <span style={S.navIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>
              {!sidebarCollapsed&&<><span style={{flex:1,textAlign:'left'}}>Εφαρμογές</span><span style={S.badge}>{tools.length}</span></>}
            </button>
          )}
        </nav>
        <div style={S.sidebarFooter}>
          <div style={S.userCard}>
            <div style={S.userAvatar}>{session.user?.email?.charAt(0).toUpperCase()}</div>
            {!sidebarCollapsed&&(<div style={S.userInfo}><div style={S.userName}>{session.user?.email?.split('@')[0]}</div><button onClick={()=>signOut()} style={S.logoutLink}>Αποσύνδεση</button></div>)}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{...S.main,marginLeft:sidebarCollapsed?'70px':'260px'}}>
        <div style={S.container}>

          {/* Home */}
          {activeView==='home'&&(
            <>
              <div style={S.welcomeSec}><h1 style={S.welcomeTitle}>Γεια σου, {session.user?.email?.split('@')[0]}! 👋</h1><p style={S.welcomeSub}>Ας συνεχίσουμε από εκεί που σταματήσαμε</p></div>

              {/* ── STATS CARDS — Energy Insights aesthetic ── */}
              <div style={S.statsGrid}>
                {statConfig.map(s=>{
                  const p=PALETTE[s.tone];
                  return (
                    <div key={s.view} className="ch"
                      style={{...S.statCard, background:p.bg, cursor:'pointer'}}
                      onClick={()=>setActiveView(s.view)}>
                      <div style={S.statInner}>
                        <div style={{flex:1}}>
                          <div style={{...S.statLabel, color:p.text, opacity:0.75}}>{s.label}</div>
                          <div style={{...S.statVal, color:p.text}}>
                            {s.value}
                            <span style={{...S.statUnit, color:p.text, opacity:0.6}}>{s.value===1?'αρχείο':'αρχεία'}</span>
                          </div>
                          <div style={{...S.statSub, color:p.text, opacity:0.55}}>{s.sub}</div>
                        </div>
                        <div style={{...S.statIcon, background:p.accent, color:p.deep}}>{s.icon}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <section style={S.section}>
                <h2 style={S.secTitle}>Φάκελοι</h2>
                <div style={S.cardsGrid}>
                  {Object.entries(FOLDERS).map(([id,f])=>{
                    const p=PALETTE[f.tone];
                    return (
                      <div key={id} className="ch" style={{...S.folderCard, background:p.bg}} onClick={()=>openFolder(id)}>
                        <div style={S.folderTop}>
                          <div style={{...S.folderIcon, background:p.accent, color:p.deep}}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                        </div>
                        <h3 style={{...S.folderTitle, color:p.text}}>{f.name}</h3>
                        <p style={{...S.folderDesc, color:p.text, opacity:0.65}}>{f.desc}</p>
                        <div style={{...S.folderFoot, borderTopColor:p.accent}}>
                          <button style={{...S.linkBtn, color:p.deep}}>Προβολή →</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {recentFiles.length>0&&(
                <section style={S.section}>
                  <h2 style={S.secTitle}>Πρόσφατα Αρχεία</h2>
                  <div style={S.recentList}>
                    {recentFiles.map(file=>(
                      <div key={file.id} className="ri-h" style={S.recentItem} onClick={()=>openFile(file)}>
                        <div style={S.recentInfo}>
                          <div style={S.recentTitle}>{file.title}</div>
                          <div style={S.recentMeta}>{file.name}</div>
                        </div>
                        <button style={S.quickBtn}>Άνοιγμα →</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* All Docs */}
          {activeView==='allDocs'&&(
            <>
              <div style={S.pageHeader}><button onClick={goHome} style={S.backBtn}>← Πίσω</button><div><h1 style={S.pageTitle}>Κείμενα &amp; Βιβλία</h1></div></div>
              <div style={S.cardsGrid}>
                {[['keimena',FOLDERS.keimena],['biblia',FOLDERS.biblia]].map(([id,f])=>{
                  const p=PALETTE[f.tone];
                  return (
                    <div key={id} className="ch" style={{...S.folderCard, background:p.bg}} onClick={()=>openFolder(id)}>
                      <div style={S.folderTop}>
                        <div style={{...S.folderIcon, background:p.accent, color:p.deep}}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                      </div>
                      <h3 style={{...S.folderTitle, color:p.text}}>{f.name}</h3>
                      <p style={{...S.folderDesc, color:p.text, opacity:0.65}}>{f.desc}</p>
                      <div style={{...S.folderFoot, borderTopColor:p.accent}}>
                        <button style={{...S.linkBtn, color:p.deep}}>Προβολή →</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Folder view */}
          {activeView==='folder'&&currentFolder&&(
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <div style={{flex:1}}>
                  <h1 style={S.pageTitle}>{FOLDERS[currentFolder].name}</h1>
                  <p style={S.pageSub}>{filteredFiles.length} αρχεία{activeTagFilter&&<span style={S.filterBadge}> · #{activeTagFilter} <button onClick={()=>setActiveTagFilter(null)} style={S.clearFilterBtn}>✕</button></span>}</p>
                </div>
              </div>
              {allTagsInFolder().length>0&&(
                <div style={S.tagFilterBar}>
                  <span style={S.tagFilterLabel}>Φίλτρο:</span>
                  {allTagsInFolder().map(t=>{ const c=tagColor(t); const active=activeTagFilter===t; return <button key={t} className="tag-filter" onClick={()=>setActiveTagFilter(active?null:t)} style={{...S.tagFilterChip,background:active?c.text:c.bg,color:active?'#fff':c.text,fontWeight:active?600:400}}>#{t}</button>; })}
                </div>
              )}
              <div style={S.searchBar}><input type="search" placeholder="Αναζήτηση..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={S.searchInput}/></div>
              <div style={S.filesGrid}>
                {loading?<div style={S.empty}>Φόρτωση...</div>:filteredFiles.length===0?<div style={S.empty}>Δεν βρέθηκαν αρχεία</div>
                  :filteredFiles.map(file=>{
                    const tags=fileTags(file.id);
                    const hasComment=!!fileComment(file.id).trim();
                    const folderTone = FOLDERS[currentFolder]?.tone || 'cream';
                    const p = PALETTE[folderTone];
                    return (
                      <div key={file.id} className="ch"
                        style={{...S.fileCard, background:p.bgSoft, ...(currentFile?.id===file.id?{...S.fileCardActive, borderColor:p.deep}:{})}}
                        onClick={()=>openFile(file)}>
                        <div style={S.fileCardTop}>
                          <div style={{...S.filePreview, background:p.bg}}>
                            <img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>';}}/>
                          </div>
                          <div style={S.fileCardBadges}>
                            <button onClick={e=>{e.stopPropagation();toggleFavorite(file);}} style={S.favBtn}>{favorites.some(f=>f.id===file.id)?'★':'☆'}</button>
                            {hasComment&&<span style={S.commentDot}>💬</span>}
                            {isDiktya&&metadata[file.id]?.linkedApp&&<span style={{...S.commentDot,background:'rgba(255,255,255,0.9)'}} title="Συνδεδεμένη εφαρμογή">🔗</span>}
                          </div>
                        </div>
                        <div style={S.fileCardBody}>
                          <h3 style={{...S.fileCardTitle, color:p.text}}>{file.title}</h3>
                          <p style={{...S.fileCardMeta, color:p.text, opacity:0.55}}>{file.name}</p>
                          {tags.length>0&&(<div style={S.cardTags} onClick={e=>e.stopPropagation()}>{tags.map(t=>{ const c=tagColor(t); return <span key={t} className="tag-chip" style={{...S.tagChip,background:c.bg,color:c.text}}>#{t}<span className="tag-x" style={S.tagX} onClick={e=>{e.stopPropagation();removeTag(file.id,t);}}>✕</span></span>; })}</div>)}
                        </div>
                        <div style={{...S.fileCardFoot, borderTopColor:p.accent}}>
                          <button style={{...S.actionSmall, color:p.deep, borderColor:p.deep}}>Προβολή →</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {/* Network Builder */}
          {activeView==='netBuilder'&&(
            <>
              <div style={S.pageHeader}>
                <button onClick={goHome} style={S.backBtn}>← Πίσω</button>
                <div style={{flex:1}}><h1 style={S.pageTitle}>Δημιουργία Δικτύου</h1><p style={S.pageSub}>Σύνθεση κειμένων + ερωτήσεων → αποθήκευση PDF στο Drive</p></div>
                <button onClick={()=>setShowNewNetForm(true)} style={S.greenBtn}>+ Νέο Δίκτυο</button>
              </div>

              {showNewNetForm&&(
                <div style={S.newNetForm}>
                  <input autoFocus type="text" placeholder="Όνομα δικτύου…" value={newNetName} onChange={e=>setNewNetName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')createNetwork();if(e.key==='Escape')setShowNewNetForm(false);}} style={S.newNetInput}/>
                  <button onClick={createNetwork} style={S.greenBtn}>Δημιουργία</button>
                  <button onClick={()=>setShowNewNetForm(false)} style={S.cancelBtn}>Ακύρωση</button>
                </div>
              )}

              {!currentNetwork&&(
                networks.length===0
                  ?<div style={{textAlign:'center',paddingTop:'48px'}}><div style={{fontSize:'48px',marginBottom:'12px'}}>🕸️</div><div style={{color:'#aeaeb8',fontSize:'13px'}}>Δεν υπάρχουν δίκτυα ακόμα</div></div>
                  :<div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    {networks.map(net=>(
                      <div key={net.id} className="ch" style={S.netListCard}>
                        <div style={S.netListLeft}>
                          <div style={S.netListIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PALETTE.mustard.deep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/></svg></div>
                          <div><div style={S.netListName}>{net.name}</div><div style={S.netListMeta}>{net.items.length} κείμενα{net.pdfFileId&&<span style={{color:PALETTE.mustard.deep,marginLeft:'8px'}}>· PDF ✓</span>}</div></div>
                        </div>
                        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                          <button onClick={()=>setCurrentNetwork(net)} style={S.greenSmall}>Επεξεργασία →</button>
                          {net.pdfFileId&&<button onClick={()=>window.open(`/api/files/pdf/${net.pdfFileId}`,'_blank')} style={S.pdfBtn}>📄 PDF</button>}
                          <button onClick={()=>deleteNetwork(net)} style={S.deleteSmall}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
              )}

              {currentNetwork&&(
                <>
                  <div style={{...S.pageHeader,marginBottom:'16px'}}>
                    <button onClick={()=>setCurrentNetwork(null)} style={S.backBtn}>← Λίστα</button>
                    <div style={{flex:1}}>
                      <h2 style={{fontSize:'17px',fontWeight:'600',color:'#1a1a1a',marginBottom:'2px'}}>{currentNetwork.name}</h2>
                      <p style={S.pageSub}>
                        {currentNetwork.items.length} κείμενα
                        {netSaving&&<span style={{marginLeft:'8px',color:PALETTE.mustard.deep,fontSize:'12px'}}>· Αποθήκευση…</span>}
                        {netMsg&&<span style={{marginLeft:'8px',color:netMsg.startsWith('✓')?PALETTE.mustard.deep:'#dc2626',fontSize:'12px'}}>{netMsg}</span>}
                      </p>
                    </div>
                    <div style={{display:'flex',gap:'8px'}}>
                      <button onClick={()=>setPickingFile(true)} style={S.greenBtn}>+ Κείμενο</button>
                      {currentNetwork.pdfFileId&&<button onClick={()=>window.open(`/api/files/pdf/${currentNetwork.pdfFileId}`,'_blank')} style={S.pdfBtn}>📄 PDF</button>}
                      <button onClick={mergeAndSave} disabled={merging||!currentNetwork.items.length} style={{...S.mergeBtn,opacity:(merging||!currentNetwork.items.length)?0.6:1}}>
                        {merging?'⏳ Δημιουργία…':`💾 ${currentNetwork.pdfFileId?'Ενημέρωση PDF':'Αποθήκευση PDF'}`}
                      </button>
                    </div>
                  </div>

                  {currentNetwork.items.length===0
                    ?<div style={{textAlign:'center',padding:'32px',color:'#aeaeb8',fontSize:'13px'}}>Πάτησε «+ Κείμενο» για να ξεκινήσεις</div>
                    :<div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                      {currentNetwork.items.map((item,idx)=>{ const isOpen=!!openAccordions[item.fileId]; return (
                        <div key={item.fileId} style={S.netItemCard}>
                          <div style={S.netItemHeader}>
                            <div style={S.netItemNum}>{idx+1}</div>
                            <div style={S.netItemTitle}>{item.title}</div>
                            <div style={{display:'flex',gap:'5px',alignItems:'center',flexShrink:0}}>
                              <button onClick={()=>moveItem(idx,-1)} disabled={idx===0} style={{...S.moveBtn,opacity:idx===0?0.3:1}}>↑</button>
                              <button onClick={()=>moveItem(idx,1)} disabled={idx===currentNetwork.items.length-1} style={{...S.moveBtn,opacity:idx===currentNetwork.items.length-1?0.3:1}}>↓</button>
                              <button onClick={()=>openFile({id:item.fileId,title:item.title,name:item.name})} style={S.viewSmall}>👁</button>
                              <button onClick={()=>removeFromNetwork(item.fileId)} style={S.deleteSmall}>✕</button>
                            </div>
                          </div>
                          <div className="acc-h" style={{...S.accToggle,cursor:'pointer',background:isOpen?PALETTE.mustard.bgSoft:'#fafaf9'}} onClick={()=>toggleAccordion(item.fileId)}>
                            <span style={S.accLabel}>Ερωτήσεις</span>
                            <span style={{fontSize:'11px',color:'#6b6b80'}}>{item.questions.length} {item.questions.length===1?'ερώτηση':'ερωτήσεις'}</span>
                            <span style={{fontSize:'11px',color:'#6b6b80',marginLeft:'6px'}}>{isOpen?'▲':'▼'}</span>
                          </div>
                          {isOpen&&(
                            <div style={S.accBody}>
                              {item.questions.length===0&&<div style={{fontSize:'13px',color:'#aeaeb8',marginBottom:'10px'}}>Δεν υπάρχουν ερωτήσεις. Πάτησε «+ Ερώτηση».</div>}
                              {item.questions.map(q=>(
                                <div key={q.id} style={S.qRow}>
                                  <input type="text" placeholder="Κωδ." value={q.code} onChange={e=>updateQuestion(item.fileId,q.id,'code',e.target.value)} onBlur={saveQuestionsNow} style={S.qCodeInput}/>
                                  <textarea rows={3} placeholder="Κείμενο ερώτησης…" value={q.text} onChange={e=>updateQuestion(item.fileId,q.id,'text',e.target.value)} onBlur={saveQuestionsNow} style={S.qTextInput}/>
                                  <button onClick={()=>removeQuestion(item.fileId,q.id)} style={S.qDelBtn}>✕</button>
                                </div>
                              ))}
                              <button onClick={()=>addQuestion(item.fileId)} style={S.addQBtn}>+ Ερώτηση</button>
                            </div>
                          )}
                        </div>
                      );})}
                    </div>
                  }
                </>
              )}
            </>
          )}

          {/* Favorites */}
          {activeView==='favorites'&&(
            <>
              <div style={S.pageHeader}><button onClick={goHome} style={S.backBtn}>← Πίσω</button><div><h1 style={S.pageTitle}>Αγαπημένα</h1><p style={S.pageSub}>{favorites.length} αρχεία</p></div></div>
              <div style={S.filesGrid}>
                {favorites.length===0?<div style={S.empty}>Δεν έχεις αγαπημένα ακόμα</div>
                  :favorites.map(file=>{
                    const p=PALETTE.cream;
                    return (
                      <div key={file.id} className="ch" style={{...S.fileCard, background:p.bgSoft}} onClick={()=>openFile(file)}>
                        <div style={S.fileCardTop}>
                          <div style={{...S.filePreview, background:p.bg}}>
                            <img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>';}}/>
                          </div>
                          <button onClick={e=>{e.stopPropagation();toggleFavorite(file);}} style={{...S.favBtn,position:'static',background:'transparent',border:'none'}}>★</button>
                        </div>
                        <div style={S.fileCardBody}>
                          <h3 style={{...S.fileCardTitle, color:p.text}}>{file.title}</h3>
                          <p style={{...S.fileCardMeta, color:p.text, opacity:0.55}}>{file.name}</p>
                        </div>
                        <div style={{...S.fileCardFoot, borderTopColor:p.accent}}>
                          <button style={{...S.actionSmall, color:p.deep, borderColor:p.deep}}>Προβολή →</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {/* Recent */}
          {activeView==='recent'&&(
            <>
              <div style={S.pageHeader}><button onClick={goHome} style={S.backBtn}>← Πίσω</button><div><h1 style={S.pageTitle}>Πρόσφατα</h1><p style={S.pageSub}>{recentFiles.length} αρχεία</p></div></div>
              <div style={S.filesGrid}>
                {recentFiles.length===0?<div style={S.empty}>Δεν έχεις ανοίξει αρχεία ακόμα</div>
                  :recentFiles.map(file=>{
                    const p=PALETTE.peach;
                    return (
                      <div key={file.id} className="ch" style={{...S.fileCard, background:p.bgSoft}} onClick={()=>openFile(file)}>
                        <div style={S.fileCardTop}>
                          <div style={{...S.filePreview, background:p.bg}}>
                            <img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>';}}/>
                          </div>
                          <button onClick={e=>{e.stopPropagation();toggleFavorite(file);}} style={S.favBtn}>{favorites.some(f=>f.id===file.id)?'★':'☆'}</button>
                        </div>
                        <div style={S.fileCardBody}>
                          <h3 style={{...S.fileCardTitle, color:p.text}}>{file.title}</h3>
                          <p style={{...S.fileCardMeta, color:p.text, opacity:0.55}}>{file.name}</p>
                        </div>
                        <div style={{...S.fileCardFoot, borderTopColor:p.accent}}>
                          <button style={{...S.actionSmall, color:p.deep, borderColor:p.deep}}>Προβολή →</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {/* All Tools */}
          {activeView==='allTools'&&(
            <>
              <div style={S.pageHeader}><button onClick={goHome} style={S.backBtn}>← Πίσω</button><div><h1 style={S.pageTitle}>Εφαρμογές</h1><p style={S.pageSub}>{filteredTools.length} εφαρμογές</p></div></div>
              <div style={S.searchBar}><input type="search" placeholder="Αναζήτηση..." value={toolsSearchQuery} onChange={e=>setToolsSearchQuery(e.target.value)} style={S.searchInput}/></div>
              {Object.entries(toolCategories).map(([cat,catTools])=>{
                const vis=catTools.filter(t=>!toolsSearchQuery||t.name.toLowerCase().includes(toolsSearchQuery.toLowerCase()));
                if(!vis.length)return null;
                return(
                  <section key={cat} style={S.section}>
                    <h2 style={S.secTitle}>{cat}</h2>
                    <div style={S.filesGrid}>
                      {vis.map(tool=>{
                        const p=PALETTE.peach;
                        return (
                          <div key={tool.file} className="ch" style={{...S.toolCard, background:p.bgSoft}} onClick={()=>openTool(tool)}>
                            <div style={{...S.toolAccent, background:p.accent}}/>
                            <div style={S.toolContent}>
                              <div style={{...S.toolThumb, background:p.bg}}>
                                <img src={`/api/thumbnail/${tool.driveId||tool.file}`} alt={tool.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.style.background=p.bg;e.target.parentNode.innerHTML=`<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${tool.icon||'🔧'}</span>`;}} />
                              </div>
                              <h3 style={{...S.toolTitle, color:p.text}}>{tool.name}</h3>
                              <button style={{...S.actionSmall, color:p.deep, borderColor:p.deep}}>Εκκίνηση →</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              { filteredTools.length===0&&<div style={S.empty}>Δεν βρέθηκαν</div>}
            </>
          )}

          {/* Tool Category */}
          {activeView==='toolCategory'&&currentToolCategory&&(
            <>
              <div style={S.pageHeader}><button onClick={openAllTools} style={S.backBtn}>← Εφαρμογές</button><div><h1 style={S.pageTitle}>{currentToolCategory==='__recent__'?'Πρόσφατα':currentToolCategory}</h1></div></div>
              <div style={S.filesGrid}>
                {filteredCategoryTools.map(tool=>{
                  const p=PALETTE.peach;
                  return (
                    <div key={tool.file} className="ch" style={{...S.toolCard, background:p.bgSoft}} onClick={()=>openTool(tool)}>
                      <div style={{...S.toolAccent, background:p.accent}}/>
                      <div style={S.toolContent}>
                        <div style={{...S.toolThumb, background:p.bg}}>
                          <img src={`/api/thumbnail/${tool.driveId||tool.file}`} alt={tool.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.style.background=p.bg;e.target.parentNode.innerHTML=`<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${tool.icon||'🔧'}</span>`;}} />
                        </div>
                        <h3 style={{...S.toolTitle, color:p.text}}>{tool.name}</h3>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <button style={{...S.actionSmall, color:p.deep, borderColor:p.deep}}>Εκκίνηση →</button>
                          <button onClick={e=>{e.stopPropagation();toggleFavoriteTool(tool);}} style={{...S.favBtn,position:'static',background:'transparent',border:'none'}}>{favoriteTools.some(t=>t.file===tool.file)?'★':'☆'}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </div>
      </main>

      {/* ── Modals (αμετάβλητα) ── */}
      {modalFile&&(
        <div style={S.modal} onClick={()=>{setCurrentFile(null);zoomReset();setShowCommentPanel(false);setShowLinkedApp(false);}}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHead}>
              <h2 style={S.modalTitle}>{modalFile.title}</h2>
              <div style={S.modalBtns}>
                <button onClick={zoomOut} style={S.zoomBtn}>−</button>
                <span style={S.zoomLabel} onClick={zoomReset}>{modalZoom}%</span>
                <button onClick={zoomIn} style={S.zoomBtn}>+</button>
                <div style={S.modalDiv}/>
                <button onClick={()=>window.open(`/api/files/pdf/${modalFile.id}`,'_blank')} style={S.iconBtn}>↗</button>
                {linkedApp
                  ?<>
                    <button onClick={()=>setShowLinkedApp(p=>!p)} style={{...S.iconBtn,background:showLinkedApp?PALETTE.mustard.bgSoft:'#f4f4f4',borderColor:showLinkedApp?PALETTE.mustard.deep:'#e0e0e0',color:showLinkedApp?PALETTE.mustard.deep:'#444'}} title={linkedApp.name}>🔗</button>
                    <button onClick={unlinkApp} style={{...S.iconBtn,fontSize:'10px',color:'#dc2626',borderColor:'#fca5a5'}} title="Αποσύνδεση εφαρμογής">✕🔗</button>
                  </>
                  :<button onClick={()=>setShowAppPicker(true)} style={{...S.iconBtn,fontSize:'11px'}} title="Σύνδεση εφαρμογής">+🔗</button>
                }
                <button onClick={()=>setShowCommentPanel(p=>!p)} style={{...S.iconBtn,background:showCommentPanel?PALETTE.peach.bgSoft:'#f4f4f4',borderColor:showCommentPanel?PALETTE.peach.deep:'#e0e0e0',color:showCommentPanel?PALETTE.peach.deep:'#444'}} title="Ετικέτες &amp; Σχόλια">🏷️</button>
                <button onClick={()=>{setCurrentFile(null);zoomReset();setShowCommentPanel(false);setShowLinkedApp(false);}} style={S.closeBtn}>✕</button>
              </div>
            </div>

            <div style={{flex:1,display:'flex',overflow:'hidden'}}>
              <div style={{flex:1,overflow:'auto',minWidth:0,display:'flex',flexDirection:'column'}}>
                <div style={{flex:1,transform:`scale(${modalZoom/100})`,transformOrigin:'top center',height:modalZoom>100?`${modalZoom}%`:'100%',width:modalZoom>100?`${10000/modalZoom}%`:'100%'}}>
                  <iframe src={`/api/files/pdf/${modalFile.id}`} style={S.iframe} title="PDF Viewer"/>
                </div>
              </div>

              {showLinkedApp&&linkedApp&&(
                <div style={{...S.linkedAppPanel,width:'50%',display:'flex',flexDirection:'column'}}>
                  <div style={S.linkedAppHeader}>
                    <span style={{fontSize:'12px',fontWeight:'600',color:PALETTE.mustard.deep}}>🔗 {linkedApp.name}</span>
                    <button onClick={()=>window.open(linkedApp.isUrl?linkedApp.file:`/api/tool/${linkedApp.driveId||linkedApp.file}`,'_blank')} style={{...S.iconBtn,width:'24px',height:'24px',fontSize:'11px'}}>↗</button>
                  </div>
                  <iframe src={linkedApp.isUrl ? linkedApp.file : `/api/tool/${linkedApp.driveId||linkedApp.file}`} style={{...S.iframe,flex:1}} title={linkedApp.name}/>
                </div>
              )}

              {showCommentPanel&&(
                <div style={S.commentPanel}>
                  <div style={S.cpHeader}><span style={S.cpTitle}>Ετικέτες &amp; Σχόλια</span>{metaSaving&&<span style={{fontSize:'11px',color:PALETTE.peach.deep}}>Αποθήκευση…</span>}</div>
                  <div style={S.cpSection}>
                    <div style={S.cpSectionLabel}>Ετικέτες</div>
                    <div style={S.tagsWrap}>{fileTags(modalFile.id).map(t=>{ const c=tagColor(t); return <span key={t} className="tag-chip" style={{...S.tagChip,background:c.bg,color:c.text}}>#{t}<span className="tag-x" style={S.tagX} onClick={()=>removeTag(modalFile.id,t)}>✕</span></span>; })}</div>
                    <div style={{position:'relative'}}>
                      <div style={S.tagInputWrap}>
                        <input ref={tagInputRef} type="text" placeholder="Νέα ετικέτα…" value={tagInput} onChange={e=>{setTagInput(e.target.value);setShowTagSuggest(true);}} onKeyDown={e=>{if(e.key==='Enter')addTag(modalFile.id,tagInput);if(e.key==='Escape')setShowTagSuggest(false);}} style={S.tagInputField}/>
                        {tagInput.trim()&&<button onClick={()=>addTag(modalFile.id,tagInput)} style={S.tagAddBtn}>+</button>}
                      </div>
                      {showTagSuggest&&tagInput&&suggestedTags.length>0&&<div style={S.suggestBox}>{suggestedTags.slice(0,6).map(t=>(<div key={t} className="suggest-item" style={S.suggestItem} onClick={()=>addTag(modalFile.id,t)}><span style={{color:PALETTE.peach.deep}}>#</span>{t}</div>))}</div>}
                      {!tagInput&&<div style={{marginTop:'8px'}}><div style={{fontSize:'11px',color:'#aeaeb8',marginBottom:'6px'}}>Προτεινόμενες:</div><div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>{SUGGESTED_TAGS.filter(t=>!fileTags(modalFile.id).includes(t)).map(t=>{ const c=tagColor(t); return <span key={t} style={{...S.tagChip,background:c.bg,color:c.text,cursor:'pointer'}} onClick={()=>addTag(modalFile.id,t)}>+{t}</span>; })}</div></div>}
                    </div>
                  </div>
                  <div style={{...S.cpSection,flex:1,display:'flex',flexDirection:'column'}}>
                    <div style={S.cpSectionLabel}>Σχόλια</div>
                    <textarea placeholder="Σημειώσεις για το αρχείο…" value={fileComment(modalFile.id)} onChange={e=>updateComment(modalFile.id,e.target.value)} style={{...S.commentTextarea,flex:1}}/>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentTool&&!currentFile&&(
        <div style={S.modal} onClick={()=>{setCurrentTool(null);zoomReset();}}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHead}><h2 style={S.modalTitle}>{currentTool.name}</h2><div style={S.modalBtns}><button onClick={zoomOut} style={S.zoomBtn}>−</button><span style={S.zoomLabel} onClick={zoomReset}>{modalZoom}%</span><button onClick={zoomIn} style={S.zoomBtn}>+</button><div style={S.modalDiv}/><button onClick={()=>window.open(`/api/tool/${currentTool.driveId||currentTool.file}`,'_blank')} style={S.iconBtn}>↗</button><button onClick={()=>{setCurrentTool(null);zoomReset();}} style={S.closeBtn}>✕</button></div></div>
            <div style={{flex:1,overflow:'auto'}}><div style={{transform:`scale(${modalZoom/100})`,transformOrigin:'top center',height:modalZoom>100?`${modalZoom}%`:'100%',width:modalZoom>100?`${10000/modalZoom}%`:'100%'}}><iframe src={`/api/tool/${currentTool.driveId||currentTool.file}`} style={S.iframe} title={currentTool.name}/></div></div>
          </div>
        </div>
      )}

      {showAppPicker&&(
        <div style={S.modal} onClick={()=>setShowAppPicker(false)}>
          <div style={{...S.modalBox,maxWidth:'560px',width:'90vw',height:'70vh',borderRadius:'16px'}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHead}><h2 style={S.modalTitle}>Σύνδεση με εφαρμογή ή σελίδα</h2><button onClick={()=>setShowAppPicker(false)} style={S.closeBtn}>✕</button></div>
            <div style={{flex:1,overflowY:'auto',padding:'14px'}}>

              {/* Custom URL */}
              <div style={{marginBottom:'20px'}}>
                <div style={{fontSize:'11px',fontWeight:'700',color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Διεύθυνση URL</div>
                <div style={{display:'flex',gap:'8px'}}>
                  <input type="url" placeholder="https://..." id="customUrlInput" style={{flex:1,padding:'9px 12px',border:'1px solid #e0e0e0',borderRadius:'10px',fontSize:'13px',color:'#1a1a1a'}}/>
                  <button onClick={()=>{const url=document.getElementById('customUrlInput').value.trim();if(url)linkAppToFile({file:url,name:url,driveId:null,isUrl:true});}} style={{...S.greenBtn,padding:'9px 14px',fontSize:'12px'}}>Σύνδεση</button>
                </div>
              </div>

              {/* Γρήγορες επιλογές */}
              <div style={{marginBottom:'20px'}}>
                <div style={{fontSize:'11px',fontWeight:'700',color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Γρήγορες επιλογές</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                  {[
                    {name:'YouTube',icon:'🎬',url:'https://www.youtube.com'},
                    {name:'Wikipedia',icon:'📖',url:'https://el.wikipedia.org'},
                    {name:'ΕΡΤ',icon:'📺',url:'https://www.ert.gr'},
                    {name:'Ψηφ. Σχολή',icon:'🏫',url:'https://www.digitalschool.gr'},
                    {name:'Καθημερινή',icon:'🗞️',url:'https://www.kathimerini.gr'},
                    {name:'ΒΗΜΑ',icon:'📰',url:'https://www.tovima.gr'},
                  ].map(q=>(
                    <button key={q.name} onClick={()=>linkAppToFile({file:q.url,name:q.name,driveId:null,isUrl:true})}
                      style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 14px',borderRadius:'10px',border:'1px solid #e0e0e0',background:'#fafafa',cursor:'pointer',fontSize:'13px',fontWeight:'500'}}>
                      <span>{q.icon}</span>{q.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Εφαρμογές ΛΕΒΙΑΘΑΝ */}
              <div>
                <div style={{fontSize:'11px',fontWeight:'700',color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Εφαρμογές ΛΕΒΙΑΘΑΝ</div>
                {tools.length===0
                  ?<div style={{textAlign:'center',padding:'20px',color:'#aeaeb8',fontSize:'13px'}}>Δεν υπάρχουν εφαρμογές</div>
                  :tools.map(tool=>(
                    <div key={tool.file} className="picker-h" style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',borderRadius:'12px',cursor:'pointer',marginBottom:'4px'}} onClick={()=>linkAppToFile(tool)}>
                      <div style={{width:'36px',height:'36px',borderRadius:'10px',background:PALETTE.peach.bg,overflow:'hidden',flexShrink:0}}>
                        <img src={`/api/thumbnail/${tool.driveId||tool.file}`} alt={tool.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML=`<span style="font-size:18px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${tool.icon||'🔧'}</span>`;}}/>
                      </div>
                      <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:'500',color:'#1a1a1a'}}>{tool.name}</div>{tool.category&&<div style={{fontSize:'11px',color:'#aeaeb8'}}>{tool.category}</div>}</div>
                      <span style={{fontSize:'12px',color:PALETTE.mustard.deep}}>+ Σύνδεση</span>
                    </div>
                  ))
                }
              </div>

            </div>
          </div>
        </div>
      )}

      {pickingFile&&(
        <div style={S.modal} onClick={()=>{setPickingFile(false);setPickerSearch('');}}>
          <div style={{...S.modalBox,maxWidth:'560px',height:'65vh'}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHead}><h2 style={S.modalTitle}>Επιλογή κειμένου</h2><button onClick={()=>{setPickingFile(false);setPickerSearch('');}} style={S.closeBtn}>✕</button></div>
            <div style={{padding:'10px 14px',borderBottom:'1px solid #ebebeb'}}><input type="search" placeholder="Αναζήτηση…" value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} style={{...S.searchInput,width:'100%'}} autoFocus/></div>
            <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
              {allFiles.filter(f=>!pickerSearch||f.title.toLowerCase().includes(pickerSearch.toLowerCase())).map(file=>{ const already=currentNetwork?.items.some(i=>i.fileId===file.id); return (
                <div key={file.id} className="picker-h" style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',borderRadius:'12px',marginBottom:'2px',opacity:already?0.45:1,cursor:already?'default':'pointer'}} onClick={()=>!already&&addFileToNetwork(file)}>
                  <div style={{fontSize:'20px',flexShrink:0}}>📄</div>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:'13px',fontWeight:'500',color:'#1a1a1a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{file.title}</div><div style={{fontSize:'11px',color:'#aeaeb8'}}>{file.name}</div></div>
                  {already?<span style={{fontSize:'11px',color:PALETTE.mustard.deep,fontWeight:500,flexShrink:0}}>✓ Έχει προστεθεί</span>:<span style={{fontSize:'12px',color:PALETTE.mustard.deep,flexShrink:0}}>+ Προσθήκη</span>}
                </div>
              );})}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  STYLES — Energy Insights aesthetic applied to cards
// ════════════════════════════════════════════════════════════════════════════
const S = {
  loadingScreen:{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#1a1a1a',color:'#ececec',fontFamily:'"Söhne",ui-sans-serif,system-ui,-apple-system,sans-serif'},
  spinner:{width:'36px',height:'36px',border:'2px solid rgba(255,255,255,0.12)',borderTop:'2px solid #c5b4e3',borderRadius:'50%',animation:'spin 0.9s linear infinite',marginBottom:'16px'},
  loadingText:{fontSize:'14px',color:'#8e8ea0'},
  app:{display:'flex',minHeight:'100vh',background:'#f9f9f8',fontFamily:'"Söhne",ui-sans-serif,system-ui,-apple-system,sans-serif',color:'#1a1a1a'},

  // Sidebar (αμετάβλητο)
  sidebar:{position:'fixed',left:0,top:0,bottom:0,background:'#1a1a1a',display:'flex',flexDirection:'column',transition:'width 0.2s ease',zIndex:100,borderRight:'1px solid rgba(255,255,255,0.06)'},
  sidebarHeader:{padding:'16px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)'},
  logoText:{fontSize:'15px',fontWeight:'500',color:'#ececec'},
  collapseBtn:{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'#8e8ea0',width:'28px',height:'28px',borderRadius:'6px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  nav:{flex:1,padding:'8px',overflowY:'auto'},
  navItem:{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:'transparent',border:'none',borderRadius:'8px',color:'#8e8ea0',fontSize:'13px',cursor:'pointer',marginBottom:'1px',textAlign:'left'},
  navActive:{background:'rgba(255,255,255,0.08)',color:'#ececec'},
  navIcon:{flexShrink:0,width:'18px',display:'flex',alignItems:'center',justifyContent:'center'},
  badge:{marginLeft:'auto',background:'rgba(255,255,255,0.07)',color:'#8e8ea0',fontSize:'11px',padding:'1px 6px',borderRadius:'10px'},
  navDiv:{height:'1px',background:'rgba(255,255,255,0.06)',margin:'8px 4px'},
  sidebarFooter:{padding:'10px',borderTop:'1px solid rgba(255,255,255,0.06)'},
  userCard:{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:'rgba(255,255,255,0.04)',borderRadius:'8px'},
  userAvatar:{width:'30px',height:'30px',borderRadius:'50%',background:'#c5b4e3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'500',color:'#1a1a1a',flexShrink:0},
  userInfo:{flex:1,minWidth:0},
  userName:{fontSize:'12px',color:'#ececec',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},
  logoutLink:{fontSize:'11px',color:'#555560',background:'none',border:'none',padding:0,cursor:'pointer',textDecoration:'underline'},

  main:{flex:1,transition:'margin-left 0.2s ease'},
  container:{maxWidth:'1280px',margin:'0 auto',padding:'32px 40px'},
  welcomeSec:{marginBottom:'32px'},
  welcomeTitle:{fontSize:'26px',fontWeight:'600',color:'#1a1a1a',marginBottom:'6px',letterSpacing:'-0.01em'},
  welcomeSub:{fontSize:'14px',color:'#6b6b80',lineHeight:'1.5'},

  // ── STAT CARDS — Energy Insights ────────────────────────────────────────
  statsGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'14px',marginBottom:'40px'},
  statCard:{
    borderRadius:'22px',
    padding:'22px 24px',
    border:'none',
    transition:'transform 0.2s ease, box-shadow 0.2s ease',
    minHeight:'140px',
  },
  statInner:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px',height:'100%'},
  statLabel:{fontSize:'13px',fontWeight:'500',marginBottom:'12px',letterSpacing:'-0.005em'},
  statVal:{
    fontSize:'42px',
    fontWeight:'700',
    lineHeight:'1',
    marginBottom:'8px',
    letterSpacing:'-0.02em',
    display:'flex',
    alignItems:'baseline',
    gap:'8px',
  },
  statUnit:{fontSize:'13px',fontWeight:'500',letterSpacing:'0'},
  statSub:{fontSize:'12px',fontWeight:'400',lineHeight:'1.4'},
  statIcon:{
    width:'44px',
    height:'44px',
    borderRadius:'14px',
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    flexShrink:0,
  },

  section:{marginBottom:'44px'},
  secTitle:{fontSize:'17px',fontWeight:'600',color:'#1a1a1a',marginBottom:'18px',letterSpacing:'-0.01em'},

  // ── FOLDER CARDS — Energy Insights ──────────────────────────────────────
  cardsGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'14px'},
  folderCard:{
    borderRadius:'22px',
    padding:'22px 24px',
    border:'none',
    cursor:'pointer',
    transition:'transform 0.2s ease, box-shadow 0.2s ease',
    minHeight:'180px',
    display:'flex',
    flexDirection:'column',
  },
  folderTop:{marginBottom:'14px'},
  folderIcon:{
    width:'48px',
    height:'48px',
    borderRadius:'14px',
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
  },
  folderTitle:{fontSize:'18px',fontWeight:'700',marginBottom:'6px',letterSpacing:'-0.015em'},
  folderDesc:{fontSize:'13px',lineHeight:'1.55',marginBottom:'16px',flex:1},
  folderFoot:{display:'flex',justifyContent:'flex-end',paddingTop:'14px',borderTop:'1px solid',borderTopStyle:'solid',borderTopWidth:'1px'},
  linkBtn:{background:'transparent',border:'none',fontSize:'13px',fontWeight:'600',cursor:'pointer',letterSpacing:'-0.005em'},

  // Tag filter bar
  tagFilterBar:{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap',marginBottom:'14px',padding:'12px 16px',background:PALETTE.cream.bgSoft,borderRadius:'14px',border:'none'},
  tagFilterLabel:{fontSize:'12px',color:PALETTE.cream.text,fontWeight:'600',flexShrink:0,opacity:0.75},
  tagFilterChip:{border:'none',padding:'4px 10px',borderRadius:'20px',fontSize:'12px',cursor:'pointer',transition:'all 0.15s'},
  filterBadge:{fontSize:'13px',color:PALETTE.peach.deep},
  clearFilterBtn:{background:'none',border:'none',cursor:'pointer',color:PALETTE.peach.deep,fontSize:'12px',marginLeft:'2px',padding:0},

  searchBar:{display:'flex',gap:'8px',marginBottom:'20px'},
  searchInput:{flex:1,padding:'11px 16px',border:'1px solid #ebebeb',borderRadius:'14px',fontSize:'13px',background:'#fff',color:'#1a1a1a'},

  // ── FILE CARDS — Energy Insights ────────────────────────────────────────
  filesGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'14px'},
  fileCard:{
    borderRadius:'20px',
    overflow:'hidden',
    border:'1px solid transparent',
    cursor:'pointer',
    transition:'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.15s',
  },
  fileCardActive:{borderColor:'inherit',borderWidth:'1px',borderStyle:'solid'},
  fileCardTop:{position:'relative'},
  filePreview:{height:'130px',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'18px 18px 0 0',overflow:'hidden'},
  fileCardBadges:{position:'absolute',top:'10px',right:'10px',display:'flex',gap:'4px',alignItems:'center'},
  favBtn:{background:'rgba(255,255,255,0.92)',border:'none',width:'30px',height:'30px',borderRadius:'50%',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  commentDot:{background:'rgba(255,255,255,0.92)',borderRadius:'50%',width:'26px',height:'26px',fontSize:'12px',display:'flex',alignItems:'center',justifyContent:'center'},
  fileCardBody:{padding:'14px 16px 8px'},
  fileCardTitle:{fontSize:'14px',fontWeight:'700',marginBottom:'4px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:'-0.01em'},
  fileCardMeta:{fontSize:'11px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:'6px'},
  cardTags:{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'6px'},
  tagChip:{display:'inline-flex',alignItems:'center',gap:'3px',padding:'3px 9px',borderRadius:'20px',fontSize:'11px',fontWeight:'500'},
  tagX:{fontSize:'10px',cursor:'pointer',opacity:0,transition:'opacity 0.15s',marginLeft:'2px'},
  fileCardFoot:{padding:'10px 16px 14px',borderTop:'1px solid'},

  // ── TOOL CARDS ──────────────────────────────────────────────────────────
  toolCard:{
    position:'relative',
    borderRadius:'20px',
    overflow:'hidden',
    border:'none',
    cursor:'pointer',
    transition:'transform 0.2s ease, box-shadow 0.2s ease',
  },
  toolAccent:{height:'4px'},
  toolContent:{padding:'18px 20px 20px'},
  toolThumb:{width:'calc(100% + 40px)',height:'130px',marginLeft:'-20px',marginRight:'-20px',marginTop:'-18px',overflow:'hidden',marginBottom:'14px'},
  toolTitle:{fontSize:'15px',fontWeight:'700',marginBottom:'14px',letterSpacing:'-0.01em'},

  // Generic "action" button — παίρνει χρώμα από τη κάρτα
  actionSmall:{background:'transparent',border:'1.5px solid',padding:'6px 14px',borderRadius:'10px',fontSize:'12px',fontWeight:'600',cursor:'pointer',letterSpacing:'-0.005em'},

  recentList:{background:'#fff',borderRadius:'16px',border:'1px solid #ebebeb',overflow:'hidden'},
  recentItem:{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',cursor:'pointer'},
  recentInfo:{flex:1,minWidth:0},
  recentTitle:{fontSize:'13px',fontWeight:'600',color:'#1a1a1a',marginBottom:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},
  recentMeta:{fontSize:'11px',color:'#aeaeb8'},
  quickBtn:{background:'transparent',border:'1.5px solid '+PALETTE.peach.deep,color:PALETTE.peach.deep,padding:'6px 14px',borderRadius:'10px',fontSize:'12px',fontWeight:'600',cursor:'pointer',flexShrink:0},

  pageHeader:{display:'flex',alignItems:'center',gap:'14px',marginBottom:'24px',flexWrap:'wrap'},
  backBtn:{background:'#fff',border:'1px solid #ebebeb',color:'#6b6b80',padding:'8px 16px',borderRadius:'12px',fontSize:'13px',cursor:'pointer'},
  pageTitle:{fontSize:'22px',fontWeight:'700',color:'#1a1a1a',marginBottom:'2px',letterSpacing:'-0.015em'},
  pageSub:{fontSize:'13px',color:'#6b6b80'},
  empty:{gridColumn:'1/-1',textAlign:'center',padding:'48px 20px',color:'#aeaeb8',fontSize:'13px'},

  // Modals & υπόλοιπα
  modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'0'},
  modalBox:{background:'#fff',borderRadius:'0',width:'100vw',maxWidth:'100vw',height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden',border:'none'},
  modalHead:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid #ebebeb',minHeight:'46px',flexShrink:0},
  modalTitle:{fontSize:'14px',fontWeight:'500',color:'#1a1a1a',flex:1,marginRight:'14px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},
  modalBtns:{display:'flex',gap:'6px',alignItems:'center'},
  iconBtn:{background:'#f4f4f4',color:'#444',border:'1px solid #e0e0e0',width:'28px',height:'28px',borderRadius:'8px',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  closeBtn:{background:'transparent',border:'1px solid #ebebeb',fontSize:'14px',color:'#8e8ea0',cursor:'pointer',width:'28px',height:'28px',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'},
  zoomBtn:{background:'#1a1a1a',color:'#fff',border:'none',width:'28px',height:'28px',borderRadius:'8px',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  zoomLabel:{fontSize:'11px',color:'#6b6b80',minWidth:'36px',textAlign:'center',cursor:'pointer',userSelect:'none'},
  modalDiv:{width:'1px',height:'18px',background:'#ebebeb',margin:'0 2px'},
  iframe:{width:'100%',height:'100%',border:'none'},
  commentPanel:{width:'280px',flexShrink:0,borderLeft:'1px solid #ebebeb',display:'flex',flexDirection:'column',background:'#fff',overflow:'hidden'},
  cpHeader:{padding:'12px 14px',borderBottom:'1px solid #ebebeb',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0},
  cpTitle:{fontSize:'13px',fontWeight:'600',color:'#1a1a1a'},
  cpSection:{padding:'12px 14px',borderBottom:'1px solid #f0f0f0'},
  cpSectionLabel:{fontSize:'11px',fontWeight:'600',color:'#888',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'},
  tagsWrap:{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'8px'},
  tagInputWrap:{display:'flex',gap:'6px',alignItems:'center'},
  tagInputField:{flex:1,padding:'8px 12px',border:'1px solid #e0e0e0',borderRadius:'10px',fontSize:'12px',color:'#1a1a1a',background:'#fff'},
  tagAddBtn:{background:PALETTE.peach.deep,color:'#fff',border:'none',width:'28px',height:'28px',borderRadius:'8px',fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},
  suggestBox:{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #e0e0e0',borderRadius:'10px',boxShadow:'0 4px 16px rgba(0,0,0,0.1)',zIndex:10,marginTop:'4px'},
  suggestItem:{padding:'8px 12px',fontSize:'12px',color:'#1a1a1a'},
  commentTextarea:{width:'100%',padding:'10px 12px',border:'1px solid #e0e0e0',borderRadius:'10px',fontSize:'13px',lineHeight:'1.65',color:'#1a1a1a',background:PALETTE.cream.bgSoft,resize:'none',fontFamily:'inherit',minHeight:'120px'},

  linkedAppPanel:{width:'45%',flexShrink:0,borderLeft:'1px solid #ebebeb',display:'flex',flexDirection:'column',background:'#fff'},
  linkedAppHeader:{padding:'8px 12px',borderBottom:'1px solid #ebebeb',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,background:PALETTE.mustard.bgSoft},

  // Network builder (με απαλές ώχρες)
  greenBtn:{background:PALETTE.mustard.deep,color:'#fff',border:'none',padding:'9px 18px',borderRadius:'10px',fontSize:'13px',fontWeight:'600',cursor:'pointer',whiteSpace:'nowrap'},
  greenSmall:{background:'transparent',color:PALETTE.mustard.deep,border:'1.5px solid '+PALETTE.mustard.deep,padding:'6px 14px',borderRadius:'10px',fontSize:'12px',fontWeight:'600',cursor:'pointer',whiteSpace:'nowrap'},
  pdfBtn:{background:'transparent',color:'#1a1a1a',border:'1px solid #ddd',padding:'6px 14px',borderRadius:'10px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'},
  mergeBtn:{background:'#1a1a1a',color:'#fff',border:'none',padding:'9px 18px',borderRadius:'10px',fontSize:'13px',fontWeight:'600',cursor:'pointer',whiteSpace:'nowrap'},
  deleteSmall:{background:'transparent',border:'1px solid #fca5a5',color:'#dc2626',padding:'6px 12px',borderRadius:'10px',fontSize:'12px',cursor:'pointer'},
  cancelBtn:{background:'transparent',border:'1px solid #ebebeb',color:'#6b6b80',padding:'9px 16px',borderRadius:'10px',fontSize:'13px',cursor:'pointer'},
  moveBtn:{background:'#f4f4f4',border:'1px solid #e0e0e0',color:'#444',width:'28px',height:'28px',borderRadius:'8px',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  viewSmall:{background:'#f4f4f4',border:'1px solid #e0e0e0',padding:'6px 10px',borderRadius:'8px',fontSize:'13px',cursor:'pointer'},
  newNetForm:{display:'flex',gap:'10px',alignItems:'center',marginBottom:'24px',padding:'18px',background:PALETTE.mustard.bgSoft,borderRadius:'16px',border:'none',flexWrap:'wrap'},
  newNetInput:{flex:1,minWidth:'200px',padding:'10px 16px',border:'1px solid '+PALETTE.mustard.accent,borderRadius:'10px',fontSize:'14px',background:'#fff',color:'#1a1a1a'},
  netListCard:{background:'#fff',borderRadius:'16px',padding:'16px 20px',border:'1px solid #ebebeb',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',flexWrap:'wrap'},
  netListLeft:{display:'flex',alignItems:'center',gap:'12px',flex:1,minWidth:0},
  netListIcon:{width:'40px',height:'40px',borderRadius:'12px',background:PALETTE.mustard.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},
  netListName:{fontSize:'14px',fontWeight:'600',color:'#1a1a1a',marginBottom:'2px'},
  netListMeta:{fontSize:'12px',color:'#6b6b80'},
  netItemCard:{background:'#fff',borderRadius:'14px',border:'1px solid #ebebeb',overflow:'hidden'},
  netItemHeader:{display:'flex',alignItems:'center',gap:'10px',padding:'12px 14px',borderBottom:'1px solid #f0f0f0',background:'#fafaf9'},
  netItemNum:{width:'26px',height:'26px',borderRadius:'50%',background:'#1a1a1a',color:'#fff',fontSize:'12px',fontWeight:'700',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},
  netItemTitle:{flex:1,fontSize:'14px',fontWeight:'600',color:'#1a1a1a',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  accToggle:{display:'flex',alignItems:'center',gap:'8px',padding:'10px 14px',borderBottom:'1px solid #f0f0f0',transition:'background 0.12s'},
  accLabel:{fontSize:'11px',fontWeight:'700',color:PALETTE.mustard.deep,textTransform:'uppercase',letterSpacing:'0.08em',flex:1},
  accBody:{padding:'12px 14px 14px'},
  qRow:{display:'flex',gap:'8px',alignItems:'flex-start',marginBottom:'8px'},
  qCodeInput:{width:'68px',flexShrink:0,padding:'8px',border:'1px solid #e0e0e0',borderRadius:'8px',fontSize:'13px',fontWeight:'600',color:'#1a1a1a',background:'#fff',textAlign:'center'},
  qTextInput:{flex:1,padding:'8px 12px',border:'1px solid #e0e0e0',borderRadius:'8px',fontSize:'13px',lineHeight:'1.6',color:'#1a1a1a',background:PALETTE.cream.bgSoft,resize:'vertical',fontFamily:'inherit'},
  qDelBtn:{background:'transparent',border:'1px solid #fca5a5',color:'#dc2626',width:'28px',height:'28px',borderRadius:'8px',fontSize:'11px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'4px'},
  addQBtn:{background:'transparent',color:PALETTE.mustard.deep,border:'1px dashed '+PALETTE.mustard.accent,padding:'6px 14px',borderRadius:'10px',fontSize:'12px',fontWeight:'600',cursor:'pointer',marginTop:'4px'},
};
