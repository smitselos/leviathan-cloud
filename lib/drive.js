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

// Διαβάζει εργαλεία (HTML) από υποφακέλους του FOLDER_TOOLS
// Κάθε υποφάκελος = κατηγορία
export async function listToolsFromDrive(accessToken) {
  const drive = getDriveClient(accessToken);
  const rootId = process.env.FOLDER_TOOLS;

  try {
    // 1. Βρες τους υποφακέλους (κατηγορίες)
    const foldersRes = await drive.files.list({
      q: `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      orderBy: 'name'
    });
    const subfolders = foldersRes.data.files || [];

    // 2. Για κάθε υποφάκελο, βρες τα αρχεία
    const tools = [];
    for (const folder of subfolders) {
      const filesRes = await drive.files.list({
        q: `'${folder.id}' in parents and trashed=false`,
        fields: 'files(id, name, modifiedTime, webViewLink)',
        orderBy: 'name'
      });
      const files = filesRes.data.files || [];
      for (const file of files) {
        tools.push({
          file: file.id,
          name: file.name.replace(/\.html$/i, ''),
          icon: getCategoryIcon(folder.name),
          category: folder.name,  // όνομα υποφακέλου = κατηγορία
          addedAt: file.modifiedTime,
          driveId: file.id,
          webViewLink: file.webViewLink
        });
      }
    }

    // 3. Αρχεία απευθείας στον root (χωρίς κατηγορία)
    const rootFilesRes = await drive.files.list({
      q: `'${rootId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      fields: 'files(id, name, modifiedTime, webViewLink)',
      orderBy: 'name'
    });
    for (const file of rootFilesRes.data.files || []) {
      tools.push({
        file: file.id,
        name: file.name.replace(/\.html$/i, ''),
        icon: '🔧',
        category: null,
        addedAt: file.modifiedTime,
        driveId: file.id,
        webViewLink: file.webViewLink
      });
    }

    return tools;
  } catch (error) {
    console.error('Error listing tools from Drive:', error);
    throw error;
  }
}

function getCategoryIcon(categoryName) {
  const icons = {
    'Γλώσσα':     '📝',
    'Λογοτεχνία': '📚',
    'Ιστορία':    '🏛️',
    'Λατινικά':   '📜',
    'Αρχαία':     '🏺',
    'Έκθεση':     '✍️',
  };
  return icons[categoryName] || '🔧';
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
