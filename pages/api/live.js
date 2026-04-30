// pages/api/live.js
const sessions = {};

function cleanup() {
  const now = Date.now();
  for (const code of Object.keys(sessions)) {
    if (now - sessions[code].updatedAt > 4 * 60 * 60 * 1000) {
      delete sessions[code];
    }
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  cleanup();

  if (req.method === 'GET') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const session = sessions[code];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.status(200).json(session);
  }

  if (req.method === 'POST') {
    const { code, type, src, title, appSrc, appHtml, appName } = req.body;
    if (!code || !src) return res.status(400).json({ error: 'Missing data' });

    sessions[code] = {
      type,
      src,
      title,
      appSrc,
      appHtml: appHtml || null,  // HTML εφαρμογής inline
      appName,
      updatedAt: Date.now(),
    };

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};
