import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';

const FOLDERS = {
  keimena: { name: 'Κείμενα', icon: '📚', color: '#3b82f6' },
  biblia: { name: 'Βιβλία', icon: '📖', color: '#8b5cf6' }
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [currentFolder, setCurrentFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [darkMode, setDarkMode] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tools, setTools] = useState([]);
  const [currentTool, setCurrentTool] = useState(null);
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  useEffect(() => {
    const savedNotes = localStorage.getItem('leviathan-notes');
    const savedFavorites = localStorage.getItem('leviathan-favorites');
    const savedDarkMode = localStorage.getItem('leviathan-darkmode');
    
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedDarkMode === 'true') setDarkMode(true);
    
    loadTools();
  }, []);
  
  useEffect(() => {
    localStorage.setItem('leviathan-notes', JSON.stringify(notes));
  }, [notes]);
  
  useEffect(() => {
    localStorage.setItem('leviathan-favorites', JSON.stringify(favorites));
  }, [favorites]);
  
  useEffect(() => {
    localStorage.setItem('leviathan-darkmode', darkMode.toString());
  }, [darkMode]);
  
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
    } catch (error) {
      console.error('Error loading files:', error);
      setFiles([]);
    }
    setLoading(false);
  }, []);
  
  const openFolder = (folderId) => {
    setCurrentFolder(folderId);
    setCurrentFile(null);
    setCurrentTool(null);
    setShowNotes(false);
    loadFiles(folderId);
  };
  
  const closeFolder = () => {
    setCurrentFolder(null);
    setCurrentFile(null);
    setFiles([]);
    setHistory([]);
    setHistoryIndex(-1);
  };
  
  const openTool = (tool) => {
    setCurrentTool(tool);
    setCurrentFolder(null);
    setCurrentFile(null);
  };
  
  const closeTool = () => {
    setCurrentTool(null);
  };
  
  const openFile = (file, fromNav = false) => {
    setCurrentFile(file);
    setShowNotes(false);
    if (!fromNav) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ folder: currentFolder, file });
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };
  
  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const entry = history[newIndex];
      if (entry.folder !== currentFolder) {
        setCurrentFolder(entry.folder);
        loadFiles(entry.folder);
      }
      setCurrentFile(entry.file);
    }
  };
  
  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const entry = history[newIndex];
      if (entry.folder !== currentFolder) {
        setCurrentFolder(entry.folder);
        loadFiles(entry.folder);
      }
      setCurrentFile(entry.file);
    }
  };
  
  const toggleFavorite = (fileId) => {
    setFavorites(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };
  
  const updateNotes = (fileId, text) => {
    setNotes(prev => ({ ...prev, [fileId]: text }));
  };
  
  const filteredFiles = files
    .filter(f => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return f.title.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.title.localeCompare(b.title, 'el');
        case 'name-desc': return b.title.localeCompare(a.title, 'el');
        case 'date': return new Date(a.modified) - new Date(b.modified);
        case 'date-desc': return new Date(b.modified) - new Date(a.modified);
        default: return 0;
      }
    });
  
  if (status === 'loading') {
    return <div style={styles.loading}>Φόρτωση...</div>;
  }
  
  if (!session) {
    return null;
  }
  
  const theme = darkMode ? darkTheme : lightTheme;
  
  return (
    <div style={{...styles.desktop, ...theme.desktop}}>
      {/* Main content area */}
      <div style={styles.mainArea}>
        {/* Welcome Section */}
        <div style={styles.welcomeSection}>
          <h1 style={{...styles.welcomeTitle, ...theme.text}}>
            Καλώς ήρθες, {session.user?.email?.split('@')[0]}! 👋
          </h1>
          <p style={styles.welcomeSubtitle}>
            Επίλεξε φάκελο ή εργαλείο για να ξεκινήσεις
          </p>
        </div>
        
        {/* Folders row */}
        <div style={styles.foldersRow}>
          {Object.entries(FOLDERS).map(([id, folder]) => (
            <div 
              key={id}
              style={{...styles.folderCard, ...theme.card}}
              onClick={() => openFolder(id)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-8px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{...styles.cardIconBg, background: folder.color}}>
                <div style={styles.cardIcon}>{folder.icon}</div>
              </div>
              <div style={styles.cardContent}>
                <h3 style={{...styles.cardTitle, ...theme.text}}>{folder.name}</h3>
                <p style={styles.cardDesc}>Εκπαιδευτικό υλικό και αρχεία</p>
                <div style={styles.cardFooter}>
                  <button style={styles.yellowBtn}>
                    Άνοιγμα →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Tools section */}
        {tools.length > 0 && (
          <div style={styles.toolsSection}>
            <h2 style={{...styles.sectionTitle, ...theme.text}}>🔧 Διαθέσιμα Εργαλεία</h2>
            <div style={styles.toolsGrid}>
              {tools.map((tool) => (
                <div 
                  key={tool.file}
                  style={{...styles.toolCard, ...theme.card}}
                  onClick={() => openTool(tool)}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={styles.toolCardAccent}></div>
                  <div style={styles.toolCardContent}>
                    <div style={styles.toolIconWrapper}>
                      <span style={styles.toolIcon}>{tool.icon || '🔧'}</span>
                    </div>
                    <h4 style={{...styles.toolCardTitle, ...theme.text}}>{tool.name}</h4>
                    <button style={styles.yellowBtnSmall}>
                      Εκκίνηση →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Logo */}
      <div style={styles.logoArea}>
        <img src="/logo.png" alt="ΛΕΒΙΑΘΑΝ" style={{width: '180px', height: 'auto'}} />
        <div style={styles.version}>Cloud Edition</div>
      </div>
      
      {/* Footer */}
      <div style={{...styles.footer, ...theme.footer}}>
        <div style={{...styles.footerUser, ...theme.text}}>
          Συνδεδεμένος: <span style={styles.footerEmail}>{session.user?.email}</span>
          <button onClick={() => signOut()} style={styles.logoutBtn}>Αποσύνδεση</button>
        </div>
        <button 
          onClick={() => setDarkMode(!darkMode)} 
          style={styles.darkModeBtn}
          title={darkMode ? 'Φωτεινό θέμα' : 'Σκοτεινό θέμα'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      
      {/* Tool Viewer Window */}
      {currentTool && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && closeTool()}>
          <div style={{...styles.window, ...theme.window}}>
            <div style={{...styles.titlebar, ...theme.titlebar}}>
              <div style={styles.titleLeft}>
                <span style={styles.titleIcon}>{currentTool.icon || '🔧'}</span>
                <span style={{...styles.titleText, ...theme.text}}>{currentTool.name}</span>
              </div>
              <div style={styles.controls}>
                <button 
                  onClick={() => window.open(`/tools/${currentTool.file}`, '_blank')} 
                  style={{...styles.controlBtn, ...theme.controlBtn}}
                  title="Άνοιγμα σε νέα καρτέλα"
                >↗</button>
                <button 
                  onClick={closeTool} 
                  style={{...styles.controlBtn, ...styles.closeBtn}}
                >✕</button>
              </div>
            </div>
            <div style={styles.toolBody}>
              <iframe 
                src={`/tools/${currentTool.file}`}
                style={styles.toolFrame}
                title={currentTool.name}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* File Manager Window */}
      {currentFolder && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && closeFolder()}>
          <div style={{...styles.window, ...theme.window}}>
            <div style={{...styles.titlebar, ...theme.titlebar}}>
              <div style={styles.titleLeft}>
                <span style={styles.titleIcon}>{FOLDERS[currentFolder]?.icon}</span>
                <span style={{...styles.titleText, ...theme.text}}>{FOLDERS[currentFolder]?.name}</span>
                <span style={styles.fileCount}>{files.length} αρχεία</span>
              </div>
              <div style={styles.controls}>
                <button 
                  onClick={() => loadFiles(currentFolder)} 
                  style={{...styles.controlBtn, ...theme.controlBtn}}
                  title="Ανανέωση"
                >🔄</button>
                <button 
                  onClick={closeFolder} 
                  style={{...styles.controlBtn, ...styles.closeBtn}}
                >✕</button>
              </div>
            </div>
            
            <div style={styles.content}>
              <div style={{...styles.list, ...theme.panel}}>
                <div style={{...styles.listHeader, ...theme.listHeader}}>
                  <input 
                    type="search"
                    placeholder="🔍 Αναζήτηση..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{...styles.search, ...theme.input}}
                  />
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{...styles.select, ...theme.input}}
                  >
                    <option value="name">Όνομα ↑</option>
                    <option value="name-desc">Όνομα ↓</option>
                    <option value="date">Χρόνος ↑</option>
                    <option value="date-desc">Χρόνος ↓</option>
                  </select>
                </div>
                
                <div style={styles.listArea}>
                  {loading ? (
                    <div style={styles.loadingSmall}>
                      <div style={styles.spinner}></div>
                      <div>Φόρτωση αρχείων...</div>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div style={styles.empty}>
                      <div style={styles.emptyIcon}>📭</div>
                      <div>Δεν βρέθηκαν αρχεία</div>
                    </div>
                  ) : (
                    filteredFiles.map(file => (
                      <div 
                        key={file.id}
                        style={{
                          ...styles.row,
                          ...theme.row,
                          ...(currentFile?.id === file.id ? styles.rowActive : {})
                        }}
                        onClick={() => openFile(file)}
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(file.id); }}
                          style={{
                            ...styles.starBtn,
                            color: favorites.includes(file.id) ? '#fbbf24' : '#94a3b8'
                          }}
                        >
                          {favorites.includes(file.id) ? '⭐' : '☆'}
                        </button>
                        <span style={styles.fileIcon}>📄</span>
                        <div style={styles.fileInfo}>
                          <div style={{...styles.fileName, ...theme.text}}>{file.title}</div>
                          <div style={styles.fileMeta}>{file.name}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div style={{...styles.preview, ...theme.panel}}>
                <div style={{...styles.previewHeader, ...theme.listHeader}}>
                  <div>
                    <div style={{...styles.previewTitle, ...theme.text}}>
                      {currentFile?.title || 'Προβολή PDF'}
                    </div>
                    <div style={styles.previewSub}>
                      {currentFile?.name || 'Επιλέξτε ένα αρχείο από τη λίστα'}
                    </div>
                  </div>
                  <div style={styles.previewBtns}>
                    <button 
                      onClick={goBack} 
                      disabled={historyIndex <= 0} 
                      style={{
                        ...styles.navBtn, 
                        ...theme.controlBtn,
                        opacity: historyIndex <= 0 ? 0.3 : 1,
                        cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
                      }}
                      title="Προηγούμενο"
                    >◀</button>
                    <button 
                      onClick={goForward} 
                      disabled={historyIndex >= history.length - 1} 
                      style={{
                        ...styles.navBtn, 
                        ...theme.controlBtn,
                        opacity: historyIndex >= history.length - 1 ? 0.3 : 1,
                        cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer'
                      }}
                      title="Επόμενο"
                    >▶</button>
                    <button 
                      onClick={() => setShowNotes(!showNotes)} 
                      disabled={!currentFile} 
                      style={{
                        ...styles.navBtn, 
                        ...theme.controlBtn,
                        background: showNotes ? '#fbbf24' : undefined,
                        opacity: !currentFile ? 0.3 : 1,
                        cursor: !currentFile ? 'not-allowed' : 'pointer'
                      }}
                      title="Σημειώσεις"
                    >📝</button>
                    <button 
                      onClick={() => currentFile && window.open(`/api/files/pdf/${currentFile.id}`, '_blank')} 
                      disabled={!currentFile} 
                      style={{
                        ...styles.printBtn,
                        opacity: !currentFile ? 0.3 : 1,
                        cursor: !currentFile ? 'not-allowed' : 'pointer'
                      }}
                      title="Εκτύπωση / Νέα καρτέλα"
                    >🖨️</button>
                  </div>
                </div>
                
                <div style={styles.previewBody}>
                  {currentFile ? (
                    <iframe src={`/api/files/pdf/${currentFile.id}`} style={styles.pdfFrame} title="PDF Viewer" />
                  ) : (
                    <div style={styles.placeholder}>
                      <div style={styles.placeholderIcon}>📄</div>
                      <div style={styles.placeholderText}>Επιλέξτε ένα αρχείο PDF</div>
                      <div style={styles.placeholderHint}>Κάντε κλικ σε ένα αρχείο από τη λίστα για προβολή</div>
                    </div>
                  )}
                </div>
                
                {showNotes && currentFile && (
                  <div style={{...styles.notesPanel, ...theme.panel}}>
                    <div style={{...styles.notesHeader, ...theme.listHeader}}>
                      <span style={{...styles.notesTitle, ...theme.text}}>📝 Σημειώσεις</span>
                      <button 
                        onClick={() => setShowNotes(false)} 
                        style={{...styles.controlBtn, ...theme.controlBtn}}
                      >✕</button>
                    </div>
                    <textarea 
                      value={notes[currentFile.id] || ''}
                      onChange={(e) => updateNotes(currentFile.id, e.target.value)}
                      placeholder="Προσθέστε τις σημειώσεις σας εδώ..."
                      style={{...styles.notesTextarea, ...theme.input}}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lightTheme = {
  desktop: { background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #dbeafe 100%)' },
  window: { background: '#ffffff', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' },
  panel: { background: '#f8fafc', border: '1px solid #e2e8f0' },
  titlebar: { background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderBottom: '1px solid #e2e8f0' },
  listHeader: { background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' },
  text: { color: '#0f172a' },
  card: { background: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.07), 0 10px 20px rgba(0,0,0,0.05)' },
  controlBtn: { background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)', color: '#0f172a', border: '1px solid #cbd5e1' },
  input: { background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' },
  row: { },
  footer: { background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0' }
};

const darkTheme = {
  desktop: { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' },
  window: { background: '#1e293b', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' },
  panel: { background: '#334155', border: '1px solid #475569' },
  titlebar: { background: 'linear-gradient(180deg, #334155 0%, #1e293b 100%)', borderBottom: '1px solid #475569' },
  listHeader: { background: '#475569', borderBottom: '1px solid #64748b' },
  text: { color: '#f1f5f9' },
  card: { background: '#1e293b', boxShadow: '0 4px 6px rgba(0,0,0,0.3), 0 10px 20px rgba(0,0,0,0.2)' },
  controlBtn: { background: 'linear-gradient(180deg, #475569 0%, #334155 100%)', color: '#f1f5f9', border: '1px solid #64748b' },
  input: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #475569' },
  row: { },
  footer: { background: 'rgba(30,41,59,0.95)', backdropFilter: 'blur(10px)', color: '#f1f5f9', borderTop: '1px solid #334155' }
};

const styles = {
  desktop: { 
    minHeight: '100vh', 
    position: 'relative', 
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif', 
    paddingBottom: '70px',
    transition: 'background 0.3s ease'
  },
  mainArea: { 
    padding: '40px 50px', 
    maxWidth: '1400px', 
    margin: '0 auto' 
  },
  
  // Welcome Section
  welcomeSection: {
    marginBottom: '40px'
  },
  welcomeTitle: {
    fontSize: '36px',
    fontWeight: '700',
    marginBottom: '8px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  welcomeSubtitle: {
    fontSize: '16px',
    color: '#64748b'
  },
  
  // Folders
  foldersRow: { 
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px', 
    marginBottom: '50px' 
  },
  folderCard: {
    borderRadius: '20px',
    padding: '0',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
    border: '2px solid transparent'
  },
  cardIconBg: {
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  cardIcon: {
    fontSize: '56px',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
  },
  cardContent: {
    padding: '24px'
  },
  cardTitle: {
    fontSize: '22px',
    fontWeight: '700',
    marginBottom: '8px'
  },
  cardDesc: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '20px',
    lineHeight: '1.6'
  },
  cardFooter: {
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0'
  },
  
  // Tools Section
  toolsSection: { 
    marginTop: '24px' 
  },
  sectionTitle: {
    fontSize: '26px',
    fontWeight: '700',
    marginBottom: '24px'
  },
  toolsGrid: { 
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '20px' 
  },
  toolCard: {
    borderRadius: '16px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '2px solid transparent'
  },
  toolCardAccent: {
    height: '6px',
    background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)'
  },
  toolCardContent: {
    padding: '20px'
  },
  toolIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 4px 12px rgba(251,191,36,0.2)'
  },
  toolIcon: {
    fontSize: '28px'
  },
  toolCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px'
  },
  
  // Buttons
  yellowBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    color: '#78350f',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(251,191,36,0.3)'
  },
  yellowBtnSmall: {
    width: '100%',
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    color: '#78350f',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  
  // Logo
  logoArea: { 
    position: 'fixed', 
    bottom: '90px', 
    right: '50px', 
    textAlign: 'center', 
    zIndex: 10,
    opacity: 0.9
  },
  version: { 
    fontSize: '12px', 
    color: '#94a3b8', 
    marginTop: '8px',
    fontWeight: '500'
  },
  
  // Footer
  footer: { 
    position: 'fixed', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: '16px 30px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    fontSize: '13px',
    zIndex: 50,
    boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
  },
  footerUser: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  footerEmail: {
    fontWeight: '600'
  },
  logoutBtn: { 
    background: 'none', 
    border: 'none', 
    color: '#3b82f6', 
    cursor: 'pointer', 
    textDecoration: 'underline',
    fontWeight: '500',
    fontSize: '13px'
  },
  darkModeBtn: { 
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none', 
    fontSize: '20px', 
    cursor: 'pointer',
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(102,126,234,0.3)',
    transition: 'all 0.2s'
  },
  
  // Overlay & Window
  overlay: { 
    position: 'fixed', 
    inset: 0, 
    background: 'rgba(0,0,0,0.6)', 
    backdropFilter: 'blur(4px)',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '20px', 
    zIndex: 100,
    animation: 'fadeIn 0.2s ease'
  },
  window: { 
    width: '95vw', 
    maxWidth: '1500px', 
    height: '88vh', 
    borderRadius: '24px',
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden',
    animation: 'slideUp 0.3s ease'
  },
  titlebar: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '16px 20px'
  },
  titleLeft: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px' 
  },
  titleIcon: { 
    fontSize: '28px' 
  },
  titleText: { 
    fontWeight: '700', 
    fontSize: '18px' 
  },
  fileCount: { 
    fontSize: '13px', 
    color: '#94a3b8',
    fontWeight: '500',
    background: 'rgba(148,163,184,0.15)',
    padding: '4px 12px',
    borderRadius: '8px'
  },
  controls: { 
    display: 'flex', 
    gap: '8px' 
  },
  controlBtn: { 
    padding: '10px 16px', 
    borderRadius: '10px', 
    cursor: 'pointer', 
    fontSize: '16px', 
    transition: 'all 0.15s',
    fontWeight: '500'
  },
  closeBtn: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(239,68,68,0.3)'
  },
  
  // Content
  content: { 
    flex: 1, 
    display: 'flex', 
    gap: '16px', 
    padding: '16px', 
    overflow: 'hidden' 
  },
  list: { 
    width: '320px', 
    flexShrink: 0, 
    borderRadius: '16px', 
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden'
  },
  listHeader: { 
    padding: '14px', 
    display: 'flex', 
    gap: '10px'
  },
  search: { 
    flex: 1, 
    padding: '12px 16px', 
    borderRadius: '10px', 
    outline: 'none', 
    fontSize: '14px',
    fontWeight: '500'
  },
  select: { 
    padding: '10px 12px', 
    borderRadius: '10px', 
    fontSize: '13px', 
    cursor: 'pointer',
    fontWeight: '500'
  },
  listArea: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '10px' 
  },
  row: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    padding: '12px', 
    borderRadius: '12px', 
    cursor: 'pointer', 
    marginBottom: '4px', 
    transition: 'all 0.15s'
  },
  rowActive: { 
    background: 'linear-gradient(135deg, rgba(102,126,234,0.2) 0%, rgba(118,75,162,0.15) 100%)',
    boxShadow: '0 2px 8px rgba(102,126,234,0.2)'
  },
  starBtn: { 
    background: 'none', 
    border: 'none', 
    fontSize: '18px', 
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  fileIcon: {
    fontSize: '24px'
  },
  fileInfo: { 
    flex: 1, 
    minWidth: 0 
  },
  fileName: { 
    fontSize: '14px', 
    fontWeight: '600', 
    whiteSpace: 'nowrap', 
    overflow: 'hidden', 
    textOverflow: 'ellipsis',
    marginBottom: '4px'
  },
  fileMeta: { 
    fontSize: '12px', 
    color: '#94a3b8', 
    whiteSpace: 'nowrap', 
    overflow: 'hidden', 
    textOverflow: 'ellipsis' 
  },
  
  // Preview
  preview: { 
    flex: 1, 
    borderRadius: '16px', 
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden'
  },
  previewHeader: { 
    padding: '14px 16px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center'
  },
  previewTitle: { 
    fontWeight: '700', 
    fontSize: '16px',
    marginBottom: '4px'
  },
  previewSub: { 
    fontSize: '13px', 
    color: '#94a3b8' 
  },
  previewBtns: { 
    display: 'flex', 
    gap: '8px' 
  },
  navBtn: {
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.15s',
    fontWeight: '500'
  },
  printBtn: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '16px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
  },
  previewBody: { 
    flex: 1, 
    position: 'relative', 
    background: '#fff' 
  },
  pdfFrame: { 
    width: '100%', 
    height: '100%', 
    border: 'none' 
  },
  placeholder: { 
    position: 'absolute', 
    inset: 0, 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: '#94a3b8',
    textAlign: 'center',
    padding: '40px'
  },
  placeholderIcon: {
    fontSize: '80px',
    marginBottom: '20px',
    opacity: 0.6
  },
  placeholderText: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '8px'
  },
  placeholderHint: {
    fontSize: '14px',
    opacity: 0.7
  },
  
  // Notes Panel
  notesPanel: { 
    borderTop: '2px solid #e2e8f0', 
    height: '220px', 
    display: 'flex', 
    flexDirection: 'column' 
  },
  notesHeader: { 
    padding: '12px 16px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center'
  },
  notesTitle: {
    fontWeight: '600',
    fontSize: '15px'
  },
  notesTextarea: { 
    flex: 1, 
    padding: '16px', 
    border: 'none', 
    resize: 'none', 
    outline: 'none', 
    fontSize: '14px', 
    lineHeight: '1.7',
    fontFamily: 'inherit'
  },
  
  // Tool Body
  toolBody: { 
    flex: 1, 
    position: 'relative', 
    overflow: 'hidden' 
  },
  toolFrame: { 
    width: '100%', 
    height: '100%', 
    border: 'none' 
  },
  
  // Loading & Empty States
  loading: { 
    minHeight: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontSize: '18px',
    fontWeight: '500'
  },
  loadingSmall: { 
    padding: '40px 20px', 
    textAlign: 'center', 
    color: '#94a3b8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  empty: { 
    padding: '60px 20px', 
    textAlign: 'center', 
    color: '#94a3b8' 
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.5
  }
};

// Add keyframes for animations
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}
