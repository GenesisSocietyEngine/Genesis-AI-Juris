import type { Metadata } from "next";
import MattersClient from "./MattersClient";

export const metadata: Metadata = {
  title: "Matter workspace · GENESIS: JURIS",
  description: "A governed workspace for professional evidence, decisions, requests, and approved outputs.",
  robots: { index: false, follow: false },
};

export default function MattersPage() {
  return <MattersClient />;
}
