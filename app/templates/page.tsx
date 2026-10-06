import type { Metadata } from "next";
import JurisApp from "../JurisApp";

export const metadata: Metadata = {
  title: "Templates · CaseVant",
  description: "Start a CaseVant case from a structured professional template.",
  alternates: { canonical: "/templates" },
};

export default function TemplatesPage() {
  return <JurisApp initialView="templates" autoStartCanopy={false} />;
}
