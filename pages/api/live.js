// pages/api/live.js
// Αποθηκεύει/διαβάζει περιεχόμενο παρουσίασης ανά κωδικό session
// Χρησιμοποιεί in-memory store (επαρκεί για σχολική χρήση)

const sessions = {};

// Καθαρισμός παλιών sessions (>4 ώρες)
function cleanup() {
  const now = Date.now();
  for (const code of Object.keys(sessions)) {
    if (now - sessions[code].updatedAt > 4 * 60 * 60 * 1000) {
      delete sessions[code];
    }
  }
}

export default function handler(req, res) {
  // CORS για δημόσια πρόσβαση
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  cleanup();

  // GET — λήψη περιεχομένου για κωδικό
  if (req.method === 'GET') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const session = sessions[code];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.status(200).json(session);
  }

  // POST — αποστολή περιεχομένου
  if (req.method === 'POST') {
    const { code, type, src, title, appSrc, appName } = req.body;
    if (!code || !src) return res.status(400).json({ error: 'Missing data' });

    sessions[code] = {
      type,      // 'pdf' | 'app' | 'split'
      src,       // URL κειμένου (PDF)
      title,     // Τίτλος κειμένου
      appSrc,    // URL εφαρμογής (αν υπάρχει)
      appName,   // Όνομα εφαρμογής
      updatedAt: Date.now(),
    };

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
