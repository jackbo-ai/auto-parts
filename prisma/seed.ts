import { PrismaClient, StockMovementType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@autoparts.local";
  const passwordHash = await bcrypt.hash("admin1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Administrateur",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin: ${adminEmail} / admin1234`);

  if ((await prisma.part.count()) > 0) {
    console.log("Données déjà présentes — seed catalogue ignoré.");
    return;
  }

  // Catégories (2 niveaux)
  const freinage = await prisma.category.create({
    data: { name: "Freinage", slug: "freinage" },
  });
  const plaquettes = await prisma.category.create({
    data: { name: "Plaquettes", slug: "plaquettes", parentId: freinage.id },
  });
  const disques = await prisma.category.create({
    data: { name: "Disques", slug: "disques", parentId: freinage.id },
  });
  const filtration = await prisma.category.create({
    data: { name: "Filtration", slug: "filtration" },
  });
  const filtresHuile = await prisma.category.create({
    data: { name: "Filtres à huile", slug: "filtres-huile", parentId: filtration.id },
  });

  // Fournisseurs
  const bosch = await prisma.supplier.create({
    data: { name: "Bosch France", email: "pro@bosch.fr", phone: "01 40 00 00 00" },
  });
  const valeo = await prisma.supplier.create({
    data: { name: "Valeo Distribution", email: "commande@valeo.com" },
  });

  // Pièces
  const seedParts: {
    reference: string;
    oemReference?: string;
    name: string;
    brand: string;
    categoryId: string;
    supplierId: string;
    purchasePriceHt: number;
    salePriceHt: number;
    stockQty: number;
    reorderThreshold: number;
    location: string;
    fitments: { make: string; model: string; engine?: string; yearFrom?: number; yearTo?: number }[];
  }[] = [
    {
      reference: "AP-PLQ-001",
      oemReference: "0986494600",
      name: "Jeu de plaquettes de frein avant",
      brand: "Bosch",
      categoryId: plaquettes.id,
      supplierId: bosch.id,
      purchasePriceHt: 18.5,
      salePriceHt: 34.9,
      stockQty: 24,
      reorderThreshold: 8,
      location: "A1-03",
      fitments: [
        { make: "Renault", model: "Clio IV", engine: "1.5 dCi", yearFrom: 2012, yearTo: 2019 },
        { make: "Renault", model: "Captur", engine: "1.5 dCi", yearFrom: 2013, yearTo: 2019 },
      ],
    },
    {
      reference: "AP-DSQ-014",
      oemReference: "0986479B21",
      name: "Disque de frein ventilé avant Ø280",
      brand: "Bosch",
      categoryId: disques.id,
      supplierId: bosch.id,
      purchasePriceHt: 27.0,
      salePriceHt: 49.9,
      stockQty: 6,
      reorderThreshold: 10,
      location: "A2-11",
      fitments: [
        { make: "Peugeot", model: "308 II", engine: "1.6 BlueHDi", yearFrom: 2013, yearTo: 2021 },
      ],
    },
    {
      reference: "AP-FIL-220",
      oemReference: "0451103316",
      name: "Filtre à huile vissable",
      brand: "Valeo",
      categoryId: filtresHuile.id,
      supplierId: valeo.id,
      purchasePriceHt: 3.2,
      salePriceHt: 7.5,
      stockQty: 120,
      reorderThreshold: 30,
      location: "B4-02",
      fitments: [
        { make: "Volkswagen", model: "Golf VII", engine: "1.6 TDI", yearFrom: 2012, yearTo: 2020 },
        { make: "Audi", model: "A3 8V", engine: "2.0 TDI", yearFrom: 2012, yearTo: 2020 },
      ],
    },
  ];

  const partsByRef: Record<string, { id: string; stockQty: number }> = {};
  for (const p of seedParts) {
    const { fitments, ...partData } = p;
    const part = await prisma.part.create({
      data: {
        ...partData,
        fitments: { create: fitments },
        movements: {
          create: {
            type: StockMovementType.IN,
            quantity: partData.stockQty,
            resulting: partData.stockQty,
            reason: "Stock initial (seed)",
            createdById: admin.id,
          },
        },
      },
    });
    partsByRef[part.reference] = { id: part.id, stockQty: part.stockQty };
    console.log(`Pièce: ${part.reference} — ${part.name}`);
  }

  // Clients
  const garageDupont = await prisma.customer.create({
    data: {
      name: "Garage Dupont",
      email: "contact@garage-dupont.fr",
      phone: "02 99 00 11 22",
    },
  });
  await prisma.customer.create({
    data: { name: "Auto Service Plus", email: "achats@autoserviceplus.fr" },
  });

  // Commande d'achat réceptionnée → entrée en stock.
  const plq = partsByRef["AP-PLQ-001"];
  const dsq = partsByRef["AP-DSQ-014"];
  const fil = partsByRef["AP-FIL-220"];

  const purchase = await prisma.purchaseOrder.create({
    data: {
      reference: "ACH-0001",
      supplierId: bosch.id,
      status: "RECEIVED",
      receivedAt: new Date(),
      createdById: admin.id,
      lines: {
        create: [
          { partId: plq.id, quantity: 20, unitPriceHt: 18.5, vatRate: 0.2 },
          { partId: dsq.id, quantity: 15, unitPriceHt: 27.0, vatRate: 0.2 },
        ],
      },
    },
  });
  for (const [part, qty] of [
    [plq, 20],
    [dsq, 15],
  ] as const) {
    part.stockQty += qty;
    await prisma.stockMovement.create({
      data: {
        partId: part.id,
        type: StockMovementType.IN,
        quantity: qty,
        resulting: part.stockQty,
        reason: `Réception achat ${purchase.reference}`,
        createdById: admin.id,
      },
    });
    await prisma.part.update({
      where: { id: part.id },
      data: { stockQty: part.stockQty },
    });
  }
  console.log(`Commande achat: ${purchase.reference} (réceptionnée)`);

  // Commande client livrée et facturée → sortie de stock.
  const sale = await prisma.salesOrder.create({
    data: {
      reference: "VTE-0001",
      customerId: garageDupont.id,
      status: "INVOICED",
      deliveredAt: new Date(),
      invoicedAt: new Date(),
      createdById: admin.id,
      lines: {
        create: [
          {
            partId: plq.id,
            quantity: 10,
            unitPriceHt: 34.9,
            vatRate: 0.2,
            unitCostHt: 18.5,
          },
          {
            partId: fil.id,
            quantity: 40,
            unitPriceHt: 7.5,
            vatRate: 0.2,
            unitCostHt: 3.2,
          },
        ],
      },
    },
  });
  for (const [part, qty] of [
    [plq, 10],
    [fil, 40],
  ] as const) {
    part.stockQty -= qty;
    await prisma.stockMovement.create({
      data: {
        partId: part.id,
        type: StockMovementType.OUT,
        quantity: -qty,
        resulting: part.stockQty,
        reason: `Livraison vente ${sale.reference}`,
        createdById: admin.id,
      },
    });
    await prisma.part.update({
      where: { id: part.id },
      data: { stockQty: part.stockQty },
    });
  }
  console.log(`Commande client: ${sale.reference} (facturée)`);

  // Un client sans commande, et une commande d'achat en brouillon pour
  // illustrer les états en cours.
  await prisma.purchaseOrder.create({
    data: {
      reference: "ACH-0002",
      supplierId: valeo.id,
      status: "DRAFT",
      createdById: admin.id,
      lines: {
        create: [
          { partId: fil.id, quantity: 100, unitPriceHt: 3.1, vatRate: 0.2 },
        ],
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
