import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getDriveClient } from '../../../lib/drive';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).send('Unauthorized');

  const { fileId } = req.query;

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
