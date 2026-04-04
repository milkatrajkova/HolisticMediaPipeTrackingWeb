import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Google MediaPipe Holistic Tracker',
  description: 'Real-time MediaPipe Holistic motion tracking with face and hands',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

