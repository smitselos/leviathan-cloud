// pages/api/share/[token].js
// Σερβίρει αρχείο ή εφαρμογή μέσω εφήμερου token — ΧΩΡΙΣ login
// Ο μαθητής σκανάρει QR → φτάνει εδώ → βλέπει απευθείας το περιεχόμενο

import { google } from 'googleapis';

// Η ίδια token store με το create.js
const tokens = global.__shareTokens || new Map();

export default async function handler(req, res) {
  const { token } = req.query;

  // Αναζήτηση token
  const entry = tokens.get(token);
  if (!entry) {
    return res.status(404).send(expiredPage('Ο σύνδεσμος δεν βρέθηκε ή έχει λήξει.'));
  }

  // Έλεγχος λήξης
  if (Date.now() > entry.expiresAt) {
    tokens.delete(token);
    return res.status(410).send(expiredPage('Ο σύνδεσμος έληξε. Ζητήστε νέο QR code από τον εκπαιδευτικό.'));
  }

  const { type, id, accessToken } = entry;

  try {
    if (type === 'pdf') {
      // ── PDF: proxy από Google Drive ────────────────────────────────
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // Πρώτα πάρε metadata για filename
      const meta = await drive.files.get({ fileId: id, fields: 'name,mimeType' });
      const mimeType = meta.data.mimeType || 'application/pdf';
      const fileName = meta.data.name || 'document.pdf';

      // Export ή download ανάλογα με τον τύπο
      let stream;
      if (mimeType === 'application/vnd.google-apps.document') {
        // Google Doc → export ως PDF
        const exp = await drive.files.export({ fileId: id, mimeType: 'application/pdf' }, { responseType: 'stream' });
        stream = exp.data;
        res.setHeader('Content-Type', 'application/pdf');
      } else {
        // Ήδη PDF ή άλλο binary
        const dl = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
        stream = dl.data;
        res.setHeader('Content-Type', mimeType);
      }

      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Cache-Control', 'no-store');
      stream.pipe(res);

    } else if (type === 'tool') {
      // ── Tool / HTML app: proxy ─────────────────────────────────────
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // Τα tools είναι HTML αρχεία στο Drive
      const dl = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'text' });
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(dl.data);

    } else {
      return res.status(400).send(expiredPage('Άγνωστος τύπος πόρου.'));
    }

  } catch (err) {
    console.error('Share proxy error:', err.message);

    // Αν το access token του εκπαιδευτικού έχει λήξει
    if (err.code === 401 || err.message?.includes('invalid_grant')) {
      tokens.delete(token);
      return res.status(410).send(expiredPage('Η συνεδρία έληξε. Ζητήστε νέο QR code από τον εκπαιδευτικό.'));
    }

    return res.status(500).send(expiredPage('Σφάλμα κατά τη φόρτωση. Δοκιμάστε ξανά.'));
  }
}

// ── Σελίδα λήξης — απλή, mobile-friendly ────────────────────────────────
function expiredPage(message) {
  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>ΛΕΒΙΑΘΑΝ — Σύνδεσμος</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f0e1;color:#3d3a2e;padding:24px;}
    .card{background:#fff;border-radius:20px;padding:40px 32px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.08);}
    .icon{font-size:48px;margin-bottom:16px;}
    h1{font-size:18px;font-weight:700;margin-bottom:12px;letter-spacing:-0.01em;}
    p{font-size:14px;line-height:1.6;color:#6b6b80;}
    .footer{margin-top:24px;font-size:11px;color:#aeaeb8;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⏱️</div>
    <h1>ΛΕΒΙΑΘΑΝ Cloud</h1>
    <p>${message}</p>
    <div class="footer">leviathan-cloud.vercel.app</div>
  </div>
</body>
</html>`;
}
