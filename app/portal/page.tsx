import { getChatGPTUser } from "../chatgpt-auth";
import Portal from "./Portal";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Client portal | CaseVant",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function ClientPortalPage() {
  const user = await getChatGPTUser();
  return (
    <main className="portal-page">
      <Portal
        signedIn={user?.authSource === "chatgpt"}
        account={user?.authSource === "chatgpt" ? user.email : undefined}
      />
    </main>
  );
}
