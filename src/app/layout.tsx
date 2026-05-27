import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "QuickVoice",
  description: "QuickVoice speech workbench",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
