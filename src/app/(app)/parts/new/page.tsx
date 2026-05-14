import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { PartForm } from "../part-form";
import { createPart } from "../actions";

export default async function NewPartPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/parts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au catalogue
      </Link>
      <h1 className="text-2xl font-semibold">Nouvelle pièce</h1>
      <PartForm
        action={createPart}
        categories={categories}
        suppliers={suppliers}
      />
    </div>
  );
}
