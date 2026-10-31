import Link from "next/link";
import { MapPin, AlertTriangle, CheckCircle, Zap } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Laporkan Mudah",
    description: "Foto, lokasi, deskripsi — kirim laporan kerusakan fasilitas desa dalam hitungan detik.",
  },
  {
    icon: Zap,
    title: "Analisis AI",
    description: "Sistem AI kami menganalisis kategori, tingkat kerusakan, dan prioritas perbaikan secara otomatis.",
  },
  {
    icon: AlertTriangle,
    title: "Pantau Status",
    description: "Lacak setiap laporan dari awal hingga selesai secara real-time.",
  },
  {
    icon: CheckCircle,
    title: "Terselesaikan",
    description: "Petugas mendapat penugasan yang tepat dan melaporkan bukti perbaikan langsung di platform.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" />
            Didukung Kecerdasan Buatan
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight mb-6">
            Laporkan Fasilitas Rusak,{" "}
            <span className="text-blue-600">Cepat &amp; Tepat</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            Platform pelaporan kerusakan fasilitas umum desa berbasis AI. Bersama kita bangun desa yang lebih baik, satu laporan dalam satu waktu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/reports/create"
              id="cta-buat-laporan"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              <AlertTriangle className="w-4 h-4" />
              Buat Laporan Sekarang
            </Link>
            <Link
              href="/login"
              id="cta-masuk"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-8 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all hover:-translate-y-0.5"
            >
              Masuk ke Akun
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Bagaimana Cara Kerjanya?</h2>
          <p className="text-slate-500 text-center mb-14 max-w-xl mx-auto">
            Proses yang sederhana dan transparan dari pelaporan hingga penyelesaian.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="flex flex-col items-start gap-3 p-6 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all bg-slate-50/50 hover:bg-white"
                >
                  <div className="p-2.5 bg-blue-100 rounded-xl">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t bg-white text-center text-sm text-slate-400">
        © {new Date().getFullYear()} CirebonLapor. Sistem Pelaporan Fasilitas Umum Desa Berbasis AI.
      </footer>
    </div>
  );
}
