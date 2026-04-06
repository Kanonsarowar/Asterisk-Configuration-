import './globals.css';

export const metadata = {
  title: 'IPRN Platform',
  description: 'International Premium Rate Number dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
