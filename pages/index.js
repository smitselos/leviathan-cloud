import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';

/* =========================
   DATA
========================= */

const FOLDERS = {
  keimena: {
    name: 'Κείμενα',
    color: '#fbbf24',
    hero: true,
    subtitle: 'Ανάλυση, κατανόηση, ερμηνεία'
  },
  biblia: {
    name: 'Βιβλία',
    color: '#3b82f6',
    hero: false,
    subtitle: 'Λογοτεχνικά έργα & αποσπάσματα'
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

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

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

  const openFolder = (id) => {
    setCurrentFolder(id);
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

        {/* TOP SPACE */}
        <div style={{ height: 64 }} />

        {/* HEADER */}
        <h1 style={styles.pageTitle}>
          Καλώς ήρθες, {session.user.email.split('@')[0]}
        </h1>
        <p style={styles.pageSubtitle}>
          Επίλεξε ενότητα για να ξεκινήσεις
        </p>

        {/* CARDS */}
        <div style={styles.cardsGrid}>
          {Object.entries(FOLDERS).map(([id, f]) => (
            <div
              key={id}
              style={{
                ...styles.card,
                ...(f.hero ? styles.cardHero : {})
              }}
              onClick={() => openFolder(id)}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow =
                  '0 30px 60px rgba(15,23,42,.28)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  f.hero
                    ? '0 36px 72px rgba(15,23,42,.45)'
                    : '0 10px 25px rgba(15,23,42,.1)';
              }}
            >
              <div style={styles.cardInner}>
                <div
                  style={{
                    ...styles.accentLine,
                    background: f.color
                  }}
                />
                <div>
                  <h3 style={{
                    ...styles.cardTitle,
                    color: f.hero ? '#fff' : '#0f172a'
                  }}>
                    {f.name}
                  </h3>
                  <p style={{
                    ...styles.cardDesc,
                    color: f.hero ? '#cbd5f5' : '#64748b'
                  }}>
                    {f.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <footer style={styles.footer}>
          <span>
            Συνδεδεμένος: <strong>{session.user.email}</strong>
          </span>
          <button onClick={() => signOut()} style={styles.logout}>
            Αποσύνδεση
          </button>
        </footer>

      </main>

      {/* OVERLAY – FILE WINDOW */}
      {currentFolder && (
        <div style={styles.overlay} onClick={closeFolder}>
          <div
            style={styles.window}
            onClick={e => e.stopPropagation()}
          >
            {/* TITLE BAR */}
            <div style={styles.titlebar}>
              <div style={styles.titleLeft}>
                <div
                  style={{
                    ...styles.titleAccent,
                    background: FOLDERS[currentFolder].color
                  }}
                />
                <div>
                  <div style={styles.titleText}>
                    {FOLDERS[currentFolder].name}
                  </div>
                  <div style={styles.titleSub}>
                    {files.length} αρχεία
                  </div>
                </div>
              </div>
              <button onClick={closeFolder} style={styles.closeBtn}>✕</button>
            </div>

            {/* CONTENT */}
            <div style={styles.windowBody}>
              {loading ? (
                <div style={styles.loadingSmall}>Φόρτωση αρχείων…</div>
              ) : files.length === 0 ? (
                <div style={styles.empty}>Δεν υπάρχουν αρχεία</div>
              ) : (
                <ul style={styles.fileList}>
                  {files.map(f => (
                    <li
                      key={f.id}
                      style={styles.fileRow}
                      onClick={() => setCurrentFile(f)}
                    >
                      {f.title}
                    </li>
                  ))}
                </ul>
              )}

              <div style={styles.preview}>
                {currentFile ? (
                  <iframe
                    src={`/api/files/pdf/${currentFile.id}`}
                    style={styles.pdfFrame}
                    title="PDF"
                  />
                ) : (
                  <div style={styles.previewPlaceholder}>
                    Επιλέξτε αρχείο για προβολή
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

/* =========================
   STYLES
========================= */

const styles = {
  desktop: {
    minHeight: '100vh',
    background: `
      radial-gradient(
        circle at top left,
        #ffffff 0%,
        #f8fafc 45%,
        #f1f5f9 100%
      )
    `,
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
    marginBottom: 8,
    letterSpacing: '-0.02em'
  },

  pageSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 48
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
    background: '#0f172a',
    boxShadow: '0 36px 72px rgba(15,23,42,.45)'
  },

  cardInner: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start'
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
    cursor: 'pointer',
    fontWeight: 500
  },

  /* OVERLAY */
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.55)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  titleLeft: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start'
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
    fontSize: 18,
    cursor: 'pointer'
  },

  windowBody: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
  },

  fileList: {
    width: 320,
    borderRight: '1px solid #e5e7eb',
    listStyle: 'none',
    margin: 0,
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
    justifyContent: 'center',
    fontSize: 18
  },

  loadingSmall: {
    padding: 40,
    color: '#64748b'
  },

  empty: {
    padding: 40,
    color: '#94a3b8'
  }
};
