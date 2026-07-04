// pages/index.js — ΛΕΒΙΑΘΑΝ Light
// Δύο λειτουργίες ΜΟΝΟ: 📡 Live  &  🌍 Μοίρασμα (Ανοιχτή πρόσβαση)
// Σύνδεση με Gmail (NextAuth). Χωρίς βιβλιοθήκη, ετικέτες, σχόλια, μαθητές, επεξεργασία.
//
// Ροή Live:      ανέβασμα αρχείου (ή σύνδεσμος) → PDF → κωδικός PIN → προβολή στον διαδραστικό (/live?code=…)
// Ροή Μοίρασμα:  ανέβασμα αρχείου → PDF → εμφανίζεται στη δημόσια σελίδα /s/{όνομα}
//
// «Δεν αποθηκεύεται τίποτε»: τα αρχεία του Live μπαίνουν στο Drive με πρόθεμα live-tmp-
// και καθαρίζονται αυτόματα (>24h) στην επόμενη σύνδεση. Τα μοιρασμένα μένουν ΜΟΝΟ
// όσο είναι στη δημόσια σελίδα — το ✕ τα αφαιρεί και από το Drive.
//
// Χωρίς πρόσθετες εξαρτήσεις: το JSZip φορτώνεται από CDN μόνο όταν ανέβει .pages/.key

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

