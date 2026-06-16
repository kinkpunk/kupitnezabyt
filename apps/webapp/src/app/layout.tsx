import type { Metadata, Viewport } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: "kupitnezabyt",
  description: "Учет регулярно заканчивающихся товаров"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f2e8"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
