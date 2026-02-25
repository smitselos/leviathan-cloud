import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Μόνο συνδεδεμένοι χρήστες
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { file, category, addedAt, name, icon } = req.body;

  if (!file || !file.endsWith('.html')) {
    return res.status(400).json({ error: 'Invalid file' });
  }

  try {
    const dataDir = path.join(process.cwd(), 'data');
    const metaPath = path.join(dataDir, 'tools.json');

    // Δημιουργία φακέλου data αν δεν υπάρχει
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Διάβασμα υπάρχοντος tools.json
    let entries = [];
    if (fs.existsSync(metaPath)) {
      try {
        entries = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch (e) { entries = []; }
    }

    // Ενημέρωση ή προσθήκη εγγραφής
    const idx = entries.findIndex(e => e.file === file);
    const entry = { file, category: category || null, addedAt: addedAt || null };
    if (name) entry.name = name;
    if (icon) entry.icon = icon;

    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...entry };
    } else {
      entries.push(entry);
    }

    fs.writeFileSync(metaPath, JSON.stringify(entries, null, 2), 'utf-8');

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating tool:', error);
    res.status(500).json({ error: error.message });
  }
}
