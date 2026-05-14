"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

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
// Le fichier doit comporter quatre colonnes : référence (TecDoc), désignation,
// marque et catégorie. Les marques et catégories absentes de la base sont
// créées à la volée. Les articles sont créés sans prix ; le coût d'achat se
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
  const brandIdx = findColumn(headers, ["marque", "brand"]);
  const categoryIdx = findColumn(headers, ["categ", "famille"]);
  if (refIdx === -1 || nameIdx === -1 || brandIdx === -1 || categoryIdx === -1) {
    redirect("/admin/articles?error=columns");
  }

  // Le fichier peut contenir des doublons : on garde la dernière ligne
  // rencontrée pour chaque référence.
  const parsed = new Map<
    string,
    { name: string; brand: string; category: string }
  >();
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const reference = String(row[refIdx] ?? "").trim();
    const name = String(row[nameIdx] ?? "").trim();
    const brand = String(row[brandIdx] ?? "").trim();
    const category = String(row[categoryIdx] ?? "").trim();
    // Référence, marque et catégorie sont obligatoires : une seule ligne
    // incomplète invalide tout le fichier — rien n'est importé.
    if (!reference) {
      redirect(`/admin/articles?error=missingref&line=${i + 1}`);
    }
    if (!brand) {
      redirect(`/admin/articles?error=missingbrand&line=${i + 1}`);
    }
    if (!category) {
      redirect(`/admin/articles?error=missingcat&line=${i + 1}`);
    }
    if (!name) {
      skipped++;
      continue;
    }
    parsed.set(reference, { name, brand, category });
  }
  if (parsed.size === 0) {
    redirect(`/admin/articles?error=norows&skipped=${skipped}`);
  }

  // Résout marques et catégories en find-or-create (insensible à la casse).
  const brandIdByKey = await resolveBrands(
    [...parsed.values()].map((v) => v.brand),
  );
  const categoryIdByKey = await resolveCategories(
    [...parsed.values()].map((v) => v.category),
  );

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

  const toCreate: {
    reference: string;
    name: string;
    vatRate: number;
    brandId: string;
    categoryId: string;
  }[] = [];
  const toUpdate: {
    reference: string;
    name: string;
    brandId: string;
    categoryId: string;
  }[] = [];
  for (const [reference, { name, brand, category }] of parsed) {
    const brandId = brandIdByKey.get(brand.toLowerCase())!;
    const categoryId = categoryIdByKey.get(category.toLowerCase())!;
    if (existing.has(reference)) {
      toUpdate.push({ reference, name, brandId, categoryId });
    } else {
      toCreate.push({ reference, name, vatRate: 0.2, brandId, categoryId });
    }
  }

  if (toCreate.length > 0) {
    await prisma.part.createMany({ data: toCreate });
  }
  for (const { reference, name, brandId, categoryId } of toUpdate) {
    await prisma.part.update({
      where: { reference },
      data: { name, brandId, categoryId },
    });
  }

  revalidatePath("/parts");
  revalidatePath("/admin/articles");
  revalidatePath("/admin/brands");
  revalidatePath("/admin/categories");
  revalidatePath("/admin");
  redirect(
    `/admin/articles?created=${toCreate.length}&updated=${toUpdate.length}&skipped=${skipped}`,
  );
}

// Find-or-create des marques à partir des noms du fichier. Renvoie une map
// nom-en-minuscules → id, pour rattacher chaque article à sa marque.
async function resolveBrands(names: string[]): Promise<Map<string, string>> {
  const existing = await prisma.brand.findMany({
    select: { id: true, name: true },
  });
  const idByKey = new Map(existing.map((b) => [b.name.toLowerCase(), b.id]));
  const distinct = new Map<string, string>(); // key → libellé original
  for (const name of names) distinct.set(name.toLowerCase(), name);
  for (const [key, label] of distinct) {
    if (!idByKey.has(key)) {
      const created = await prisma.brand.create({ data: { name: label } });
      idByKey.set(key, created.id);
    }
  }
  return idByKey;
}

// Find-or-create des catégories. Les catégories créées le sont à la racine
// (pas de parent) ; le slug est dérivé du nom et désambiguïsé si besoin.
async function resolveCategories(
  names: string[],
): Promise<Map<string, string>> {
  const existing = await prisma.category.findMany({
    select: { id: true, name: true, slug: true },
  });
  const idByKey = new Map(existing.map((c) => [c.name.toLowerCase(), c.id]));
  const usedSlugs = new Set(existing.map((c) => c.slug));
  const distinct = new Map<string, string>();
  for (const name of names) distinct.set(name.toLowerCase(), name);
  for (const [key, label] of distinct) {
    if (idByKey.has(key)) continue;
    const root = slugify(label) || "categorie";
    let slug = root;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${root}-${n++}`;
    usedSlugs.add(slug);
    const created = await prisma.category.create({
      data: { name: label, slug },
    });
    idByKey.set(key, created.id);
  }
  return idByKey;
}
