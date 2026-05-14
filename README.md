# AutoParts — back-office fournisseur de pièces automobiles

Application interne de gestion d'un fournisseur de pièces auto :
catalogue, stock et fournisseurs. **Phase 1** du projet (socle interne) ;
les phases suivantes ajouteront le portail B2B (garages) puis la boutique
B2C.

## Stack

- **Next.js 15** (App Router, Server Actions)
- **Prisma** + **SQLite** (fichier unique, persistable sur un volume en prod)
- **NextAuth v5** (Credentials, sessions JWT)
- **Tailwind CSS** + composants maison (style shadcn/ui)

## Démarrage

```bash
npm install
npx prisma migrate dev --name init   # crée la base + applique le schéma
npm run db:seed                      # admin + catalogue de démonstration
npm run dev
```

L'app tourne sur http://localhost:3000.

Compte de démonstration créé par le seed :

- **admin@autoparts.local** / **admin1234** (rôle Administrateur)

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production (génère le client Prisma) |
| `npm run db:migrate:dev` | crée/applique une migration en dev |
| `npm run db:migrate` | applique les migrations en prod |
| `npm run db:seed` | peuple la base (admin + données exemple) |
| `npm run db:studio` | Prisma Studio |

## Modèle de données

- **User** / **Role** (`ADMIN`, `MANAGER`, `STAFF`) — comptes internes
- **Category** — arborescence de catégories (parent/enfants)
- **Supplier** — fournisseurs en amont
- **Part** — pièce : référence interne + OEM, prix achat/vente HT, TVA,
  stock dénormalisé (`stockQty`) et seuil de réappro
- **Fitment** — compatibilité véhicule d'une pièce
- **StockMovement** — entrée / sortie / correction ; met à jour `stockQty`
  dans la même transaction pour éviter toute dérive

## Rôles

| Rôle | Droits |
|---|---|
| Administrateur | tout, dont la gestion des utilisateurs |
| Gestionnaire | catalogue, catégories, fournisseurs, stock |
| Magasinier | lecture du catalogue + saisie de mouvements de stock |

## Périmètre Phase 1

- ✅ Authentification + gestion des utilisateurs
- ✅ Catalogue : pièces (CRUD, recherche, compatibilités), catégories
- ✅ Fournisseurs (CRUD)
- ✅ Stock : mouvements transactionnels, alertes de seuil, valorisation
- ⬜ Phase 2 : portail B2B (devis, commandes, grilles tarifaires)
- ⬜ Phase 3 : boutique B2C + paiement
