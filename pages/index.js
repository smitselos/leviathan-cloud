import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';

const FOLDERS = {
  keimena: { name: 'Κείμενα', icon: null, color: '#3b82f6', desc: 'Εκπαιδευτικά κείμενα και υλικό' },
  biblia: { name: 'Βιβλία', icon: null, color: '#8b5cf6', desc: 'Βιβλία αναφοράς και μελέτης' }
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [activeView, setActiveView] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tools, setTools] = useState([]);
  const [currentTool, setCurrentTool] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0 });
  const [toolsSearchQuery, setToolsSearchQuery] = useState('');
  const [currentToolCategory, setCurrentToolCategory] = useState(null);
  const [modalZoom, setModalZoom] = useState(100);

  const zoomIn  = () => setModalZoom(z => Math.min(z + 10, 200));
  const zoomOut = () => setModalZoom(z => Math.max(z - 10, 50));
  const zoomReset = () => setModalZoom(100);

  const [favoriteTools, setFavoriteTools] = useState([]);

  const toggleFavoriteTool = (tool) => {
    const isFav = favoriteTools.some(t => t.file === tool.file);
    const updated = isFav
      ? favoriteTools.filter(t => t.file !== tool.file)
      : [...favoriteTools, tool];
    setFavoriteTools(updated);
    localStorage.setItem('leviathan-favorite-tools', JSON.stringify(updated));
  };

  const recentTools = [...tools]
    .filter(t => t.addedAt)
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    .slice(0, 5);
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // ✅ ΔΙΟΡΘΩΣΗ: localStorage μόνο — χωρίς loadTools()
  useEffect(() => {
    const savedFavorites = localStorage.getItem('leviathan-favorites');
    const savedRecent = localStorage.getItem('leviathan-recent');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedRecent) setRecentFiles(JSON.parse(savedRecent));
    const savedFavTools = localStorage.getItem('leviathan-favorite-tools');
    if (savedFavTools) setFavoriteTools(JSON.parse(savedFavTools));
  }, []);

  // ✅ ΔΙΟΡΘΩΣΗ: loadTools μόνο όταν υπάρχει session
  useEffect(() => {
    if (session) {
      loadTools();
    }
  }, [session]);
  
  const loadTools = async () => {
    try {
      const res = await fetch('/api/tools');
      const data = await res.json();
      setTools(data.tools || []);
    } catch (error) {
      console.error('Error loading tools:', error);
    }
  };

  const getToolCategories = () => {
    const cats = {};
    tools.forEach(tool => {
      if (!tool.category) return;
      if (!cats[tool.category]) cats[tool.category] = [];
      cats[tool.category].push(tool);
    });
    return cats;
  };
  
  const loadFiles = useCallback(async (folderId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${folderId}`);
      const data = await res.json();
      setFiles(data.files || []);
      setStats({
        total: data.files?.length || 0,
        completed: Math.floor((data.files?.length || 0) * 0.6),
        inProgress: Math.floor((data.files?.length || 0) * 0.4)
      });
    } catch (error) {
      console.error('Error loading files:', error);
      setFiles([]);
    }
    setLoading(false);
  }, []);
  
  const openFolder = (folderId) => {
    setCurrentFolder(folderId);
    setActiveView('folder');
    setCurrentFile(null);
    loadFiles(folderId);
  };
  
  const openTool = (tool) => {
    setCurrentTool(tool);
  };
  
  const openAllTools = async () => {
    setActiveView('allTools');
    setCurrentFolder(null);
    setCurrentFile(null);
    setCurrentToolCategory(null);
    await loadTools();
  };

  const openToolCategory = (categoryName) => {
    setCurrentToolCategory(categoryName);
    setActiveView('toolCategory');
    setCurrentFolder(null);
    setCurrentFile(null);
  };
  
  const goHome = () => {
    setActiveView('home');
    setCurrentFolder(null);
    setCurrentFile(null);
    setCurrentTool(null);
    setCurrentToolCategory(null);
  };
  
  const openFile = (file) => {
    setCurrentFile(file);
    const updated = [file, ...recentFiles.filter(f => f.id !== file.id)].slice(0, 5);
    setRecentFiles(updated);
    localStorage.setItem('leviathan-recent', JSON.stringify(updated));
  };
  
  const toggleFavorite = (file) => {
    const isFav = favorites.some(f => f.id === file.id);
    const updated = isFav 
      ? favorites.filter(f => f.id !== file.id)
      : [...favorites, file];
    setFavorites(updated);
    localStorage.setItem('leviathan-favorites', JSON.stringify(updated));
  };
  
  const filteredFiles = files.filter(f => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return f.title.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
  });
  
  const filteredTools = tools.filter(t => {
    if (!toolsSearchQuery) return true;
    const q = toolsSearchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q);
  });

  const filteredCategoryTools = currentToolCategory
    ? (currentToolCategory === '__recent__'
        ? recentTools
        : currentToolCategory === '__favtools__'
          ? favoriteTools
          : tools.filter(t => t.category === currentToolCategory)
      ).filter(t => !toolsSearchQuery || t.name.toLowerCase().includes(toolsSearchQuery.toLowerCase()))
    : [];

  const allDocFiles = files;
  
  if (status === 'loading') {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner}></div>
        <div style={styles.loadingText}>Φόρτωση ΛΕΒΙΑΘΑΝ Cloud...</div>
      </div>
    );
  }
  
  if (!session) return null;

  const toolCategories = getToolCategories();
  
  return (
    <div style={styles.app}>
      <style>{`
        * { box-sizing: border-box; }
        .card-hover { transition: border-color 0.15s ease !important; }
        .card-hover:hover { border-color: #c4b5fd !important; }
        .card-hover-tool:hover { border-color: #fcd34d !important; }
        .card-hover-dark:hover { border-color: rgba(196,181,253,0.3) !important; }
        .card-hover-file:hover { border-color: #c4b5fd !important; }
        .nav-item-hover { transition: background 0.12s ease, color 0.12s ease !important; }
        .nav-item-hover:hover { background: rgba(255,255,255,0.06) !important; color: #ececec !important; }
        .recent-item-hover { transition: background 0.12s ease !important; }
        .recent-item-hover:hover { background: #f9f9f8 !important; }
        input[type=search]:focus { border-color: #8b5cf6 !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.12) !important; }
        button:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Sidebar */}
      <aside style={{...styles.sidebar, width: sidebarCollapsed ? '70px' : '260px'}}>
        <div style={styles.sidebarHeader}>
          {!sidebarCollapsed && (
            <div style={styles.logo}>
              <span style={styles.logoText}>ΛΕΒΙΑΘΑΝ</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={styles.collapseBtn}>
            {sidebarCollapsed ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>) : (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>)}
          </button>
        </div>
        
        <nav style={styles.nav}>

          {/* Αρχική */}
          <button onClick={goHome} className="nav-item-hover"
            style={{...styles.navItem, ...(activeView === 'home' ? styles.navItemActive : {})}}>
            <span style={styles.navIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
                <path d="M9 21V12h6v9"/>
              </svg>
            </span>
            {!sidebarCollapsed && <span>Αρχική</span>}
          </button>

          <div style={styles.navDivider}></div>

          {/* Έγγραφα — ένα μόνο κουμπί, icon τύπου "projects" */}
          <button className="nav-item-hover" onClick={() => { setActiveView('allDocs'); setCurrentFolder(null); }}
            style={{...styles.navItem, ...(['allDocs','folder','favorites','recent'].includes(activeView) ? styles.navItemActive : {})}}>
            <span style={styles.navIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M3 12h18M3 18h18"/>
                <rect x="1" y="3" width="4" height="4" rx="0.5"/>
                <rect x="1" y="9" width="4" height="4" rx="0.5"/>
                <rect x="1" y="15" width="4" height="4" rx="0.5"/>
              </svg>
            </span>
            {!sidebarCollapsed && <span>Κείμενα &amp; Βιβλία</span>}
          </button>

          <div style={styles.navDivider}></div>

          {/* Εργαλεία — ένα μόνο κουμπί */}
          {tools.length > 0 && (
            <button className="nav-item-hover" onClick={openAllTools}
              style={{...styles.navItem, ...(['allTools','toolCategory'].includes(activeView) ? styles.navItemActive : {})}}>
              <span style={styles.navIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </span>
              {!sidebarCollapsed && <><span style={{flex:1, textAlign:'left'}}>Εφαρμογές</span><span style={styles.catCount}>{tools.length}</span></>}
            </button>
          )}

        </nav>
        
        <div style={styles.sidebarFooter}>
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>
              {session.user?.email?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div style={styles.userInfo}>
                <div style={styles.userName}>{session.user?.email?.split('@')[0]}</div>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                  <button onClick={() => signOut()} style={styles.logoutLink}>Αποσύνδεση</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main style={{...styles.main, marginLeft: sidebarCollapsed ? '70px' : '260px'}}>
        <div style={styles.container}>

          {/* Home View */}
          {activeView === 'home' && (
            <>
              <div style={styles.welcomeSection}>
                <h1 style={styles.welcomeTitle}>Γεια σου, {session.user?.email?.split('@')[0]}! 👋</h1>
                <p style={styles.welcomeSubtitle}>Ας συνεχίσουμε από εκεί που σταματήσαμε</p>
              </div>

              <div style={styles.statsGrid}>
                <div className="card-hover" style={{...styles.statCard, cursor:'pointer'}} onClick={() => setActiveView('favorites')}>
                  <div style={styles.statCardContent}>
                    <div>
                      <div style={styles.statLabel}>Αγαπημένα Έγγραφα</div>
                      <div style={styles.statValue}>{favorites.length}</div>
                      <div style={styles.statSubtext}>Επιλεγμένα αρχεία</div>
                    </div>
                    <div style={{...styles.statIcon, background:'#f0f0f0'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
                  </div>
                </div>

                <div className="card-hover" style={{...styles.statCard, cursor:'pointer'}} onClick={() => setActiveView('recent')}>
                  <div style={styles.statCardContent}>
                    <div>
                      <div style={styles.statLabel}>Πρόσφατα Έγγραφα</div>
                      <div style={styles.statValue}>{recentFiles.length}</div>
                      <div style={styles.statSubtext}>Τελευταία αρχεία</div>
                    </div>
                    <div style={{...styles.statIcon, background:'#f0f0f0'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                  </div>
                </div>

                <div className="card-hover" style={{...styles.statCard, cursor:'pointer'}} onClick={() => { setActiveView('allDocs'); setCurrentFolder(null); }}>
                  <div style={styles.statCardContent}>
                    <div>
                      <div style={styles.statLabel}>Όλα τα Έγγραφα</div>
                      <div style={styles.statValue}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                      <div style={styles.statSubtext}>Κείμενα &amp; Βιβλία</div>
                    </div>
                    <div style={{...styles.statIcon, background:'#f0f0f0'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                  </div>
                </div>
              </div>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Φάκελοι Εγγράφων</h2>
                <div style={styles.cardsGrid}>
                  {Object.entries(FOLDERS).map(([id, folder]) => (
                    <div key={id} className="card-hover" style={styles.folderCard} onClick={() => openFolder(id)}>
                      <div style={styles.folderCardHeader}>
                        <div style={{...styles.folderIconLarge, background: '#f4f4f4', color: '#444'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <button style={styles.moreBtn}>⋮</button>
                      </div>
                      <h3 style={styles.folderCardTitle}>{folder.name}</h3>
                      <p style={styles.folderCardDesc}>{folder.desc}</p>
                      <div style={styles.folderCardFooter}>
                        <span style={styles.folderCardStat}>Αρχεία</span>
                        <button style={styles.viewDetailsBtn}>Προβολή →</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {tools.length > 0 && <div style={styles.sectionDivider}></div>}

              {tools.length > 0 && (
                <section style={styles.section}>
                  <h2 style={styles.sectionTitle}>Εργαλεία</h2>
                  <div style={styles.cardsGrid}>
                    {recentTools.length > 0 && (
                      <div className="card-hover" style={styles.categoryCard} onClick={() => openToolCategory('__recent__')}>
                        <div style={{...styles.categoryCardAccent, background:'#d97706'}}></div>
                        <div style={styles.categoryCardContent}>
                          <div style={{...styles.categoryIconWrapper, background:'#fffbeb'}}>
                            <span style={styles.categoryIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                          </div>
                          <h3 style={styles.categoryCardTitle}>Πρόσφατα</h3>
                          <p style={styles.categoryCardDesc}>{recentTools.length} τελευταία εργαλεία</p>
                          <button style={styles.yellowBtnSmall}>Άνοιγμα →</button>
                        </div>
                      </div>
                    )}

                    {Object.entries(toolCategories).map(([catName, catTools]) => (
                      <div key={catName} className="card-hover" style={styles.categoryCard} onClick={() => openToolCategory(catName)}>
                        <div style={styles.categoryCardAccent}></div>
                        <div style={styles.categoryCardContent}>
                          <div style={styles.categoryIconWrapper}>
                            <span style={styles.categoryIcon}>{getCategoryIcon(catName)}</span>
                          </div>
                          <h3 style={styles.categoryCardTitle}>{catName}</h3>
                          <p style={styles.categoryCardDesc}>{catTools.length} {catTools.length === 1 ? 'εργαλείο' : 'εργαλεία'}</p>
                          <button style={styles.yellowBtnSmall}>Άνοιγμα →</button>
                        </div>
                      </div>
                    ))}

                    <div className="card-hover card-hover-dark" style={styles.allToolsCard} onClick={openAllTools}>
                      <div style={styles.allToolsCardContent}>
                        <div style={styles.allToolsIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div>
                        <h3 style={styles.allToolsTitle}>Όλα τα Εργαλεία</h3>
                        <p style={styles.allToolsDesc}>{tools.length} διαθέσιμα εργαλεία</p>
                        <button style={styles.yellowBtn}>Προβολή Όλων →</button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {recentFiles.length > 0 && (
                <section style={styles.section}>
                  <h2 style={styles.sectionTitle}>Πρόσφατα Αρχεία</h2>
                  <div style={styles.recentList}>
                    {recentFiles.map((file) => (
                      <div key={file.id} className="recent-item-hover" style={styles.recentItem}>
                        <div style={styles.recentIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <div style={styles.recentInfo}>
                          <div style={styles.recentTitle}>{file.title}</div>
                          <div style={styles.recentMeta}>{file.name}</div>
                        </div>
                        <button onClick={() => openFile(file)} style={styles.quickActionBtn}>Άνοιγμα →</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          
          {/* All Docs View */}
          {activeView === 'allDocs' && (
            <>
              <div style={styles.pageHeader}>
                <button onClick={goHome} style={styles.backBtn}>← Πίσω</button>
                <div>
                  <h1 style={styles.pageTitle}>Όλα τα Έγγραφα</h1>
                  <p style={styles.pageSubtitle}>Επέλεξε φάκελο για να δεις τα αρχεία</p>
                </div>
              </div>
              <div style={styles.cardsGrid}>
                {Object.entries(FOLDERS).map(([id, folder]) => (
                  <div key={id} className="card-hover" style={styles.folderCard} onClick={() => openFolder(id)}>
                    <div style={styles.folderCardHeader}>
                      <div style={{...styles.folderIconLarge, background: '#f4f4f4', color: '#444'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    </div>
                    <h3 style={styles.folderCardTitle}>{folder.name}</h3>
                    <p style={styles.folderCardDesc}>{folder.desc}</p>
                    <div style={styles.folderCardFooter}>
                      <button style={styles.viewDetailsBtn}>Προβολή →</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Folder View */}
          {activeView === 'folder' && currentFolder && (
            <>
              <div style={styles.pageHeader}>
                <button onClick={goHome} style={styles.backBtn}>← Πίσω</button>
                <div>
                  <h1 style={styles.pageTitle}>{FOLDERS[currentFolder].icon} {FOLDERS[currentFolder].name}</h1>
                  <p style={styles.pageSubtitle}>{filteredFiles.length} {filteredFiles.length === 1 ? 'αρχείο' : 'αρχεία'}</p>
                </div>
              </div>
              <div style={styles.searchBar}>
                <input type="search" placeholder="Αναζήτηση αρχείων..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchInput} />
                <button style={styles.searchBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
              </div>
              <div style={styles.filesGrid}>
                {loading ? (
                  <div style={styles.loadingState}>Φόρτωση...</div>
                ) : filteredFiles.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg></div>
                    <div style={styles.emptyText}>Δεν βρέθηκαν αρχεία</div>
                  </div>
                ) : (
                  filteredFiles.map(file => (
                    <div key={file.id} className="card-hover card-hover-file"
                      style={{...styles.fileCard, ...(currentFile?.id === file.id ? styles.fileCardActive : {})}}
                      onClick={() => openFile(file)}>
                      <div style={styles.fileCardHeader}>
                        <div style={styles.filePreview}><img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e)=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>'}} /></div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }} style={styles.favBtn}>
                          {favorites.some(f => f.id === file.id) ? '★' : '☆'}
                        </button>
                      </div>
                      <div style={styles.fileCardBody}>
                        <h3 style={styles.fileCardTitle}>{file.title}</h3>
                        <p style={styles.fileCardMeta}>{file.name}</p>
                      </div>
                      <div style={styles.fileCardFooter}>
                        <button style={styles.yellowBtnSmall}>Προβολή →</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          
          {/* All Tools View */}
          {activeView === 'allTools' && (
            <>
              <div style={styles.pageHeader}>
                <button onClick={goHome} style={styles.backBtn}>← Πίσω</button>
                <div>
                  <h1 style={styles.pageTitle}>Όλα τα Εργαλεία</h1>
                  <p style={styles.pageSubtitle}>{filteredTools.length} {filteredTools.length === 1 ? 'εργαλείο' : 'εργαλεία'}</p>
                </div>
              </div>
              <div style={styles.searchBar}>
                <input type="search" placeholder="Αναζήτηση εργαλείων..." value={toolsSearchQuery}
                  onChange={(e) => setToolsSearchQuery(e.target.value)} style={styles.searchInput} />
                <button style={styles.searchBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
              </div>

              {Object.entries(toolCategories).map(([catName, catTools]) => {
                const visible = catTools.filter(t =>
                  !toolsSearchQuery || t.name.toLowerCase().includes(toolsSearchQuery.toLowerCase())
                );
                if (visible.length === 0) return null;
                return (
                  <section key={catName} style={styles.section}>
                    <div style={styles.catSectionHeader}>
                      <span style={styles.catSectionIcon}>{getCategoryIcon(catName)}</span>
                      <h2 style={styles.catSectionTitle}>{catName}</h2>
                      <span style={styles.catSectionCount}>{visible.length}</span>
                    </div>
                    <div style={styles.filesGrid}>
                      {visible.map(tool => (
                        <div key={tool.file} className="card-hover card-hover-tool" style={styles.toolCard} onClick={() => openTool(tool)}>
                          <div style={styles.toolCardAccent}></div>
                          <div style={styles.toolCardContent}>
                            <div style={{...styles.toolIconWrapper, overflow:'hidden', padding:0}}><img src={`/api/thumbnail/${tool.driveId || tool.file}`} alt={tool.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e)=>{e.target.style.display='none';e.target.parentNode.style.background='#fffbeb';e.target.parentNode.innerHTML='<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">' + (tool.icon||'🔧') + '</span>'}} /></div>
                            <h3 style={styles.toolCardTitle}>{tool.name}</h3>
                            <p style={styles.toolCardDesc}>Διαδραστικό εργαλείο για εκπαιδευτική χρήση</p>
                            <button style={styles.yellowBtnSmall}>Εκκίνηση →</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              {(() => {
                const uncategorized = filteredTools.filter(t => !t.category);
                if (uncategorized.length === 0) return null;
                return (
                  <section style={styles.section}>
                    <div style={styles.catSectionHeader}>
                      <span style={styles.catSectionIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></span>
                      <h2 style={styles.catSectionTitle}>Χωρίς κατηγορία</h2>
                      <span style={styles.catSectionCount}>{uncategorized.length}</span>
                    </div>
                    <div style={styles.filesGrid}>
                      {uncategorized.map(tool => (
                        <div key={tool.file} className="card-hover card-hover-tool" style={styles.toolCard} onClick={() => openTool(tool)}>
                          <div style={styles.toolCardAccent}></div>
                          <div style={styles.toolCardContent}>
                            <div style={{...styles.toolIconWrapper, overflow:'hidden', padding:0}}><img src={`/api/thumbnail/${tool.driveId || tool.file}`} alt={tool.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e)=>{e.target.style.display='none';e.target.parentNode.style.background='#fffbeb';e.target.parentNode.innerHTML='<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">' + (tool.icon||'🔧') + '</span>'}} /></div>
                            <h3 style={styles.toolCardTitle}>{tool.name}</h3>
                            <p style={styles.toolCardDesc}>Διαδραστικό εργαλείο για εκπαιδευτική χρήση</p>
                            <button style={styles.yellowBtnSmall}>Εκκίνηση →</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })()}

              {filteredTools.length === 0 && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                  <div style={styles.emptyText}>Δεν βρέθηκαν εργαλεία</div>
                </div>
              )}
            </>
          )}

          {/* Tool Category View */}
          {activeView === 'toolCategory' && currentToolCategory && (
            <>
              <div style={styles.pageHeader}>
                <button onClick={openAllTools} style={styles.backBtn}>← Πίσω στα Εργαλεία</button>
                <div>
                  <h1 style={styles.pageTitle}>
                    {currentToolCategory === '__recent__' ? 'Πρόσφατα' : currentToolCategory}
                  </h1>
                  <p style={styles.pageSubtitle}>{filteredCategoryTools.length} {filteredCategoryTools.length === 1 ? 'εργαλείο' : 'εργαλεία'}</p>
                </div>
              </div>
              <div style={styles.searchBar}>
                <input type="search" placeholder="Αναζήτηση εργαλείων..." value={toolsSearchQuery}
                  onChange={(e) => setToolsSearchQuery(e.target.value)} style={styles.searchInput} />
                <button style={styles.searchBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
              </div>
              <div style={styles.filesGrid}>
                {filteredCategoryTools.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                    <div style={styles.emptyText}>Δεν βρέθηκαν εργαλεία</div>
                  </div>
                ) : (
                  filteredCategoryTools.map(tool => (
                    <div key={tool.file} className="card-hover card-hover-tool" style={styles.toolCard} onClick={() => openTool(tool)}>
                      <div style={styles.toolCardAccent}></div>
                      <div style={styles.toolCardContent}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                          <div style={{...styles.toolIconWrapper, overflow:'hidden', padding:0}}><img src={`/api/thumbnail/${tool.driveId || tool.file}`} alt={tool.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e)=>{e.target.style.display='none';e.target.parentNode.style.background='#fffbeb';e.target.parentNode.innerHTML='<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">' + (tool.icon||'🔧') + '</span>'}} /></div>
                          <button onClick={(e) => { e.stopPropagation(); toggleFavoriteTool(tool); }} style={styles.favBtn} title="Αγαπημένο">
                            {favoriteTools.some(t => t.file === tool.file) ? '★' : '☆'}
                          </button>
                        </div>
                        <h3 style={styles.toolCardTitle}>{tool.name}</h3>
                        <p style={styles.toolCardDesc}>Διαδραστικό εργαλείο για εκπαιδευτική χρήση</p>
                        <button style={styles.yellowBtnSmall}>Εκκίνηση →</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          
          {/* Favorites View */}
          {activeView === 'favorites' && (
            <>
              <div style={styles.pageHeader}>
                <button onClick={goHome} style={styles.backBtn}>← Πίσω</button>
                <div>
                  <h1 style={styles.pageTitle}>Αγαπημένα</h1>
                  <p style={styles.pageSubtitle}>{favorites.length} {favorites.length === 1 ? 'αγαπημένο' : 'αγαπημένα'}</p>
                </div>
              </div>
              <div style={styles.filesGrid}>
                {favorites.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
                    <div style={styles.emptyText}>Δεν έχεις αγαπημένα ακόμα</div>
                  </div>
                ) : (
                  favorites.map(file => (
                    <div key={file.id} className="card-hover card-hover-file" style={styles.fileCard} onClick={() => openFile(file)}>
                      <div style={styles.fileCardHeader}>
                        <div style={styles.filePreview}><img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e)=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>'}} /></div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }} style={styles.favBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
                      </div>
                      <div style={styles.fileCardBody}>
                        <h3 style={styles.fileCardTitle}>{file.title}</h3>
                        <p style={styles.fileCardMeta}>{file.name}</p>
                      </div>
                      <div style={styles.fileCardFooter}>
                        <button style={styles.yellowBtnSmall}>Προβολή →</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          
          {/* Recent View */}
          {activeView === 'recent' && (
            <>
              <div style={styles.pageHeader}>
                <button onClick={goHome} style={styles.backBtn}>← Πίσω</button>
                <div>
                  <h1 style={styles.pageTitle}>Πρόσφατα Αρχεία</h1>
                  <p style={styles.pageSubtitle}>{recentFiles.length} {recentFiles.length === 1 ? 'αρχείο' : 'αρχεία'}</p>
                </div>
              </div>
              <div style={styles.filesGrid}>
                {recentFiles.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div style={styles.emptyText}>Δεν έχεις ανοίξει αρχεία ακόμα</div>
                  </div>
                ) : (
                  recentFiles.map(file => (
                    <div key={file.id} className="card-hover card-hover-file" style={styles.fileCard} onClick={() => openFile(file)}>
                      <div style={styles.fileCardHeader}>
                        <div style={styles.filePreview}><img src={`/api/thumbnail/${file.id}`} alt={file.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e)=>{e.target.style.display='none';e.target.parentNode.innerHTML='<span style="font-size:36px">📄</span>'}} /></div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }} style={styles.favBtn}>
                          {favorites.some(f => f.id === file.id) ? '★' : '☆'}
                        </button>
                      </div>
                      <div style={styles.fileCardBody}>
                        <h3 style={styles.fileCardTitle}>{file.title}</h3>
                        <p style={styles.fileCardMeta}>{file.name}</p>
                      </div>
                      <div style={styles.fileCardFooter}>
                        <button style={styles.yellowBtnSmall}>Προβολή →</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
      
      {/* File Preview Modal */}
      {currentFile && (
        <div style={styles.modal} onClick={() => { setCurrentFile(null); zoomReset(); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{currentFile.title}</h2>
              <div style={styles.modalHeaderButtons}>
                <button onClick={zoomOut} style={styles.zoomBtn} title="Σμίκρυνση">−</button>
                <span style={styles.zoomLabel} onClick={zoomReset} title="Επαναφορά">{modalZoom}%</span>
                <button onClick={zoomIn} style={styles.zoomBtn} title="Μεγέθυνση">+</button>
                <div style={styles.modalDivider}></div>
                <button onClick={() => window.open(`/api/files/pdf/${currentFile.id}`, '_blank')} style={styles.iconBtn} title="Άνοιγμα σε νέα καρτέλα">↗</button>
                <button onClick={() => { const w = window.open(`/api/files/pdf/${currentFile.id}`, '_blank'); if (w) w.onload = () => w.print(); }} style={styles.iconBtn} title="Εκτύπωση">🖨️</button>
                <button onClick={() => { setCurrentFile(null); zoomReset(); }} style={styles.modalClose} title="Κλείσιμο">✕</button>
              </div>
            </div>
            <div style={{...styles.modalBody, borderRadius: '0 0 20px 20px', overflow: 'auto'}}>
              <div style={{ transform: `scale(${modalZoom/100})`, transformOrigin: 'top center', height: modalZoom > 100 ? `${modalZoom}%` : '100%', width: modalZoom > 100 ? `${10000/modalZoom}%` : '100%' }}>
                <iframe src={`/api/files/pdf/${currentFile.id}`} style={styles.pdfViewer} title="PDF Viewer" />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tool Viewer Modal */}
      {currentTool && !currentFile && (
        <div style={styles.modal} onClick={() => { setCurrentTool(null); zoomReset(); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{currentTool.name}</h2>
              <div style={styles.modalHeaderButtons}>
                <button onClick={zoomOut} style={styles.zoomBtn} title="Σμίκρυνση">−</button>
                <span style={styles.zoomLabel} onClick={zoomReset} title="Επαναφορά">{modalZoom}%</span>
                <button onClick={zoomIn} style={styles.zoomBtn} title="Μεγέθυνση">+</button>
                <div style={styles.modalDivider}></div>
                <button onClick={() => window.open(`/api/tool/${currentTool.driveId || currentTool.file}`, '_blank')} style={styles.iconBtn} title="Άνοιγμα σε νέα σελίδα">↗</button>
                <button onClick={() => { setCurrentTool(null); zoomReset(); }} style={styles.modalClose} title="Κλείσιμο">✕</button>
              </div>
            </div>
            <div style={{...styles.modalBody, borderRadius: '0 0 20px 20px', overflow: 'auto'}}>
              <div style={{ transform: `scale(${modalZoom/100})`, transformOrigin: 'top center', height: modalZoom > 100 ? `${modalZoom}%` : '100%', width: modalZoom > 100 ? `${10000/modalZoom}%` : '100%' }}>
                <iframe
                  src={`/api/tool/${currentTool.driveId || currentTool.file}`}
                  style={styles.pdfViewer}
                  title={currentTool.name}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getCategoryIcon(categoryName) {
  const svgFile = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
  const svgBook = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;
  const svgEdit = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
  const svgTool = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>;
  const svgSearch = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  const svgFolder = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>;
  const icons = {
    'Γλώσσα':         svgEdit,
    'Λογοτεχνία':     svgBook,
    'Ιστορία':        svgBook,
    'Λατινικά':       svgFile,
    'Αρχαία':         svgFile,
    'Έκθεση':         svgEdit,
    'Γενικά':         svgTool,
    'Γραμματική':     svgEdit,
    'Λεξιλόγιο':      svgBook,
    'Σύνταξη':        svgFile,
    'Κείμενο':        svgFile,
    'Αξιολόγηση':     svgSearch,
    'Ασκήσεις':       svgEdit,
    'Ανάλυση':        svgSearch,
    'Παραγωγή Λόγου': svgEdit,
  };
  return icons[categoryName] || svgFolder;
}

const styles = {

  /* ── Loading ── */
  loadingScreen: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#1a1a1a', color: '#ececec',
    fontFamily: '"Söhne", ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
  spinner: {
    width: '36px', height: '36px',
    border: '2px solid rgba(255,255,255,0.12)',
    borderTop: '2px solid #c5b4e3',
    borderRadius: '50%', animation: 'spin 0.9s linear infinite', marginBottom: '16px',
  },
  loadingText: { fontSize: '14px', fontWeight: '400', color: '#8e8ea0', letterSpacing: '0.01em' },

  /* ── App shell ── */
  app: {
    display: 'flex', minHeight: '100vh',
    background: '#f9f9f8',
    fontFamily: '"Söhne", ui-sans-serif, system-ui, -apple-system, sans-serif',
    color: '#1a1a1a',
  },

  /* ── Sidebar ── */
  sidebar: {
    position: 'fixed', left: 0, top: 0, bottom: 0,
    background: '#1a1a1a',
    display: 'flex', flexDirection: 'column',
    transition: 'width 0.2s ease', zIndex: 100,
    borderRight: '1px solid rgba(255,255,255,0.06)',
  },
  sidebarHeader: {
    padding: '16px 12px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: '8px' },
  logoText: { fontSize: '15px', fontWeight: '500', color: '#ececec', letterSpacing: '0.01em' },
  collapseBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#8e8ea0', width: '28px', height: '28px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s, border-color 0.15s',
  },
  nav: { flex: 1, padding: '8px', overflowY: 'auto' },
  navItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 10px',
    background: 'transparent', border: 'none', borderRadius: '8px',
    color: '#8e8ea0', fontSize: '13px', fontWeight: '400',
    cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
    marginBottom: '1px', textAlign: 'left',
  },
  navSubItem: { paddingLeft: '22px', fontSize: '12px' },
  navItemActive: { background: 'rgba(255,255,255,0.08)', color: '#ececec' },
  navIcon: { fontSize: '15px', flexShrink: 0, width: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  catCount: {
    marginLeft: 'auto',
    background: 'rgba(255,255,255,0.07)', color: '#8e8ea0',
    fontSize: '11px', padding: '1px 6px', borderRadius: '10px',
  },
  navDivider: { height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 4px' },
  navMiniDivider: { height: '1px', background: 'rgba(255,255,255,0.04)', margin: '4px 10px' },
  navSectionTitle: {
    fontSize: '10px', fontWeight: '500', color: '#555560',
    padding: '8px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.07em',
  },
  navSection: {},
  sidebarFooter: { padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  userCard: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
  },
  userAvatar: {
    width: '30px', height: '30px', borderRadius: '50%',
    background: '#c5b4e3',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: '500', color: '#1a1a1a', flexShrink: 0,
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: {
    fontSize: '12px', fontWeight: '400', color: '#ececec',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  logoutLink: {
    fontSize: '11px', color: '#555560',
    background: 'none', border: 'none', padding: 0,
    cursor: 'pointer', textDecoration: 'underline',
  },

  /* ── Main ── */
  main: { flex: 1, transition: 'margin-left 0.2s ease' },
  container: { maxWidth: '1280px', margin: '0 auto', padding: '32px 40px' },

  /* ── Welcome ── */
  welcomeSection: { marginBottom: '32px' },
  welcomeTitle: {
    fontSize: '24px', fontWeight: '500', color: '#1a1a1a', marginBottom: '6px',
  },
  welcomeSubtitle: { fontSize: '14px', color: '#6b6b80', lineHeight: '1.5' },

  /* ── Stats grid ── */
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px', marginBottom: '36px',
  },
  statCard: {
    background: '#fff', borderRadius: '10px', padding: '18px',
    border: '1px solid #ebebeb',
    transition: 'border-color 0.15s', cursor: 'pointer',
  },
  darkStatCard: { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' },
  statCardContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  statLabel: { fontSize: '12px', color: '#6b6b80', fontWeight: '400', marginBottom: '6px' },
  statValue: { fontSize: '28px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px' },
  statSubtext: { fontSize: '11px', color: '#aeaeb8' },
  statIcon: {
    width: '36px', height: '36px', borderRadius: '7px', background: '#f0f0f0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6b80',
  },

  /* ── Sections ── */
  section: { marginBottom: '40px' },
  sectionDivider: { height: '1px', background: '#ebebeb', margin: '0 0 36px' },
  sectionTitle: { fontSize: '16px', fontWeight: '500', color: '#1a1a1a', marginBottom: '16px' },
  cardsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px',
  },

  /* ── Folder card ── */
  folderCard: {
    background: '#fff', borderRadius: '10px', padding: '18px',
    border: '1px solid #ebebeb',
    transition: 'border-color 0.15s', cursor: 'pointer',
  },
  folderCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  folderIconLarge: {
    width: '40px', height: '40px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
  },
  moreBtn: { background: 'transparent', border: 'none', fontSize: '16px', color: '#aeaeb8', cursor: 'pointer', padding: '2px' },
  folderCardTitle: { fontSize: '15px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' },
  folderCardDesc: { fontSize: '13px', color: '#6b6b80', lineHeight: '1.55', marginBottom: '14px' },
  folderCardFooter: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: '12px', borderTop: '1px solid #f0f0f0',
  },
  folderCardStat: { fontSize: '12px', color: '#6b6b80' },
  viewDetailsBtn: {
    background: 'transparent', border: 'none',
    color: '#8b5cf6', fontSize: '12px', fontWeight: '500',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
  },

  /* ── Category card ── */
  categoryCard: {
    position: 'relative', background: '#fff', borderRadius: '10px', overflow: 'hidden',
    border: '1px solid #ebebeb', transition: 'border-color 0.15s', cursor: 'pointer',
  },
  categoryCardAccent: { height: '3px', background: '#e0e0e0' },
  categoryCardContent: { padding: '18px' },
  categoryIconWrapper: {
    width: '40px', height: '40px', borderRadius: '8px',
    background: '#f4f4f4',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px',
  },
  categoryIcon: { fontSize: '20px' },
  categoryCardTitle: { fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' },
  categoryCardDesc: { fontSize: '12px', color: '#6b6b80', lineHeight: '1.55', marginBottom: '14px' },

  /* ── Tool card ── */
  toolCard: {
    position: 'relative', background: '#fff', borderRadius: '10px', overflow: 'hidden',
    border: '1px solid #ebebeb', transition: 'border-color 0.15s', cursor: 'pointer',
  },
  toolCardAccent: { height: '3px', background: '#e0e0e0' },
  toolCardContent: { padding: '18px' },
  toolIconWrapper: {
    width: '100%', height: '120px', borderRadius: '8px 8px 0 0',
    background: '#f4f4f4',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px',
    overflow: 'hidden', marginLeft: '-18px', marginRight: '-18px', marginTop: '-18px', width: 'calc(100% + 36px)',
  },
  toolIcon: { fontSize: '20px' },
  toolCardTitle: { fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' },
  toolCardDesc: { fontSize: '12px', color: '#6b6b80', lineHeight: '1.55', marginBottom: '14px' },

  /* ── Category section header ── */
  catSectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' },
  catSectionIcon: { fontSize: '16px' },
  catSectionTitle: { fontSize: '15px', fontWeight: '500', color: '#1a1a1a', flex: 1 },
  catSectionCount: {
    background: '#f0f0f0', color: '#6b6b80',
    fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
  },

  /* ── All tools card ── */
  allToolsCard: {
    position: 'relative', background: '#1a1a1a', borderRadius: '10px', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)', transition: 'border-color 0.15s', cursor: 'pointer',
  },
  allToolsCardContent: { padding: '24px 18px', textAlign: 'center' },
  allToolsIcon: { fontSize: '28px', marginBottom: '10px' },
  allToolsTitle: { fontSize: '15px', fontWeight: '500', marginBottom: '4px', color: '#ececec' },
  allToolsDesc: { fontSize: '12px', color: '#8e8ea0', marginBottom: '14px' },

  /* ── Buttons ── */
  yellowBtn: {
    background: '#d97706', color: '#fff', border: 'none',
    padding: '9px 18px', borderRadius: '8px',
    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
    transition: 'background 0.15s', width: '100%',
  },
  yellowBtnSmall: {
    background: 'transparent', color: '#d97706',
    border: '1px solid #d97706',
    padding: '5px 12px', borderRadius: '7px',
    fontSize: '12px', fontWeight: '500', cursor: 'pointer',
    transition: 'background 0.15s',
  },

  /* ── Recent list ── */
  recentList: {
    background: '#fff', borderRadius: '10px', border: '1px solid #ebebeb',
  },
  recentItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 14px', transition: 'background 0.12s', cursor: 'pointer',
    borderRadius: '8px',
  },
  recentIcon: { fontSize: '20px', flexShrink: 0 },
  recentInfo: { flex: 1, minWidth: 0 },
  recentTitle: {
    fontSize: '13px', fontWeight: '500', color: '#1a1a1a',
    marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  recentMeta: { fontSize: '11px', color: '#aeaeb8' },
  quickActionBtn: {
    background: 'transparent', border: '1px solid #ebebeb',
    color: '#8b5cf6', padding: '5px 12px', borderRadius: '7px',
    fontSize: '12px', fontWeight: '500', cursor: 'pointer',
  },

  /* ── Page header ── */
  pageHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' },
  backBtn: {
    background: '#fff', border: '1px solid #ebebeb', color: '#6b6b80',
    padding: '7px 14px', borderRadius: '8px',
    fontSize: '13px', fontWeight: '400', cursor: 'pointer', transition: 'border-color 0.15s',
  },
  pageTitle: { fontSize: '20px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px' },
  pageSubtitle: { fontSize: '13px', color: '#6b6b80' },

  /* ── Search ── */
  searchBar: { display: 'flex', gap: '8px', marginBottom: '20px' },
  searchInput: {
    flex: 1, padding: '10px 14px',
    border: '1px solid #ebebeb', borderRadius: '8px',
    fontSize: '13px', outline: 'none', background: '#fff',
    color: '#1a1a1a', transition: 'border-color 0.15s',
  },
  searchBtn: {
    background: 'transparent', color: '#6b6b80', border: '1px solid #ebebeb',
    padding: '8px 12px', borderRadius: '8px', fontSize: '15px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  /* ── Files grid ── */
  filesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' },
  fileCard: {
    background: '#fff', borderRadius: '10px', overflow: 'hidden',
    border: '1px solid #ebebeb', transition: 'border-color 0.15s', cursor: 'pointer',
  },
  fileCardActive: { borderColor: '#8b5cf6' },
  fileCardHeader: { position: 'relative' },
  filePreview: {
    height: '120px', background: '#f9f9f8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  filePreviewIcon: { fontSize: '36px' },
  favBtn: {
    position: 'absolute', top: '8px', right: '8px',
    background: 'rgba(255,255,255,0.9)', border: 'none',
    width: '28px', height: '28px', borderRadius: '50%',
    fontSize: '13px', cursor: 'pointer',
  },
  fileCardBody: { padding: '12px 12px 8px' },
  fileCardTitle: {
    fontSize: '13px', fontWeight: '500', color: '#1a1a1a',
    marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  fileCardMeta: {
    fontSize: '11px', color: '#aeaeb8',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  fileCardFooter: { padding: '8px 12px 12px', borderTop: '1px solid #f0f0f0' },

  /* ── Modal ── */
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: '20px',
  },
  modalContent: {
    background: '#fff', borderRadius: '12px',
    width: '90vw', maxWidth: '1400px', height: '92vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    border: '1px solid #e5e5e5',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', borderBottom: '1px solid #ebebeb', minHeight: '46px',
  },
  modalTitle: {
    fontSize: '14px', fontWeight: '500', color: '#1a1a1a',
    flex: 1, marginRight: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  modalHeaderButtons: { display: 'flex', gap: '6px', alignItems: 'center' },
  iconBtn: {
    background: '#f4f4f4', color: '#444', border: '1px solid #e0e0e0',
    width: '28px', height: '28px', borderRadius: '6px',
    fontSize: '13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  },
  modalClose: {
    background: 'transparent', border: '1px solid #ebebeb',
    fontSize: '14px', color: '#8e8ea0', cursor: 'pointer',
    width: '28px', height: '28px', borderRadius: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.15s',
  },
  zoomBtn: {
    background: '#1a1a1a', color: '#fff', border: 'none',
    width: '28px', height: '28px', borderRadius: '6px',
    fontSize: '14px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s', lineHeight: 1,
  },
  zoomLabel: {
    fontSize: '11px', color: '#6b6b80',
    minWidth: '36px', textAlign: 'center', cursor: 'pointer', userSelect: 'none',
  },
  modalDivider: { width: '1px', height: '18px', background: '#ebebeb', margin: '0 2px' },
  modalBody: { flex: 1, overflow: 'hidden' },
  pdfViewer: { width: '100%', height: '100%', border: 'none' },

  /* ── Empty / loading states ── */
  loadingState: {
    gridColumn: '1 / -1', textAlign: 'center',
    padding: '48px 20px', color: '#aeaeb8', fontSize: '13px',
  },
  emptyState: { gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px' },
  emptyIcon: { fontSize: '40px', marginBottom: '12px' },
  emptyText: { color: '#aeaeb8', fontSize: '13px' },
};

