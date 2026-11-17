"use client";
import { getErrorMessage } from "@/lib/ui-helpers";

import { useState, useEffect, useCallback } from "react";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  phone: string;
  address: string;
  reportCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Logika manajemen pengguna yang dipakai bersama oleh halaman users
 * (Tahap C4). Markup tetap berada di masing-masing halaman.
 *
 * Seluruh state, pesan, URL, status yang ditangani, dan urutan aksi
 * disalin apa adanya dari implementasi sebelumnya.
 */
export function useUserManagement() {
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
        setToast({ message: getErrorMessage(data, "Gagal memuat daftar pengguna"), type: "error" });
      }
    } catch {
      setToast({ message: "Terjadi kesalahan server", type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, roleFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleDelete = (user: UserRow) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus pengguna "${user.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      setDeleteError(null);
      setUserToDelete(user);
      setShowDeleteModal(true);
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
    setDeleteError(null);
    setDeletingId(null);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setDeleteError(null);
    setDeletingId(userToDelete.id);

    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
      });
      const data: ApiResponse | null = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        const message = getErrorMessage(data, "Pengguna berhasil dihapus");
        const shouldGoToPreviousPage = users.length === 1 && page > 1;
        closeDeleteModal();
        showToast(message, "success");
        if (shouldGoToPreviousPage) {
          setPage(page - 1);
        } else {
          fetchUsers();
        }
      } else {
        setDeleteError(
          getErrorMessage(
            data,
            res.status === 404
              ? "Pengguna tidak ditemukan atau sudah dihapus."
              : `Gagal menghapus pengguna (HTTP ${res.status}).`
          )
        );
        setDeletingId(null);
      }
    } catch {
      setDeleteError("Tidak dapat terhubung ke server. Silakan coba lagi.");
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return {
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
  };
}
