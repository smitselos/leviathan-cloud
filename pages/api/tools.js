import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const toolsDir = path.join(process.cwd(), 'public', 'tools');
    
    // Check if tools directory exists
    if (!fs.existsSync(toolsDir)) {
      return res.status(200).json({ tools: [] });
    }
    
    const files = fs.readdirSync(toolsDir);
    
    const tools = files
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const name = f.replace('.html', '');
        
        // Try to read title from the HTML file
        let title = name;
        let icon = '🔧';
        
        try {
          const content = fs.readFileSync(path.join(toolsDir, f), 'utf-8');
          
          // Extract title from <title> tag
          const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
          if (titleMatch) {
            title = titleMatch[1];
          }
          
          // Try to detect icon from content
          if (content.includes('κριτήριο') || content.includes('Κριτήριο')) icon = '📝';
          else if (content.includes('κουίζ') || content.includes('quiz') || content.includes('Quiz')) icon = '🎯';
          else if (content.includes('ανάλυση') || content.includes('Ανάλυση') || content.includes('analyzer')) icon = '🔍';
          else if (content.includes('άσκηση') || content.includes('Άσκηση') || content.includes('exercise')) icon = '✏️';
          else if (content.includes('λεξικό') || content.includes('dictionary')) icon = '📖';
          else if (content.includes('χάρτης') || content.includes('map')) icon = '🗺️';
          else if (content.includes('παιχνίδι') || content.includes('game')) icon = '🎮';
          else if (content.includes('εφηβεία') || content.includes('Εφηβεία')) icon = '📚';
        } catch (e) {
          // If reading fails, use defaults
        }
        
        return {
          file: f,
          name: title,
          icon: icon
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'el'));
    
    res.status(200).json({ tools });
  } catch (error) {
    console.error('Error reading tools:', error);
    res.status(200).json({ tools: [] });
  }
}
