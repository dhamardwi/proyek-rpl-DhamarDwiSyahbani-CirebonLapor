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
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pb-28 sm:pt-24 lg:pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-blue-50/80 via-white to-transparent" />
          <div className="absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute right-0 top-20 h-64 w-64 rounded-full bg-cyan-100/40 blur-3xl" />
        </div>
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-blue-700 shadow-sm backdrop-blur">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
              <Zap className="h-3 w-3" />
            </span>
            Platform pelaporan berbasis kecerdasan buatan
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl lg:leading-[1.1]">
            Laporkan fasilitas rusak,
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent"> pantau hingga tuntas</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            CirebonLapor membantu masyarakat melaporkan kerusakan fasilitas umum dengan cepat, sementara petugas dan admin
            dapat memverifikasi, menugaskan, dan menyelesaikan laporan secara transparan.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/reports/create"
              id="cta-buat-laporan"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 sm:w-auto"
            >
              <AlertTriangle className="h-4 w-4" />
              Buat Laporan
            </Link>
            <Link
              href="/map"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              <MapPin className="h-4 w-4" />
              Lihat Peta Sebaran
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Sudah punya akun? <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">Masuk di sini</Link>
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-16 sm:pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="group rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{stat.value}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">{stat.label}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Alur Kerja</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Bagaimana CirebonLapor bekerja?
            </h2>
            <p className="mt-4 text-slate-600">
              Proses yang sederhana, terstruktur, dan transparan dari pelaporan hingga penyelesaian.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"
                >
                  <div className="absolute right-4 top-4 text-4xl font-bold text-slate-100 transition-colors group-hover:text-blue-50">0{index + 1}</div>
                  <div className="relative">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 transition-colors group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-600 p-8 text-center shadow-xl shadow-blue-600/20 sm:p-12 lg:p-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_35%)]" />
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Siap membantu memperbaiki fasilitas umum?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-blue-100 sm:text-base">
                Sampaikan laporan dengan detail dan lokasi yang jelas agar proses verifikasi dan penanganan dapat dilakukan lebih cepat.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/reports/create"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-blue-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-50 sm:w-auto"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Buat Laporan Sekarang
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white transition-all hover:bg-white/20 sm:w-auto"
                >
                  Daftar Akun
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-4 border-t border-slate-200/70 bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-[10px] font-bold text-white">CL</div>
            <span className="text-sm font-semibold text-slate-900">CirebonLapor</span>
          </div>
          <p className="text-center text-xs text-slate-500 sm:text-right">
            © {new Date().getFullYear()} CirebonLapor. Sistem Pelaporan Fasilitas Umum Berbasis AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
