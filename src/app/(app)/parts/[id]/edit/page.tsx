import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { PartForm } from "../../part-form";
import { updatePart } from "../../actions";

export default async function EditPartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const [part, categories, suppliers] = await Promise.all([
    prisma.part.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!part) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href={`/parts/${part.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la fiche
      </Link>
      <h1 className="text-2xl font-semibold">Modifier la pièce</h1>
      <PartForm
        action={updatePart}
        categories={categories}
        suppliers={suppliers}
        part={part}
      />
    </div>
  );
}
