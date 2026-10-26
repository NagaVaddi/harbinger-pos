import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Harbinger POS',
  description: 'GCC-ready Point of Sale & Franchise Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
