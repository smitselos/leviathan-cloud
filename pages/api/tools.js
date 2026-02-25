import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const toolsDir = path.join(process.cwd(), 'public', 'tools');

    if (!fs.existsSync(toolsDir)) {
      return res.status(200).json({ tools: [] });
    }

    // Διαβάζουμε το tools.json αν υπάρχει (metadata: category, addedAt, icon override)
    let metadata = {};
    const metaPath = path.join(toolsDir, 'tools.json');
    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const arr = JSON.parse(raw);
        // Δημιουργούμε map: filename → metadata
        arr.forEach(entry => {
          metadata[entry.file] = entry;
        });
      } catch (e) {
        console.error('Error reading tools.json:', e);
      }
    }

    const files = fs.readdirSync(toolsDir);

    const tools = files
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const name = f.replace('.html', '');
        let title = name;
        let icon = '🔧';

        try {
          const content = fs.readFileSync(path.join(toolsDir, f), 'utf-8');

          const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
          if (titleMatch) title = titleMatch[1];

          if (content.includes('κριτήριο') || content.includes('Κριτήριο')) icon = '📝';
          else if (content.includes('κουίζ') || content.includes('quiz') || content.includes('Quiz')) icon = '🎯';
          else if (content.includes('ανάλυση') || content.includes('Ανάλυση') || content.includes('analyzer')) icon = '🔍';
          else if (content.includes('άσκηση') || content.includes('Άσκηση') || content.includes('exercise')) icon = '✏️';
          else if (content.includes('λεξικό') || content.includes('dictionary')) icon = '📖';
          else if (content.includes('χάρτης') || content.includes('map')) icon = '🗺️';
          else if (content.includes('παιχνίδι') || content.includes('game')) icon = '🎮';
          else if (content.includes('εφηβεία') || content.includes('Εφηβεία')) icon = '📚';
        } catch (e) {}

        // Συγχώνευση με metadata από tools.json
        const meta = metadata[f] || {};

        return {
          file: f,
          name: meta.name || title,          // όνομα από tools.json ή από <title>
          icon: meta.icon || icon,            // εικονίδιο από tools.json ή auto-detect
          category: meta.category || null,    // κατηγορία — null αν δεν ορίστηκε
          addedAt: meta.addedAt || null,      // ημερομηνία προσθήκης
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'el'));

    res.status(200).json({ tools });
  } catch (error) {
    console.error('Error reading tools:', error);
    res.status(200).json({ tools: [] });
  }
}
