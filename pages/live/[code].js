// pages/live/[code].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LivePresentation() {
  const router = useRouter();
  const { code } = router.query;
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('pdf');

  const fetchSession = async () => {
    if (!code) return;
    try {
      const r = await fetch(`/api/live?code=${code}`);
      if (r.status === 404) { setError('Δεν βρέθηκε παρουσίαση.'); return; }
      const data = await r.json();
      if (data.updatedAt !== lastUpdated) {
        setSession(data);
        setLastUpdated(data.updatedAt);
        setActiveTab('pdf');
        setError(null);
      }
    } catch(e) {}
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [code, lastUpdated]);

  if (!session) return (
    <div style={{minHeight:'100vh',background:'#1a1a1a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>
      <img src="/logo-white.png" alt="ΛΕΒΙΑΘΑΝ" style={{height:'80px',marginBottom:'32px',objectFit:'contain'}}/>
      <div style={{color:'#e8c96a',fontSize:'48px',fontWeight:'700',letterSpacing:'0.1em',marginBottom:'12px'}}>{code}</div>
      <div style={{color:'#8e8ea0',fontSize:'14px',marginBottom:'32px'}}>{error||'Αναμονή παρουσίασης…'}</div>
      <div style={{display:'flex',gap:'6px'}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{width:'8px',height:'8px',borderRadius:'50%',background:'#e8c96a',opacity:0.4,animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite`}}/>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.4;}50%{opacity:1;}}`}</style>
    </div>
  );

  const hasApp = !!session.appSrc;

  // Μετατροπή appSrc σε public-tool URL αν είναι εφαρμογή ΛΕΒΙΑΘΑΝ
  const getAppSrc = () => {
    if (!session.appSrc) return null;
    // Αν είναι εξωτερικό URL (http/https) το αφήνουμε ως έχει
    if (session.appSrc.startsWith('http')) return session.appSrc;
    // Αν είναι /api/tool/[id] το μετατρέπουμε σε /api/public-tool/[id]
    return session.appSrc.replace('/api/tool/', '/api/public-tool/');
  };

  const appSrc = getAppSrc();

  return (
    <div style={{position:'fixed',inset:0,background:'#000',display:'flex',flexDirection:'column'}}>

      {/* Tab bar — μόνο αν υπάρχει εφαρμογή */}
      {hasApp && (
        <div style={{display:'flex',background:'#1a1a1a',flexShrink:0,height:'44px'}}>
          <button onClick={()=>setActiveTab('pdf')}
            style={{flex:1,background:'transparent',border:'none',borderBottom:activeTab==='pdf'?'2px solid #e8c96a':'2px solid transparent',color:activeTab==='pdf'?'#e8c96a':'#8e8ea0',fontSize:'14px',fontWeight:activeTab==='pdf'?700:400,cursor:'pointer',fontFamily:'sans-serif'}}>
            📄 {session.title}
          </button>
          <button onClick={()=>setActiveTab('app')}
            style={{flex:1,background:'transparent',border:'none',borderBottom:activeTab==='app'?'2px solid #e8c96a':'2px solid transparent',color:activeTab==='app'?'#e8c96a':'#8e8ea0',fontSize:'14px',fontWeight:activeTab==='app'?700:400,cursor:'pointer',fontFamily:'sans-serif'}}>
            🔗 {session.appName}
          </button>
          <button onClick={()=>setActiveTab('split')}
            style={{width:'60px',background:'transparent',border:'none',borderBottom:activeTab==='split'?'2px solid #e8c96a':'2px solid transparent',color:activeTab==='split'?'#e8c96a':'#8e8ea0',fontSize:'20px',cursor:'pointer'}}>
            ⊞
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {(activeTab==='pdf'||activeTab==='split'||!hasApp)&&(
          <iframe src={session.src}
            style={{flex:1,border:'none',height:'100%'}}
            title={session.title} allow="fullscreen"/>
        )}
        {activeTab==='split'&&hasApp&&(
          <div style={{width:'3px',background:'#333',flexShrink:0}}/>
        )}
        {hasApp&&(activeTab==='app'||activeTab==='split')&&appSrc&&(
          <iframe src={appSrc}
            style={{flex:1,border:'none',height:'100%'}}
            title={session.appName} allow="fullscreen"/>
        )}
      </div>

      {/* Floating info */}
      <div style={{position:'absolute',bottom:'10px',left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,0.5)',backdropFilter:'blur(8px)',borderRadius:'20px',padding:'5px 14px',color:'rgba(255,255,255,0.4)',fontSize:'11px',display:'flex',gap:'8px',alignItems:'center',fontFamily:'sans-serif'}}>
        <span style={{color:'#e8c96a',fontWeight:'600'}}>ΛΕΒΙΑΘΑΝ</span>
        <span>·</span>
        <span>{session.title}</span>
        <span>·</span>
        <span style={{fontFamily:'monospace'}}>{code}</span>
      </div>

    </div>
  );
}
