import { redirect } from "next/navigation";
import { requireUser } from "@/lib/permissions";
import { Header } from "@/components/header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header user={user} />
      <main className="container mx-auto flex-1 px-4 py-6">{children}</main>
      <footer className="border-t bg-card py-4 text-center text-xs text-muted-foreground">
        AutoParts — back-office fournisseur de pièces
      </footer>
    </div>
  );
}