/* ── Βοηθητικά ── */
const IWORK_RE = /\.(pages|key|numbers)$/i;
const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.pages,.key,image/*';

const cleanName = (n) => n.replace(/^live-tmp-\d+-/, '').replace(/\.(pdf|docx?|pptx?|xlsx?|pages|key)$/i, '');

// Φόρτωση JSZip από CDN κατά ζήτηση (καμία εξάρτηση στο package.json)
let _jszipPromise = null;
function loadJSZip() {
  if (typeof window !== 'undefined' && window.JSZip) return Promise.resolve(window.JSZip);
  if (!_jszipPromise) {
    _jszipPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => { _jszipPromise = null; reject(new Error('Αποτυχία φόρτωσης JSZip')); };
      document.head.appendChild(s);
    });
  }
  return _jszipPromise;
}

// .pages/.key = πακέτο ZIP με ενσωματωμένο QuickLook/Preview.pdf → το εξάγουμε στον browser
async function iworkToPdf(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const hit = zip.file(/quicklook\/preview\.pdf$/i)[0];
  if (!hit) return null;
  const blob = await hit.async('blob');
  return new File([blob], file.name.replace(IWORK_RE, '.pdf'), { type: 'application/pdf' });
}

async function prepareFile(file) {
  if (IWORK_RE.test(file.name)) {
    try {
      const pdf = await iworkToPdf(file);
      if (pdf) return pdf;
    } catch {}
    alert(`Το «${file.name}» δεν περιέχει ενσωματωμένη προεπισκόπηση PDF.\n\nΆνοιξέ το στο Pages/Keynote και κάνε Εξαγωγή → PDF, μετά ανέβασε το PDF.`);
    return null;
  }
  return file; // PDF/Office/εικόνες: όπως είναι (τα Office αποδίδονται ως PDF από το pipeline προβολής)
}

/* ── Χρώματα (κρέμ παλέτα ΛΕΒΙΑΘΑΝ) ── */
const C = {
  bg: '#f7f5f0', card: '#ffffff', line: '#ebebeb',
  ink: '#1a1a1a', sub: '#6b6b80', mut: '#aeaeb8',
  cream: '#8a7d4a', creamBg: '#faf6ea', creamLine: '#e8e0c8',
  live: '#e8c96a', dark: '#1a1a1a', red: '#dc2626', green: '#16a34a',
};

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [mode, setMode] = useState('live');            // 'live' | 'share'
  const [rootId, setRootId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [busy, setBusy] = useState('');                // '' | 'live' | 'share' | 'load'

  // Live
  const [liveFiles, setLiveFiles] = useState([]);      // File[] (μετά το prepare)
  const [liveUrls, setLiveUrls] = useState([]);        // [{url,name}]
  const [urlInput, setUrlInput] = useState('');
  const [urlName, setUrlName] = useState('');
  const [liveCode, setLiveCode] = useState(null);

  // Μοίρασμα
  const [shared, setShared] = useState([]);            // δημόσια αρχεία (από registry, αόρατο υπόβαθρο)
  const [shareDone, setShareDone] = useState(false);

  const publicPath = '/s/' + (session?.user?.email?.split('@')[0] || '');

  /* ── Σύνδεση / αρχικοποίηση ── */
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (session?.error === 'RefreshAccessTokenError') signOut({ callbackUrl: '/login' });
  }, [status, session, router]);

  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 700);
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  const loadShared = useCallback(async () => {
    try {
      const r = await fetch('/api/registry');
      const d = await r.json();
      setShared((d.files || []).filter((x) => x.visibility === 'public' || x.published));
    } catch {}
  }, []);

  // Καθάρισμα προσωρινών του Live (>24 ωρών) — τρέχει αθόρυβα στη σύνδεση
  const cleanupTemp = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const q = encodeURIComponent("name contains 'live-tmp-' and trashed=false");
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,createdTime)`,
        { headers: { Authorization: 'Bearer ' + session.accessToken } });
      const d = await r.json();
      const cutoff = Date.now() - 24 * 3600 * 1000;
      for (const f of d.files || []) {
        if (new Date(f.createdTime).getTime() < cutoff) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + session.accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }),
          }).catch(() => {});
        }
      }
    } catch {}
  }, [session]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      setBusy('load');
      try {
        const r = await fetch('/api/folders');       // δίνει rootId (ο κορμός μένει, αόρατος)
        const d = await r.json();
        setRootId(d.rootId || null);
      } catch {}
      await loadShared();
      setBusy('');
      cleanupTemp();
    })();
  }, [status, loadShared, cleanupTemp]);

  /* ── Ανέβασμα στο Drive (multipart, με το token του χρήστη) ── */
  const uploadToDrive = async (file, prefix = '') => {
    const metadata = { name: prefix + file.name, mimeType: file.type || 'application/octet-stream', parents: [rootId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
      { method: 'POST', headers: { Authorization: 'Bearer ' + session.accessToken }, body: form });
    const doc = await res.json();
    if (!doc.id) throw new Error(doc.error?.message || 'Αποτυχία ανεβάσματος');
    return doc;
  };

  /* ── LIVE: ανέβασμα → PDF → κωδικός ── */
  const pickLiveFiles = async (e) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    const ok = [];
    for (const f of list) { const p = await prepareFile(f); if (p) ok.push(p); }
    if (ok.length) { setLiveFiles((prev) => [...prev, ...ok]); setLiveCode(null); }
  };

  const addUrl = () => {
    let u = urlInput.trim(); if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    setLiveUrls((p) => [...p, { url: u, name: urlName.trim() || u.replace(/^https?:\/\//, '').slice(0, 40) }]);
    setUrlInput(''); setUrlName(''); setLiveCode(null);
  };

  const startLive = async () => {
    if ((!liveFiles.length && !liveUrls.length) || busy || !rootId) return;
    setBusy('live'); setLiveCode(null);
    try {
      const items = [];
      for (const f of liveFiles) {
        const doc = await uploadToDrive(f, 'live-tmp-' + Date.now() + '-');
        items.push({ kind: 'file', id: doc.id, name: cleanName(f.name) });
      }
      for (const u of liveUrls) items.push({ kind: 'url', url: u.url, name: u.name });
      const r = await fetch('/api/live', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, title: items[0]?.name || 'Live' }),
      });
      const d = await r.json();
      if (d.code) { setLiveCode(d.code); setLiveFiles([]); setLiveUrls([]); }
      else alert(d.error || 'Δεν δόθηκε κωδικός — δοκίμασε ξανά.');
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  /* ── ΜΟΙΡΑΣΜΑ: ανέβασμα → PDF → δημόσια σελίδα ── */
  const pickShareFiles = async (e) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    if (!list.length || busy || !rootId) return;
    setBusy('share'); setShareDone(false);
    try {
      const added = [];
      for (const f of list) {
        const p = await prepareFile(f); if (!p) continue;
        const doc = await uploadToDrive(p);
        added.push({ id: doc.id, name: doc.name, mimeType: doc.mimeType, folderId: rootId });
      }
      if (added.length) {
        await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: added }) });
        for (const a of added) {
          await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, visibility: 'public' }) });
        }
        await loadShared();
        setShareDone(true);
      }
    } catch (err) { alert('Σφάλμα: ' + err.message); }
    setBusy('');
  };

  const unshare = async (f) => {
    if (!confirm(`Να αφαιρεθεί το «${cleanName(f.name)}» από τη δημόσια σελίδα;\n(Θα διαγραφεί — δεν κρατιέται πουθενά.)`)) return;
    try {
      await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, visibility: 'none' }) });
      await fetch('/api/registry', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, deleteFromDrive: true }) });
      await loadShared();
    } catch {}
  };

  /* ── UI ── */
  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.sub, fontFamily: 'system-ui' }}>Φόρτωση…</div>;
  }

  const S = {
    wrap: { minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", paddingBottom: 40 },
    inner: { maxWidth: 640, margin: '0 auto', padding: isMobile ? '20px 16px' : '36px 20px' },
    card: { background: C.card, border: '1px solid ' + C.line, borderRadius: 16, padding: isMobile ? 16 : 20, marginBottom: 16 },
    h1: { fontSize: isMobile ? 20 : 24, fontWeight: 700, color: C.ink, margin: 0 },
    sub: { fontSize: 13, color: C.sub, margin: '4px 0 0' },
    tab: (on) => ({ flex: 1, padding: '13px 10px', borderRadius: 14, border: '2px solid ' + (on ? C.cream : C.line), background: on ? C.creamBg : '#fff', color: on ? C.cream : C.sub, fontSize: 14, fontWeight: 700, cursor: 'pointer' }),
    upBtn: { display: 'block', width: '100%', padding: '26px 14px', borderRadius: 14, border: '2px dashed ' + C.creamLine, background: C.creamBg, color: C.cream, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box' },
    go: (on) => ({ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: on ? C.dark : '#e0e0e0', color: '#fff', fontSize: 15, fontWeight: 600, cursor: on ? 'pointer' : 'default' }),
    row: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#fff', border: '1px solid ' + C.creamLine, borderRadius: 12 },
    x: { background: 'none', border: 'none', color: C.mut, cursor: 'pointer', fontSize: 13, flexShrink: 0 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 10, fontSize: isMobile ? 16 : 13, boxSizing: 'border-box' },
  };

  return (
    <div style={S.wrap}>
      <div style={S.inner}>

        {/* Κεφαλίδα */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h1 style={S.h1}>ΛΕΒΙΑΘΑΝ <span style={{ fontWeight: 400, color: C.cream }}>light</span></h1>
            <p style={S.sub}>Γεια σου, {session.user?.name || session.user?.email} 👋</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            style={{ background: 'none', border: '1px solid ' + C.line, borderRadius: 10, padding: '8px 14px', color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Έξοδος
          </button>
        </div>

        {/* Δύο λειτουργίες */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <button style={S.tab(mode === 'live')} onClick={() => setMode('live')}>📡 Live</button>
          <button style={S.tab(mode === 'share')} onClick={() => setMode('share')}>🌍 Μοίρασμα</button>
        </div>

        {/* ═══ LIVE ═══ */}
        {mode === 'live' && (
          <>
            <div style={S.card}>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>
                Ανέβασε αρχείο (PDF, Word, PowerPoint, Pages, εικόνα) από τον υπολογιστή ή το cloud σου — γίνεται PDF και παίρνεις κωδικό για τον διαδραστικό.
              </div>

              <label style={S.upBtn}>
                ⬆️ Επιλογή αρχείου…
                <input type="file" multiple accept={ACCEPT} onChange={pickLiveFiles} style={{ display: 'none' }} />
              </label>

              {/* Προαιρετικός σύνδεσμος */}
              <div style={{ marginTop: 14 }}>
                <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="…ή επικόλλησε σύνδεσμο (YouTube, ιστοσελίδα)" style={S.input} />
                {urlInput.trim() && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input value={urlName} onChange={(e) => setUrlName(e.target.value)} placeholder="Όνομα (προαιρετικό)" style={{ ...S.input, flex: 1 }} />
                    <button onClick={addUrl} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: C.cream, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>+ Προσθήκη</button>
                  </div>
                )}
              </div>

              {/* Λίστα προς προβολή */}
              {(liveFiles.length > 0 || liveUrls.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                  {liveFiles.map((f, i) => (
                    <div key={'f' + i} style={S.row}>
                      <span>📄</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button style={S.x} onClick={() => setLiveFiles((p) => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                  {liveUrls.map((u, i) => (
                    <div key={'u' + i} style={S.row}>
                      <span>🌐</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                      <button style={S.x} onClick={() => setLiveUrls((p) => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button style={S.go((liveFiles.length || liveUrls.length) && !busy)} disabled={(!liveFiles.length && !liveUrls.length) || !!busy} onClick={startLive}>
              {busy === 'live' ? '⏳ Ανέβασμα & δημιουργία…' : '📡 Έναρξη Live'}
            </button>

            {liveCode && (
              <div style={{ marginTop: 16, padding: 24, background: 'linear-gradient(135deg,#1a1a1a,#2d2a1e)', borderRadius: 18, textAlign: 'center' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: C.live, marginBottom: 10 }}>Κωδικός Live</div>
                <div style={{ fontSize: 52, fontWeight: 700, color: '#fff', letterSpacing: '0.15em', fontFamily: 'monospace', marginBottom: 10 }}>{liveCode}</div>
                <div style={{ fontSize: 12, color: '#8e8ea0', marginBottom: 16 }}>
                  Στον διαδραστικό: άνοιξε την <b>Ανοιχτή πρόσβαση</b>, πάτησε <b>Live</b> και βάλε τον κωδικό. Ισχύει ~2 ώρες.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/live?code=${liveCode}`).catch(() => {}); }}
                    style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: C.live, fontSize: 13, cursor: 'pointer' }}>📋 Αντιγραφή συνδέσμου</button>
                  <button onClick={() => window.open(`/live?code=${liveCode}`, '_blank')}
                    style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: C.live, color: C.dark, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Άνοιγμα →</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ ΜΟΙΡΑΣΜΑ ═══ */}
        {mode === 'share' && (
          <>
            <div style={S.card}>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>
                Ανέβασε αρχείο — γίνεται PDF και εμφανίζεται αμέσως στη <b>δημόσια σελίδα</b> σου (χωρίς σύνδεση για τους μαθητές).
              </div>
              <label style={S.upBtn}>
                {busy === 'share' ? '⏳ Ανέβασμα & δημοσίευση…' : '⬆️ Επιλογή αρχείου για μοίρασμα…'}
                <input type="file" multiple accept={ACCEPT} onChange={pickShareFiles} style={{ display: 'none' }} disabled={!!busy} />
              </label>
              {shareDone && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0faf0', border: '1px solid #cde8cd', borderRadius: 12, fontSize: 13, color: C.green, fontWeight: 600 }}>
                  ✓ Δημοσιεύτηκε στην ανοιχτή σελίδα
                </div>
              )}
            </div>

            {/* Τι βλέπουν τώρα οι μαθητές */}
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.cream, textTransform: 'uppercase', letterSpacing: 0.5 }}>Στη δημόσια σελίδα ({shared.length})</div>
                <button onClick={() => window.open(publicPath, '_blank')}
                  style={{ background: 'none', border: 'none', color: C.cream, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Άνοιγμα →</button>
              </div>
              {busy === 'load' && <div style={{ fontSize: 12, color: C.mut }}>Φόρτωση…</div>}
              {!shared.length && busy !== 'load' && <div style={{ fontSize: 13, color: C.mut }}>Τίποτα ακόμη — ανέβασε το πρώτο αρχείο.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {shared.map((f) => (
                  <div key={f.id} style={S.row}>
                    <span>📄</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanName(f.name)}</span>
                    <button style={{ ...S.x, color: C.red }} title="Αφαίρεση από τη δημόσια σελίδα" onClick={() => unshare(f)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: C.mut, textAlign: 'center' }}>
              Δημόσια διεύθυνση: <b style={{ color: C.sub }}>{typeof window !== 'undefined' ? window.location.host : ''}{publicPath}</b>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
