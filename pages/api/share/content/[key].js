// pages/api/share/content/[key].js
// Σερβίρει δημοσιευμένο αρχείο/εφαρμογή χωρίς auth
// Χρησιμοποιεί το access token του εκπαιδευτικού

import { google } from 'googleapis';

const published = global.__publishedItems || new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { key } = req.query;
  // key μπορεί να είναι "pdf_XXXXX" ή "tool_XXXXX" ή "app_XXXXX"
  // Επίσης δέχεται query ?part=app για τη linked app ενός pair
  const part = req.query.part || 'main';

  const entry = published.get(key);
  if (!entry) {
    return res.status(404).send(errorPage('Το περιεχόμενο δεν βρέθηκε ή έχει λήξει.'));
  }

  if (Date.now() > entry.expiresAt) {
    published.delete(key);
    return res.status(410).send(errorPage('Ο σύνδεσμος έληξε. Ζητήστε νέο υλικό από τον εκπαιδευτικό.'));
  }

  const { accessToken } = entry;

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });

    let fileId;
    if (part === 'app' && entry.linkedApp) {
      fileId = entry.linkedApp;
    } else {
      fileId = entry.id;
    }

    const meta = await drive.files.get({ fileId, fields: 'name,mimeType' });
    const mimeType = meta.data.mimeType;
    const fileName = meta.data.name || 'document';

    if (mimeType === 'application/vnd.google-apps.document') {
      const exp = await drive.files.export({ fileId, mimeType: 'application/pdf' }, { responseType: 'stream' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Cache-Control', 'no-store');
      exp.data.pipe(res);
    } else if (mimeType === 'text/html' || fileName.endsWith('.html')) {
      const dl = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(dl.data);
    } else {
      const dl = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Cache-Control', 'no-store');
      dl.data.pipe(res);
    }

  } catch (err) {
    console.error('[share/content] Error:', err.message);
    if (err.code === 401 || err.message?.includes('invalid_grant')) {
      published.delete(key);
      return res.status(410).send(errorPage('Η συνεδρία έληξε. Ζητήστε νέο υλικό από τον εκπαιδευτικό.'));
    }
    return res.status(500).send(errorPage('Σφάλμα κατά τη φόρτωση.'));
  }
}

function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ΛΕΒΙΑΘΑΝ — Μαθητές</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f0e1;color:#3d3a2e;padding:24px;}.card{background:#fff;border-radius:20px;padding:40px 32px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.08);}.icon{font-size:48px;margin-bottom:16px;}h1{font-size:18px;font-weight:700;margin-bottom:12px;}p{font-size:14px;line-height:1.6;color:#6b6b80;}.footer{margin-top:24px;font-size:11px;color:#aeaeb8;}</style>
</head><body><div class="card"><div class="icon">📚</div><h1>ΛΕΒΙΑΘΑΝ Cloud</h1><p>${message}</p><div class="footer">leviathan-cloud.vercel.app</div></div></body></html>`;
}
