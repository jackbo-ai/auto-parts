// Génère le prochain numéro de compte AutoParts pour un client (CLI-0001…).
// On s'appuie sur le max existant plutôt que sur un simple count() : ça évite
// les collisions si un client a été supprimé entre-temps. À appeler à l'intérieur
// d'une transaction.

import type { Prisma } from "@prisma/client";

const PREFIX = "CLI-";

export async function nextCustomerAccountNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const last = await tx.customer.findFirst({
    where: { accountNumber: { startsWith: PREFIX } },
    orderBy: { accountNumber: "desc" },
    select: { accountNumber: true },
  });
  let next = 1;
  if (last?.accountNumber) {
    const tail = last.accountNumber.slice(PREFIX.length);
    const parsed = parseInt(tail, 10);
    if (Number.isFinite(parsed) && parsed > 0) next = parsed + 1;
  }
  return `${PREFIX}${String(next).padStart(4, "0")}`;
}
