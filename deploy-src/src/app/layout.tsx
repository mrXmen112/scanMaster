import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const geistSans = {
  variable: "font-sans",
};

const geistMono = {
  variable: "font-mono",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a2e" },
  ],
};

export const metadata: Metadata = {
  title: "ScanMaster AI - PDF Scanner & Editor",
  description:
    "All-in-one mobile document scanner and PDF editor. Create, scan, edit, compress, and manage PDF documents.",
  keywords: [
    "PDF",
    "Scanner",
    "OCR",
    "PDF Editor",
    "Document Scanner",
    "ScanMaster AI",
  ],
  authors: [{ name: "ScanMaster AI" }],
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-512.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ScanMaster AI",
  },
  applicationName: "ScanMaster AI",
  openGraph: {
    title: "ScanMaster AI",
    description:
      "All-in-one mobile document scanner and PDF editor",
    type: "website",
    siteName: "ScanMaster AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apple PWA meta tags */}
        <link rel="apple-touch-icon" href="/icon-512.png" sizes="512x512" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Android / Chrome PWA meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Android WebView compatibility: allow camera in WebView */}
        <meta name="android-webapp-capable" content="yes" />

        {/* Camera permission hint for Android WebView / TWA */}
        <meta name="permissions-policy" content="camera=(self)" />

        {/*
          Content Security Policy for camera access.
          media-src 'self' blob: is required for getUserMedia() to work.
          This is handled via Next.js headers config or the <meta> tag below.
        */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self' capacitor: ionic: blob: data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' capacitor: ionic:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: capacitor: ionic: https:; media-src 'self' blob: https: capacitor:; connect-src 'self' https: wss: capacitor: ionic: blob:; font-src 'self' data: https:;"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
