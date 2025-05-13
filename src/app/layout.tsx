import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
// Removed: import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'TaskWebhook App',
  description: 'Manage your tasks with AI-powered prioritization.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={${GeistSans.variable} font-sans antialiased} suppressHydrationWarning>
        {children}
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: 
              (function() {
                // This script runs on the client side only
                // It helps prevent hydration mismatches from browser extensions
                document.body.setAttribute('data-client-rendered', 'true');
                
                // Remove any classes added by browser extensions
                if (document.body.classList.contains('clickup-chrome-ext_installed')) {
                  document.body.classList.remove('clickup-chrome-ext_installed');
                }
              })();
            ,
          }}
        />
      </body>
    </html>
  );
}
