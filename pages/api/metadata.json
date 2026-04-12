// pages/api/metadata.js
// Αποθηκεύει ετικέτες + σχόλια ανά αρχείο ως leviathan-metadata.json στο Google Drive

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { google } from 'googleapis';

const FILENAME = 'leviathan-metadata.json';

async function getDrive(session) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  return google.drive({ version: 'v3', auth });
}

async function findFile(drive) {
  const res = await drive.files.list({
    q: `name='${FILENAME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  return res.data.files?.[0] || null;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const drive = await getDrive(session);

  if (req.method === 'GET') {
    try {
      const file = await findFile(drive);
      if (!file) return res.status(200).json({ metadata: {} });
      const content = await drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'text' }
      );
      return res.status(200).json(JSON.parse(content.data));
    } catch (e) {
      console.error('GET metadata:', e);
      return res.status(200).json({ metadata: {} });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = JSON.stringify(req.body, null, 2);
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
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('POST metadata:', e);
      return res.status(500).json({ error: 'Save failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
