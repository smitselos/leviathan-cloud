import { google } from 'googleapis';

export function getDriveClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

export async function listFilesInFolder(accessToken, folderId) {
  const drive = getDriveClient(accessToken);
  
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'files(id, name, modifiedTime, size, webViewLink, webContentLink)',
      orderBy: 'name',
      pageSize: 100
    });
    
    return response.data.files || [];
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

export async function getFileContent(accessToken, fileId) {
  const drive = getDriveClient(accessToken);
  
  try {
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, {
      responseType: 'arraybuffer'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting file:', error);
    throw error;
  }
}
