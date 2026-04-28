// pages/api/networks/merge.js

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getFileContent, getDriveClient } from '../../../lib/drive';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const NETWORKS_FOLDER = process.env.FOLDER_NETWORKS;

// DejaVu Sans — υποστηρίζει ελληνικά, ελεύθερη χρήση
const FONT_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';

async function fetchFont() {
  const res = await fetch(FONT_URL);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { network } = req.body;
  if (!network?.items?.length) return res.status(400).json({ error: 'No items' });

  const { accessToken } = session;

  try {
    const mergedPdf = await PDFDocument.create();
    mergedPdf.registerFontkit(fontkit);

    // 1. Πρόσθεσε κάθε κείμενο (PDF)
    for (const item of network.items) {
      try {
        const pdfBytes = await getFileContent(accessToken, item.fileId);
        const buffer = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
        const srcPdf = await PDFDocument.load(buffer);
        const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
      } catch (e) {
        console.error(`Error loading PDF for ${item.title}:`, e.message);
      }
    }

    // 2. Σελίδα ερωτήσεων
    const allQuestions = network.items
      .flatMap(item => item.questions.map(q => ({ ...q, itemTitle: item.title })))
      .filter(q => q.text?.trim());

    if (allQuestions.length > 0) {
      const fontBytes = await fetchFont();
      const font = await mergedPdf.embedFont(fontBytes);

      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 60;
      const lineHeight = 22;
      const maxWidth = pageWidth - margin * 2;

      let page = mergedPdf.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      // Τίτλος ΕΡΩΤΗΣΕΙΣ
      page.drawText('ΕΡΩΤΗΣΕΙΣ', {
        x: margin, y, size: 16, font, color: rgb(0, 0, 0),
      });
      y -= lineHeight * 2;

      const drawWrappedText = (text, size) => {
        const words = text.split(' ');
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
            if (y < margin + lineHeight) {
              page = mergedPdf.addPage([pageWidth, pageHeight]);
              y = pageHeight - margin;
            }
            page.drawText(line, { x: margin, y, size, font, color: rgb(0, 0, 0) });
            y -= lineHeight;
            line = word;
          } else {
            line = test;
          }
        }
        if (line) {
          if (y < margin + lineHeight) {
            page = mergedPdf.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
          page.drawText(line, { x: margin, y, size, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
        }
      };

      for (const q of allQuestions) {
        const prefix = q.code ? `${q.code}. ` : '';
        drawWrappedText(`${prefix}${q.text}`, 11);
        y -= 8;
      }
    }

    // 3. Αποθήκευσε στο Drive
    const pdfBytes = await mergedPdf.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const filename = `network_${network.id}.pdf`;
    const drive = getDriveClient(accessToken);

    let pdfFileId = network.pdfFileId;

    if (pdfFileId) {
      await drive.files.update({
        fileId: pdfFileId,
        media: { mimeType: 'application/pdf', body: pdfBuffer },
      });
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: filename,
          parents: [NETWORKS_FOLDER],
          mimeType: 'application/pdf',
        },
        media: { mimeType: 'application/pdf', body: pdfBuffer },
        fields: 'id, name',
      });
      pdfFileId = created.data.id;
    }

    return res.status(200).json({ pdfFileId, pdfFilename: filename });

  } catch (error) {
    console.error('Merge error:', error);
    return res.status(500).json({ error: error.message || 'Merge failed' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};
