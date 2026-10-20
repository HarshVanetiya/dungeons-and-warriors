import type { Metadata, Viewport } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { ServerWake } from '@/components/ServerWake';
import './globals.css';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-cinzel' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Dungeon Drill', template: '%s · Dungeon Drill' },
  description: 'A 1v1 dice-duel. Pick a hero, roll, and outlast your opponent.',
};

export const viewport: Viewport = { themeColor: '#07060a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <ServerWake />
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
