import './globals.css';

export const metadata = {
  title: 'CertFlow – Bulk Certificate Generator',
  description: 'Design a certificate, upload Excel/CSV, export PDFs/PNGs as ZIP, send via Google Sheets.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=DM+Sans:wght@400;600;700&family=Great+Vibes&family=Montserrat:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Poppins:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
