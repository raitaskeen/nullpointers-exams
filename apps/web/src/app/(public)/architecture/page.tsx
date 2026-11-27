import type { Metadata } from "next";
import { ArchitecturePage } from "@/features/home/ArchitecturePage";

export const metadata: Metadata = { title: "Architecture" };

export default function Page() {
  return <ArchitecturePage />;
}
