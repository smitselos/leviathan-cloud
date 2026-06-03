import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { FOLDERS } from '../../../lib/config';
import { listFilesInFolder } from '../../../lib/drive';

// Αφαίρεση κατάληξης αρχείου από τον τίτλο (όλοι οι τύποι)
const stripExtension = (name) =>
  name.replace(/\.(pdf|docx?|pptx?|xlsx?|odt|odp|ods|txt|rtf|csv)$/i, '');

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
    
    // Transform files for frontend — περιλαμβάνει πλέον mimeType
    const transformedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      title: stripExtension(file.name),
      mimeType: file.mimeType || '',
      path: `${folderId}/${file.id}`,
      size: parseInt(file.size) || 0,
      modified: file.modifiedTime,
      createdTime: file.createdTime || file.modifiedTime,
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
