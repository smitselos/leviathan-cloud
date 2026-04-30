// pages/api/tool/[fileId].js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getDriveClient } from '../../../lib/drive';
import { google } from 'googleapis';

export default async function handler(req, res) {
  const { fileId } = req.query;

  try {
    // Προσπαθεί με session πρώτα
    const session = await getServerSession(req, res, authOptions);
    
    let drive;
    if (session) {
      drive = getDriveClient(session.accessToken);
    } else {
      // Χωρίς session — χρησιμοποιεί API Key
      drive = google.drive({ version: 'v3', auth: process.env.GOOGLE_API_KEY });
    }

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
