
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
  
  const loadFiles = useCallback(async (folderId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${folderId}`);
      const data = await res.json();
      setFiles(data.files || []);
      
      // Update stats
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
    // Don't change view, just open the modal
  };
  
  const openAllTools = async () => {
    setActiveView('allTools');
    setCurrentFolder(null);
    setCurrentFile(null);
    // Reload tools to get any new ones
    await loadTools();
  };
  
  const goHome = () => {
    setActiveView('home');
    setCurrentFolder(null);
    setCurrentFile(null);
    setCurrentTool(null);
  };
  
  const openFile = (file) => {
    setCurrentFile(file);
    // If we're in home view and don't have a folder open, we need to determine which folder this file belongs to
    // For now, we'll just set the file - the modal will open in any view
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
  
  if (status === 'loading') {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner}></div>
        <div style={styles.loadingText}>Φόρτωση ΛΕΒΙΑΘΑΝ Cloud...</div>
      </div>
    );
  }
  
  if (!session) return null;
  
  return (
    <div style={styles.app}>
      {/* Sidebar */}
      <aside style={{...styles.sidebar, width: sidebarCollapsed ? '70px' : '260px'}}>
        <div style={styles.sidebarHeader}>
          {!sidebarCollapsed && (
            <div style={styles.logo}>
              <span style={styles.logoIcon}>🐋</span>
              <span style={styles.logoText}>ΛΕΒΙΑΘΑΝ</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={styles.collapseBtn}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        
        <nav style={styles.nav}>
          <button 
            onClick={goHome}
            style={{...styles.navItem, ...(activeView === 'home' ? styles.navItemActive : {})}}
          >
            <span style={styles.navIcon}>🏠</span>
            {!sidebarCollapsed && <span>Αρχική</span>}
          </button>
          
          <button 
            style={{...styles.navItem, ...(favorites.length > 0 ? {} : {opacity: 0.5})}}
          >
            <span style={styles.navIcon}>⭐</span>
            {!sidebarCollapsed && <span>Αγαπημένα</span>}
            {!sidebarCollapsed && favorites.length > 0 && (
              <span style={styles.badge}>{favorites.length}</span>
            )}
          </button>
          
          <div style={styles.navDivider}></div>
          
          <div style={styles.navSection}>
            {!sidebarCollapsed && <div style={styles.navSectionTitle}>ΠΕΡΙΕΧΟΜΕΝΟ</div>}
            {Object.entries(FOLDERS).map(([id, folder]) => (
              <button 
                key={id}
                onClick={() => openFolder(id)}
                style={{
                  ...styles.navItem, 
                  ...(currentFolder === id ? styles.navItemActive : {})
                }}
              >
                <span style={styles.navIcon}>{folder.icon}</span>
                {!sidebarCollapsed && <span>{folder.name}</span>}
              </button>
            ))}
          </div>
          
          {tools.length > 0 && (
            <>
              <div style={styles.navDivider}></div>
              <div style={styles.navSection}>
                {!sidebarCollapsed && <div style={styles.navSectionTitle}>ΕΡΓΑΛΕΙΑ</div>}
                {tools.slice(0, 5).map((tool) => (
                  <button 
                    key={tool.file}
                    onClick={() => openTool(tool)}
                    style={{
                      ...styles.navItem,
                      ...(currentTool?.file === tool.file ? styles.navItemActive : {})
                    }}
                  >
                    <span style={styles.navIcon}>{tool.icon || '🔧'}</span>
                    {!sidebarCollapsed && <span>{tool.name}</span>}
                  </button>
                ))}
                {tools.length > 5 && (
                  <button 
                    onClick={openAllTools}
                    style={{
                      ...styles.navItem,
                      ...(activeView === 'allTools' ? styles.navItemActive : {})
                    }}
                  >
                    <span style={styles.navIcon}>📋</span>
                    {!sidebarCollapsed && <span>Όλα τα Εργαλεία</span>}
                  </button>
                )}
              </div>
            </>
          )}
        </nav>
        
        <div style={styles.sidebarFooter}>
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>
              {session.user?.email?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div style={styles.userInfo}>
                <div style={styles.userName}>
                  {session.user?.email?.split('@')[0]}
                </div>
                <button onClick={() => signOut()} style={styles.logoutLink}>
                  Αποσύνδεση
                </button>
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
                <div>
                  <h1 style={styles.welcomeTitle}>
                    Γεια σου, {session.user?.email?.split('@')[0]}! 👋
                  </h1>
                  <p style={styles.welcomeSubtitle}>
                    Ας συνεχίσουμε από εκεί που σταματήσαμε
                  </p>
                </div>
              </div>
              
              {/* Stats Cards */}
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statCardContent}>
                    <div>
                      <div style={styles.statLabel}>Συνολικά Αρχεία</div>
                      <div style={styles.statValue}>{stats.total}</div>
                      <div style={styles.statSubtext}>Σε όλους τους φακέλους</div>
                    </div>
                    <div style={{...styles.statIcon, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
                      📊
                    </div>
                  </div>
                </div>
                
                <div style={styles.statCard}>
                  <div style={styles.statCardContent}>
                    <div>
                      <div style={styles.statLabel}>Ολοκληρωμένα</div>
                      <div style={styles.statValue}>{stats.completed}</div>
                      <div style={styles.statSubtext}>Επεξεργασμένα αρχεία</div>
                    </div>
                    <div style={{...styles.statIcon, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
                      ✅
                    </div>
                  </div>
                </div>
                
                <div style={styles.statCard}>
                  <div style={styles.statCardContent}>
                    <div>
                      <div style={styles.statLabel}>Σε Εξέλιξη</div>
                      <div style={styles.statValue}>{stats.inProgress}</div>
                      <div style={styles.statSubtext}>Ενεργά έργα</div>
                    </div>
                    <div style={{...styles.statIcon, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'}}>
                      ⏳
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Folders Section */}
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Φάκελοι Περιεχομένου</h2>
                <div style={styles.cardsGrid}>
                  {Object.entries(FOLDERS).map(([id, folder]) => (
                    <div 
                      key={id} 
                      style={styles.folderCard}
                      onClick={() => openFolder(id)}
                    >
                      <div style={styles.folderCardHeader}>
                        <div style={{...styles.folderIconLarge, background: folder.color}}>
                          {folder.icon}
                        </div>
                        <button style={styles.moreBtn}>⋮</button>
                      </div>
                      <h3 style={styles.folderCardTitle}>{folder.name}</h3>
                      <p style={styles.folderCardDesc}>{folder.desc}</p>
                      <div style={styles.folderCardFooter}>
                        <span style={styles.folderCardStat}>
                          📄 {files.length} αρχεία
                        </span>
                        <button style={styles.viewDetailsBtn}>
                          Προβολή <span style={{marginLeft: '4px'}}>→</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              
              {/* Popular Tools */}
              {tools.length > 0 && (
                <section style={styles.section}>
                  <h2 style={styles.sectionTitle}>Δημοφιλή Εργαλεία</h2>
                  <div style={styles.cardsGrid}>
                    {tools.slice(0, 3).map((tool) => (
                      <div 
                        key={tool.file}
                        style={styles.toolCard}
                        onClick={() => openTool(tool)}
                      >
                        <div style={styles.toolCardAccent}></div>
                        <div style={styles.toolCardContent}>
                          <div style={styles.toolIconWrapper}>
                            <span style={styles.toolIcon}>{tool.icon || '🔧'}</span>
                          </div>
                          <h3 style={styles.toolCardTitle}>{tool.name}</h3>
                          <p style={styles.toolCardDesc}>
                            Διαδραστικό εργαλείο για εκπαιδευτική χρήση
                          </p>
                          <button style={styles.yellowBtn}>
                            Εκκίνηση →
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* All Tools Card */}
                    {tools.length > 3 && (
                      <div 
                        style={styles.allToolsCard}
                        onClick={openAllTools}
                      >
                        <div style={styles.allToolsCardContent}>
                          <div style={styles.allToolsIcon}>🔧</div>
                          <h3 style={styles.allToolsTitle}>
                            Όλα τα Εργαλεία
                          </h3>
                          <p style={styles.allToolsDesc}>
                            Δες όλα τα {tools.length} διαθέσιμα εργαλεία
                          </p>
                          <button style={styles.yellowBtn}>
                            Προβολή Όλων →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
              
              {/* Recent Files */}
              {recentFiles.length > 0 && (
                <section style={styles.section}>
                  <h2 style={styles.sectionTitle}>Πρόσφατα Αρχεία</h2>
                  <div style={styles.recentList}>
                    {recentFiles.map((file) => (
                      <div 
                        key={file.id}
                        style={styles.recentItem}
                      >
                        <div style={styles.recentIcon}>📄</div>
                        <div style={styles.recentInfo}>
                          <div style={styles.recentTitle}>{file.title}</div>
                          <div style={styles.recentMeta}>{file.name}</div>
                        </div>
                        <button 
                          onClick={() => openFile(file)}
                          style={styles.quickActionBtn}
                        >
                          Άνοιγμα →
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          
          {/* Folder View */}
          {activeView === 'folder' && currentFolder && (
            <>
              <div style={styles.pageHeader}>
                <button onClick={goHome} style={styles.backBtn}>
                  ← Πίσω
                </button>
                <div>
                  <h1 style={styles.pageTitle}>
                    {FOLDERS[currentFolder].icon} {FOLDERS[currentFolder].name}
                  </h1>
                  <p style={styles.pageSubtitle}>
                    {filteredFiles.length} {filteredFiles.length === 1 ? 'αρχείο' : 'αρχεία'}
                  </p>
                </div>
              </div>
              
              <div style={styles.searchBar}>
                <input 
                  type="search"
                  placeholder="Αναζήτηση αρχείων..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
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
                    <div 
                      key={file.id}
                      style={{
                        ...styles.fileCard,
                        ...(currentFile?.id === file.id ? styles.fileCardActive : {})
                      }}
                      onClick={() => openFile(file)}
                    >
                      <div style={styles.fileCardHeader}>
                        <div style={styles.filePreview}>
                          <span style={styles.filePreviewIcon}>📄</span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }}
                          style={styles.favBtn}
                        >
                          {favorites.some(f => f.id === file.id) ? '⭐' : '☆'}
                        </button>
                      </div>
                      <div style={styles.fileCardBody}>
                        <h3 style={styles.fileCardTitle}>{file.title}</h3>
                        <p style={styles.fileCardMeta}>{file.name}</p>
                      </div>
                      <div style={styles.fileCardFooter}>
                        <button style={styles.yellowBtnSmall}>
                          Προβολή →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          
          {/* Tool View - Removed, tools now open in modal */}
          
          {/* All Tools View */}
          {activeView === 'allTools' && (
            <>
              <div style={styles.pageHeader}>
                <button onClick={goHome} style={styles.backBtn}>
                  ← Πίσω
                </button>
                <div>
                  <h1 style={styles.pageTitle}>
                    🔧 Όλα τα Εργαλεία
                  </h1>
                  <p style={styles.pageSubtitle}>
                    {filteredTools.length} {filteredTools.length === 1 ? 'εργαλείο' : 'εργαλεία'}
                  </p>
                </div>
              </div>
              
              <div style={styles.searchBar}>
                <input 
                  type="search"
                  placeholder="Αναζήτηση εργαλείων..."
                  value={toolsSearchQuery}
                  onChange={(e) => setToolsSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
                <button style={styles.searchBtn}>🔍</button>
              </div>
              
              <div style={styles.filesGrid}>
                {filteredTools.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>🔍</div>
                    <div style={styles.emptyText}>Δεν βρέθηκαν εργαλεία</div>
                  </div>
                ) : (
                  filteredTools.map(tool => (
                    <div 
                      key={tool.file}
                      style={styles.toolCard}
                      onClick={() => openTool(tool)}
                    >
                      <div style={styles.toolCardAccent}></div>
                      <div style={styles.toolCardContent}>
                        <div style={styles.toolIconWrapper}>
                          <span style={styles.toolIcon}>{tool.icon || '🔧'}</span>
                        </div>
                        <h3 style={styles.toolCardTitle}>{tool.name}</h3>
                        <p style={styles.toolCardDesc}>
                          Διαδραστικό εργαλείο για εκπαιδευτική χρήση
                        </p>
                        <button style={styles.yellowBtnSmall}>
                          Εκκίνηση →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
      
      {/* File Preview Modal - Global */}
      {currentFile && (
        <div style={styles.modal} onClick={() => setCurrentFile(null)}>
          <div 
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{currentFile.title}</h2>
              <button 
                onClick={() => setCurrentFile(null)}
                style={styles.modalClose}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <iframe 
                src={`/api/files/pdf/${currentFile.id}`}
                style={styles.pdfViewer}
                title="PDF Viewer"
              />
            </div>
            <div style={styles.modalFooter}>
              <button 
                onClick={() => window.open(`/api/files/pdf/${currentFile.id}`, '_blank')}
                style={styles.openBtn}
              >
                ↗ Άνοιγμα σε νέα καρτέλα
              </button>
              <button 
                onClick={() => {
                  const printWindow = window.open(`/api/files/pdf/${currentFile.id}`, '_blank');
                  if (printWindow) {
                    printWindow.onload = () => printWindow.print();
                  }
                }}
                style={styles.yellowBtn}
              >
                🖨️ Εκτύπωση
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Tool Viewer Modal - Global */}
      {currentTool && !currentFile && (
        <div style={styles.modal} onClick={() => setCurrentTool(null)}>
          <div 
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {currentTool.icon || '🔧'} {currentTool.name}
              </h2>
              <button 
                onClick={() => setCurrentTool(null)}
                style={styles.modalClose}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <iframe 
                src={`/tools/${currentTool.file}`}
                style={styles.pdfViewer}
                title={currentTool.name}
              />
            </div>
            <div style={styles.modalFooter}>
              <button 
                onClick={() => window.open(`/tools/${currentTool.file}`, '_blank')}
                style={styles.openBtn}
              >
                ↗ Άνοιγμα σε νέα σελίδα
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  // Loading
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  loadingText: {
    fontSize: '18px',
    fontWeight: '500'
  },
  
  // App Layout
  app: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  
  // Sidebar
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    background: '#1e293b',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s ease',
    zIndex: 100,
    boxShadow: '4px 0 24px rgba(0,0,0,0.1)'
  },
  sidebarHeader: {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoIcon: {
    fontSize: '28px'
  },
  logoText: {
    fontSize: '20px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  collapseBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#e2e8f0',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  
  // Navigation
  nav: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto'
  },
  navItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '12px',
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '4px',
    textAlign: 'left'
  },
  navItemActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(102,126,234,0.4)'
  },
  navIcon: {
    fontSize: '20px',
    flexShrink: 0
  },
  badge: {
    marginLeft: 'auto',
    background: '#ef4444',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '12px'
  },
  navDivider: {
    height: '1px',
    background: 'rgba(255,255,255,0.1)',
    margin: '16px 0'
  },
  navSection: {
    marginBottom: '16px'
  },
  navSectionTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    padding: '8px 16px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  
  // Sidebar Footer
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px'
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    flexShrink: 0
  },
  userInfo: {
    flex: 1,
    minWidth: 0
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#e2e8f0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  logoutLink: {
    fontSize: '12px',
    color: '#94a3b8',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  
  // Main Content
  main: {
    flex: 1,
    transition: 'margin-left 0.3s ease'
  },
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '40px',
    paddingTop: '24px'
  },
  
  // Welcome Section
  welcomeSection: {
    marginBottom: '32px'
  },
  welcomeTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px'
  },
  welcomeSubtitle: {
    fontSize: '16px',
    color: '#64748b'
  },
  
  // Stats Cards
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  },
  statCard: {
    background: '#fff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.02)',
    transition: 'all 0.3s ease'
  },
  statCardContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  statLabel: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '500',
    marginBottom: '8px'
  },
  statValue: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '4px'
  },
  statSubtext: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  statIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
  },
  
  // Section
  section: {
    marginBottom: '48px'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '24px'
  },
  
  // Cards Grid
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px'
  },
  
  // Folder Card
  folderCard: {
    background: '#fff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    border: '2px solid transparent'
  },
  folderCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  folderIconLarge: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
  },
  moreBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '20px',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px'
  },
  folderCardTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: '8px'
  },
  folderCardDesc: {
    fontSize: '14px',
    color: '#64748b',
    lineHeight: '1.6',
    marginBottom: '20px'
  },
  folderCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9'
  },
  folderCardStat: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '500'
  },
  viewDetailsBtn: {
    background: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  
  // Tool Card
  toolCard: {
    position: 'relative',
    background: '#fff',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  toolCardAccent: {
    height: '4px',
    background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)'
  },
  toolCardContent: {
    padding: '24px'
  },
  toolIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px'
  },
  toolIcon: {
    fontSize: '28px'
  },
  toolCardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: '8px'
  },
  toolCardDesc: {
    fontSize: '14px',
    color: '#64748b',
    lineHeight: '1.6',
    marginBottom: '20px'
  },
  
  // All Tools Card
  allToolsCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 8px 16px rgba(102,126,234,0.3)',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  allToolsCardContent: {
    padding: '32px 24px',
    textAlign: 'center',
    color: '#fff'
  },
  allToolsIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  allToolsTitle: {
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#fff'
  },
  allToolsDesc: {
    fontSize: '14px',
    opacity: 0.9,
    marginBottom: '20px',
    color: '#fff'
  },
  
  // Yellow Button
  yellowBtn: {
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    color: '#78350f',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(251,191,36,0.3)',
    width: '100%'
  },
  openBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
    marginRight: '12px'
  },
  yellowBtnSmall: {
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    color: '#78350f',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  
  // Recent List
  recentList: {
    background: '#fff',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    borderRadius: '12px',
    transition: 'background 0.2s',
    cursor: 'pointer'
  },
  recentIcon: {
    fontSize: '32px'
  },
  recentInfo: {
    flex: 1,
    minWidth: 0
  },
  recentTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  recentMeta: {
    fontSize: '13px',
    color: '#94a3b8'
  },
  quickActionBtn: {
    background: 'transparent',
    border: '1px solid #e2e8f0',
    color: '#3b82f6',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  
  // Page Header
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '32px'
  },
  backBtn: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '4px'
  },
  pageSubtitle: {
    fontSize: '14px',
    color: '#64748b'
  },
  
  // Search Bar
  searchBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px'
  },
  searchInput: {
    flex: 1,
    padding: '14px 20px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  searchBtn: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '18px',
    cursor: 'pointer'
  },
  
  // Files Grid
  filesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px'
  },
  
  // File Card
  fileCard: {
    background: '#fff',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    border: '2px solid transparent'
  },
  fileCardActive: {
    borderColor: '#3b82f6',
    boxShadow: '0 8px 16px rgba(59,130,246,0.2)'
  },
  fileCardHeader: {
    position: 'relative'
  },
  filePreview: {
    height: '160px',
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  filePreviewIcon: {
    fontSize: '48px'
  },
  favBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(255,255,255,0.9)',
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    fontSize: '18px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  fileCardBody: {
    padding: '16px'
  },
  fileCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: '6px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  fileCardMeta: {
    fontSize: '13px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  fileCardFooter: {
    padding: '12px 16px',
    borderTop: '1px solid #f1f5f9'
  },
  
  // Modal
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '20px'
  },
  modalContent: {
    background: '#fff',
    borderRadius: '20px',
    width: '90vw',
    maxWidth: '1400px',
    height: '92vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#0f172a'
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#94a3b8',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    transition: 'all 0.2s'
  },
  modalBody: {
    flex: 1,
    overflow: 'hidden'
  },
  pdfViewer: {
    width: '100%',
    height: '100%',
    border: 'none'
  },
  modalFooter: {
    padding: '20px 24px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  
  // Tool Container
  toolContainer: {
    background: '#fff',
    borderRadius: '20px',
    overflow: 'hidden',
    height: 'calc(100vh - 200px)',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
  },
  toolFrame: {
    width: '100%',
    height: '100%',
    border: 'none'
  },
  
  // Empty/Loading States
  loadingState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    color: '#94a3b8',
    fontSize: '16px'
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: '16px'
  }
};
