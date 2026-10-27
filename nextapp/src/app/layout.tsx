import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Harbinger POS',
  description: 'GCC-ready Point of Sale & Franchise Platform',
};

// Providers are mounted by (pos)/layout.tsx so context is scoped to the POS shell.
// Non-POS routes (e.g. a future marketing site) are provider-free.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
