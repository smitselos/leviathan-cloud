import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getFileContent } from '../../../../lib/drive';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { fileId } = req.query;
  
  if (!fileId) {
    return res.status(400).json({ error: 'File ID required' });
  }
  
  try {
    const result = await getFileContent(session.accessToken, fileId);
    
    res.setHeader('Content-Type', result.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(result.data));
  } catch (error) {
    console.error('Error fetching file:', error);
    return res.status(500).json({ error: 'Failed to fetch file' });
  }
}
