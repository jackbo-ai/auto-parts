// Calcul des totaux d'une commande (achat ou vente). Les lignes portent un
// prix unitaire HT, une quantité et un taux de TVA — tout le reste se déduit.

export type LineLike = {
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function lineTotals(line: LineLike) {
  const ht = round(line.quantity * line.unitPriceHt);
  const ttc = round(ht * (1 + line.vatRate));
  return { ht, ttc, vat: round(ttc - ht) };
}

export function orderTotals(lines: LineLike[]) {
  let ht = 0;
  let ttc = 0;
  for (const line of lines) {
    const t = lineTotals(line);
    ht += t.ht;
    ttc += t.ttc;
  }
  return { ht: round(ht), ttc: round(ttc), vat: round(ttc - ht) };
}
