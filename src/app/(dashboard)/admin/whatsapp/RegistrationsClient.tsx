"use client";
import { getErrorMessage } from "@/lib/ui-helpers";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export interface RegistrationRow {
  id: string;
  phoneNumber: string;
  maskedPhoneNumber: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  otpSentAt: string | null;
  otpSendError: string | null;
  otpExpiresAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  activeLink: {
    maskedPhoneNumber: string;
    verifiedAt: string;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  VERIFIED: "Terverifikasi",
  CANCELLED: "Dibatalkan",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-blue-100 text-blue-700 border-blue-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  VERIFIED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

type RegistrationsApiResponse = {
  success?: boolean;
  message?: string;
  data?: { registrations?: RegistrationRow[] };
};

async function readJsonSafe(res: Response): Promise<RegistrationsApiResponse> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      res.status === 404
        ? "Endpoint persetujuan tidak ditemukan. Restart server development agar route baru dikenali."
        : `Server mengembalikan respons tidak valid (HTTP ${res.status}). Periksa log server.`
    );
  }
  return res.json();
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface WhatsappRegistrationsClientProps {
  initialRegistrations: RegistrationRow[];
}

export default function WhatsappRegistrationsClient({
  initialRegistrations,
}: WhatsappRegistrationsClientProps) {
  const [rows, setRows] = useState<RegistrationRow[]>(initialRegistrations);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RegistrationRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );

  const loadRegistrations = useCallback(async (status: string, term: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (term.trim()) params.set("search", term.trim());

      const res = await fetch(`/api/admin/whatsapp/registrations?${params}`, {
        cache: "no-store",
      });
      const json = await readJsonSafe(res);
      if (!res.ok || !json.success) {
        throw new Error(getErrorMessage(json, "Gagal memuat pengajuan"));
      }
      setRows(json.data?.registrations ?? []);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Gagal memuat pengajuan",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  const runAction = async (
    row: RegistrationRow,
    action: "APPROVE" | "REJECT" | "RESEND",
    reason?: string
  ) => {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/whatsapp/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: row.id, action, reason }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || !json.success) {
        throw new Error(getErrorMessage(json, "Gagal memproses pengajuan"));
      }
      showToast(getErrorMessage(json, "Pengajuan berhasil diproses"), "success");
      setRejectTarget(null);
      setRejectReason("");
      await loadRegistrations(statusFilter, search);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memproses pengajuan", "error");
    } finally {
      setBusyId(null);
    }
  };

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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Administrasi
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Persetujuan WhatsApp
            </h1>
            <p className="text-sm text-slate-500 sm:text-base">
              Tinjau pengajuan nomor WhatsApp pengguna, setujui atau tolak, lalu pantau status
              pengiriman OTP.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void loadRegistrations(statusFilter, search);
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Muat Ulang
        </Button>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-semibold text-slate-900">
            Filter Pengajuan
          </CardTitle>
          <p className="mt-0.5 text-sm text-slate-500">
            Cari berdasarkan nama, email, atau nomor WhatsApp.
          </p>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari nama, email, atau nomor..."
                value={search}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearch(value);
                  void loadRegistrations(statusFilter, value);
                }}
                className="h-10 pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                const value = e.target.value;
                setStatusFilter(value);
                void loadRegistrations(value, search);
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="PENDING">Menunggu Persetujuan</option>
              <option value="APPROVED">Disetujui (menunggu OTP)</option>
              <option value="REJECTED">Ditolak</option>
              <option value="VERIFIED">Terverifikasi</option>
              <option value="CANCELLED">Dibatalkan</option>
              <option value="ALL">Semua Status</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-col gap-1 border-b border-slate-100 bg-white/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Daftar Pengajuan
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">Total {rows.length} pengajuan</p>
          </div>
          {isLoading && <span className="text-xs text-slate-400">Memuat data...</span>}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="px-5">Pengguna</TableHead>
                  <TableHead className="px-5">Nomor WhatsApp</TableHead>
                  <TableHead className="w-36 px-5">Status</TableHead>
                  <TableHead className="w-48 px-5">Pengiriman OTP</TableHead>
                  <TableHead className="w-64 px-5 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-md space-y-2">
                        <MessageCircle className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="text-base font-semibold text-slate-800">
                          Tidak ada pengajuan ditemukan
                        </p>
                        <p className="text-sm text-slate-500">
                          Sesuaikan filter atau tunggu pengajuan baru dari pengguna.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {row.user.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">{row.user.email}</p>
                            {row.activeLink && (
                              <p className="mt-0.5 text-xs text-green-700">
                                Aktif: {row.activeLink.maskedPhoneNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <p className="font-mono text-sm text-slate-800">{row.phoneNumber}</p>
                        <p className="text-xs text-slate-500">
                          Diajukan {formatDate(row.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[row.status] ?? ""}
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                        {row.rejectionReason && (
                          <p className="mt-1 text-xs text-red-600">{row.rejectionReason}</p>
                        )}
                        {row.reviewedAt && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Ditinjau {formatDate(row.reviewedAt)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-slate-600">
                        {row.otpSentAt ? (
                          <span className="text-green-700">
                            Terkirim {formatDate(row.otpSentAt)}
                          </span>
                        ) : row.otpSendError ? (
                          <span className="text-red-600">Gagal: {row.otpSendError}</span>
                        ) : (
                          <span className="text-slate-400">Belum dikirim</span>
                        )}
                        {row.otpExpiresAt && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Berlaku s.d. {formatDate(row.otpExpiresAt)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {row.status === "PENDING" && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => runAction(row, "APPROVE")}
                                disabled={busyId !== null}
                              >
                                {busyId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                                Setujui
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setRejectTarget(row);
                                  setRejectReason("");
                                }}
                                disabled={busyId !== null}
                              >
                                <X className="h-4 w-4" />
                                Tolak
                              </Button>
                            </>
                          )}
                          {row.status === "APPROVED" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => runAction(row, "RESEND")}
                              disabled={busyId !== null}
                            >
                              {busyId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              Kirim Ulang OTP
                            </Button>
                          )}

                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setRejectTarget(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Tolak Pengajuan</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {rejectTarget.user.name} - {rejectTarget.phoneNumber}
                </p>
              </div>
              <button
                onClick={() => setRejectTarget(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="text-sm font-medium text-slate-700" htmlFor="reject-reason">
              Alasan penolakan (opsional)
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Contoh: nomor tidak aktif atau bukan milik pengguna."
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setRejectTarget(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                onClick={() => runAction(rejectTarget, "REJECT", rejectReason)}
                disabled={busyId !== null}
              >
                {busyId === rejectTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Tolak Pengajuan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
