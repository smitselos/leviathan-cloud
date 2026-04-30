// pages/live/[code].js
// Δημόσια σελίδα παρουσίασης — χωρίς login
// Ανανεώνεται αυτόματα κάθε 3 δευτερόλεπτα

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LivePresentation() {
  const router = useRouter();
  const { code } = router.query;
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchSession = async () => {
    if (!code) return;
    try {
      const r = await fetch(`/api/live?code=${code}`);
      if (r.status === 404) {
        setError('Δεν βρέθηκε παρουσίαση για αυτόν τον κωδικό.');
        return;
      }
      const data = await r.json();
      if (data.updatedAt !== lastUpdated) {
        setSession(data);
        setLastUpdated(data.updatedAt);
        setError(null);
      }
    } catch (e) {
      // Σιωπηλό error — συνεχίζει να προσπαθεί
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [code, lastUpdated]);

  // Waiting screen
  if (!session) return (
    <div style={{
      minHeight:'100vh', background:'#1a1a1a',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      fontFamily:'sans-serif',
    }}>
      <img src="/logo-white.png" alt="ΛΕΒΙΑΘΑΝ" style={{height:'80px', marginBottom:'32px', objectFit:'contain'}}/>
      <div style={{color:'#e8c96a', fontSize:'48px', fontWeight:'700', letterSpacing:'0.1em', marginBottom:'12px'}}>
        {code}
      </div>
      <div style={{color:'#8e8ea0', fontSize:'14px', marginBottom:'32px'}}>
        {error || 'Αναμονή παρουσίασης…'}
      </div>
      <div style={{display:'flex', gap:'6px'}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{
            width:'8px', height:'8px', borderRadius:'50%',
            background:'#e8c96a', opacity:0.4,
            animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite`,
          }}/>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.4;}50%{opacity:1;}}`}</style>
    </div>
  );

  const isSplit = session.appSrc && session.type === 'split';
  const pdfSrc = session.src;
  const appSrc = session.appSrc;

  return (
    <div style={{position:'fixed', inset:0, background:'#000', display:'flex', flexDirection:'column'}}>

      {/* Panels */}
      <div style={{flex:1, display:'flex', overflow:'hidden'}}>
        {/* PDF */}
        <iframe
          src={pdfSrc}
          style={{flex:1, border:'none', height:'100%'}}
          title={session.title}
        />
        {/* Εφαρμογή — μόνο αν split */}
        {isSplit && appSrc && (
          <>
            <div style={{width:'3px', background:'#333', flexShrink:0}}/>
            <iframe
              src={appSrc}
              style={{flex:1, border:'none', height:'100%'}}
              title={session.appName}
            />
          </>
        )}
      </div>

      {/* Floating info bar — διακριτικό */}
      <div style={{
        position:'absolute', bottom:'12px', left:'50%',
        transform:'translateX(-50%)',
        background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)',
        borderRadius:'20px', padding:'6px 16px',
        display:'flex', alignItems:'center', gap:'8px',
        color:'rgba(255,255,255,0.5)', fontSize:'11px',
      }}>
        <span style={{color:'#e8c96a', fontWeight:'600'}}>ΛΕΒΙΑΘΑΝ</span>
        <span>·</span>
        <span>{session.title}</span>
        {session.appName && <><span>·</span><span>🔗 {session.appName}</span></>}
        <span>·</span>
        <span style={{fontFamily:'monospace'}}>{code}</span>
      </div>

    </div>
  );
}
