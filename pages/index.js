import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';

const FOLDERS = {
  keimena: { name: 'Κείμενα', icon: '📁' },
  biblia: { name: 'Βιβλία', icon: '📚' },
  diktya: { name: 'Δίκτυα κειμένων', icon: '🔗' },
  epexergasia: { name: 'Επεξεργασία', icon: '✏️' },
  theoria_glossa: { name: 'Θεωρία Ν. Γλώσσας', icon: '📖' },
  theoria_logotexnia: { name: 'Θεωρία Λογοτεχνίας', icon: '📜' },
  logotexnia: { name: 'Λογοτεχνία', icon: '🎭' }
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
    // Load saved data from localStorage
    const savedNotes = localStorage.getItem('leviathan-notes');
    const savedFavorites = localStorage.getItem('leviathan-favorites');
    const savedDarkMode = localStorage.getItem('leviathan-darkmode');
    
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedDarkMode === 'true') setDarkMode(true);
    
    // Load tools list
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
      {/* Desktop Icons - Folders */}
      <div style={styles.iconsLeft}>
        {Object.entries(FOLDERS).map(([id, folder]) => (
          <div 
            key={id}
            style={{...styles.icon, ...theme.icon}}
            onClick={() => openFolder(id)}
          >
            <div style={styles.glyph}>{folder.icon}</div>
            <div style={{...styles.label, ...theme.text}}>{folder.name}</div>
          </div>
        ))}
      </div>
      
      {/* Desktop Icons - Tools */}
      {tools.length > 0 && (
        <div style={styles.iconsRight}>
          <div style={styles.toolsLabel}>🔧 Εργαλεία</div>
          {tools.map((tool) => (
            <div 
              key={tool.file}
              style={{...styles.icon, ...styles.toolIcon, ...theme.icon}}
              onClick={() => openTool(tool)}
            >
              <div style={styles.glyph}>{tool.icon || '🔧'}</div>
              <div style={{...styles.label, ...theme.text}}>{tool.name}</div>
            </div>
          ))}
        </div>
      )}
      
      {/* Logo */}
      <div style={styles.logoArea}>
        <img src="/logo.png" alt="ΛΕΒΙΑΘΑΝ" style={{width: '180px', height: 'auto'}} />
        <div style={styles.version}>Cloud Edition</div>
      </div>
      
      {/* Footer */}
      <div style={{...styles.footer, ...theme.footer}}>
        <div>
          Συνδεδεμένος: {session.user?.email}
          <button onClick={() => signOut()} style={styles.logoutBtn}>Αποσύνδεση</button>
        </div>
        <button 
          onClick={() => setDarkMode(!darkMode)} 
          style={styles.darkModeBtn}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      
      {/* Tool Viewer Window */}
      {currentTool && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && closeTool()}>
          <div style={{...styles.window, ...theme.window}}>
            {/* Title Bar */}
            <div style={{...styles.titlebar, ...theme.titlebar}}>
              <div style={styles.titleLeft}>
                <span style={styles.titleIcon}>{currentTool.icon || '🔧'}</span>
                <span style={{...styles.titleText, ...theme.text}}>{currentTool.name}</span>
              </div>
              <div style={styles.controls}>
                <button 
                  onClick={() => window.open(`/tools/${currentTool.file}`, '_blank')} 
                  style={{...styles.btn, ...theme.btn}}
                  title="Άνοιγμα σε νέα καρτέλα"
                >↗</button>
                <button onClick={closeTool} style={{...styles.btn, ...theme.btn}}>✕</button>
              </div>
            </div>
            {/* Tool Content */}
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
            {/* Title Bar */}
            <div style={{...styles.titlebar, ...theme.titlebar}}>
              <div style={styles.titleLeft}>
                <span style={styles.titleIcon}>{FOLDERS[currentFolder]?.icon}</span>
                <span style={{...styles.titleText, ...theme.text}}>{FOLDERS[currentFolder]?.name}</span>
                <span style={styles.fileCount}>{files.length} αρχεία</span>
              </div>
              <div style={styles.controls}>
                <button onClick={() => loadFiles(currentFolder)} style={{...styles.btn, ...theme.btn}}>🔄</button>
                <button onClick={closeFolder} style={{...styles.btn, ...theme.btn}}>✕</button>
              </div>
            </div>
            
            {/* Content */}
            <div style={styles.content}>
              {/* File List */}
              <div style={{...styles.list, ...theme.panel}}>
                <div style={{...styles.listHeader, ...theme.listHeader}}>
                  <input 
                    type="search"
                    placeholder="Αναζήτηση..."
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
                    <div style={styles.loadingSmall}>Φόρτωση...</div>
                  ) : filteredFiles.length === 0 ? (
                    <div style={styles.empty}>Δεν βρέθηκαν αρχεία</div>
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
                            color: favorites.includes(file.id) ? '#f59e0b' : '#94a3b8'
                          }}
                        >
                          {favorites.includes(file.id) ? '⭐' : '☆'}
                        </button>
                        <span>📄</span>
                        <div style={styles.fileInfo}>
                          <div style={{...styles.fileName, ...theme.text}}>{file.title}</div>
                          <div style={styles.fileMeta}>{file.name}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Preview */}
              <div style={{...styles.preview, ...theme.panel}}>
                <div style={{...styles.previewHeader, ...theme.listHeader}}>
                  <div>
                    <div style={{...styles.previewTitle, ...theme.text}}>
                      {currentFile?.title || 'Προβολή'}
                    </div>
                    <div style={styles.previewSub}>
                      {currentFile?.name || 'Επιλέξτε ένα PDF'}
                    </div>
                  </div>
                  <div style={styles.previewBtns}>
                    <button 
                      onClick={goBack} 
                      disabled={historyIndex <= 0}
                      style={{...styles.btn, ...theme.btn}}
                    >◀</button>
                    <button 
                      onClick={goForward} 
                      disabled={historyIndex >= history.length - 1}
                      style={{...styles.btn, ...theme.btn}}
                    >▶</button>
                    <button 
                      onClick={() => setShowNotes(!showNotes)}
                      disabled={!currentFile}
                      style={{...styles.btn, ...theme.btn}}
                    >📝</button>
                    <button 
                      onClick={() => currentFile && window.open(`/api/files/pdf/${currentFile.id}`, '_blank')}
                      disabled={!currentFile}
                      style={{...styles.btn, ...theme.btn, background: '#2563eb', color: '#fff'}}
                    >🖨️</button>
                  </div>
                </div>
                
                <div style={styles.previewBody}>
                  {currentFile ? (
                    <iframe 
                      src={`/api/files/pdf/${currentFile.id}`}
                      style={styles.pdfFrame}
                      title="PDF Viewer"
                    />
                  ) : (
                    <div style={styles.placeholder}>
                      <div style={{fontSize: '64px', marginBottom: '16px'}}>📄</div>
                      <div>Επιλέξτε ένα αρχείο PDF</div>
                    </div>
                  )}
                </div>
                
                {showNotes && currentFile && (
                  <div style={{...styles.notesPanel, ...theme.panel}}>
                    <div style={{...styles.notesHeader, ...theme.listHeader}}>
                      <span>📝 Σημειώσεις</span>
                      <button onClick={() => setShowNotes(false)} style={{...styles.btn, ...theme.btn}}>✕</button>
                    </div>
                    <textarea 
                      value={notes[currentFile.id] || ''}
                      onChange={(e) => updateNotes(currentFile.id, e.target.value)}
                      placeholder="Προσθέστε σημειώσεις..."
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
  desktop: { background: 'linear-gradient(135deg, #f7f9fc, #eef4fb)' },
  window: { background: '#ffffff' },
  panel: { background: '#f8fafc' },
  titlebar: { background: 'linear-gradient(180deg, #ffffff, #f1f5f9)' },
  listHeader: { background: '#f1f5f9' },
  text: { color: '#0f172a' },
  icon: { background: '#ffffff', border: '1px solid rgba(15,23,42,.12)' },
  btn: { background: 'linear-gradient(180deg, #ffffff, #f1f5f9)', color: '#0f172a', border: '1px solid rgba(15,23,42,.18)' },
  input: { background: '#ffffff', color: '#0f172a', border: '1px solid rgba(15,23,42,.18)' },
  row: { },
  footer: { background: 'rgba(255,255,255,.85)' }
};

const darkTheme = {
  desktop: { background: 'linear-gradient(135deg, #0f172a, #1e293b)' },
  window: { background: '#1e293b' },
  panel: { background: '#334155' },
  titlebar: { background: 'linear-gradient(180deg, #334155, #1e293b)' },
  listHeader: { background: '#334155' },
  text: { color: '#f1f5f9' },
  icon: { background: '#1e293b', border: '1px solid rgba(248,250,252,.12)' },
  btn: { background: 'linear-gradient(180deg, #334155, #1e293b)', color: '#f1f5f9', border: '1px solid rgba(248,250,252,.18)' },
  input: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(248,250,252,.18)' },
  row: { },
  footer: { background: 'rgba(30,41,59,.9)', color: '#f1f5f9' }
};

const styles = {
  desktop: {
    minHeight: '100vh',
    position: 'relative',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  iconsLeft: {
    position: 'absolute',
    top: '28px',
    left: '22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  iconsRight: {
    position: 'absolute',
    top: '28px',
    right: '22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center'
  },
  toolsLabel: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#475569',
    marginBottom: '6px',
    letterSpacing: '1px'
  },
  icon: {
    width: '110px',
    height: '90px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all .15s'
  },
  toolIcon: {
    borderColor: 'rgba(37,99,235,.25)'
  },
  glyph: { fontSize: '32px' },
  label: { fontSize: '10px', marginTop: '4px', textAlign: 'center' },
  logoArea: {
    position: 'absolute',
    bottom: '70px',
    right: '40px',
    textAlign: 'center'
  },
  logoTitle: {
    fontSize: '48px',
    fontWeight: '900',
    background: 'linear-gradient(180deg, #ef4444, #991b1b)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  logoSubtitle: {
    fontSize: '16px',
    letterSpacing: '10px',
    color: '#1e40af'
  },
  version: {
    fontSize: '11px',
    color: 'rgba(71,85,105,.5)',
    marginTop: '8px'
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    borderTop: '1px solid rgba(15,23,42,.12)'
  },
  logoutBtn: {
    marginLeft: '12px',
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  darkModeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer'
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    zIndex: 100
  },
  window: {
    width: '95vw',
    maxWidth: '1400px',
    height: '85vh',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(15,23,42,.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  titlebar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderBottom: '1px solid rgba(15,23,42,.12)'
  },
  titleLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  titleIcon: { fontSize: '24px' },
  titleText: { fontWeight: '600', fontSize: '16px' },
  fileCount: { fontSize: '12px', color: '#94a3b8' },
  controls: { display: 'flex', gap: '8px' },
  btn: {
    padding: '8px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all .15s'
  },
  content: {
    flex: 1,
    display: 'flex',
    gap: '12px',
    padding: '14px',
    overflow: 'hidden'
  },
  list: {
    width: '280px',
    flexShrink: 0,
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid rgba(15,23,42,.12)'
  },
  listHeader: {
    padding: '12px',
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid rgba(15,23,42,.12)'
  },
  search: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '8px',
    outline: 'none',
    fontSize: '13px'
  },
  select: {
    padding: '8px',
    borderRadius: '8px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  listArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '2px',
    transition: 'all .15s'
  },
  rowActive: {
    background: 'rgba(37,99,235,.15)'
  },
  starBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer'
  },
  fileInfo: { flex: 1, minWidth: 0 },
  fileName: {
    fontSize: '13px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  fileMeta: {
    fontSize: '11px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  preview: {
    flex: 1,
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid rgba(15,23,42,.12)'
  },
  previewHeader: {
    padding: '12px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(15,23,42,.12)'
  },
  previewTitle: { fontWeight: '600', fontSize: '14px' },
  previewSub: { fontSize: '12px', color: '#94a3b8' },
  previewBtns: { display: 'flex', gap: '6px' },
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
    color: '#94a3b8'
  },
  notesPanel: {
    borderTop: '1px solid rgba(15,23,42,.12)',
    height: '200px',
    display: 'flex',
    flexDirection: 'column'
  },
  notesHeader: {
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(15,23,42,.12)'
  },
  notesTextarea: {
    flex: 1,
    padding: '12px',
    border: 'none',
    resize: 'none',
    outline: 'none',
    fontSize: '13px',
    lineHeight: '1.6'
  },
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
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px'
  },
  loadingSmall: {
    padding: '20px',
    textAlign: 'center',
    color: '#94a3b8'
  },
  empty: {
    padding: '30px 20px',
    textAlign: 'center',
    color: '#94a3b8'
  }
};
