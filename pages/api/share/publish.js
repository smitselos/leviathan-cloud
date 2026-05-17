// pages/api/share/publish.js
// POST: δημοσιεύει αρχείο/εφαρμογή στη δημόσια σελίδα (εφήμερο 2 ώρες)
// DELETE: αφαιρεί δημοσίευση
// GET: επιστρέφει τη λίστα δημοσιευμένων (δημόσιο — χωρίς auth)

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const TTL_MS = 2 * 60 * 60 * 1000; // 2 ώρες

// In-memory store — global για persistence μεταξύ serverless calls
if (!global.__publishedItems) {
  global.__publishedItems = new Map();
}
const published = global.__publishedItems;

// Cleanup ληγμένων κάθε 5 λεπτά
if (!global.__publishCleanup) {
  global.__publishCleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of published) {
      if (v.expiresAt < now) published.delete(k);
    }
  }, 5 * 60 * 1000);
}

export default async function handler(req, res) {

  // GET — δημόσιο, χωρίς auth
  if (req.method === 'GET') {
    const now = Date.now();
    const items = [];
    for (const [key, item] of published) {
      if (item.expiresAt > now) {
        items.push({
          key,
          type: item.type,           // 'pdf' | 'tool' | 'pair'
          title: item.title,
          linkedAppTitle: item.linkedAppTitle || null,
          expiresAt: item.expiresAt,
          publishedAt: item.publishedAt,
        });
      } else {
        published.delete(key);
      }
    }
    return res.status(200).json({ items });
  }

  // POST & DELETE — απαιτούν auth
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    const { type, id, title, accessToken: _, linkedApp, linkedAppTitle } = req.body;
    if (!type || !id || !title) {
      return res.status(400).json({ error: 'Missing type, id, or title' });
    }

    const key = `${type}_${id}`;
    const now = Date.now();

    published.set(key, {
      type,
      id,
      title,
      linkedApp: linkedApp || null,       // driveId εφαρμογής
      linkedAppTitle: linkedAppTitle || null,
      accessToken: session.accessToken,    // για proxy σε Drive
      expiresAt: now + TTL_MS,
      publishedAt: now,
      publishedBy: session.user?.email,
    });

    return res.status(200).json({
      key,
      expiresAt: now + TTL_MS,
      message: 'Published',
    });
  }

  if (req.method === 'DELETE') {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key' });
    published.delete(key);
    return res.status(200).json({ message: 'Unpublished' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
