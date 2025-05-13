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
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
