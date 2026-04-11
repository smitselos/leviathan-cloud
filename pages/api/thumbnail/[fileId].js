import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getDriveClient } from '../../../lib/drive';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { fileId } = req.query;

  try {
    const drive = getDriveClient(session.accessToken);

    // Παίρνουμε το thumbnail link από τα metadata
    const file = await drive.files.get({
      fileId,
      fields: 'thumbnailLink, hasThumbnail',
    });

    if (!file.data.hasThumbnail || !file.data.thumbnailLink) {
      return res.status(404).json({ error: 'No thumbnail' });
    }

    // Μεγαλύτερο thumbnail (αντικαθιστούμε το s220 με s800)
    const thumbUrl = file.data.thumbnailLink.replace(/=s\d+/, '=s800');

    // Κάνουμε fetch το thumbnail και το προωθούμε
    const response = await fetch(thumbUrl);
    if (!response.ok) {
      return res.status(404).json({ error: 'Thumbnail fetch failed' });
    }

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Thumbnail error:', error);
    res.status(500).json({ error: error.message });
  }
}
