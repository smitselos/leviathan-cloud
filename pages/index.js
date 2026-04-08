import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';

const FOLDERS = {
  keimena: { name: 'Κείμενα', icon: '📚', color: '#3b82f6', desc: 'Εκπαιδευτικά κείμενα και υλικό' },
  biblia: { name: 'Βιβλία', icon: '📖', color: '#8b5cf6', desc: 'Βιβλία αναφοράς και μελέτης' }
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
        .card-hover { transition: border-color 0.15s ease, background 0.15s ease !important; }
        .card-hover:hover { border-color: rgba(83,74,183,0.3) !important; background: #f9f8f7 !important; }
        .card-hover-tool:hover { border-color: rgba(186,117,23,0.3) !important; background: #fffdf7 !important; }
        .card-hover-dark:hover { background: #1a1f2e !important; }
        .card-hover-file:hover { border-color: rgba(24,95,165,0.25) !important; background: #f8fbff !important; }
        .nav-item-hover { transition: background 0.12s ease, color 0.12s ease !important; }
        .nav-item-hover:hover { background: rgba(255,255,255,0.06) !important; color: #e2e8f0 !important; }
        .recent-item-hover { transition: background 0.12s ease !important; }
        .recent-item-hover:hover { background: #f4f2ef !important; }
        button:focus-visible, input:focus-visible { outline: 2px solid #534AB7; outline-offset: 2px; }
      \`}</style>

      {/* Sidebar */}
      <aside style={{...styles.sidebar, width: sidebarCollapsed ? '70px' : '260px'}}>
        <div style={styles.sidebarHeader}>
          {!sidebarCollapsed && (
            <div style={styles.logo}>
              <span style={styles.logoText}>ΛΕΒΙΑΘΑΝ</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={styles.collapseBtn}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        
        <nav style={styles.nav}>
          <button onClick={goHome} className="nav-item-hover"
            style={{...styles.navItem, ...(activeView === 'home' ? styles.navItemActive : {})}}>
            <span style={styles.navIcon}>🏠</span>
            {!sidebarCollapsed && <span>Αρχική</span>}
          </button>

          <div style={styles.navDivider}></div>

          <div style={styles.navSection}>
            {!sidebarCollapsed && <div style={styles.navSectionTitle}>ΕΓΓΡΑΦΑ</div>}

            <button className="nav-item-hover" onClick={() => setActiveView('favorites')}
              style={{...styles.navItem, ...styles.navSubItem, ...(activeView === 'favorites' ? styles.navItemActive : {})}}>
              <span style={styles.navIcon}>⭐</span>
              {!sidebarCollapsed && <><span style={{flex:1, textAlign:'left'}}>Αγαπημένα</span><span style={styles.catCount}>{favorites.length}</span></>}
            </button>

            <button className="nav-item-hover" onClick={() => setActiveView('recent')}
              style={{...styles.navItem, ...styles.navSubItem, ...(activeView === 'recent' ? styles.navItemActive : {})}}>
              <span style={styles.navIcon}>🕐</span>
              {!sidebarCollapsed && <><span style={{flex:1, textAlign:'left'}}>Πρόσφατα</span><span style={styles.catCount}>{recentFiles.length}</span></>}
            </button>

            <button className="nav-item-hover" onClick={() => { setActiveView('allDocs'); setCurrentFolder(null); }}
              style={{...styles.navItem, ...styles.navSubItem, ...(activeView === 'allDocs' ? styles.navItemActive : {})}}>
              <span style={styles.navIcon}>📄</span>
              {!sidebarCollapsed && <span>Όλα τα Έγγραφα</span>}
            </button>

            <div style={styles.navMiniDivider}></div>

            {Object.entries(FOLDERS).map(([id, folder]) => (
              <button key={id} className="nav-item-hover" onClick={() => openFolder(id)}
                style={{...styles.navItem, ...styles.navSubItem, ...(currentFolder === id ? styles.navItemActive : {})}}>
                <span style={styles.navIcon}>{folder.icon}</span>
                {!sidebarCollapsed && <span style={{flex:1, textAlign:'left'}}>{folder.name}</span>}
              </button>
            ))}
          </div>

          <div style={styles.navDivider}></div>

          {tools.length > 0 && (
            <div style={styles.navSection}>
              {!sidebarCollapsed && <div style={styles.navSectionTitle}>ΕΡΓΑΛΕΙΑ</div>}

              <button className="nav-item-hover" onClick={() => openToolCategory('__favtools__')}
                style={{...styles.navItem, ...styles.navSubItem, ...(currentToolCategory === '__favtools__' ? styles.navItemActive : {})}}>
                <span style={styles.navIcon}>⭐</span>
                {!sidebarCollapsed && <><span style={{flex:1, textAlign:'left'}}>Αγαπημένα</span><span style={styles.catCount}>{favoriteTools.length}</span></>}
              </button>

              {recentTools.length > 0 && (
                <button className="nav-item-hover" onClick={() => openToolCategory('__recent__')}
                  style={{...styles.navItem, ...styles.navSubItem, ...(currentToolCategory === '__recent__' ? styles.navItemActive : {})}}>
                  <span style={styles.navIcon}>🕐</span>
                  {!sidebarCollapsed && <><span style={{flex:1, textAlign:'left'}}>Πρόσφατα</span><span style={styles.catCount}>{recentTools.length}</span></>}
                </button>
              )}

              <button className="nav-item-hover" onClick={openAllTools}
                style={{...styles.navItem, ...styles.navSubItem, ...(activeView === 'allTools' ? styles.navItemActive : {})}}>
                <span style={styles.navIcon}>🔧</span>
                {!sidebarCollapsed && <><span style={{flex:1, textAlign:'left'}}>Όλα</span><span style={styles.catCount}>{tools.length}</span></>}
              </button>

              <div style={styles.navMiniDivider}></div>

              {Object.entries(toolCategories).map(([catName, catTools]) => (
                <button key={catName} className="nav-item-hover" onClick={() => openToolCategory(catName)}
                  style={{...styles.navItem, ...styles.navSubItem,
                    ...(currentToolCategory === catName && activeView === 'toolCategory' ? styles.navItemActive : {})}}>
                  <span style={styles.navIcon}>{getCategoryIcon(catName)}</span>
                  {!sidebarCollapsed && <><span style={{flex:1, textAlign:'left'}}>{catName}</span><span style={styles.catCount}>{catTools.length}</span></>}
                </button>
              ))}
            </div>
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
                    <div style={{...styles.statIcon, background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>⭐</div>
                  </div>
                </div>

                <div className="card-hover" style={{...styles.statCard, cursor:'pointer'}} onClick={() => setActiveView('recent')}>
                  <div style={styles.statCardContent}>
                    <div>
                      <div style={styles.statLabel}>Πρόσφατα Έγγραφα</div>
                      <div style={styles.statValue}>{recentFiles.length}</div>
                      <div style={styles.statSubtext}>Τελευταία αρχεία</div>
                    </div>
                    <div style={{...styles.statIcon, background:'linear-gradient(135deg,#f093fb,#f5576c)'}}>🕐</div>
                  </div>
                </div>

                <div className="card-hover" style={{...styles.statCard, cursor:'pointer'}} onClick={() => { setActiveView('allDocs'); setCurrentFolder(null); }}>
                  <div style={styles.statCardContent}>
                    <div>
                      <div style={styles.statLabel}>Όλα τα Έγγραφα</div>
                      <div style={styles.statValue}>📄</div>
                      <div style={styles.statSubtext}>Κείμενα &amp; Βιβλία</div>
                    </div>
                    <div style={{...styles.statIcon, background:'linear-gradient(135deg,#3b82f6,#1d4ed8)'}}>📚</div>
                  </div>
                </div>
              </div>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Φάκελοι Εγγράφων</h2>
                <div style={styles.cardsGrid}>
                  {Object.entries(FOLDERS).map(([id, folder]) => (
                    <div key={id} className="card-hover" style={styles.folderCard} onClick={() => openFolder(id)}>
                      <div style={styles.folderCardHeader}>
                        <div style={{...styles.folderIconLarge, background: folder.color}}>{folder.icon}</div>
                        <button style={styles.moreBtn}>⋮</button>
                      </div>
                      <h3 style={styles.folderCardTitle}>{folder.name}</h3>
                      <p style={styles.folderCardDesc}>{folder.desc}</p>
                      <div style={styles.folderCardFooter}>
                        <span style={styles.folderCardStat}>📄 Αρχεία</span>
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
                        <div style={{...styles.categoryCardAccent, background:'linear-gradient(90deg,#f59e0b,#ef4444)'}}></div>
                        <div style={styles.categoryCardContent}>
                          <div style={{...styles.categoryIconWrapper, background:'linear-gradient(135deg,#fef3c7,#fde68a)'}}>
                            <span style={styles.categoryIcon}>🕐</span>
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
                        <div style={styles.allToolsIcon}>🔧</div>
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
                        <div style={styles.recentIcon}>📄</div>
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
                  <h1 style={styles.pageTitle}>📄 Όλα τα Έγγραφα</h1>
                  <p style={styles.pageSubtitle}>Επέλεξε φάκελο για να δεις τα αρχεία</p>
                </div>
              </div>
              <div style={styles.cardsGrid}>
                {Object.entries(FOLDERS).map(([id, folder]) => (
                  <div key={id} className="card-hover" style={styles.folderCard} onClick={() => openFolder(id)}>
                    <div style={styles.folderCardHeader}>
                      <div style={{...styles.folderIconLarge, background: folder.color}}>{folder.icon}</div>
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
                <button style={styles.searchBtn}>🔍</button>
              </div>
              <div style={styles.filesGrid}>
                {loading ? (
                  <div style={styles.loadingState}>Φόρτωση...</div>
                ) : filteredFiles.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>📭</div>
                    <div style={styles.emptyText}>Δεν βρέθηκαν αρχεία</div>
                  </div>
                ) : (
                  filteredFiles.map(file => (
                    <div key={file.id} className="card-hover card-hover-file"
                      style={{...styles.fileCard, ...(currentFile?.id === file.id ? styles.fileCardActive : {})}}
                      onClick={() => openFile(file)}>
                      <div style={styles.fileCardHeader}>
                        <div style={styles.filePreview}><span style={styles.filePreviewIcon}>📄</span></div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }} style={styles.favBtn}>
                          {favorites.some(f => f.id === file.id) ? '⭐' : '☆'}
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
                  <h1 style={styles.pageTitle}>🔧 Όλα τα Εργαλεία</h1>
                  <p style={styles.pageSubtitle}>{filteredTools.length} {filteredTools.length === 1 ? 'εργαλείο' : 'εργαλεία'}</p>
                </div>
              </div>
              <div style={styles.searchBar}>
                <input type="search" placeholder="Αναζήτηση εργαλείων..." value={toolsSearchQuery}
                  onChange={(e) => setToolsSearchQuery(e.target.value)} style={styles.searchInput} />
                <button style={styles.searchBtn}>🔍</button>
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
                            <div style={styles.toolIconWrapper}><span style={styles.toolIcon}>{tool.icon || '🔧'}</span></div>
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
                      <span style={styles.catSectionIcon}>🔧</span>
                      <h2 style={styles.catSectionTitle}>Χωρίς κατηγορία</h2>
                      <span style={styles.catSectionCount}>{uncategorized.length}</span>
                    </div>
                    <div style={styles.filesGrid}>
                      {uncategorized.map(tool => (
                        <div key={tool.file} className="card-hover card-hover-tool" style={styles.toolCard} onClick={() => openTool(tool)}>
                          <div style={styles.toolCardAccent}></div>
                          <div style={styles.toolCardContent}>
                            <div style={styles.toolIconWrapper}><span style={styles.toolIcon}>{tool.icon || '🔧'}</span></div>
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
                  <div style={styles.emptyIcon}>🔍</div>
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
                    {currentToolCategory === '__recent__' ? '🕐 Πρόσφατα' : `${getCategoryIcon(currentToolCategory)} ${currentToolCategory}`}
                  </h1>
                  <p style={styles.pageSubtitle}>{filteredCategoryTools.length} {filteredCategoryTools.length === 1 ? 'εργαλείο' : 'εργαλεία'}</p>
                </div>
              </div>
              <div style={styles.searchBar}>
                <input type="search" placeholder="Αναζήτηση εργαλείων..." value={toolsSearchQuery}
                  onChange={(e) => setToolsSearchQuery(e.target.value)} style={styles.searchInput} />
                <button style={styles.searchBtn}>🔍</button>
              </div>
              <div style={styles.filesGrid}>
                {filteredCategoryTools.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>🔍</div>
                    <div style={styles.emptyText}>Δεν βρέθηκαν εργαλεία</div>
                  </div>
                ) : (
                  filteredCategoryTools.map(tool => (
                    <div key={tool.file} className="card-hover card-hover-tool" style={styles.toolCard} onClick={() => openTool(tool)}>
                      <div style={styles.toolCardAccent}></div>
                      <div style={styles.toolCardContent}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                          <div style={styles.toolIconWrapper}><span style={styles.toolIcon}>{tool.icon || '🔧'}</span></div>
                          <button onClick={(e) => { e.stopPropagation(); toggleFavoriteTool(tool); }} style={styles.favBtn} title="Αγαπημένο">
                            {favoriteTools.some(t => t.file === tool.file) ? '⭐' : '☆'}
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
                  <h1 style={styles.pageTitle}>⭐ Αγαπημένα</h1>
                  <p style={styles.pageSubtitle}>{favorites.length} {favorites.length === 1 ? 'αγαπημένο' : 'αγαπημένα'}</p>
                </div>
              </div>
              <div style={styles.filesGrid}>
                {favorites.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>⭐</div>
                    <div style={styles.emptyText}>Δεν έχεις αγαπημένα ακόμα</div>
                  </div>
                ) : (
                  favorites.map(file => (
                    <div key={file.id} className="card-hover card-hover-file" style={styles.fileCard} onClick={() => openFile(file)}>
                      <div style={styles.fileCardHeader}>
                        <div style={styles.filePreview}><span style={styles.filePreviewIcon}>📄</span></div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }} style={styles.favBtn}>⭐</button>
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
                  <h1 style={styles.pageTitle}>📄 Πρόσφατα Αρχεία</h1>
                  <p style={styles.pageSubtitle}>{recentFiles.length} {recentFiles.length === 1 ? 'αρχείο' : 'αρχεία'}</p>
                </div>
              </div>
              <div style={styles.filesGrid}>
                {recentFiles.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>📄</div>
                    <div style={styles.emptyText}>Δεν έχεις ανοίξει αρχεία ακόμα</div>
                  </div>
                ) : (
                  recentFiles.map(file => (
                    <div key={file.id} className="card-hover card-hover-file" style={styles.fileCard} onClick={() => openFile(file)}>
                      <div style={styles.fileCardHeader}>
                        <div style={styles.filePreview}><span style={styles.filePreviewIcon}>📄</span></div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }} style={styles.favBtn}>
                          {favorites.some(f => f.id === file.id) ? '⭐' : '☆'}
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
              <h2 style={styles.modalTitle}>{currentTool.icon || '🔧'} {currentTool.name}</h2>
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
  const icons = {
    'Γλώσσα':         '📝',
    'Λογοτεχνία':     '📚',
    'Ιστορία':        '🏛️',
    'Λατινικά':       '📜',
    'Αρχαία':         '🏺',
    'Έκθεση':         '✍️',
    'Γενικά':         '🔧',
    'Γραμματική':     '📝',
    'Λεξιλόγιο':      '📖',
    'Σύνταξη':        '🔗',
    'Κείμενο':        '📄',
    'Αξιολόγηση':     '✅',
    'Ασκήσεις':       '✏️',
    'Ανάλυση':        '🔍',
    'Παραγωγή Λόγου': '✍️',
  };
  return icons[categoryName] || '📁';
}

const styles = {
  /* ── Loading ── */
  loadingScreen: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0f1a', color: '#e2e8f0' },
  spinner: { width: '40px', height: '40px', border: '2px solid rgba(255,255,255,0.15)', borderTop: '2px solid #AFA9EC', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '20px' },
  loadingText: { fontSize: '16px', fontWeight: '400', color: '#94a3b8', letterSpacing: '0.02em' },

  /* ── Layout ── */
  app: { display: 'flex', minHeight: '100vh', background: '#f4f2ef', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },

  /* ── Sidebar ── */
  sidebar: { position: 'fixed', left: 0, top: 0, bottom: 0, background: '#0f1117', color: '#e2e8f0', display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease', zIndex: 100, borderRight: '0.5px solid rgba(255,255,255,0.06)' },
  sidebarHeader: { padding: '18px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(255,255,255,0.06)' },
  logo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoText: { fontSize: '17px', fontWeight: '500', color: '#CECBF6', letterSpacing: '0.04em' },
  collapseBtn: { background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', color: '#94a3b8', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s, color 0.15s' },
  nav: { flex: 1, padding: '12px 8px', overflowY: 'auto' },
  navItem: { width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#64748b', fontSize: '13px', fontWeight: '400', cursor: 'pointer', transition: 'background 0.12s, color 0.12s', marginBottom: '2px', textAlign: 'left' },
  navSubItem: { paddingLeft: '24px', fontSize: '12px', color: '#475569' },
  navItemActive: { background: 'rgba(174,168,236,0.12)', color: '#CECBF6' },
  navIcon: { fontSize: '16px', flexShrink: 0, width: '20px', textAlign: 'center' },
  catCount: { marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', color: '#64748b', fontSize: '11px', fontWeight: '400', padding: '1px 6px', borderRadius: '8px' },
  navDivider: { height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '12px 8px' },
  navMiniDivider: { height: '0.5px', background: 'rgba(255,255,255,0.04)', margin: '6px 12px' },
  navSectionTitle: { fontSize: '10px', fontWeight: '500', color: '#334155', padding: '8px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.08em' },
  navSection: {},
  sidebarFooter: { padding: '12px', borderTop: '0.5px solid rgba(255,255,255,0.06)' },
  userCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' },
  userAvatar: { width: '32px', height: '32px', borderRadius: '50%', background: '#3C3489', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: '#CECBF6', flexShrink: 0 },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: '13px', fontWeight: '400', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logoutLink: { fontSize: '11px', color: '#475569', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' },

  /* ── Main ── */
  main: { flex: 1, transition: 'margin-left 0.25s ease' },
  container: { maxWidth: '1320px', margin: '0 auto', padding: '32px 40px' },

  /* ── Welcome ── */
  welcomeSection: { marginBottom: '28px' },
  welcomeTitle: { fontSize: '26px', fontWeight: '500', color: '#1a1a18', marginBottom: '6px' },
  welcomeSubtitle: { fontSize: '14px', color: '#6b7280' },

  /* ── Stats ── */
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' },
  statCard: { background: '#fff', borderRadius: '12px', padding: '20px', border: '0.5px solid rgba(0,0,0,0.08)', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer' },
  darkStatCard: { background: '#0f1117', border: '0.5px solid rgba(255,255,255,0.08)' },
  statCardContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  statLabel: { fontSize: '12px', color: '#6b7280', fontWeight: '400', marginBottom: '8px' },
  statValue: { fontSize: '32px', fontWeight: '500', color: '#1a1a18', marginBottom: '4px' },
  statSubtext: { fontSize: '11px', color: '#9ca3af' },
  statIcon: { width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' },

  /* ── Sections ── */
  section: { marginBottom: '40px' },
  sectionDivider: { height: '0.5px', background: 'rgba(0,0,0,0.08)', margin: '-8px 0 36px 0' },
  sectionTitle: { fontSize: '18px', fontWeight: '500', color: '#1a1a18', marginBottom: '20px' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },

  /* ── Folder Card ── */
  folderCard: { background: '#fff', borderRadius: '12px', padding: '20px', border: '0.5px solid rgba(0,0,0,0.08)', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer' },
  folderCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' },
  folderIconLarge: { width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' },
  moreBtn: { background: 'transparent', border: 'none', fontSize: '18px', color: '#9ca3af', cursor: 'pointer', padding: '4px' },
  folderCardTitle: { fontSize: '17px', fontWeight: '500', color: '#1a1a18', marginBottom: '6px' },
  folderCardDesc: { fontSize: '13px', color: '#6b7280', lineHeight: '1.6', marginBottom: '16px' },
  folderCardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '0.5px solid rgba(0,0,0,0.06)' },
  folderCardStat: { fontSize: '12px', color: '#6b7280', fontWeight: '400' },
  viewDetailsBtn: { background: 'transparent', border: 'none', color: '#534AB7', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center' },

  /* ── Category Card ── */
  categoryCard: { position: 'relative', background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.08)', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer' },
  categoryCardAccent: { height: '3px', background: '#534AB7' },
  categoryCardContent: { padding: '20px' },
  categoryIconWrapper: { width: '44px', height: '44px', borderRadius: '10px', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' },
  categoryIcon: { fontSize: '22px' },
  categoryCardTitle: { fontSize: '16px', fontWeight: '500', color: '#1a1a18', marginBottom: '6px' },
  categoryCardDesc: { fontSize: '13px', color: '#6b7280', lineHeight: '1.6', marginBottom: '16px' },

  /* ── Tool Card ── */
  toolCard: { position: 'relative', background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.08)', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer' },
  toolCardAccent: { height: '3px', background: '#BA7517' },
  toolCardContent: { padding: '20px' },
  toolIconWrapper: { width: '44px', height: '44px', borderRadius: '10px', background: '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' },
  toolIcon: { fontSize: '22px' },
  toolCardTitle: { fontSize: '16px', fontWeight: '500', color: '#1a1a18', marginBottom: '6px' },
  toolCardDesc: { fontSize: '13px', color: '#6b7280', lineHeight: '1.6', marginBottom: '16px' },

  /* ── Category section header ── */
  catSectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  catSectionIcon: { fontSize: '18px' },
  catSectionTitle: { fontSize: '17px', fontWeight: '500', color: '#1a1a18', flex: 1 },
  catSectionCount: { background: 'rgba(0,0,0,0.05)', color: '#6b7280', fontSize: '12px', fontWeight: '400', padding: '3px 10px', borderRadius: '10px' },

  /* ── All Tools Card ── */
  allToolsCard: { position: 'relative', background: '#0f1117', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid rgba(174,168,236,0.2)', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer' },
  allToolsCardContent: { padding: '28px 20px', textAlign: 'center', color: '#e2e8f0' },
  allToolsIcon: { fontSize: '36px', marginBottom: '12px' },
  allToolsTitle: { fontSize: '17px', fontWeight: '500', marginBottom: '6px', color: '#CECBF6' },
  allToolsDesc: { fontSize: '13px', opacity: 0.6, marginBottom: '16px', color: '#e2e8f0' },

  /* ── Buttons ── */
  yellowBtn: { background: '#BA7517', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.15s', width: '100%' },
  yellowBtnSmall: { background: 'transparent', color: '#BA7517', border: '0.5px solid #BA7517', padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' },

  /* ── Recent List ── */
  recentList: { background: '#fff', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.08)' },
  recentItem: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '8px', transition: 'background 0.12s', cursor: 'pointer' },
  recentIcon: { fontSize: '24px', flexShrink: 0 },
  recentInfo: { flex: 1, minWidth: 0 },
  recentTitle: { fontSize: '14px', fontWeight: '500', color: '#1a1a18', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  recentMeta: { fontSize: '12px', color: '#9ca3af' },
  quickActionBtn: { background: 'transparent', border: '0.5px solid rgba(0,0,0,0.15)', color: '#534AB7', padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },

  /* ── Page Header ── */
  pageHeader: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  backBtn: { background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)', color: '#6b7280', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '400', cursor: 'pointer', transition: 'border-color 0.15s' },
  pageTitle: { fontSize: '22px', fontWeight: '500', color: '#1a1a18', marginBottom: '2px' },
  pageSubtitle: { fontSize: '13px', color: '#6b7280' },

  /* ── Search ── */
  searchBar: { display: 'flex', gap: '10px', marginBottom: '24px' },
  searchInput: { flex: 1, padding: '11px 16px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff', transition: 'border-color 0.15s', color: '#1a1a18' },
  searchBtn: { background: '#534AB7', color: '#fff', border: 'none', padding: '11px 18px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },

  /* ── Files Grid ── */
  filesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' },
  fileCard: { background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.08)', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer' },
  fileCardActive: { borderColor: 'rgba(83,74,183,0.5)' },
  fileCardHeader: { position: 'relative' },
  filePreview: { height: '140px', background: '#f4f2ef', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  filePreviewIcon: { fontSize: '40px' },
  favBtn: { position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.88)', border: 'none', width: '30px', height: '30px', borderRadius: '50%', fontSize: '14px', cursor: 'pointer' },
  fileCardBody: { padding: '14px 14px 10px' },
  fileCardTitle: { fontSize: '14px', fontWeight: '500', color: '#1a1a18', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  fileCardMeta: { fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  fileCardFooter: { padding: '10px 14px 14px', borderTop: '0.5px solid rgba(0,0,0,0.06)' },

  /* ── Modal ── */
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
  modalContent: { background: '#fff', borderRadius: '14px', width: '90vw', maxWidth: '1400px', height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', minHeight: '48px' },
  modalTitle: { fontSize: '15px', fontWeight: '500', color: '#1a1a18', flex: 1, marginRight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  modalHeaderButtons: { display: 'flex', gap: '6px', alignItems: 'center' },
  iconBtn: { background: '#0F6E56', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '7px', fontSize: '14px', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalClose: { background: 'transparent', border: '0.5px solid rgba(0,0,0,0.12)', fontSize: '16px', color: '#6b7280', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '7px', transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  zoomBtn: { background: '#1a1a18', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '7px', fontSize: '16px', fontWeight: '400', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', lineHeight: 1 },
  zoomLabel: { fontSize: '12px', fontWeight: '400', color: '#6b7280', minWidth: '38px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' },
  modalDivider: { width: '0.5px', height: '20px', background: 'rgba(0,0,0,0.12)', margin: '0 2px' },
  modalBody: { flex: 1, overflow: 'hidden' },
  pdfViewer: { width: '100%', height: '100%', border: 'none' },

  /* ── States ── */
  loadingState: { gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px', color: '#9ca3af', fontSize: '14px' },
  emptyState: { gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px' },
  emptyIcon: { fontSize: '48px', marginBottom: '14px' },
  emptyText: { color: '#9ca3af', fontSize: '14px' },
};
