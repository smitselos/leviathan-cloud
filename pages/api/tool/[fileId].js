// pages/api/tool/[fileId].js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getDriveClient } from '../../../lib/drive';
import { google } from 'googleapis';

export default async function handler(req, res) {
  const { fileId, token } = req.query;

  // Έλεγχος token για /live (χωρίς session)
  if (token && token === process.env.LIVE_TOKEN) {
    try {
      const drive = google.drive({
        version: 'v3',
        auth: process.env.GOOGLE_API_KEY,
      });
      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.send(response.data);
    } catch (error) {
      return res.status(500).send('Error: ' + error.message);
    }
  }

  // Κανονικό session-based authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).send('Unauthorized');

  try {
    const drive = getDriveClient(session.accessToken);
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(response.data);
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
}
