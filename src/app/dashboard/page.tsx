import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * /dashboard — Entry point yang redirect berdasarkan role.
 * Middleware memastikan hanya user yang sudah login yang sampai di sini.
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;

  if (role === "ADMIN") {
    redirect("/dashboard/admin");
  }

  if (role === "PETUGAS") {
    redirect("/dashboard/petugas");
  }

  // Default: MASYARAKAT
  redirect("/dashboard/masyarakat");
}
