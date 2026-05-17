import Link from "next/link";
import {
  Banknote,
  Boxes,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingCart,
} from "lucide-react";
import type { SessionUser } from "@/lib/permissions";
import { ROLE_LABELS, canManageUsers } from "@/lib/permissions";
import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/purchase-orders", label: "Achats", icon: ShoppingCart },
  { href: "/sales-orders", label: "Ventes", icon: Receipt },
  { href: "/encaissements", label: "Encaissements", icon: Banknote },
];

export function Header({ user }: { user: SessionUser }) {
  const nav = canManageUsers(user.role)
    ? [...NAV, { href: "/admin", label: "Admin", icon: Settings }]
    : NAV;

  return (
    <header className="hero-gradient text-white shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight text-white"
        >
          <BrandMark className="h-9 w-9" />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-base">AutoParts</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-red-200">
              Back-office fournisseur de pièces
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden text-right text-xs leading-tight sm:block">
            <div className="font-medium text-white">
              {user.name || user.email}
            </div>
            <div className="text-red-200">{ROLE_LABELS[user.role]}</div>
          </div>
          <SignOutButton />
        </div>
      </div>

      <nav className="container mx-auto -mt-1 flex gap-1 overflow-x-auto px-4 pb-2">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
