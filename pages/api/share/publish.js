// pages/api/share/publish.js
// POST: δημοσιεύει αρχείο/εφαρμογή (αποθηκεύει στο leviathan-metadata.json)
// DELETE: αφαιρεί δημοσίευση
// GET: επιστρέφει δημοσιευμένα (δημόσιο — χωρίς auth, αλλά χρειάζεται accessToken proxy)

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { google } from 'googleapis';

const FILENAME = 'leviathan-metadata.json';
const TTL_MS = 2 * 60 * 60 * 1000; // 2 ώρες

async function getDrive(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

async function findMetaFile(drive) {
  const res = await drive.files.list({
    q: `name='${FILENAME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  return res.data.files?.[0] || null;
}

async function loadMetadata(drive) {
  const file = await findMetaFile(drive);
  if (!file) return {};
  const content = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'text' }
  );
  return typeof content.data === 'string' ? JSON.parse(content.data) : content.data;
}

async function saveMetadata(drive, data) {
  const body = JSON.stringify(data, null, 2);
  const existing = await findMetaFile(drive);
  if (existing) {
    await drive.files.update({
      fileId: existing.id,
      media: { mimeType: 'application/json', body },
    });
  } else {
    await drive.files.create({
      requestBody: { name: FILENAME, mimeType: 'application/json' },
      media: { mimeType: 'application/json', body },
      fields: 'id',
    });
  }
}

// Καθαρισμός ληγμένων
function cleanExpired(published) {
  const now = Date.now();
  const cleaned = {};
  for (const [key, item] of Object.entries(published)) {
    if (item.expiresAt > now) cleaned[key] = item;
  }
  return cleaned;
}

export default async function handler(req, res) {

  // GET — δημόσιο, αλλά χρειάζεται accessToken για Drive
  // Αποθηκεύουμε το accessToken στα published items
  if (req.method === 'GET') {
    // Δοκιμή: πρώτα με session (αν είναι authenticated)
    // Αν δεν υπάρχει session, χρησιμοποιεί cached accessToken από τα published
    const session = await getServerSession(req, res, authOptions);
    
    if (!session) {
      // Δημόσιο GET — χρησιμοποιεί in-memory cache
      const cached = global.__publishCache || { items: [], updatedAt: 0 };
      // Φιλτράρισμα ληγμένων
      const now = Date.now();
      const items = cached.items.filter(i => i.expiresAt > now);
      return res.status(200).json({ items });
    }

    // Authenticated GET — διαβάζει από Drive
    try {
      const drive = await getDrive(session.accessToken);
      const meta = await loadMetadata(drive);
      const published = cleanExpired(meta._published || {});
      
      const items = Object.entries(published).map(([key, item]) => ({
        key,
        type: item.type,
        title: item.title,
        linkedAppTitle: item.linkedAppTitle || null,
        expiresAt: item.expiresAt,
        publishedAt: item.publishedAt,
      }));

      // Cache για μη-authenticated requests
      global.__publishCache = { items, updatedAt: Date.now() };

      // Data cache με accessTokens
      if (!global.__publishDataCache) global.__publishDataCache = {};
      for (const [k, item] of Object.entries(published)) {
        global.__publishDataCache[k] = { ...item, accessToken: session.accessToken };
      }

      return res.status(200).json({ items });
    } catch (e) {
      console.error('[publish GET]', e.message);
      return res.status(200).json({ items: [] });
    }
  }

  // POST & DELETE — απαιτούν auth
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const drive = await getDrive(session.accessToken);

  if (req.method === 'POST') {
    const { type, id, title, linkedApp, linkedAppTitle } = req.body;
    if (!type || !id || !title) {
      return res.status(400).json({ error: 'Missing type, id, or title' });
    }

    try {
      const meta = await loadMetadata(drive);
      if (!meta._published) meta._published = {};
      
      // Καθαρισμός ληγμένων
      meta._published = cleanExpired(meta._published);

      const key = `${type}_${id}`;
      const now = Date.now();

      meta._published[key] = {
        type,
        id,
        title,
        linkedApp: linkedApp || null,
        linkedAppTitle: linkedAppTitle || null,
        accessToken: session.accessToken,
        expiresAt: now + TTL_MS,
        publishedAt: now,
      };

      await saveMetadata(drive, meta);

      // Update cache — items (χωρίς accessToken) για student page
      const items = Object.entries(meta._published).map(([k, item]) => ({
        key: k,
        type: item.type,
        title: item.title,
        linkedAppTitle: item.linkedAppTitle || null,
        expiresAt: item.expiresAt,
        publishedAt: item.publishedAt,
      }));
      global.__publishCache = { items, updatedAt: Date.now() };

      // Update data cache — με accessToken για content serving
      if (!global.__publishDataCache) global.__publishDataCache = {};
      for (const [k, item] of Object.entries(meta._published)) {
        global.__publishDataCache[k] = item;
      }

      return res.status(200).json({ key, expiresAt: now + TTL_MS });
    } catch (e) {
      console.error('[publish POST]', e.message);
      return res.status(500).json({ error: 'Failed to publish' });
    }
  }

  if (req.method === 'DELETE') {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key' });

    try {
      const meta = await loadMetadata(drive);
      if (meta._published) {
        delete meta._published[key];
        meta._published = cleanExpired(meta._published);
        await saveMetadata(drive, meta);
      }

      // Update cache
      const items = Object.entries(meta._published || {}).map(([k, item]) => ({
        key: k, type: item.type, title: item.title,
        linkedAppTitle: item.linkedAppTitle || null,
        expiresAt: item.expiresAt, publishedAt: item.publishedAt,
      }));
      global.__publishCache = { items, updatedAt: Date.now() };

      return res.status(200).json({ message: 'Unpublished' });
    } catch (e) {
      console.error('[publish DELETE]', e.message);
      return res.status(500).json({ error: 'Failed to unpublish' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
