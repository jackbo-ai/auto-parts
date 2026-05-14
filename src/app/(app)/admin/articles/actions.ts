"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

// Normalise un libellé de colonne : minuscules, sans accents, sans espaces
// superflus — pour reconnaître les en-têtes quelle que soit leur casse.
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

function findColumn(headers: string[], keywords: string[]) {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i] ?? "");
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

// Import d'initialisation de la base articles depuis un fichier CSV ou XLSX.
// Le fichier doit comporter une colonne référence (TecDoc) et une colonne
// désignation. Les articles sont créés sans prix ; le coût d'achat se
// constituera via les commandes d'achat (PMP).
export async function importArticles(formData: FormData) {
  await requireRole([Role.ADMIN]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/articles?error=nofile");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  let rows: unknown[][] = [];
  let parseFailed = false;
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = sheet
      ? XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          blankrows: false,
        })
      : [];
  } catch {
    parseFailed = true;
  }
  if (parseFailed) redirect("/admin/articles?error=parse");
  if (rows.length < 2) redirect("/admin/articles?error=empty");

  const headers = (rows[0] as unknown[]).map((c) => String(c ?? ""));
  const refIdx = findColumn(headers, ["tecdoc", "ref"]);
  const nameIdx = findColumn(headers, ["design", "libell", "nom"]);
  if (refIdx === -1 || nameIdx === -1) {
    redirect("/admin/articles?error=columns");
  }

  // Le fichier peut contenir des doublons : on garde la dernière désignation
  // rencontrée pour chaque référence.
  const parsed = new Map<string, string>();
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const reference = String(row[refIdx] ?? "").trim();
    const name = String(row[nameIdx] ?? "").trim();
    if (!reference || !name) {
      skipped++;
      continue;
    }
    parsed.set(reference, name);
  }
  if (parsed.size === 0) {
    redirect(`/admin/articles?error=norows&skipped=${skipped}`);
  }

  // Quelles références existent déjà ? Requête par lots pour rester sous la
  // limite de variables SQLite.
  const refs = [...parsed.keys()];
  const existing = new Set<string>();
  for (let i = 0; i < refs.length; i += 400) {
    const found = await prisma.part.findMany({
      where: { reference: { in: refs.slice(i, i + 400) } },
      select: { reference: true },
    });
    for (const p of found) existing.add(p.reference);
  }

  const toCreate: { reference: string; name: string; vatRate: number }[] = [];
  const toUpdate: { reference: string; name: string }[] = [];
  for (const [reference, name] of parsed) {
    if (existing.has(reference)) toUpdate.push({ reference, name });
    else toCreate.push({ reference, name, vatRate: 0.2 });
  }

  if (toCreate.length > 0) {
    await prisma.part.createMany({ data: toCreate });
  }
  for (const { reference, name } of toUpdate) {
    await prisma.part.update({ where: { reference }, data: { name } });
  }

  revalidatePath("/parts");
  revalidatePath("/admin/articles");
  revalidatePath("/admin");
  redirect(
    `/admin/articles?created=${toCreate.length}&updated=${toUpdate.length}&skipped=${skipped}`,
  );
}
