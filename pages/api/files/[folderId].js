import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { FOLDERS } from '../../../lib/config';
import { listFilesInFolder } from '../../../lib/drive';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { folderId } = req.query;
  
  if (!folderId || !FOLDERS[folderId]) {
    return res.status(400).json({ error: 'Invalid folder' });
  }
  
  const folder = FOLDERS[folderId];
  
  try {
    const files = await listFilesInFolder(session.accessToken, folder.driveId);
    
    // Transform files for frontend
    const transformedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      title: file.name.replace('.pdf', ''),
      path: `${folderId}/${file.id}`,
      size: parseInt(file.size) || 0,
      modified: file.modifiedTime,
      webViewLink: file.webViewLink,
      webContentLink: file.webContentLink,
      categories: [],
      description: '',
      notes: ''
    }));
    
    return res.status(200).json({
      files: transformedFiles,
      categories: [],
      folder: folder.name
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return res.status(500).json({ error: 'Failed to fetch files' });
  }
}
