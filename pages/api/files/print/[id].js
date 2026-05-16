// pages/api/files/print/[id].js
// POST: δέχεται { questions: [...] } → PDF κειμένου + σελίδα ερωτήσεων
// GET: μόνο PDF

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getFileContent } from '../../../../lib/drive';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function sortCode(code) {
  const m = (code || '').match(/^([A-Za-zΑ-Ωα-ω]+)(\d*)$/u);
  if (!m) return 9999;
  return m[1].charCodeAt(0) * 1000 + (parseInt(m[2]) || 0);
}

async function buildQuestionsPage(questions, docTitle) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const USABLE_W = PAGE_W - 2 * MARGIN;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Header
  page.drawText('EROTISEIS', { x: MARGIN, y, size: 14, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
  y -= 22;

  if (docTitle) {
    page.drawText(docTitle, { x: MARGIN, y, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
    y -= 24;
  }

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 20;

  const sorted = [...questions].sort((a, b) => sortCode(a.code) - sortCode(b.code));
  const qSize = 11;
  const lineH = 16;
  const qGap = 14;

  for (const q of sorted) {
    const label = q.code || '-';
    const text = q.text || '';
    const fullText = label + '.  ' + text;
    const words = fullText.split(' ');
    const lines = [];
    let cur = '';

    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, qSize) > USABLE_W && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);

    if (y - (lines.length * lineH + qGap) < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }

    const labelStr = label + '.';
    const labelW = fontBold.widthOfTextAtSize(labelStr + '  ', qSize);
    page.drawText(labelStr, { x: MARGIN, y, size: qSize, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    const first = lines[0]?.substring((label + '.  ').length) || '';
    if (first) {
      page.drawText(first, { x: MARGIN + labelW, y, size: qSize, font, color: rgb(0.15, 0.15, 0.15) });
    }
    y -= lineH;

    for (let i = 1; i < lines.length; i++) {
      page.drawText(lines[i], { x: MARGIN, y, size: qSize, font, color: rgb(0.15, 0.15, 0.15) });
      y -= lineH;
    }
    y -= qGap - lineH;
  }

  return doc.save();
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing file id' });

  try {
    // Χρησιμοποιεί το ίδιο getFileContent που δουλεύει στο pdf/[fileId].js
    const content = await getFileContent(session.accessToken, id);
    const pdfBytes = new Uint8Array(content);

    // GET → μόνο PDF
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      return res.send(Buffer.from(pdfBytes));
    }

    // POST → PDF + ερωτήσεις
    if (req.method === 'POST') {
      const { questions } = req.body || {};

      if (!questions || questions.length === 0) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        return res.send(Buffer.from(pdfBytes));
      }

      const mergedDoc = await PDFDocument.load(pdfBytes);
      const questionsBytes = await buildQuestionsPage(questions, 'Document');
      const questionsDoc = await PDFDocument.load(questionsBytes);
      const copiedPages = await mergedDoc.copyPages(questionsDoc, questionsDoc.getPageIndices());
      copiedPages.forEach(p => mergedDoc.addPage(p));

      const finalBytes = await mergedDoc.save();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(Buffer.from(finalBytes));
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[print] Error:', err);
    return res.status(500).json({ error: 'Failed to generate print PDF: ' + err.message });
  }
}
