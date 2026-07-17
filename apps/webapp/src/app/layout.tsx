import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./styles.css";

export const metadata: Metadata = {
  title: "kupitnezabyt",
  description: "Учет регулярно заканчивающихся товаров",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/favicon.png",
        sizes: "32x32",
        type: "image/png"
      },
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      }
    ],
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png"
    }
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "kupitnezabyt"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c94a5f"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
