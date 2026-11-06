import Link from "next/link";
import {
  MapPin,
  AlertTriangle,
  CheckCircle,
  Zap,
  FileText,
  Wrench,
  Brain,
} from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Laporkan Mudah",
    description:
      "Foto, lokasi, dan deskripsi — kirim laporan kerusakan fasilitas desa dalam hitungan detik.",
  },
  {
    icon: Zap,
    title: "Analisis AI",
    description:
      "Sistem AI menganalisis kategori, tingkat kerusakan, dan prioritas perbaikan secara otomatis.",
  },
  {
    icon: AlertTriangle,
    title: "Pantau Status",
    description:
      "Lacak setiap laporan dari awal hingga selesai secara real-time melalui dashboard Anda.",
  },
  {
    icon: CheckCircle,
    title: "Terselesaikan",
    description:
      "Petugas lapangan mendapat penugasan dan melaporkan bukti perbaikan langsung di platform.",
  },
];

const stats = [
  { label: "Laporan Terkirim", value: "10.000+", icon: FileText },
  { label: "Fasilitas Ditangani", value: "1.200+", icon: Wrench },
  { label: "Desa Terlayani", value: "15+", icon: MapPin },
  { label: "Akurasi AI", value: "94%", icon: Brain },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-svh">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 shadow-sm">
            <Zap className="w-3 h-3" />
            Didukung Kecerdasan Buatan
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight mb-6">
            Laporkan Fasilitas Rusak,{" "}
            <span className="text-blue-600">Cepat &amp; Tepat</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Platform pelaporan kerusakan fasilitas umum desa berbasis AI. Bersama kita bangun desa yang lebih
            baik, satu laporan dalam satu waktu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/reports/create"
              id="cta-buat-laporan"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg shadow-blue-200/60 hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              <AlertTriangle className="w-4 h-4" />
              Buat Laporan Sekarang
            </Link>
            <Link
              href="/login"
              id="cta-masuk"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-8 py-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all hover:-translate-y-0.5 shadow-sm"
            >
              Masuk ke Akun
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="p-6 rounded-xl bg-slate-50/50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 rounded-lg text-blue-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Bagaimana Cara Kerjanya?
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Proses yang sederhana dan transparan dari pelaporan hingga penyelesaian.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="flex flex-col items-start gap-4 p-8 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl transition-all group"
                >
                  <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-6 h-6 text-blue-600 group-hover:text-blue-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl bg-blue-600 p-8 sm:p-12 text-center shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Siap melaporkan kerusakan fasilitas umum?
            </h2>
            <p className="text-blue-100 mb-8 max-w-lg mx-auto text-sm sm:text-base">
              Buat laporan sekarang dan bantu pemerintah desa mempercepat penanganan infrastruktur umum.
            </p>
            <Link
              href="/reports/create"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 hover:bg-slate-50 font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-white/20 hover:-translate-y-0.5"
            >
              <AlertTriangle className="w-4 h-4" />
              Buat Laporan Sekarang
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">C</span>
            </div>
            <span className="font-bold text-sm text-slate-900">CirebonLapor</span>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} CirebonLapor. Sistem Pelaporan Fasilitas Umum Desa Berbasis AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
