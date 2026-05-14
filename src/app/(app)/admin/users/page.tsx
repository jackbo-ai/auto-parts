import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDate } from "@/lib/utils";
import {
  createUser,
  deleteUser,
  resetUserPassword,
  toggleUserActive,
  updateUserRole,
} from "./actions";

export default async function AdminUsersPage() {
  const me = await requireRole([Role.ADMIN]);

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Utilisateurs</h1>

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Créer un utilisateur</h2>
        <form action={createUser} className="grid gap-2 sm:grid-cols-2">
          <Input name="name" required placeholder="Nom complet *" />
          <Input name="email" type="email" required placeholder="Email *" />
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Mot de passe (8 car. min) *"
          />
          <Select name="role" defaultValue={Role.STAFF}>
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <Button type="submit">Créer le compte</Button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Comptes existants ({users.length})
        </h2>
        <div className="space-y-2">
          {users.map((u) => {
            const isMe = u.id === me.id;
            return (
              <div
                key={u.id}
                className={`rounded-lg border p-3 ${
                  u.active ? "bg-card" : "bg-muted/50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {u.name}
                      {isMe && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (vous)
                        </span>
                      )}
                    </div>
                    <div className="break-all font-mono text-xs text-muted-foreground">
                      {u.email}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {u.active ? (
                        <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                          Actif
                        </Badge>
                      ) : (
                        <Badge className="border-slate-300 bg-slate-200 text-slate-700">
                          Désactivé
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        Créé le {formatDate(u.createdAt)}
                      </span>
                    </div>
                  </div>
                  <form
                    action={updateUserRole}
                    className="flex items-center gap-1.5"
                  >
                    <input type="hidden" name="userId" value={u.id} />
                    <Select
                      name="role"
                      defaultValue={u.role}
                      disabled={isMe}
                      className="h-9 w-40 disabled:opacity-60"
                    >
                      {Object.values(Role).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                    {!isMe && (
                      <Button type="submit" size="sm" variant="secondary">
                        OK
                      </Button>
                    )}
                  </form>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  {!isMe && (
                    <form action={toggleUserActive}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={u.active ? "outline" : "secondary"}
                      >
                        {u.active ? "Désactiver" : "Réactiver"}
                      </Button>
                    </form>
                  )}
                  <form
                    action={resetUserPassword}
                    className="flex flex-1 items-center gap-1"
                  >
                    <input type="hidden" name="userId" value={u.id} />
                    <Input
                      name="password"
                      type="password"
                      placeholder="Nouveau mot de passe"
                      minLength={8}
                      className="h-9 max-w-xs"
                    />
                    <Button type="submit" size="sm" variant="ghost">
                      Réinitialiser
                    </Button>
                  </form>
                  {!isMe && (
                    <form action={deleteUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        message={`Supprimer le compte de ${u.name} (${u.email}) ?`}
                      >
                        Supprimer
                      </ConfirmSubmit>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
