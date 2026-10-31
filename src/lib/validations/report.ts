import { z } from "zod";

export const MAX_REPORT_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_REPORT_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

export const CreateReportSchema = z
  .object({
    title: z.string().min(5, "Judul minimal 5 karakter").max(100, "Judul maksimal 100 karakter"),
    description: z.string().min(10, "Deskripsi minimal 10 karakter"),
    facilityTypeId: z.string().min(1, "Pilih jenis fasilitas"),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    address: z.string().min(5, "Alamat spesifik/patokan diperlukan"),
  })
  .refine(
    (data) => (data.latitude == null) === (data.longitude == null),
    {
      message: "Latitude dan longitude harus diisi bersamaan atau dikosongkan keduanya",
      path: ["latitude"],
    }
  );

export type CreateReportInput = z.infer<typeof CreateReportSchema>;
