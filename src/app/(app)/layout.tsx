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
      <footer className="border-t bg-white py-4 text-center text-xs leading-tight text-muted-foreground">
        <div className="font-medium tracking-tight text-slate-700">
          AutoParts
        </div>
        <div className="mt-0.5 uppercase tracking-[0.18em]">
          Back-office fournisseur de pièces
        </div>
      </footer>
    </div>
  );
}
