import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const toolsDir = path.join(process.cwd(), 'public', 'tools');

    if (!fs.existsSync(toolsDir)) {
      return res.status(200).json({ tools: [] });
    }

    // Διαβάζουμε το tools.json για metadata (category, addedAt, icon override)
    let metadata = {};
    const metaPath = path.join(process.cwd(), 'data', 'tools.json');
    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const arr = JSON.parse(raw);
        arr.forEach(entry => { metadata[entry.file] = entry; });
      } catch (e) {}
    }

    const files = fs.readdirSync(toolsDir);

    const tools = files
      .filter(f => f.endsWith('.html'))
      .map(f => {
        let title = f.replace('.html', '');
        let icon = '🔧';

        try {
          const content = fs.readFileSync(path.join(toolsDir, f), 'utf-8');

          const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
          if (titleMatch) title = titleMatch[1];

          if (content.includes('κριτήριο') || content.includes('Κριτήριο')) icon = '📝';
          else if (content.includes('κουίζ') || content.includes('quiz') || content.includes('Quiz')) icon = '🎯';
          else if (content.includes('ανάλυση') || content.includes('Ανάλυση')) icon = '🔍';
          else if (content.includes('άσκηση') || content.includes('Άσκηση')) icon = '✏️';
          else if (content.includes('λεξικό') || content.includes('dictionary')) icon = '📖';
          else if (content.includes('παιχνίδι') || content.includes('game')) icon = '🎮';
        } catch (e) {}

        const meta = metadata[f] || {};

        return {
          file: f,
          name: meta.name || title,
          icon: meta.icon || icon,
          category: meta.category || null,
          addedAt: meta.addedAt || null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'el'));

    res.status(200).json({ tools });
  } catch (error) {
    console.error('Error reading tools:', error);
    res.status(200).json({ tools: [] });
  }
}
