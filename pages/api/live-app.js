// pages/api/live-app.js
// Σερβίρει το HTML της εφαρμογής από το live session
import { google } from 'googleapis';

const FILENAME = 'leviathan-live-sessions.json';
const FOLDER_ID = process.env.FOLDER_NETWORKS;

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const drive = google.drive({ version: 'v3', auth: process.env.GOOGLE_API_KEY });

    const list = await drive.files.list({
      q: `name='${FILENAME}' and '${FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });

    const file = list.data.files?.[0];
    if (!file) return res.status(404).send('No sessions');

    const content = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'text' }
    );

    const sessions = JSON.parse(content.data);
    const session = sessions[code];
    if (!session || !session.appHtml) return res.status(404).send('App not found');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(session.appHtml);
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
}
