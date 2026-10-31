/**
 * src/lib/validations/auth.ts
 * Zod schemas untuk validasi autentikasi.
 */

import { z } from "zod";

// ------------------------------------
// Register Schema
// ------------------------------------
export const RegisterSchema = z
  .object({
    name: z
      .string()
      .min(2, "Nama minimal 2 karakter")
      .max(100, "Nama maksimal 100 karakter")
      .trim(),
    email: z
      .string()
      .email("Format email tidak valid")
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .regex(/[A-Z]/, "Password harus mengandung huruf kapital")
      .regex(/[a-z]/, "Password harus mengandung huruf kecil")
      .regex(/[0-9]/, "Password harus mengandung angka"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password dan konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof RegisterSchema>;

// ------------------------------------
// Login Schema
// ------------------------------------
export const LoginSchema = z.object({
  email: z
    .string()
    .email("Format email tidak valid")
    .toLowerCase()
    .trim(),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
