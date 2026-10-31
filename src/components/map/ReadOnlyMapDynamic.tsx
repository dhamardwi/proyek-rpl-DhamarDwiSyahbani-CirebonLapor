"use client";

import dynamic from "next/dynamic";

const ReadOnlyMap = dynamic(() => import("./ReadOnlyMap"), {
  ssr: false,
  loading: () => <div className="h-[250px] w-full bg-slate-100 animate-pulse rounded-xl" />,
});

export default function ReadOnlyMapDynamic({ position }: { position: [number, number] }) {
  return <ReadOnlyMap position={position} />;
}
