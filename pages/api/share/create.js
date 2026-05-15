// pages/api/share/create.js
// Δημιουργεί εφήμερο token για δημόσιο QR share — λήξη 2 ώρες
// Αποθήκευση: in-memory Map (χάνεται σε restart — αρκεί για εφήμερα tokens)
// Για persistence μπορείτε αργότερα να αντικαταστήσετε με Redis ή DB.

import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import crypto from 'crypto';

// ── In-memory token store ───────────────────────────────────────────────
// Μορφή: Map<token, { type, id, name, accessToken, expiresAt }>
if (!global.__shareTokens) {
  global.__shareTokens = new Map();
}
const tokens = global.__shareTokens;

// Καθαρισμός ληγμένων tokens κάθε 10 λεπτά
if (!global.__shareCleanupInterval) {
  global.__shareCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of tokens) {
      if (v.expiresAt < now) tokens.delete(k);
    }
  }, 10 * 60 * 1000);
}

const TTL_MS = 2 * 60 * 60 * 1000; // 2 ώρες

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Μόνο authenticated χρήστες (ο εκπαιδευτικός) μπορούν να δημιουργήσουν tokens
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { type, id, name } = req.body;
  if (!type || !id) return res.status(400).json({ error: 'Missing type or id' });

  // Δημιουργία token
  const token = crypto.randomBytes(24).toString('base64url'); // 32 χαρακτήρες URL-safe
  const expiresAt = Date.now() + TTL_MS;

  tokens.set(token, {
    type,       // 'pdf' | 'tool'
    id,         // Google Drive file ID ή tool filename
    name,       // Φιλικό όνομα για logging
    accessToken: session.accessToken,  // Google OAuth access token του εκπαιδευτικού
    expiresAt,
    createdBy: session.user?.email,
  });

  return res.status(200).json({
    token,
    expiresAt,
    url: `/api/share/${token}`,
  });
}
