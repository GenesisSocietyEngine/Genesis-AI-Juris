import type { Metadata } from "next";
import JurisApp from "../JurisApp";

export const metadata: Metadata = { title: "Templates · CaseVant" };

export default function TemplatesPage() {
  return <JurisApp initialView="templates" autoStartCanopy={false} />;
}
