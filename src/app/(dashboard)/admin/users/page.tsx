"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  User,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  phone: string;
  address: string;
  profileImage: string | null;
  reportCount: number;
  taskCount: number;
  telegramConnected: boolean;
  telegramChatId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
      });
      const res = await fetch(`/api/users?${params}`);
      const data: ApiResponse<{ users: UserRow[]; total: number; page: number; pageSize: number; totalPages: number }> = await res.json();

      if (data.success && data.data) {
        setUsers(data.data.users);
        setTotal(data.data.total);
        setPage(data.data.page);
        setPageSize(data.data.pageSize);
      } else {
        setToast({ message: data.message || "Gagal memuat daftar pengguna", type: "error" });
      }
    } catch {
      setToast({ message: "Terjadi kesalahan server", type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleDelete = (user: UserRow) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus pengguna "${user.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      setUserToDelete(user);
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setDeletingId(userToDelete.id);

    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
      });
      const data: ApiResponse = await res.json();

      if (data.success) {
        setShowDeleteModal(false);
        setUserToDelete(null);
        setDeletingId(null);
        showToast(data.message || "Pengguna berhasil dihapus", "success");
        fetchUsers();
      } else {
        setToast({ message: data.message || "Gagal menghapus pengguna", type: "error" });
        setDeletingId(null);
      }
    } catch {
      setToast({ message: "Terjadi kesalahan server", type: "error" });
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors mb-2 sm:mb-0"
            >
              <span className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <span className="w-2 h-2 bg-blue-600 rounded-full" />
              </span>
              Kembali ke Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">
              Manajemen Pengguna
            </h1>
            <p className="text-sm text-slate-500">
              Kelola seluruh akun pengguna sistem
            </p>
          </div>
          <Link
            href="/dashboard/admin/users/create"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Pengguna
          </Link>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          toast.type === "success"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}

      {/* Search & Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Filter & Pencarian
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white max-w-[200px]"
            >
              <option value="">Semua Role</option>
              <option value="ADMIN">Admin</option>
              <option value="PETUGAS">Petugas</option>
              <option value="MASYARAKAT">Masyarakat</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Daftar Pengguna ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-24">Role</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-center">Laporan</TableHead>
                  <TableHead className="w-20 text-center">Tugas</TableHead>
                  <TableHead className="w-24 text-center">Telegram</TableHead>
                  <TableHead className="w-20 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      Tidak ada pengguna yang ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <p className="text-sm font-medium text-slate-900">{user.email}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge variant="outline" className={ROLE_COLORS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge
                          variant={user.isActive ? "success" : "danger"}
                          className="px-2 py-1 text-xs"
                        >
                          {user.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <p className="text-sm font-medium text-slate-900">{user.reportCount}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <p className="text-sm font-medium text-slate-900">{user.taskCount}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        {user.telegramConnected ? (
                          <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full text-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            Terhubung
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full text-xs">
                            Belum
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={isLoading || deletingId !== null}
                          className="p-2 text-red-600 hover:bg-red-50 hover:text-red-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4">
                <p className="text-sm text-slate-600">
                  Menampilkan {((page - 1) * pageSize + 1) || 0} -{" "}
                  {Math.min(page * pageSize, total)} dari {total} pengguna
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1 || isLoading}
                    className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  <p className="px-3 py-1.5 text-sm text-slate-600">
                    Halaman {page} dari {totalPages}
                  </p>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages || isLoading}
                    className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Konfirmasi Hapus</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Apakah Anda yakin ingin menghapus pengguna <strong>&quot;{userToDelete.name}&quot;</strong> ({userToDelete.email})?
            </p>
            <p className="text-xs text-red-600 mb-6">
              Tindakan ini tidak dapat dibatalkan. Laporan dan tugas terkait pengguna ini juga akan terpengaruh.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId === userToDelete.id}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === userToDelete.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{deletingId === userToDelete.id ? "Menghapus..." : "Hapus Pengguna"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
