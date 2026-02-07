import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';

/* =========================
   DATA
========================= */

const FOLDERS = {
  keimena: {
    name: 'Κείμενα',
    subtitle: 'Ανάλυση, κατανόηση, ερμηνεία',
    color: '#fbbf24',
    hero: true
  },
  biblia: {
    name: 'Βιβλία',
    subtitle: 'Λογοτεχνικά έργα & αποσπάσματα',
    color: '#3b82f6',
    hero: false
  }
};

/* =========================
   COMPONENT
========================= */

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentFolder, setCurrentFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [tools, setTools] = useState([]);
  const [currentTool, setCurrentTool] = useState(null);

  /* AUTH */
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  /* LOAD FILES */
  const loadFiles = useCallback(async (folderId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${folderId}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setFiles([]);
    }
    setLoading(false);
  }, []);

  /* LOAD TOOLS */
  useEffect(() => {
    const loadTools = async () => {
      try {
        const res = await fetch('/api/tools');
        const data = await res.json();
        setTools(data.tools || []);
      } catch {
        setTools([]);
      }
    };
    loadTools();
  }, []);

  const openFolder = (id) => {
    setCurrentFolder(id);
    setCurrentFile(null);
    loadFiles(id);
  };

  const closeFolder = () => {
    setCurrentFolder(null);
    setCurrentFile(null);
    setFiles([]);
  };

  if (status === 'loading') {
    return <div style={styles.loading}>Φόρτωση…</div>;
  }

  if (!session) return null;

  return (
    <div style={styles.desktop}>
      <main style={styles.mainArea}>

        <div style={{ height: 64 }} />

        <h1 style={styles.pageTitle}>
          Καλώς ήρθες, {session.user.email.split('@')[0]}
        </h1>
        <p style={styles.pageSubtitle}>
          Επίλεξε ενότητα ή εργαλείο για να ξεκινήσεις
        </p>

        {/* ===== FOLDERS ===== */}
        <div style={styles.cardsGrid}>
          {Object.entries(FOLDERS).map(([id, f]) => (
            <Card
              key={id}
              title={f.name}
              subtitle={f.subtitle}
              color={f.color}
              hero={f.hero}
              onClick={() => openFolder(id)}
            />
          ))}
        </div>

        {/* ===== TOOLS ===== */}
        {tools.length > 0 && (
          <>
            <h2 style={styles.sectionTitle}>Εργαλεία</h2>
            <div style={styles.cardsGrid}>
              {tools.map(tool => (
                <Card
                  key={tool.file}
                  title={tool.name}
                  subtitle="Διαδραστική εφαρμογή"
                  color="#64748b"
                  onClick={() => setCurrentTool(tool)}
                />
              ))}
            </div>
          </>
        )}

        <footer style={styles.footer}>
          <span>
            Συνδεδεμένος: <strong>{session.user.email}</strong>
          </span>
          <button onClick={() => signOut()} style={styles.logout}>
            Αποσύνδεση
          </button>
        </footer>
      </main>

      {/* ===== FILE OVERLAY ===== */}
      {currentFolder && (
        <Overlay onClose={closeFolder} accent={FOLDERS[currentFolder].color}
          title={FOLDERS[currentFolder].name}
          subtitle={`${files.length} αρχεία`}
        >
          <div style={styles.windowBody}>
            <div style={styles.fileList}>
              {loading ? 'Φόρτωση…' : files.map(f => (
                <div
                  key={f.id}
                  style={styles.fileRow}
                  onClick={() => setCurrentFile(f)}
                >
                  {f.title}
                </div>
              ))}
            </div>
            <div style={styles.preview}>
              {currentFile ? (
                <iframe
                  src={`/api/files/pdf/${currentFile.id}`}
                  style={styles.pdfFrame}
                />
              ) : (
                <div style={styles.previewPlaceholder}>
                  Επιλέξτε αρχείο για προβολή
                </div>
              )}
            </div>
          </div>
        </Overlay>
      )}

      {/* ===== TOOL OVERLAY ===== */}
      {currentTool && (
        <Overlay
          onClose={() => setCurrentTool(null)}
          accent="#64748b"
          title={currentTool.name}
          subtitle="Εργαλείο"
        >
          <iframe
            src={`/tools/${currentTool.file}`}
            style={styles.pdfFrame}
          />
        </Overlay>
      )}
    </div>
  );
}

/* =========================
   REUSABLE COMPONENTS
========================= */

function Card({ title, subtitle, color, hero, onClick }) {
  return (
    <div
      style={{
        ...styles.card,
        ...(hero ? styles.cardHero : {})
      }}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.boxShadow =
          '0 30px 60px rgba(15,23,42,.28)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow =
          hero
            ? '0 36px 72px rgba(15,23,42,.45)'
            : '0 10px 25px rgba(15,23,42,.1)';
      }}
    >
      <div style={styles.cardInner}>
        <div style={{ ...styles.accentLine, background: color }} />
        <div>
          <h3 style={{
            ...styles.cardTitle,
            color: hero ? '#fff' : '#0f172a'
          }}>{title}</h3>
          <p style={{
            ...styles.cardDesc,
            color: hero ? '#cbd5f5' : '#64748b'
          }}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function Overlay({ children, onClose, accent, title, subtitle }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.window} onClick={e => e.stopPropagation()}>
        <div style={styles.titlebar}>
          <div style={styles.titleLeft}>
            <div style={{ ...styles.titleAccent, background: accent }} />
            <div>
              <div style={styles.titleText}>{title}</div>
              <div style={styles.titleSub}>{subtitle}</div>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const styles = {
  desktop: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left,#fff 0%,#f8fafc 45%,#f1f5f9 100%)',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
  },
  mainArea: {
    maxWidth: 1300,
    margin: '0 auto',
    padding: '0 48px 80px'
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: 600,
    marginBottom: 8
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 48
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 600,
    margin: '64px 0 24px'
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))',
    gap: 28
  },
  card: {
    background: '#fff',
    borderRadius: 22,
    padding: 28,
    cursor: 'pointer',
    transition: 'all .35s cubic-bezier(.4,0,.2,1)',
    boxShadow: '0 10px 25px rgba(15,23,42,.1)'
  },
  cardHero: {
    background: '#0f172a'
  },
  cardInner: {
    display: 'flex',
    gap: 16
  },
  accentLine: {
    width: 4,
    borderRadius: 2,
    marginTop: 6
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 6
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 1.6
  },
  footer: {
    marginTop: 80,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#475569'
  },
  logout: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer'
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,.55)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  },
  window: {
    width: '95vw',
    maxWidth: 1500,
    height: '88vh',
    background: '#fff',
    borderRadius: 24,
    boxShadow: '0 40px 80px rgba(15,23,42,.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  titlebar: {
    padding: '18px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between'
  },
  titleLeft: {
    display: 'flex',
    gap: 14
  },
  titleAccent: {
    width: 4,
    borderRadius: 2,
    marginTop: 6
  },
  titleText: {
    fontSize: 18,
    fontWeight: 600
  },
  titleSub: {
    fontSize: 13,
    color: '#64748b'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer'
  },
  windowBody: {
    flex: 1,
    display: 'flex'
  },
  fileList: {
    width: 320,
    borderRight: '1px solid #e5e7eb',
    padding: 16
  },
  fileRow: {
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer'
  },
  preview: {
    flex: 1,
    background: '#f8fafc'
  },
  pdfFrame: {
    width: '100%',
    height: '100%',
    border: 'none'
  },
  previewPlaceholder: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8'
  },
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};
