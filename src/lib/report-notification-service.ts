import db from "@/lib/db";
import { createNotification } from "@/lib/notification-service";
import type { AutoDecision } from "@/lib/ai-service";
import {
  PRIORITY_LABELS,
  REPORT_STATUS_LABELS,
  type Priority,
  type ReportStatus,
} from "@/lib/constants";
import { formatReportMessage } from "@/lib/telegram/messages";

/**
 * Notification service untuk alur laporan.
 *
 * Modul ini menentukan PENERIMA berdasarkan role/penugasan dan menyusun isi
 * pesan. Pengiriman tetap melalui createNotification() sehingga kanal in-app
 * dan Telegram konsisten.
 */

export interface ReportCreatedNotificationInput {
  report: { id: string; title: string; createdAt: Date };
  reporterId: string;
  reporterName: string;
  autoDecision: AutoDecision;
}

function reporterStatusFor(autoDecision: AutoDecision): ReportStatus {
  if (autoDecision === "AUTO_ACCEPTED") return "DITERIMA";
  if (autoDecision === "AUTO_REJECTED") return "DITOLAK";
  return "MENUNGGU_VERIFIKASI";
}

export async function notifyReportCreated(
  input: ReportCreatedNotificationInput
): Promise<void> {
  const { report, reporterId, reporterName, autoDecision } = input;

  try {
    const status = reporterStatusFor(autoDecision);
    const statusLabel = REPORT_STATUS_LABELS[status];

    const autoSuffix =
      autoDecision === "AUTO_ACCEPTED"
        ? " Laporan Anda terverifikasi otomatis oleh AI."
        : autoDecision === "AUTO_REJECTED"
          ? " Laporan Anda ditolak otomatis oleh AI karena foto tidak menunjukkan kerusakan yang jelas. Admin dapat meninjau ulang."
          : "";

    await createNotification({
      userId: reporterId,
      title: "Laporan Dibuat",
      message: `Laporan Anda berhasil dikirim dan sedang menunggu verifikasi.${autoSuffix}`,
      link: `/my-reports/${report.id}`,
      dedupeKey: `report-created:${report.id}`,
      telegram: {
        text: formatReportMessage({
          heading: "🔔 Laporan Berhasil Dibuat",
          intro: "Halo, laporan Anda sudah kami terima.",
          reportId: report.id,
          reportTitle: report.title,
          status: statusLabel,
          eventTime: report.createdAt,
          footer: "Silakan buka aplikasi untuk memantau perkembangan laporan Anda.",
          linkPath: `/my-reports/${report.id}`,
        }),
      },
    });

    const [admins, petugas] = await Promise.all([
      db.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      }),
      autoDecision === "AUTO_ACCEPTED"
        ? db.user.findMany({
            where: { role: "PETUGAS", isActive: true },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    await Promise.all(
      admins
        .filter((admin) => admin.id !== reporterId)
        .map((admin) =>
          createNotification({
            userId: admin.id,
            title: "Laporan Masuk",
            message: `Laporan baru dari ${reporterName}: "${report.title}".${autoDecision === "AUTO_ACCEPTED" ? " Sudah diverifikasi otomatis oleh AI." : ""}`,
            link: `/admin/reports/${report.id}`,
            dedupeKey: `report-created-admin:${report.id}`,
            telegram: {
              text: formatReportMessage({
                heading: "📥 Laporan Baru Masuk",
                reportId: report.id,
                reportTitle: report.title,
                status: statusLabel,
                eventTime: report.createdAt,
                footer:
                  autoDecision === "AUTO_ACCEPTED"
                    ? "Laporan sudah diverifikasi otomatis oleh AI. Admin tetap dapat meninjau ulang."
                    : "Silakan buka dashboard admin untuk memeriksa laporan.",
                linkPath: `/admin/reports/${report.id}`,
                linkLabel: "Buka dashboard admin",
              }),
            },
          })
        )
    );

    await Promise.all(
      petugas.map((officer) =>
        createNotification({
          userId: officer.id,
          title: "Laporan Terverifikasi",
          message: `Laporan "${report.title}" telah terverifikasi (otomatis oleh AI) dan menunggu penugasan admin.`,
          link: "/tasks",
          dedupeKey: `report-autoaccepted-petugas:${report.id}`,
          telegram: {
            text: formatReportMessage({
              heading: "📋 Laporan Terverifikasi",
              intro: "Laporan berikut sudah terverifikasi dan menunggu penugasan admin.",
              reportId: report.id,
              reportTitle: report.title,
              status: statusLabel,
              eventTime: report.createdAt,
              footer: "Tautan tugas akan tersedia setelah admin menugaskan laporan kepada Anda.",
              linkPath: "/tasks",
              linkLabel: "Buka daftar tugas",
            }),
          },
        })
      )
    );
  } catch (error) {
    console.error(
      "[REPORT_CREATED_NOTIFICATION_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
  }
}

export type AdminReportAction = "VERIFY" | "REJECT" | "ASSIGN" | "PRIORITY";

export interface AdminReportActionNotificationInput {
  action: AdminReportAction;
  report: {
    id: string;
    userId: string;
    title: string;
    address: string;
    status: string;
    assignedTo: string | null;
  };
  note?: string;
  assigneeId?: string;
  assigneeName?: string;
  priority?: string;
  actorId: string;
  actorName: string;
  occurredAt: Date;
}

export async function notifyAdminReportAction(
  input: AdminReportActionNotificationInput
): Promise<void> {
  const { action, report, note, assigneeId, assigneeName, priority } = input;

  try {
    const eventStamp = input.occurredAt.getTime();

    if (action === "VERIFY") {
      await createNotification({
        userId: report.userId,
        title: "Laporan Diverifikasi",
        message: "Laporan Anda telah diverifikasi dan diterima oleh Admin.",
        link: `/my-reports/${report.id}`,
        dedupeKey: `report-verified:${report.id}:${eventStamp}`,
        telegram: {
          text: formatReportMessage({
            heading: "🔔 Laporan Diverifikasi",
            intro: "Halo, laporan Anda telah diverifikasi oleh admin.",
            reportId: report.id,
            reportTitle: report.title,
            status: REPORT_STATUS_LABELS.DITERIMA,
            note: note || undefined,
            eventTime: input.occurredAt,
            footer: "Laporan akan segera ditugaskan kepada petugas.",
            linkPath: `/my-reports/${report.id}`,
          }),
        },
      });

      const petugas = await db.user.findMany({
        where: { role: "PETUGAS", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        petugas.map((officer) =>
          createNotification({
            userId: officer.id,
            title: "Laporan Terverifikasi",
            message: `Laporan "${report.title}" telah diverifikasi admin dan menunggu penugasan.`,
            link: "/tasks",
            dedupeKey: `report-verified-petugas:${report.id}:${eventStamp}`,
            telegram: {
              text: formatReportMessage({
                heading: "📋 Laporan Siap Ditugaskan",
                intro: "Laporan berikut sudah diverifikasi admin dan menunggu penugasan.",
                reportId: report.id,
                reportTitle: report.title,
                status: REPORT_STATUS_LABELS.DITERIMA,
                eventTime: input.occurredAt,
                footer: "Admin akan menugaskan laporan ini kepada petugas yang sesuai.",
                linkPath: "/tasks",
                linkLabel: "Buka daftar tugas",
              }),
            },
          })
        )
      );
      return;
    }

    if (action === "REJECT") {
      const reason = note || "Tidak memenuhi syarat.";

      await createNotification({
        userId: report.userId,
        title: "Laporan Ditolak",
        message: `Laporan Anda ditolak. Alasan: ${reason}`,
        link: `/my-reports/${report.id}`,
        dedupeKey: `report-rejected:${report.id}:${eventStamp}`,
        telegram: {
          text: formatReportMessage({
            heading: "🔔 Laporan Ditolak",
            intro: "Halo, laporan Anda belum dapat kami terima.",
            reportId: report.id,
            reportTitle: report.title,
            status: REPORT_STATUS_LABELS.DITOLAK,
            note: reason,
            eventTime: input.occurredAt,
            footer: "Silakan buka aplikasi untuk melihat detail laporan.",
            linkPath: `/my-reports/${report.id}`,
          }),
        },
      });
      return;
    }

    if (action === "ASSIGN" && assigneeId) {
      let officerName = assigneeName;
      if (!officerName) {
        const assignee = await db.user.findUnique({
          where: { id: assigneeId },
          select: { name: true },
        });
        officerName = assignee?.name;
      }
      officerName = officerName ?? "petugas";

      await createNotification({
        userId: report.userId,
        title: "Petugas Ditugaskan",
        message: `Laporan Anda telah ditugaskan kepada petugas: ${officerName} dan akan segera ditangani.`,
        link: `/my-reports/${report.id}`,
        dedupeKey: `report-assigned-reporter:${report.id}:${eventStamp}`,
        telegram: {
          text: formatReportMessage({
            heading: "🔔 Petugas Ditugaskan",
            intro: "Halo, laporan Anda sedang ditangani.",
            reportId: report.id,
            reportTitle: report.title,
            status: REPORT_STATUS_LABELS.DITUGASKAN,
            assignedTo: officerName,
            eventTime: input.occurredAt,
            footer: "Anda dapat memantau perkembangan melalui aplikasi.",
            linkPath: `/my-reports/${report.id}`,
          }),
        },
      });

      await createNotification({
        userId: assigneeId,
        title: "Tugas Baru",
        message: `Anda mendapat tugas baru dari Admin untuk menangani laporan: ${report.title}`,
        link: `/tasks/${report.id}`,
        dedupeKey: `report-assigned-petugas:${report.id}:${eventStamp}`,
        telegram: {
          text: formatReportMessage({
            heading: "📋 Penugasan Laporan Baru",
            reportId: report.id,
            reportTitle: report.title,
            status: REPORT_STATUS_LABELS.DITUGASKAN,
            address: report.address,
            assignedBy: input.actorName,
            eventTime: input.occurredAt,
            footer:
              "Silakan login ke aplikasi untuk melihat detail laporan dan melakukan penanganan.",
            linkPath: `/tasks/${report.id}`,
            linkLabel: "Buka detail tugas",
          }),
        },
      });
      return;
    }

    if (action === "PRIORITY" && report.assignedTo) {
      const priorityLabel = PRIORITY_LABELS[priority as Priority] ?? priority;

      await createNotification({
        userId: report.assignedTo,
        title: "Prioritas Tugas Diperbarui",
        message: `Prioritas laporan "${report.title}" diubah menjadi ${priorityLabel}.`,
        link: `/tasks/${report.id}`,
        dedupeKey: `report-priority:${report.id}:${eventStamp}`,
        telegram: {
          text: formatReportMessage({
            heading: "🔔 Prioritas Tugas Diperbarui",
            reportId: report.id,
            reportTitle: report.title,
            status:
              REPORT_STATUS_LABELS[report.status as ReportStatus] ?? report.status,
            address: report.address,
            note: `Prioritas baru: ${priorityLabel}`,
            eventTime: input.occurredAt,
            footer: "Silakan buka detail tugas untuk melihat pembaruan.",
            linkPath: `/tasks/${report.id}`,
            linkLabel: "Buka detail tugas",
          }),
        },
      });
    }
  } catch (error) {
    console.error(
      "[ADMIN_REPORT_NOTIFICATION_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
  }
}

export interface TaskStatusNotificationInput {
  report: { id: string; userId: string; title: string; address: string };
  newStatus: string;
  note?: string | null;
  actorId: string;
  actorName: string;
  occurredAt: Date;
}

export async function notifyTaskStatusChanged(
  input: TaskStatusNotificationInput
): Promise<void> {
  const { report, newStatus, note, actorId, actorName, occurredAt } = input;

  try {
    const statusLabel =
      REPORT_STATUS_LABELS[newStatus as ReportStatus] ?? newStatus;

    await createNotification({
      userId: report.userId,
      title:
        newStatus === "SELESAI"
          ? "Laporan Selesai Diperbaiki"
          : "Laporan Sedang Diperbaiki",
      message:
        newStatus === "SELESAI"
          ? `Laporan "${report.title}" telah selesai diperbaiki oleh petugas.`
          : `Laporan "${report.title}" sedang dikerjakan oleh petugas.`,
      link: `/my-reports/${report.id}`,
      dedupeKey: `report-work-status:${report.id}:${newStatus}:${occurredAt.getTime()}`,
      telegram: {
        text: formatReportMessage({
          heading:
            newStatus === "SELESAI"
              ? "✅ Laporan Selesai Ditangani"
              : "🔔 Status Penanganan Diperbarui",
          intro:
            newStatus === "SELESAI"
              ? "Halo, laporan Anda telah selesai ditangani oleh petugas."
              : "Halo, laporan Anda sedang dikerjakan oleh petugas.",
          reportId: report.id,
          reportTitle: report.title,
          status: statusLabel,
          note: note || undefined,
          eventTime: occurredAt,
          footer:
            newStatus === "SELESAI"
              ? "Terima kasih telah membantu menjaga fasilitas umum."
              : "Anda dapat memantau perkembangan melalui aplikasi.",
          linkPath: `/my-reports/${report.id}`,
        }),
      },
    });

    // Tahap verifikasi ulang setelah SELESAI tidak ada di sistem ini, jadi
    // admin hanya menerima informasi penyelesaian (bukan permintaan aksi).
    if (newStatus === "SELESAI") {
      const admins = await db.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });

      await Promise.all(
        admins
          .filter((admin) => admin.id !== actorId)
          .map((admin) =>
            createNotification({
              userId: admin.id,
              title: "Laporan Selesai",
              message: `Laporan "${report.title}" telah diselesaikan oleh petugas ${actorName}.`,
              link: `/admin/reports/${report.id}`,
              dedupeKey: `report-completed-admin:${report.id}`,
              telegram: {
                text: formatReportMessage({
                  heading: "✅ Laporan Selesai Ditangani",
                  reportId: report.id,
                  reportTitle: report.title,
                  status: statusLabel,
                  address: report.address,
                  assignedTo: actorName,
                  note: note || undefined,
                  eventTime: occurredAt,
                  footer: "Buka dashboard admin untuk melihat bukti perbaikan.",
                  linkPath: `/admin/reports/${report.id}`,
                  linkLabel: "Buka dashboard admin",
                }),
              },
            })
          )
      );
    }
  } catch (error) {
    console.error(
      "[TASK_STATUS_NOTIFICATION_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
  }
}
