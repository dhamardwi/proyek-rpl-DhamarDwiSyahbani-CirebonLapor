import { PropsWithChildren } from "react";
import Navbar from "@/components/shared/Navbar";

export default function PublicLayout({ children }: PropsWithChildren) {
  return (
    <div className="app-bg flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
