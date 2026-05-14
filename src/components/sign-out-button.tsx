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
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Déconnexion</span>
      </Button>
    </form>
  );
}
