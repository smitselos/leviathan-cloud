// pages/_document.js
// Καθολικά <head> tags για όλες τις σελίδες:
// - apple-touch-icon (ΑΠΑΡΑΙΤΗΤΟ για το iOS «Προσθήκη στην οθόνη Αφετηρίας»)
// - manifest (Android/Chrome PWA)
// - theme-color
//
// Ανά σελίδα: το εικονίδιο και ο τίτλος επιλέγονται με βάση τη διαδρομή (route),
// ώστε η /class να εγκαθίσταται στην αρχική οθόνη ως ξεχωριστό εικονίδιο από τη Light.
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document({ icon512, icon192, appTitle }) {
  return (
    <Html lang="el">
      <Head>
        {/* Εικονίδιο εφαρμογής για iOS — το iOS αγνοεί το manifest, διαβάζει ΜΟΝΟ αυτό */}
        <link rel="apple-touch-icon" href={icon512} />
        <link rel="apple-touch-icon" sizes="180x180" href={icon512} />
        <link rel="apple-touch-icon" sizes="192x192" href={icon192} />

        {/* Εικονίδιο browser / favicon */}
        <link rel="icon" type="image/png" sizes="192x192" href={icon192} />
        <link rel="icon" type="image/png" sizes="512x512" href={icon512} />
        <link rel="shortcut icon" href={icon192} />

        {/* PWA manifest (Android/Chrome) */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS standalone behaviour */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={appTitle} />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Χρώμα γραμμής κατάστασης / theme */}
        <meta name="theme-color" content="#1a1a1a" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// Επιλογή εικονιδίου/τίτλου ανά διαδρομή. Τρέχει στον server κατά την πρώτη φόρτωση
// της σελίδας — ακριβώς τη στιγμή που το iOS διαβάζει το <head> για το «Προσθήκη στην οθόνη».
Document.getInitialProps = async (ctx) => {
  const initialProps = await ctx.defaultGetInitialProps(ctx);
  const path = ctx.pathname || '';
  const isClass = path === '/class' || path.startsWith('/class/');

  const branding = isClass
    ? { icon512: '/icon-class-512.png', icon192: '/icon-class-192.png', appTitle: 'Τάξη' }
    : { icon512: '/icon-512.png',       icon192: '/icon-192.png',       appTitle: 'ΛΕΒΙΑΘΑΝ' };

  return { ...initialProps, ...branding };
};
