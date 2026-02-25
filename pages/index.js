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
  
  useEffect(() => {
    const savedFavorites = localStorage.getItem('leviathan-favorites');
    const savedRecent = localStorage.getItem('leviathan-recent');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedRecent) setRecentFiles(JSON.parse(savedRecent));
    const savedFavTools = localStorage.getItem('leviathan-favorite-tools');
    if (savedFavTools) setFavoriteTools(JSON.parse(savedFavTools));
    loadTools();
  }, []);
  
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
        .card-hover {
          transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s ease, filter 0.22s ease !important;
        }
        .card-hover:hover {
          transform: translateY(-6px) scale(1.025) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.13), 0 4px 12px rgba(102,126,234,0.10) !important;
          filter: brightness(1.03) !important;
          z-index: 2;
          position: relative;
        }
        .card-hover-tool:hover {
          transform: translateY(-6px) scale(1.025) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.13), 0 4px 12px rgba(251,191,36,0.18) !important;
          filter: brightness(1.04) !important;
        }
        .card-hover-dark:hover {
          transform: translateY(-6px) scale(1.025) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.35), 0 4px 12px rgba(102,126,234,0.25) !important;
          filter: brightness(1.08) !important;
        }
        .card-hover-file:hover {
          transform: translateY(-5px) scale(1.018) !important;
          box-shadow: 0 12px 32px rgba(59,130,246,0.13), 0 3px 8px rgba(0,0,0,0.08) !important;
          filter: brightness(1.02) !important;
        }
        .nav-item-hover {
          transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease !important;
        }
        .nav-item-hover:hover {
          background: rgba(255,255,255,0.07) !important;
          transform: translateX(3px) !important;
          color: #e2e8f0 !important;
        }
        .recent-item-hover {
          transition: background 0.15s ease, transform 0.15s ease !important;
        }
        .recent-item-hover:hover {
          background: #f8fafc !important;
          transform: translateX(4px) !important;
        }
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
                  <span style={{color:'#475569'}}>·</span>
                  <button onClick={() => router.push('/admin')} style={styles.logoutLink}>⚙️ Admin</button>
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
      
      {/* Tool Viewer Modal — ✅ ΑΛΛΑΓΗ: χρησιμοποιεί webViewLink από Drive */}
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
  loadingScreen: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' },
  spinner: { width: '50px', height: '50px', border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' },
  loadingText: { fontSize: '18px', fontWeight: '500' },
  app: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  sidebar: { position: 'fixed', left: 0, top: 0, bottom: 0, background: '#0a0f1a', color: '#e2e8f0', display: 'flex', flexDirection: 'column', transition: 'width 0.3s ease', zIndex: 100, boxShadow: '4px 0 24px rgba(0,0,0,0.3)' },
  sidebarHeader: { padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  logo: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoText: { fontSize: '20px', fontWeight: '700', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  collapseBtn: { background: 'rgba(255,255,255,0.07)', border: 'none', color: '#e2e8f0', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' },
  nav: { flex: 1, padding: '16px', overflowY: 'auto' },
  navItem: { width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'transparent', border: 'none', borderRadius: '12px', color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '4px', textAlign: 'left' },
  navSubItem: { paddingLeft: '28px', fontSize: '13px', color: '#64748b' },
  navItemActive: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', boxShadow: '0 4px 12px rgba(102,126,234,0.4)' },
  navIcon: { fontSize: '20px', flexShrink: 0 },
  catCount: { marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '11px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px' },
  navDivider: { height: '1px', background: 'rgba(255,255,255,0.07)', margin: '16px 0' },
  navMiniDivider: { height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 16px' },
  navSectionTitle: { fontSize: '11px', fontWeight: '600', color: '#475569', padding: '8px 16px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  navSection: {},
  sidebarFooter: { padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' },
  userCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' },
  userAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '600', color: '#fff', flexShrink: 0 },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: '14px', fontWeight: '500', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logoutLink: { fontSize: '12px', color: '#94a3b8', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' },
  main: { flex: 1, transition: 'margin-left 0.3s ease' },
  container: { maxWidth: '1400px', margin: '0 auto', padding: '40px', paddingTop: '24px' },
  welcomeSection: { marginBottom: '32px' },
  welcomeTitle: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' },
  welcomeSubtitle: { fontSize: '16px', color: '#64748b' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' },
  statCard: { background: '#fff', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.3s ease' },
  darkStatCard: { background: 'linear-gradient(135deg, #0a0f1a 0%, #1e293b 100%)', boxShadow: '0 8px 16px rgba(0,0,0,0.25)' },
  statCardContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  statLabel: { fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '8px' },
  statValue: { fontSize: '36px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' },
  statSubtext: { fontSize: '12px', color: '#94a3b8' },
  statIcon: { width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: '0 8px 16px rgba(0,0,0,0.15)' },
  section: { marginBottom: '48px' },
  sectionDivider: { height: '2px', background: 'linear-gradient(90deg, transparent, #e2e8f0 20%, #e2e8f0 80%, transparent)', margin: '-16px 0 40px 0', borderRadius: '2px' },
  sectionTitle: { fontSize: '24px', fontWeight: '700', color: '#0f172a', marginBottom: '24px' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' },
  folderCard: { background: '#fff', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.3s ease', cursor: 'pointer', border: '2px solid transparent' },
  folderCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  folderIconLarge: { width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: '0 8px 16px rgba(0,0,0,0.15)' },
  moreBtn: { background: 'transparent', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer', padding: '4px' },
  folderCardTitle: { fontSize: '20px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' },
  folderCardDesc: { fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' },
  folderCardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #f1f5f9' },
  folderCardStat: { fontSize: '13px', color: '#64748b', fontWeight: '500' },
  viewDetailsBtn: { background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  categoryCard: { position: 'relative', background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.3s ease', cursor: 'pointer' },
  categoryCardAccent: { height: '4px', background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)' },
  categoryCardContent: { padding: '24px' },
  categoryIconWrapper: { width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' },
  categoryIcon: { fontSize: '28px' },
  categoryCardTitle: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' },
  categoryCardDesc: { fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' },
  toolCard: { position: 'relative', background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: 'all 0.3s ease', cursor: 'pointer' },
  toolCardAccent: { height: '4px', background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)' },
  toolCardContent: { padding: '24px' },
  toolIconWrapper: { width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' },
  toolIcon: { fontSize: '28px' },
  toolCardTitle: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' },
  toolCardDesc: { fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' },
  catSectionHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
  catSectionIcon: { fontSize: '24px' },
  catSectionTitle: { fontSize: '20px', fontWeight: '700', color: '#0f172a', flex: 1 },
  catSectionCount: { background: '#e2e8f0', color: '#475569', fontSize: '13px', fontWeight: '600', padding: '4px 12px', borderRadius: '12px' },
  allToolsCard: { position: 'relative', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 16px rgba(102,126,234,0.3)', transition: 'all 0.3s ease', cursor: 'pointer' },
  allToolsCardContent: { padding: '32px 24px', textAlign: 'center', color: '#fff' },
  allToolsIcon: { fontSize: '48px', marginBottom: '16px' },
  allToolsTitle: { fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#fff' },
  allToolsDesc: { fontSize: '14px', opacity: 0.9, marginBottom: '20px', color: '#fff' },
  yellowBtn: { background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: '#78350f', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(251,191,36,0.3)', width: '100%' },
  yellowBtnSmall: { background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: '#78350f', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  recentList: { background: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  recentItem: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', transition: 'background 0.2s', cursor: 'pointer' },
  recentIcon: { fontSize: '32px' },
  recentInfo: { flex: 1, minWidth: 0 },
  recentTitle: { fontSize: '15px', fontWeight: '600', color: '#0f172a', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  recentMeta: { fontSize: '13px', color: '#94a3b8' },
  quickActionBtn: { background: 'transparent', border: '1px solid #e2e8f0', color: '#3b82f6', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  pageHeader: { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' },
  backBtn: { background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' },
  pageTitle: { fontSize: '28px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' },
  pageSubtitle: { fontSize: '14px', color: '#64748b' },
  searchBar: { display: 'flex', gap: '12px', marginBottom: '32px' },
  searchInput: { flex: 1, padding: '14px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' },
  searchBtn: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '12px', fontSize: '18px', cursor: 'pointer' },
  filesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' },
  fileCard: { background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.3s ease', cursor: 'pointer', border: '2px solid transparent' },
  fileCardActive: { borderColor: '#3b82f6', boxShadow: '0 8px 16px rgba(59,130,246,0.2)' },
  fileCardHeader: { position: 'relative' },
  filePreview: { height: '160px', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  filePreviewIcon: { fontSize: '48px' },
  favBtn: { position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.9)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  fileCardBody: { padding: '16px' },
  fileCardTitle: { fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  fileCardMeta: { fontSize: '13px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  fileCardFooter: { padding: '12px 16px', borderTop: '1px solid #f1f5f9' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
  modalContent: { background: '#fff', borderRadius: '20px', width: '90vw', maxWidth: '1400px', height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', minHeight: '50px' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: '#0f172a', flex: 1, marginRight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  modalHeaderButtons: { display: 'flex', gap: '8px', alignItems: 'center' },
  iconBtn: { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalClose: { background: 'transparent', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '8px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  zoomBtn: { background: '#1e293b', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '8px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', lineHeight: 1 },
  zoomLabel: { fontSize: '13px', fontWeight: '600', color: '#475569', minWidth: '42px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' },
  modalDivider: { width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' },
  modalBody: { flex: 1, overflow: 'hidden' },
  pdfViewer: { width: '100%', height: '100%', border: 'none' },
  loadingState: { gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#94a3b8', fontSize: '16px' },
  emptyState: { gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: '64px', marginBottom: '16px' },
  emptyText: { color: '#94a3b8', fontSize: '16px' }
};
