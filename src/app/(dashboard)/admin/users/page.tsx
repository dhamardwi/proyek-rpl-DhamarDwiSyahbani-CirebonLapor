"use client";

import Link from "next/link";
import { useUserManagement } from "@/hooks/use-user-management";
import { getPaginationRange } from "@/lib/ui-helpers";
import {
  Search,
  User,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PETUGAS: "Petugas",
  MASYARAKAT: "Masyarakat",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-blue-100 text-blue-700 border-blue-200",
  PETUGAS: "bg-indigo-100 text-indigo-700 border-indigo-200",
  MASYARAKAT: "bg-green-100 text-green-700 border-green-200",
};

export default function UserManagementPage() {
  const {
    users,
    total,
    page,
    pageSize,
    search,
    roleFilter,
    isLoading,
    deletingId,
    showDeleteModal,
    userToDelete,
    deleteError,
    toast,
    setPage,
    setSearch,
    setRoleFilter,
    handleDelete,
    closeDeleteModal,
    confirmDelete,
    totalPages,
  } = useUserManagement();
  const { start, end } = getPaginationRange(page, pageSize, total);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            </span>
            Kembali ke Dashboard
          </Link>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Administrasi</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Manajemen Pengguna</h1>
            <p className="text-sm text-slate-500 sm:text-base">Kelola akun pengguna, peran, dan status akses sistem.</p>
          </div>
        </div>
        <Link
          href="/dashboard/admin/users/create"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Tambah Pengguna
        </Link>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.type === "success" ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-semibold text-slate-900">Filter & Pencarian</CardTitle>
          <p className="mt-0.5 text-sm text-slate-500">Cari pengguna berdasarkan nama/email dan filter berdasarkan peran.</p>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-10"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Semua Role</option>
              <option value="ADMIN">Admin</option>
              <option value="PETUGAS">Petugas</option>
              <option value="MASYARAKAT">Masyarakat</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-col gap-1 border-b border-slate-100 bg-white/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Daftar Pengguna</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Total {total} pengguna terdaftar</p>
          </div>
          {isLoading && <span className="text-xs text-slate-400">Memuat data...</span>}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="px-5">Nama</TableHead>
                  <TableHead className="px-5">Email</TableHead>
                  <TableHead className="w-28 px-5">Role</TableHead>
                  <TableHead className="w-28 px-5">Status</TableHead>
                  <TableHead className="w-24 px-5 text-center">Laporan</TableHead>
                  <TableHead className="w-24 px-5 text-center">Tugas</TableHead>
                  <TableHead className="w-20 px-5 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-md space-y-2">
                        <p className="text-base font-semibold text-slate-800">Tidak ada pengguna ditemukan</p>
                        <p className="text-sm text-slate-500">Sesuaikan pencarian atau filter untuk menampilkan data lain.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="border-slate-100 transition-colors hover:bg-slate-50/70">
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                            <p className="truncate text-xs text-slate-500">{user.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <p className="truncate text-sm text-slate-700">{user.email}</p>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge variant="outline" className={ROLE_COLORS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge variant={user.isActive ? "success" : "danger"} className="px-2.5 py-1 text-xs">
                          {user.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center">
                        <p className="text-sm font-medium text-slate-900">{user.reportCount}</p>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center">
                        <p className="text-sm font-medium text-slate-900">{user.taskCount}</p>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={isLoading || deletingId !== null}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Hapus Pengguna"
                          aria-label={`Hapus pengguna ${user.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Menampilkan <span className="font-medium text-slate-900">{start}</span> -{" "}
                <span className="font-medium text-slate-900">{end}</span> dari{" "}
                <span className="font-medium text-slate-900">{total}</span> pengguna
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1 || isLoading}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <p className="px-2 text-sm text-slate-600">
                  Halaman <span className="font-medium text-slate-900">{page}</span> dari{" "}
                  <span className="font-medium text-slate-900">{totalPages}</span>
                </p>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages || isLoading}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeDeleteModal} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Konfirmasi Hapus</h2>
                <p className="mt-1 text-sm text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
              <button
                onClick={closeDeleteModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Apakah Anda yakin ingin menghapus pengguna <strong className="text-slate-900">&quot;{userToDelete.name}&quot;</strong>{" "}
                <span className="text-slate-500">({userToDelete.email})</span>?
              </p>
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                Laporan dan tugas terkait pengguna ini dapat terpengaruh setelah penghapusan.
              </div>
              {deleteError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  {deleteError}
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={closeDeleteModal}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId === userToDelete.id}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === userToDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>{deletingId === userToDelete.id ? "Menghapus..." : "Hapus Pengguna"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
