import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";

export const metadata: Metadata = {
  title: "CirebonLapor – Sistem Pelaporan Fasilitas Umum",
  description: "Platform pelaporan kerusakan fasilitas umum desa berbasis AI. Laporkan, pantau, dan selesaikan masalah infrastruktur desa dengan mudah.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full bg-[var(--background)] text-slate-900 font-sans antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
          <ChatbotWidget />
        </Providers>
      </body>
    </html>
  );
}
