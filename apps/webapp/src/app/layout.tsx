import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  title: "kupitnezabyt",
  description: "Учет регулярно заканчивающихся товаров",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "kupitnezabyt",
    description: "Учет регулярно заканчивающихся товаров",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        type: "image/png"
      }
    ]
  },
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
    statusBarStyle: "black",
    title: "kupitnezabyt"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f19fa7"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var theme = localStorage.getItem("kupitnezabyt.theme");
                  if (theme === "dark" || theme === "light") {
                    document.documentElement.setAttribute("data-theme", theme);
                  }
                } catch (e) {
                  // ignore storage access errors
                }
              })();
              (function () {
                try {
                  if (window.navigator.standalone === true) {
                    document.documentElement.classList.add("is-standalone");
                  }
                } catch (e) {
                  // ignore standalone detection errors
                }
              })();
            `
          }}
        />
      </head>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
