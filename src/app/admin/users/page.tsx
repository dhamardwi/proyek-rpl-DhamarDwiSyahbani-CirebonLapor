import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { Search, ShieldAlert, Users } from "lucide-react";
import { Prisma } from "@prisma/client";
import { ToggleUserStatus } from "@/components/admin/UserActionButtons";
import AddPetugasModal from "@/components/admin/AddPetugasModal";

export const metadata = {
  title: "Manajemen User – Admin",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : undefined;
  const tab = typeof sp.tab === 'string' ? sp.tab : 'MASYARAKAT';
  
  const page = typeof sp.page === 'string' ? parseInt(sp.page) : 1;
  const perPage = 10;

  const where: Prisma.UserWhereInput = {
    role: tab
  };
  
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { email: { contains: query } },
    ];
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        _count: {
          select: { reports: true, assignments: true }
        }
      }
    })
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Pengguna</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola akses masyarakat dan petugas lapangan.
          </p>
        </div>
        {tab === "PETUGAS" && <AddPetugasModal />}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <Link 
          href="?tab=MASYARAKAT"
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'MASYARAKAT' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <Users className="w-4 h-4" /> Masyarakat
        </Link>
        <Link 
          href="?tab=PETUGAS"
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'PETUGAS' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <ShieldAlert className="w-4 h-4" /> Petugas
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <form className="flex flex-col sm:flex-row gap-4">
          <input type="hidden" name="tab" value={tab} />
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              name="q"
              defaultValue={query}
              placeholder="Cari nama atau email..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
            />
          </div>
          <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl font-medium text-sm transition-colors">
            Cari
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal Daftar</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {tab === "MASYARAKAT" ? "Jml Laporan" : "Jml Tugas"}
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data pengguna yang ditemukan.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(user.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {tab === "MASYARAKAT" ? user._count.reports : user._count.assignments}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Aktif</span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Nonaktif</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end">
                        <ToggleUserStatus userId={user.id} isActive={user.isActive} currentRole={user.role} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link 
                  href={`/admin/users?tab=${tab}&page=${page - 1}${query ? `&q=${query}` : ''}`}
                  className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Sebelumnya
                </Link>
              )}
              {page < totalPages && (
                <Link 
                  href={`/admin/users?tab=${tab}&page=${page + 1}${query ? `&q=${query}` : ''}`}
                  className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Selanjutnya
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
