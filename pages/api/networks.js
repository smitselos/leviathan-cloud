// pages/api/networks.js

import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import {
  getDriveClient,
  createJsonFile,
  updateJsonFile,
  readJsonFile,
  deleteFile,
  listJsonFilesInFolder,
} from '../../lib/drive';

// Φάκελος στο Drive όπου αποθηκεύονται τα δίκτυα (JSON αρχεία)
// Πρόσθεσε στο .env.local:  FOLDER_NETWORKS=<drive_folder_id>
const NETWORKS_FOLDER = process.env.FOLDER_NETWORKS;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { accessToken } = session;

  // ── GET: φόρτωση όλων των δικτύων ──────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const files = await listJsonFilesInFolder(accessToken, NETWORKS_FOLDER);
      const networks = await Promise.all(
        files.map(async (f) => {
          try {
            const data = await readJsonFile(accessToken, f.id);
            return { ...data, driveFileId: f.id };
          } catch {
            return null;
          }
        })
      );
      return res.status(200).json({
        networks: networks.filter(Boolean),
      });
    } catch (error) {
      console.error('GET networks error:', error);
      return res.status(500).json({ error: 'Failed to load networks' });
    }
  }

  // ── POST: δημιουργία ή ενημέρωση δικτύου ───────────────────────────────
  if (req.method === 'POST') {
    const network = req.body;
    if (!network || !network.id) {
      return res.status(400).json({ error: 'Invalid network data' });
    }

    try {
      let driveFileId = network.driveFileId;

      if (driveFileId) {
        // Ενημέρωση υπάρχοντος αρχείου
        await updateJsonFile(accessToken, driveFileId, network);
      } else {
        // Δημιουργία νέου αρχείου
        const filename = `network_${network.id}.json`;
        const created = await createJsonFile(
          accessToken,
          NETWORKS_FOLDER,
          filename,
          network
        );
        driveFileId = created.id;
      }

      return res.status(200).json({ driveFileId });
    } catch (error) {
      console.error('POST networks error:', error);
      return res.status(500).json({ error: 'Failed to save network' });
    }
  }

  // ── DELETE: διαγραφή δικτύου ────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { driveFileId } = req.body;
    if (!driveFileId) {
      return res.status(400).json({ error: 'Missing driveFileId' });
    }

    try {
      await deleteFile(accessToken, driveFileId);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('DELETE network error:', error);
      return res.status(500).json({ error: 'Failed to delete network' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
