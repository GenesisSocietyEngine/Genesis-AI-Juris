import type { Metadata } from "next";
import JurisApp from "../JurisApp";

export const metadata: Metadata = {
  title: "Templates · CaseVant",
  description: "Start a CaseVant case from a structured professional template.",
  alternates: { canonical: "/templates" },
  openGraph: { title: "CaseVant — Make your case.", url: "https://casevant.pro/templates", siteName: "CaseVant" },
};

export default function TemplatesPage() {
  return <JurisApp initialView="templates" autoStartCanopy={false} />;
}
