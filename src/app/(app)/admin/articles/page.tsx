import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { importArticles } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  nofile: "Aucun fichier sélectionné.",
  parse:
    "Fichier illisible. Vérifiez qu'il s'agit bien d'un CSV ou d'un fichier Excel (.xlsx).",
  empty: "Le fichier est vide ou ne contient aucune ligne de données.",
  columns:
    "Colonnes introuvables. Le fichier doit comporter quatre colonnes : référence (TecDoc), désignation, marque et catégorie.",
  norows: "Aucune ligne valide trouvée dans le fichier.",
};

// Erreurs « une ligne incomplète rejette tout le fichier » : champ manquant
// par clé d'erreur.
const LINE_ERROR_FIELDS: Record<string, string> = {
  missingref: "référence TecDoc",
  missingbrand: "marque",
  missingcat: "catégorie",
};

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    skipped?: string;
    error?: string;
    line?: string;
  }>;
}) {
  await requireRole([Role.ADMIN]);
  const params = await searchParams;
  const partCount = await prisma.part.count();

  const created = Number(params.created ?? 0);
  const updated = Number(params.updated ?? 0);
  const skipped = Number(params.skipped ?? 0);
  const hasResult = params.created != null || params.updated != null;
  let errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? null : null;
  const lineErrorField = params.error
    ? LINE_ERROR_FIELDS[params.error]
    : undefined;
  if (lineErrorField) {
    errorMessage = `${
      params.line ? `Ligne ${params.line} : ` : ""
    }${lineErrorField} manquante. Le fichier entier a été rejeté — aucun article importé.`;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l&apos;administration
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Initialisation base articles</h1>
        <p className="text-sm text-muted-foreground">
          {formatNumber(partCount)} article{partCount > 1 ? "s" : ""}{" "}
          actuellement en base.
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {hasResult && !errorMessage && (
        <div className="space-y-1 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Import terminé
          </div>
          <ul className="ml-5 list-disc">
            <li>{created} article(s) créé(s)</li>
            <li>
              {updated} article(s) mis à jour (désignation, marque, catégorie)
            </li>
            {skipped > 0 && (
              <li>{skipped} ligne(s) ignorée(s) — désignation manquante</li>
            )}
          </ul>
        </div>
      )}

      <section className="space-y-3 rounded-lg border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4" />
          Format du fichier attendu
        </h2>
        <p className="text-sm">
          Un fichier <strong>CSV</strong> ou <strong>Excel (.xlsx)</strong> avec
          une ligne d&apos;en-tête et quatre colonnes :
        </p>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Référence (TecDoc)</th>
                <th className="px-3 py-2">Désignation</th>
                <th className="px-3 py-2">Marque</th>
                <th className="px-3 py-2">Catégorie</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-2 font-mono text-xs">0986494600</td>
                <td className="px-3 py-2">
                  Jeu de plaquettes de frein avant
                </td>
                <td className="px-3 py-2">Bosch</td>
                <td className="px-3 py-2">Freinage</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2 font-mono text-xs">0451103316</td>
                <td className="px-3 py-2">Filtre à huile vissable</td>
                <td className="px-3 py-2">Valeo</td>
                <td className="px-3 py-2">Filtration</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="ml-5 list-disc text-xs text-muted-foreground">
          <li>
            Les en-têtes sont reconnus automatiquement (référence / réf /
            TecDoc, désignation / libellé / nom, marque, catégorie / famille).
          </li>
          <li>
            Référence, marque et catégorie sont obligatoires sur chaque ligne :
            une seule ligne incomplète fait rejeter le fichier entier.
          </li>
          <li>
            Les marques et catégories absentes de la base sont créées
            automatiquement à l&apos;import.
          </li>
          <li>
            Une référence déjà présente voit sa désignation, sa marque et sa
            catégorie mises à jour, sans doublon.
          </li>
          <li>
            Les articles sont créés sans prix : le coût d&apos;achat se
            constitue ensuite via les commandes d&apos;achat (PMP).
          </li>
        </ul>
      </section>

      <form
        action={importArticles}
        className="space-y-3 rounded-lg border bg-card p-5"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Importer le fichier
        </h2>
        <input
          type="file"
          name="file"
          accept=".csv,.xlsx"
          required
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
        />
        <Button type="submit">
          <Upload className="h-4 w-4" />
          Lancer l&apos;import
        </Button>
      </form>
    </div>
  );
}
