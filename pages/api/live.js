// pages/api/live.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { google } from 'googleapis';

const FILENAME = 'leviathan-live-sessions.json';

async function getDrive(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

async function getDrivePublic() {
  // Χρησιμοποιεί API Key για δημόσια ανάγνωση
  return google.drive({ version: 'v3', auth: process.env.GOOGLE_API_KEY });
}

async function findFile(drive) {
  const res = await drive.files.list({
    q: `name='${FILENAME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  return res.data.files?.[0] || null;
}

async function readSessions(drive) {
  try {
    const file = await findFile(drive);
    if (!file) return {};
    const content = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'text' }
    );
    const data = JSON.parse(content.data);
    const now = Date.now();
    for (const code of Object.keys(data)) {
      if (now - data[code].updatedAt > 4 * 60 * 60 * 1000) delete data[code];
    }
    return data;
  } catch(e) { return {}; }
}

async function writeSessions(drive, sessions) {
  const body = JSON.stringify(sessions, null, 2);
  const existing = await findFile(drive);
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — χρησιμοποιεί session αν υπάρχει, αλλιώς API Key
  if (req.method === 'GET') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    try {
      // Προσπαθεί με session πρώτα
      const session = await getServerSession(req, res, authOptions);
      const drive = session ? await getDrive(session.accessToken) : await getDrivePublic();
      const sessions = await readSessions(drive);
      const data = sessions[code];
      if (!data) return res.status(404).json({ error: 'Session not found' });
      return res.status(200).json(data);
    } catch(e) {
      console.error('GET live error:', e);
      return res.status(404).json({ error: 'Session not found' });
    }
  }

  // POST — χρειάζεται session
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const { code, type, src, title, appSrc, appHtml, appName } = req.body;
    if (!code || !src) return res.status(400).json({ error: 'Missing data' });

    try {
      const drive = await getDrive(session.accessToken);
      const sessions = await readSessions(drive);
      sessions[code] = {
        type, src, title, appSrc,
        appHtml: appHtml || null,
        appName,
        updatedAt: Date.now(),
      };
      await writeSessions(drive, sessions);
      return res.status(200).json({ ok: true });
    } catch(e) {
      console.error('POST live error:', e);
      return res.status(500).json({ error: 'Failed to save session' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};
