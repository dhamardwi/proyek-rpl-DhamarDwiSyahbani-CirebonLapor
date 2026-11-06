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
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <Providers>
          <main className="flex-grow">{children}</main>
          <ChatbotWidget />
        </Providers>
      </body>
    </html>
  );
}
