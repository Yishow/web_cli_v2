import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "web_cli_v2 • wterm + tmux",
  description: "Browser terminal with wterm and persistent tmux sessions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body 
        className="bg-zinc-950 text-white antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
