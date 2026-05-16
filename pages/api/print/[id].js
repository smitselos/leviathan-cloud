// pages/api/files/print/[id].js
// Σερβίρει PDF με προαιρετική σελίδα ερωτήσεων στο τέλος
// Query: ?withQuestions=true
// Διαβάζει τις ερωτήσεις από leviathan-metadata.json στο Drive

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { google } from 'googleapis';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

async function getDrive(session) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  return google.drive({ version: 'v3', auth });
}

// Ανάκτηση metadata (ερωτήσεις)
async function getMetadata(drive) {
  try {
    const res = await drive.files.list({
      q: "name='leviathan-metadata.json' and trashed=false",
      fields: 'files(id)',
      pageSize: 1,
    });
    if (!res.data.files?.length) return {};
    const content = await drive.files.get(
      { fileId: res.data.files[0].id, alt: 'media' },
      { responseType: 'text' }
    );
    return typeof content.data === 'string' ? JSON.parse(content.data) : content.data;
  } catch (e) {
    console.error('Failed to load metadata:', e.message);
    return {};
  }
}

// Κατέβασμα PDF αρχείου από Drive
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

// Ταξινόμηση κωδικών ερωτήσεων
function sortCode(code) {
  const m = code.match(/^([Α-Ωα-ω]+)(\d*)$/u);
  if (!m) return 9999;
  return m[1].charCodeAt(0) * 1000 + (parseInt(m[2]) || 0);
}

// Δημιουργία σελίδας ερωτήσεων
async function buildQuestionsPage(questions, docTitle) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // Χρήση ενσωματωμένης γραμματοσειράς — τα ελληνικά απαιτούν embedded font
  // Χρησιμοποιούμε NotoSans αν υπάρχει, αλλιώς fallback σε Helvetica
  let font, fontBold;
  const notoPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf');
  const notoBoldPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Bold.ttf');

  if (fs.existsSync(notoPath) && fs.existsSync(notoBoldPath)) {
    const notoBytes = fs.readFileSync(notoPath);
    const notoBoldBytes = fs.readFileSync(notoBoldPath);
    font = await doc.embedFont(notoBytes);
    fontBold = await doc.embedFont(notoBoldBytes);
  } else {
    // Fallback — Helvetica δεν υποστηρίζει ελληνικά καλά,
    // αλλά λειτουργεί βασικά
    font = await doc.embedFont(StandardFonts.Helvetica);
    fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  const PAGE_W = 595.28;  // A4
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const USABLE_W = PAGE_W - 2 * MARGIN;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Τίτλος
  const titleSize = 14;
  page.drawText('ΕΡΩΤΗΣΕΙΣ', { x: MARGIN, y, size: titleSize, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
  y -= 22;

  if (docTitle) {
    const subSize = 10;
    page.drawText(docTitle, { x: MARGIN, y, size: subSize, font, color: rgb(0.45, 0.45, 0.45) });
    y -= 24;
  }

  // Γραμμή διαχωρισμού
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 20;

  // Ερωτήσεις
  const sorted = [...questions].sort((a, b) => sortCode(a.code || '') - sortCode(b.code || ''));
  const qSize = 11;
  const lineHeight = 16;
  const qGap = 14;

  for (const q of sorted) {
    const label = q.code || '•';
    const text = q.text || '';

    // Υπολογισμός γραμμών (word wrap)
    const fullText = `${label}.  ${text}`;
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

    // Νέα σελίδα αν δεν χωράει
    if (y - neededHeight < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }

    // Πρώτη γραμμή με bold κωδικό
    const labelWidth = fontBold.widthOfTextAtSize(label + '.  ', qSize);
    page.drawText(label + '.', { x: MARGIN, y, size: qSize, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    // Κείμενο πρώτης γραμμής
    const firstLineText = lines[0]?.substring((label + '.  ').length) || '';
    if (firstLineText) {
      page.drawText(firstLineText, { x: MARGIN + labelWidth, y, size: qSize, font, color: rgb(0.15, 0.15, 0.15) });
    }
    y -= lineHeight;

    // Υπόλοιπες γραμμές
    for (let i = 1; i < lines.length; i++) {
      page.drawText(lines[i], { x: MARGIN, y, size: qSize, font, color: rgb(0.15, 0.15, 0.15) });
      y -= lineHeight;
    }

    y -= qGap - lineHeight; // extra gap μεταξύ ερωτήσεων
  }

  return doc.save();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  const withQuestions = req.query.withQuestions === 'true';

  if (!id) return res.status(400).json({ error: 'Missing file id' });

  try {
    const drive = await getDrive(session);
    const { buffer: pdfBytes, name: fileName } = await downloadPdf(drive, id);

    if (!withQuestions) {
      // Απλή εκτύπωση — σερβίρισμα PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      return res.send(Buffer.from(pdfBytes));
    }

    // Εκτύπωση με ερωτήσεις
    const metadata = await getMetadata(drive);
    const fileMeta = metadata[id];
    const questions = fileMeta?.questions || [];

    if (questions.length === 0) {
      // Δεν υπάρχουν ερωτήσεις — σερβίρισμα μόνο PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      return res.send(Buffer.from(pdfBytes));
    }

    // Ένωση PDF + σελίδα ερωτήσεων
    const mergedDoc = await PDFDocument.load(pdfBytes);
    
    // Τίτλος εγγράφου (χωρίς extension)
    const docTitle = fileName.replace(/\.[^.]+$/, '');
    
    const questionsBytes = await buildQuestionsPage(questions, docTitle);
    const questionsDoc = await PDFDocument.load(questionsBytes);
    const copiedPages = await mergedDoc.copyPages(questionsDoc, questionsDoc.getPageIndices());
    copiedPages.forEach(p => mergedDoc.addPage(p));

    const finalBytes = await mergedDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(docTitle + '_με_ερωτήσεις.pdf')}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(finalBytes));

  } catch (err) {
    console.error('Print error:', err.message);
    return res.status(500).json({ error: 'Failed to generate print PDF' });
  }
}
