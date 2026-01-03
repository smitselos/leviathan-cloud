import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { error } = router.query;
  
  useEffect(() => {
    if (session) {
      router.push('/');
    }
  }, [session, router]);
  
  if (status === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner}></div>
          <p>Φόρτωση...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.waves}>
            {[...Array(7)].map((_, i) => (
              <div key={i} style={{...styles.wave, height: `${4 + i * 3}px`}}></div>
            ))}
          </div>
          <h1 style={styles.title}>ΛΕΒΙΑΘΑΝ</h1>
          <p style={styles.subtitle}>ΕΠΟΠΤΙΚΟΝ</p>
        </div>
        
        {error && (
          <div style={styles.error}>
            {error === 'AccessDenied' 
              ? 'Δεν έχετε πρόσβαση. Επικοινωνήστε με τον διαχειριστή.'
              : 'Σφάλμα σύνδεσης. Δοκιμάστε ξανά.'}
          </div>
        )}
        
        <button 
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={styles.button}
        >
          <svg style={styles.googleIcon} viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Σύνδεση με Google
        </button>
        
        <p style={styles.footer}>
          Μόνο εξουσιοδοτημένοι χρήστες
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f7f9fc, #eef4fb)',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 20px 50px rgba(15,23,42,.18)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '90%'
  },
  logo: {
    marginBottom: '30px'
  },
  waves: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
    marginBottom: '16px'
  },
  wave: {
    width: '8px',
    background: 'linear-gradient(180deg, #2563eb, #60a5fa)',
    borderRadius: '4px'
  },
  title: {
    fontSize: '42px',
    fontWeight: '900',
    background: 'linear-gradient(180deg, #ef4444, #991b1b)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0',
    textShadow: '2px 2px 4px rgba(0,0,0,.1)'
  },
  subtitle: {
    fontSize: '14px',
    letterSpacing: '8px',
    color: '#1e40af',
    margin: '8px 0 0 0'
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#0f172a',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all .15s'
  },
  googleIcon: {
    width: '20px',
    height: '20px'
  },
  footer: {
    marginTop: '20px',
    fontSize: '12px',
    color: '#94a3b8'
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px'
  }
};
