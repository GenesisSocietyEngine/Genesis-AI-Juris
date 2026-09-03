import type { Metadata } from "next";
import JurisApp from "../JurisApp";

export const metadata: Metadata = {
  title: "Falcon-Merlin Case Studio",
  description: "A professional workbench for tax and legal advisers to structure cases, compare scenarios and preserve a canonical methodology.",
};

export default function FalconMerlinStudioPage() {
  return <JurisApp studioOnly />;
}
