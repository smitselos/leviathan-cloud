import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

const CATEGORIES = ['Γλώσσα', 'Λογοτεχνία', 'Ιστορία', 'Λατινικά', 'Αρχαία', 'Έκθεση'];

export default function Admin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') loadTools();
  }, [status]);

  const loadTools = async () => {
    setLoading(true);
    const res = await fetch('/api/tools');
    const data = await res.json();
    setTools(data.tools || []);
    setLoading(false);
  };

  const updateTool = async (file, category, addedAt) => {
    setSaving(file);
    try {
      const res = await fetch('/api/admin/update-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, category, addedAt })
      });
      const data = await res.json();
      if (data.success) {
        setTools(prev => prev.map(t => t.file === file ? { ...t, category, addedAt } : t));
        showMessage('success', '✅ Αποθηκεύτηκε!');
      } else {
        showMessage('error', `❌ Σφάλμα: ${data.error}`);
      }
    } catch (e) {
      showMessage('error', '❌ Σφάλμα σύνδεσης');
    }
    setSaving(null);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if (status === 'loading' || loading) {
    return (
      <div style={s.center}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={s.spinner}></div>
        <p style={{color:'#64748b'}}>Φόρτωση εργαλείων...</p>
      </div>
    );
  }

  if (!session) return null;

  const withCat = tools.filter(t => t.category).length;
  const withoutCat = tools.length - withCat;

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .row:hover { background: #f8fafc !important; }
        select:focus, input:focus { border-color: #667eea !important; outline: none; }
      `}</style>

      <div style={s.header}>
        <div style={s.headerLeft}>
          <button onClick={() => router.push('/')} style={s.backBtn}>← Αρχική</button>
          <div>
            <h1 style={s.title}>⚙️ Διαχείριση Εργαλείων</h1>
            <p style={s.subtitle}>
              {tools.length} εργαλεία &nbsp;·&nbsp;
              <span style={{color:'#10b981'}}>{withCat} με κατηγορία</span>
              &nbsp;·&nbsp;
              <span style={{color:'#f59e0b'}}>{withoutCat} χωρίς</span>
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div style={{
          ...s.message,
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b'
        }}>
          {message.text}
        </div>
      )}

      <div style={s.info}>
        💡 Επέλεξε κατηγορία για κάθε εργαλείο και πάτησε <strong>💾</strong> για αποθήκευση.
        Τα εργαλεία χωρίς κατηγορία εμφανίζονται μόνο στο «Όλα».
      </div>

      <div style={s.table}>
        <div style={s.tableHead}>
          <div style={{...s.col, flex:3}}>Εργαλείο</div>
          <div style={{...s.col, flex:2}}>Κατηγορία</div>
          <div style={{...s.col, flex:1.5}}>Ημερομηνία</div>
          <div style={{...s.col, flex:0.5, justifyContent:'center'}}>💾</div>
        </div>

        {tools.map(tool => (
          <ToolRow
            key={tool.file}
            tool={tool}
            categories={CATEGORIES}
            saving={saving === tool.file}
            onSave={updateTool}
          />
        ))}

        {tools.length === 0 && (
          <div style={s.empty}>Δεν βρέθηκαν εργαλεία στον φάκελο public/tools</div>
        )}
      </div>
    </div>
  );
}

function ToolRow({ tool, categories, saving, onSave }) {
  const [category, setCategory] = useState(tool.category || '');
  const [addedAt, setAddedAt] = useState(
    tool.addedAt || new Date().toISOString().split('T')[0]
  );

  return (
    <div className="row" style={{
      ...s.row,
      background: tool.category ? '#fff' : '#fffbeb'
    }}>
      <div style={{...s.col, flex:3, gap:'12px'}}>
        <span style={s.icon}>{tool.icon}</span>
        <div>
          <div style={s.toolName}>{tool.name}</div>
          <div style={s.toolFile}>{tool.file}</div>
        </div>
        {tool.category && (
          <span style={{...s.badge, background: getCategoryColor(tool.category)}}>
            {tool.category}
          </span>
        )}
      </div>

      <div style={{...s.col, flex:2}}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={s.select}>
          <option value="">— χωρίς κατηγορία —</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div style={{...s.col, flex:1.5}}>
        <input
          type="date"
          value={addedAt}
          onChange={e => setAddedAt(e.target.value)}
          style={s.dateInput}
        />
      </div>

      <div style={{...s.col, flex:0.5, justifyContent:'center'}}>
        <button
          onClick={() => onSave(tool.file, category, addedAt)}
          disabled={saving}
          title="Αποθήκευση"
          style={{...s.saveBtn, opacity: saving ? 0.5 : 1}}
        >
          {saving ? '⏳' : '💾'}
        </button>
      </div>
    </div>
  );
}

function getCategoryColor(cat) {
  const colors = {
    'Γλώσσα':     '#dbeafe',
    'Λογοτεχνία': '#fce7f3',
    'Ιστορία':    '#fef3c7',
    'Λατινικά':   '#ede9fe',
    'Αρχαία':     '#d1fae5',
    'Έκθεση':     '#fee2e2',
  };
  return colors[cat] || '#e2e8f0';
}

const s = {
  page: {
    minHeight: '100vh', background: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '32px 40px', maxWidth: '1200px', margin: '0 auto'
  },
  center: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '16px'
  },
  spinner: {
    width: '40px', height: '40px',
    border: '4px solid #e2e8f0', borderTop: '4px solid #667eea',
    borderRadius: '50%', animation: 'spin 1s linear infinite'
  },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '24px'
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '20px' },
  backBtn: {
    background: '#fff', border: '1px solid #e2e8f0', color: '#64748b',
    padding: '10px 18px', borderRadius: '10px', fontSize: '14px',
    cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap'
  },
  title: { fontSize: '26px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#64748b', margin: 0 },
  message: {
    padding: '14px 20px', borderRadius: '12px',
    marginBottom: '16px', fontSize: '14px', fontWeight: '600'
  },
  info: {
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: '12px', padding: '14px 20px',
    marginBottom: '24px', fontSize: '14px', color: '#1e40af'
  },
  table: {
    background: '#fff', borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden'
  },
  tableHead: {
    display: 'flex', alignItems: 'center', padding: '14px 20px',
    background: '#f1f5f9', borderBottom: '2px solid #e2e8f0',
    fontSize: '12px', fontWeight: '700', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  row: {
    display: 'flex', alignItems: 'center', padding: '14px 20px',
    borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s'
  },
  col: { display: 'flex', alignItems: 'center', gap: '8px' },
  icon: { fontSize: '26px', flexShrink: 0 },
  toolName: { fontSize: '15px', fontWeight: '600', color: '#0f172a' },
  toolFile: { fontSize: '11px', color: '#94a3b8', marginTop: '2px' },
  badge: {
    fontSize: '11px', fontWeight: '600', color: '#475569',
    padding: '3px 8px', borderRadius: '8px', whiteSpace: 'nowrap'
  },
  select: {
    width: '100%', padding: '9px 12px', border: '2px solid #e2e8f0',
    borderRadius: '10px', fontSize: '14px', background: '#fff',
    color: '#0f172a', transition: 'border-color 0.2s'
  },
  dateInput: {
    width: '100%', padding: '9px 12px', border: '2px solid #e2e8f0',
    borderRadius: '10px', fontSize: '14px', background: '#fff',
    color: '#0f172a', transition: 'border-color 0.2s'
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', width: '42px', height: '42px',
    borderRadius: '10px', fontSize: '18px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s'
  },
  empty: { padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '15px' }
};
