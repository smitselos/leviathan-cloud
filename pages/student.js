// pages/student.js
// Δημόσια σελίδα μαθητών — χωρίς login
// Εμφανίζει υλικό που ο εκπαιδευτικός έχει δημοσιεύσει

import { useState, useEffect, useCallback, useRef } from 'react';

const PALETTE = {
  cream:   { bg:'#f5f0e1', bgSoft:'#faf6ea', accent:'#e8dfc4', text:'#3d3a2e', deep:'#8a7d4a' },
  peach:   { bg:'#f9e4d4', bgSoft:'#fcf0e5', accent:'#f0c9a8', text:'#5c3826', deep:'#c97b5a' },
  mustard: { bg:'#efe5b8', bgSoft:'#f7f0d0', accent:'#d4b348', text:'#4a3f1a', deep:'#a68a2e' },
};

export default function StudentPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentItem, setCurrentItem] = useState(null);
  const [showApp, setShowApp] = useState(false); // false = PDF, true = app
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const r = await fetch('/api/share/publish');
      const d = await r.json();
      setItems(d.items || []);
    } catch (e) {
      console.error('Failed to load items:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); const iv = setInterval(loadItems, 30000); return () => clearInterval(iv); }, [loadItems]);

  const openItem = (item) => {
    setCurrentItem(item);
    setShowApp(false);
  };

  const contentUrl = (item, part) => `/api/share/content/${item.key}${part === 'app' ? '?part=app' : ''}`;

  const typeIcon = (type) => type === 'tool' ? '🎮' : type === 'pair' ? '📄🎮' : '📄';
  const typeLabel = (type) => type === 'tool' ? 'Εφαρμογή' : type === 'pair' ? 'Κείμενο + Εφαρμογή' : 'Κείμενο';

  const timeLeft = (expiresAt) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return 'Έληξε';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} λεπτά`;
    const hrs = Math.floor(mins / 60);
    const rm = mins % 60;
    return `${hrs}ω ${rm}λ`;
  };

  // ── Zoom ──
  const [zoom, setZoom] = useState(100);
  const zoomIn = () => setZoom(z => Math.min(z + 15, 200));
  const zoomOut = () => setZoom(z => Math.max(z - 15, 50));

  // ── Modal — PDF/App viewer (ίδιο με index) ──
  const modalFile = currentItem;

  return (
    <div style={S.app}>
      <style>{`
        @media(max-width:767px){
          .student-sidebar{display:none !important;}
          .student-main{margin-left:0 !important;}
        }
        .ri-h:hover{background:#f9f6ed !important;}
        .stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,0.10);}
      `}</style>

      {/* ── Sidebar ── */}
      {!isMobile && (
        <div className="student-sidebar" style={{...S.sidebar, width: sidebarOpen ? '220px' : '56px'}}>
          <div style={S.sidebarHeader}>
            {sidebarOpen && <span style={S.logoText}>ΛΕΒΙΑΘΑΝ</span>}
            <button onClick={() => setSidebarOpen(p => !p)} style={S.collapseBtn}>{sidebarOpen ? '◀' : '▶'}</button>
          </div>
          <nav style={S.nav}>
            <button onClick={() => setCurrentItem(null)}
              style={{...S.navItem, ...(!currentItem ? S.navActive : {})}}>
              <span style={S.navIcon}>🏠</span>
              {sidebarOpen && 'Αρχική'}
            </button>
            <div style={S.navDiv} />
            <a href="/" style={{...S.navItem, textDecoration: 'none'}}>
              <span style={S.navIcon}>🔐</span>
              {sidebarOpen && 'Σύνδεση Εκπαιδευτικού'}
            </a>
          </nav>
          <div style={S.sidebarFooter}>
            <div style={S.userCard}>
              <div style={{...S.userAvatar, background:'#b8d4e3'}}>📚</div>
              {sidebarOpen && (
                <div style={S.userInfo}>
                  <div style={S.userName}>Μαθητής</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <div className="student-main" style={{...S.main, marginLeft: !isMobile && sidebarOpen ? '220px' : !isMobile ? '56px' : '0'}}>

        {/* ── Mobile top bar ── */}
        {isMobile && !currentItem && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid #eee',background:'#fff'}}>
            <span style={{fontSize:'16px',fontWeight:'700',color:'#1a1a1a'}}>📚 ΛΕΒΙΑΘΑΝ</span>
            <a href="/" style={{fontSize:'12px',color:PALETTE.peach.deep,textDecoration:'none',fontWeight:'600'}}>🔐 Σύνδεση</a>
          </div>
        )}

        {/* ── Home view ── */}
        {!currentItem && (
          <div style={S.container}>
            <div style={S.welcomeSec}>
              <h1 style={S.welcomeTitle}>Καλώς ήρθες 📚</h1>
              <p style={S.welcomeSub}>Υλικό που έχει δημοσιεύσει ο εκπαιδευτικός</p>
            </div>

            {loading ? (
              <div style={S.empty}>Φόρτωση...</div>
            ) : items.length === 0 ? (
              <div style={{...S.empty, padding:'60px 20px'}}>
                <div style={{fontSize:'48px',marginBottom:'16px'}}>📭</div>
                <div style={{fontSize:'15px',color:'#6b6b80'}}>Δεν υπάρχει διαθέσιμο υλικό αυτή τη στιγμή.</div>
                <div style={{fontSize:'13px',color:'#aeaeb8',marginTop:'8px'}}>Ο εκπαιδευτικός θα δημοσιεύσει υλικό κατά τη διάρκεια του μαθήματος.</div>
              </div>
            ) : (
              <>
                {/* Stat card */}
                <div style={S.statsGrid}>
                  <div className="stat-card" style={{...S.statCard, background:PALETTE.cream.bg, color:PALETTE.cream.text, cursor:'default'}}>
                    <div style={S.statInner}>
                      <div>
                        <div style={S.statLabel}>Διαθέσιμο υλικό</div>
                        <div style={S.statVal}>{items.length}</div>
                        <div style={S.statSub}>Κείμενα & εφαρμογές</div>
                      </div>
                      <div style={{...S.statIcon, background:PALETTE.cream.accent}}>📚</div>
                    </div>
                  </div>
                </div>

                {/* Items list */}
                <div style={S.section}>
                  <div style={S.secTitle}>Υλικό μαθήματος</div>
                  <div style={S.recentList}>
                    {items.map((item, idx) => {
                      const p = item.type === 'tool' ? PALETTE.mustard : item.type === 'pair' ? PALETTE.peach : PALETTE.cream;
                      return (
                        <div key={item.key} className="ri-h"
                          style={{...S.recentItem, borderBottom: idx < items.length - 1 ? '1px solid #f0f0f0' : 'none', cursor:'pointer'}}
                          onClick={() => openItem(item)}>
                          <div style={{width:'42px',height:'42px',borderRadius:'12px',background:p.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'18px'}}>
                            {typeIcon(item.type)}
                          </div>
                          <div style={S.recentInfo}>
                            <div style={S.recentTitle}>{item.title}</div>
                            <div style={S.recentMeta}>
                              {typeLabel(item.type)} — {item.linkedAppTitle ? `+ ${item.linkedAppTitle}` : ''} ⏱ {timeLeft(item.expiresAt)}
                            </div>
                          </div>
                          <button style={{...S.quickBtn, color:p.deep, borderColor:p.deep}}>Άνοιγμα →</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── File/App viewer — desktop modal ── */}
        {!isMobile && modalFile && (
          <div style={S.modal} onClick={() => setCurrentItem(null)}>
            <div style={S.modalContent} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <h2 style={S.modalTitle}>{modalFile.title}</h2>
                <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                  {modalFile.linkedAppTitle && (
                    <button onClick={() => setShowApp(p => !p)}
                      style={{...S.iconBtn, background: showApp ? PALETTE.mustard.bgSoft : '#f4f4f4', borderColor: showApp ? PALETTE.mustard.deep : '#e0e0e0', color: showApp ? PALETTE.mustard.deep : '#444'}}
                      title="Εναλλαγή Κείμενο / Εφαρμογή">
                      {showApp ? '📄' : '🎮'}
                    </button>
                  )}
                  <button onClick={() => setCurrentItem(null)} style={S.closeBtn}>✕</button>
                </div>
              </div>
              <div style={{flex:1,position:'relative'}}>
                {!showApp ? (
                  <iframe src={contentUrl(modalFile, 'main')} style={{width:'100%',height:'100%',border:'none',borderRadius:'0 0 16px 16px'}} />
                ) : (
                  <iframe ref={iframeRef} src={contentUrl(modalFile, 'app')} style={{width:'100%',height:'100%',border:'none',borderRadius:'0 0 16px 16px'}} />
                )}
                {/* Zoom controls */}
                <div style={{position:'absolute',top:'12px',left:'12px',display:'flex',gap:'4px',background:'rgba(0,0,0,0.5)',borderRadius:'10px',padding:'4px'}}>
                  <button onClick={zoomOut} style={S.zoomBtn}>−</button>
                  <span style={{color:'#fff',fontSize:'12px',padding:'4px 6px'}}>{zoom}%</span>
                  <button onClick={zoomIn} style={S.zoomBtn}>+</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── File/App viewer — mobile fullscreen ── */}
        {isMobile && modalFile && (
          <div style={{position:'fixed',inset:0,background:'#fff',zIndex:1000,display:'flex',flexDirection:'column'}}>
            {/* Mobile header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'#fff',borderBottom:'1px solid #eee'}}>
              <div style={{fontSize:'14px',fontWeight:'600',color:'#1a1a1a',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{modalFile.title}</div>
              <div style={{display:'flex',gap:'8px'}}>
                {modalFile.linkedAppTitle && (
                  <button onClick={() => setShowApp(p => !p)}
                    style={{padding:'6px 12px',borderRadius:'8px',border:'1px solid #ddd',background:showApp?PALETTE.mustard.bgSoft:'#f9f9f9',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>
                    {showApp ? '📄 Κείμενο' : '🎮 Εφαρμογή'}
                  </button>
                )}
                <button onClick={() => setCurrentItem(null)}
                  style={{width:'32px',height:'32px',borderRadius:'8px',background:'#f4f4f4',border:'none',fontSize:'16px',cursor:'pointer'}}>✕</button>
              </div>
            </div>
            {/* Content */}
            <div style={{flex:1}}>
              <iframe
                src={!showApp ? contentUrl(modalFile, 'main') : contentUrl(modalFile, 'app')}
                style={{width:'100%',height:'100%',border:'none'}}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Styles — ίδια αισθητική με index (Energy Insights) ──
const S = {
  app:{display:'flex',minHeight:'100vh',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif",background:'#fafafa'},
  sidebar:{position:'fixed',top:0,left:0,height:'100vh',background:'#1a1a1a',display:'flex',flexDirection:'column',zIndex:200,transition:'width 0.2s ease',overflowX:'hidden'},
  sidebarHeader:{padding:'16px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)'},
  logoText:{fontSize:'15px',fontWeight:'500',color:'#ececec'},
  collapseBtn:{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'#8e8ea0',width:'28px',height:'28px',borderRadius:'6px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  nav:{flex:1,padding:'8px',overflowY:'auto'},
  navItem:{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:'transparent',border:'none',borderRadius:'8px',color:'#8e8ea0',fontSize:'13px',cursor:'pointer',marginBottom:'1px',textAlign:'left'},
  navActive:{background:'rgba(255,255,255,0.08)',color:'#ececec'},
  navIcon:{flexShrink:0,width:'18px',display:'flex',alignItems:'center',justifyContent:'center'},
  navDiv:{height:'1px',background:'rgba(255,255,255,0.06)',margin:'8px 4px'},
  sidebarFooter:{padding:'10px',borderTop:'1px solid rgba(255,255,255,0.06)'},
  userCard:{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:'rgba(255,255,255,0.04)',borderRadius:'8px'},
  userAvatar:{width:'30px',height:'30px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'500',color:'#1a1a1a',flexShrink:0},
  userInfo:{flex:1,minWidth:0},
  userName:{fontSize:'12px',color:'#ececec',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},

  main:{flex:1,transition:'margin-left 0.2s ease'},
  container:{maxWidth:'1280px',margin:'0 auto',padding:'32px 40px'},
  welcomeSec:{marginBottom:'32px'},
  welcomeTitle:{fontSize:'26px',fontWeight:'600',color:'#1a1a1a',marginBottom:'6px',letterSpacing:'-0.01em'},
  welcomeSub:{fontSize:'14px',color:'#6b6b80',lineHeight:'1.5'},

  statsGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'14px',marginBottom:'40px'},
  statCard:{borderRadius:'22px',padding:'22px 24px',border:'none',transition:'transform 0.2s ease, box-shadow 0.2s ease',minHeight:'140px'},
  statInner:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px',height:'100%'},
  statLabel:{fontSize:'13px',fontWeight:'500',marginBottom:'12px'},
  statVal:{fontSize:'42px',fontWeight:'700',lineHeight:'1',marginBottom:'8px',letterSpacing:'-0.02em'},
  statSub:{fontSize:'12px',fontWeight:'400',lineHeight:'1.4'},
  statIcon:{width:'44px',height:'44px',borderRadius:'14px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},

  section:{marginBottom:'44px'},
  secTitle:{fontSize:'17px',fontWeight:'600',color:'#1a1a1a',marginBottom:'18px',letterSpacing:'-0.01em'},

  recentList:{background:'#ffffff',borderRadius:'18px',overflow:'hidden',border:'1px solid #f0f0f0'},
  recentItem:{display:'flex',alignItems:'center',gap:'14px',padding:'14px 18px',transition:'background 0.1s'},
  recentInfo:{flex:1,minWidth:0},
  recentTitle:{fontSize:'14px',fontWeight:'600',color:'#1a1a1a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},
  recentMeta:{fontSize:'12px',color:'#aeaeb8',marginTop:'3px'},
  quickBtn:{background:'transparent',border:'1.5px solid',borderRadius:'10px',padding:'6px 14px',fontSize:'12px',fontWeight:'600',cursor:'pointer'},
  empty:{textAlign:'center',color:'#b0b0b0',padding:'32px',fontSize:'14px'},

  modal:{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'24px'},
  modalContent:{background:'#fff',borderRadius:'18px',width:'90vw',maxWidth:'1100px',height:'85vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,0.2)'},
  modalHeader:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #eee'},
  modalTitle:{fontSize:'16px',fontWeight:'600',color:'#1a1a1a',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginRight:'12px'},
  closeBtn:{width:'34px',height:'34px',borderRadius:'10px',background:'#ff6b6b',border:'none',color:'#fff',fontSize:'16px',fontWeight:'700',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  iconBtn:{width:'34px',height:'34px',borderRadius:'10px',border:'1px solid #e0e0e0',background:'#f4f4f4',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px'},
  zoomBtn:{width:'28px',height:'28px',borderRadius:'8px',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
};
