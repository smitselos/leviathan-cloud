// pages/api/share/content/[key].js
// Σερβίρει δημοσιευμένο αρχείο χωρίς user auth
// Διαβάζει published items + accessToken από leviathan-metadata.json στο Drive
// Χρησιμοποιεί service-level access μέσω του αποθηκευμένου accessToken

import { google } from 'googleapis';

const FILENAME = 'leviathan-metadata.json';

// Cache metadata με TTL 30 δευτερόλεπτα
let metaCache = { data: null, accessToken: null, timestamp: 0 };
const CACHE_TTL = 30 * 1000;

async function loadPublishedFromDrive() {
  // Αν υπάρχει fresh cache, χρήσε τον
  if (metaCache.data && Date.now() - metaCache.timestamp < CACHE_TTL) {
    return metaCache.data;
  }

  // Δοκίμασε πρώτα global cache (γεμίζει από publish.js)
  if (global.__publishDataCache && Object.keys(global.__publishDataCache).length > 0) {
    return global.__publishDataCache;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rawKey = req.query.key;
  // Next.js catch-all μπορεί να δώσει array
  const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
  const part = req.query.part || 'main';

  // Βρες published data
  let published = await loadPublishedFromDrive();

  // Αν δεν υπάρχει καθόλου cache, δοκίμασε να φορτώσει από Drive
  // χρησιμοποιώντας ένα fallback accessToken αν υπάρχει
  if (!published && global.__lastPublishAccessToken) {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: global.__lastPublishAccessToken });
      const drive = google.drive({ version: 'v3', auth });
      
      const searchRes = await drive.files.list({
        q: `name='${FILENAME}' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
        pageSize: 1,
      });
      
      if (searchRes.data.files?.length) {
        const content = await drive.files.get(
          { fileId: searchRes.data.files[0].id, alt: 'media' },
          { responseType: 'text' }
        );
        const meta = typeof content.data === 'string' ? JSON.parse(content.data) : content.data;
        published = meta._published || {};
        
        // Update caches
        metaCache = { data: published, timestamp: Date.now() };
        global.__publishDataCache = published;
      }
    } catch (e) {
      console.error('[content] Drive fallback failed:', e.message);
    }
  }

  if (!published) {
    return res.status(404).send(errorPage('Το περιεχόμενο δεν βρέθηκε. Δοκιμάστε να ξαναφορτώσετε τη σελίδα.'));
  }

  const entry = published[key];

  if (!entry) {
    return res.status(404).send(errorPage('Το περιεχόμενο δεν βρέθηκε ή έχει λήξει.'));
  }

  if (Date.now() > entry.expiresAt) {
    return res.status(410).send(errorPage('Ο σύνδεσμος έληξε. Ζητήστε νέο υλικό από τον εκπαιδευτικό.'));
  }

  const { accessToken } = entry;
  if (!accessToken) {
    return res.status(500).send(errorPage('Σφάλμα πρόσβασης. Ο εκπαιδευτικός πρέπει να δημοσιεύσει ξανά.'));
  }

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
    console.error('[content] Error:', err.message);
    if (err.code === 401 || err.message?.includes('invalid_grant')) {
      return res.status(410).send(errorPage('Η συνεδρία έληξε. Ζητήστε νέο υλικό από τον εκπαιδευτικό.'));
    }
    return res.status(500).send(errorPage('Σφάλμα κατά τη φόρτωση.'));
  }
}

function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ΛΕΒΙΑΘΑΝ</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f0e1;color:#3d3a2e;padding:24px;}.card{background:#fff;border-radius:20px;padding:40px 32px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.08);}.icon{font-size:48px;margin-bottom:16px;}h1{font-size:18px;font-weight:700;margin-bottom:12px;}p{font-size:14px;line-height:1.6;color:#6b6b80;}.footer{margin-top:24px;font-size:11px;color:#aeaeb8;}</style>
</head><body><div class="card"><div class="icon">📚</div><h1>ΛΕΒΙΑΘΑΝ Cloud</h1><p>${message}</p><div class="footer">leviathan-cloud.vercel.app</div></div></body></html>`;
}
