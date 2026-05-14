import { signOut } from "@/auth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="h-4 w-4" />
        Déconnexion
      </Button>
    </form>
  );
}
