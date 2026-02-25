import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { listToolsFromDrive } from '../../../lib/drive';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const tools = await listToolsFromDrive(session.accessToken);
    res.status(200).json({ tools });
  } catch (error) {
    console.error('Error loading tools:', error);
    res.status(500).json({ tools: [], error: error.message });
  }
}
