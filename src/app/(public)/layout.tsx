import { PropsWithChildren } from "react";
import Navbar from "@/components/shared/Navbar";

export default function PublicLayout({ children }: PropsWithChildren<{}>) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">{children}</main>
    </div>
  );
}
