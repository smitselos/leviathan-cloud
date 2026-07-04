// pages/login.js — Σύνδεση εκπαιδευτικού (μόνο Google)
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Login() {
  const { status } = useSession();
  const router = useRouter();
  const reauth = router.query.reauth === '1'; // ζητήθηκε επανασύνδεση λόγω ληγμένης άδειας Google

  useEffect(() => {
    if (status === 'authenticated' && !reauth) router.replace('/');
  }, [status, router, reauth]);

  if (status === 'loading' || (status === 'authenticated' && !reauth)) {
    return (
      <div style={S.page}><div style={S.card}><div style={{ fontSize: 14, color: '#6b6b80' }}>Φόρτωση…</div></div></div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ ...S.card, maxWidth: 400 }}>
        <img src="/logo.png" alt="Leviathan" style={{ height: 100, objectFit: 'contain', marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Είσοδος εκπαιδευτικού</div>
        <p style={{ fontSize: 13, color: '#6b6b80', marginBottom: 28, lineHeight: 1.6 }}>
          Συνδέσου με τον λογαριασμό Google σου. Τα αρχεία σου μένουν στο δικό σου Google Drive.
        </p>
        {reauth && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fdf6e3', border: '1px solid #e8dfc0', borderRadius: 12, fontSize: 12.5, color: '#8a6d1a', lineHeight: 1.55, textAlign: 'left' }}>
            Η άδεια πρόσβασης της Google έληξε. Πάτησε «Σύνδεση με Google» και <b>αποδέξου ξανά</b> την πρόσβαση — μία φορά αρκεί.
          </div>
        )}
        <button
          onClick={() => signIn('google', { callbackUrl: '/login' }, reauth ? { prompt: 'consent', access_type: 'offline' } : undefined)}
          style={S.googleBtn}>
          Σύνδεση με Google
        </button>
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #f0ece0' }}>
          <p style={{ fontSize: 12, color: '#aeaeb8', marginBottom: 8 }}>Είσαι μαθητής;</p>
          <a href="/class" style={{ fontSize: 13, color: '#5c7a3a', fontWeight: 600, textDecoration: 'none' }}>Δες δημόσιο υλικό →</a>
        </div>
      </div>
      <div style={{ marginTop: 24, fontSize: 11, color: '#aeaeb8', textAlign: 'center' }}>leviathan-cloud</div>
    </div>
  );
}

const S = {
  page: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f5f0e1', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding:24 },
  card: { background:'#fff', borderRadius:20, padding:'40px 32px', maxWidth:380, width:'100%', textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.08)' },
  googleBtn: { background:'#8a7d4a', color:'#fff', border:'none', padding:'12px 28px', borderRadius:12, fontSize:15, fontWeight:600, cursor:'pointer', width:'100%' },
};
