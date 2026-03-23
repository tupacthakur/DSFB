import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import '@/styles/globals.css';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SettingsHydrator } from '@/components/layout/SettingsHydrator';
import { ThemeSync } from '@/components/layout/ThemeSync';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { Topbar } from '@/components/layout/Topbar';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Koravo — F&B Intelligence',
  description: 'Food & Beverage intelligence platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('koravo_settings');var m='dark';if(t){try{var p=JSON.parse(t);if(p.theme==='light')m='light';else if(p.theme==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches)m='light';}catch(e){}}document.documentElement.setAttribute('data-theme',m);})();`,
          }}
        />
      </head>
      <body className={outfit.className}>
        <ErrorBoundary level="page">
          <SettingsHydrator />
          <ThemeSync />
          <OfflineBanner />
          <Topbar />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
