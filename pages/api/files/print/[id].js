// pages/api/files/print/[id].js
// POST: δέχεται { questions: [...] } και επιστρέφει PDF κειμένου + σελίδα ερωτήσεων
// GET: επιστρέφει μόνο το PDF (fallback)

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { google } from 'googleapis';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function getDrive(session) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  return google.drive({ version: 'v3', auth });
}

async function downloadPdf(drive, fileId) {
  const meta = await drive.files.get({ fileId, fields: 'name,mimeType' });
  const mimeType = meta.data.mimeType;
  let buffer;
  if (mimeType === 'application/vnd.google-apps.document') {
    const exp = await drive.files.export(
      { fileId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    );
    buffer = exp.data;
  } else {
    const dl = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    buffer = dl.data;
  }
  return { buffer: new Uint8Array(buffer), name: meta.data.name };
}

function sortCode(code) {
  const m = (code || '').match(/^([Α-Ωα-ω]+)(\d*)$/u);
  if (!m) return 9999;
  return m[1].charCodeAt(0) * 1000 + (parseInt(m[2]) || 0);
}

async function buildQuestionsPage(questions, docTitle) {
  const doc = await PDFDocument.create();

  // Helvetica — ενσωματωμένη, δεν χρειάζεται fontkit
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const USABLE_W = PAGE_W - 2 * MARGIN;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Τίτλος
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
  const lineHeight = 16;
  const qGap = 14;

  for (const q of sorted) {
    const label = q.code || '-';
    const text = q.text || '';
    const fullText = label + '.  ' + text;
    const words = fullText.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const test = currentLine ? currentLine + ' ' + word : word;
      const width = font.widthOfTextAtSize(test, qSize);
      if (width > USABLE_W && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);

    const neededHeight = lines.length * lineHeight + qGap;
    if (y - neededHeight < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }

    // Bold label
    const labelStr = label + '.';
    const labelWidth = fontBold.widthOfTextAtSize(labelStr + '  ', qSize);
    page.drawText(labelStr, { x: MARGIN, y, size: qSize, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    const firstLineText = lines[0]?.substring((label + '.  ').length) || '';
    if (firstLineText) {
      page.drawText(firstLineText, { x: MARGIN + labelWidth, y, size: qSize, font, color: rgb(0.15, 0.15, 0.15) });
    }
    y -= lineHeight;

    for (let i = 1; i < lines.length; i++) {
      page.drawText(lines[i], { x: MARGIN, y, size: qSize, font, color: rgb(0.15, 0.15, 0.15) });
      y -= lineHeight;
    }

    y -= qGap - lineHeight;
  }

  return doc.save();
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing file id' });

  try {
    const drive = await getDrive(session);
    const { buffer: pdfBytes, name: fileName } = await downloadPdf(drive, id);

    // GET → μόνο PDF
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      return res.send(Buffer.from(pdfBytes));
    }

    // POST → PDF + ερωτήσεις
    if (req.method === 'POST') {
      const { questions } = req.body || {};

      if (!questions || questions.length === 0) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
        return res.send(Buffer.from(pdfBytes));
      }

      const mergedDoc = await PDFDocument.load(pdfBytes);
      const docTitle = fileName.replace(/\.[^.]+$/, '');
      const questionsBytes = await buildQuestionsPage(questions, docTitle);
      const questionsDoc = await PDFDocument.load(questionsBytes);
      const copiedPages = await mergedDoc.copyPages(questionsDoc, questionsDoc.getPageIndices());
      copiedPages.forEach(p => mergedDoc.addPage(p));

      const finalBytes = await mergedDoc.save();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(docTitle + '_me_erotiseis.pdf')}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(Buffer.from(finalBytes));
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[print] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate print PDF' });
  }
}
