import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenPose Tracker',
  description: 'Real-time OpenPose motion tracking with face and hands',
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

