// pages/api/public-tool/[fileId].js
// Σερβίρει εφαρμογές HTML χωρίς authentication — για χρήση στο /live

import { google } from 'googleapis';

export default async function handler(req, res) {
  const { fileId } = req.query;

  try {
    // Χρησιμοποιεί API key αντί για OAuth — δεν χρειάζεται login
    const drive = google.drive({
      version: 'v3',
      auth: process.env.GOOGLE_API_KEY,
    });

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(response.data);
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
}
