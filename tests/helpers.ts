import { randomUUID } from "crypto";
import db from "@/lib/db";

export async function resetDatabase() {
  await db.whatsappOutbox.deleteMany();
  await db.whatsappOtp.deleteMany();
  await db.whatsappRegistration.deleteMany();
  await db.whatsappLink.deleteMany();
  await db.notification.deleteMany();
  await db.reportDuplicateAnalysis.deleteMany();
  await db.reportStatusHistory.deleteMany();
  await db.reportImage.deleteMany();
  await db.report.deleteMany();
  await db.facilityType.deleteMany();
  await db.user.deleteMany();
}

export async function createTestUser(role = "MASYARAKAT", name = "Test User") {
  return db.user.create({
    data: {
      name,
      email: `${role.toLowerCase()}-${randomUUID()}@example.com`,
      password: "not-used-in-tests",
      role,
    },
  });
}
