import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings2 } from "lucide-react";
import { formatBuildStamp } from "@/lib/build-stamp";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.email ?? user?.phone ?? "AL").slice(0, 2).toUpperCase();
  // Versão em execução, para acompanhar se o deploy novo já subiu.
  const version = formatBuildStamp();

  return (
    <header className="sticky top-0 z-40 h-[88px] border-b border-border bg-card">
      <div className="mx-auto flex h-full max-w-[1400px] items-center gap-4 px-4 sm:px-8">
        <Link to="/studio" className="flex min-w-0 items-center gap-4">
          <img
            src="/ailou-wordmark.png"
            alt="AiLou"
            className="h-9 w-auto shrink-0 sm:h-11"
            loading="eager"
          />
          <span className="hidden h-11 w-px shrink-0 bg-sand/70 sm:block" />
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="text-[15px] font-semibold uppercase leading-none tracking-[4px] text-primary">
              Studio
            </span>
            <span className="mt-1.5 text-[10px] uppercase leading-none tracking-[2px] text-muted-foreground">
              Estampas &amp; Coleções
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-4">
          <span
            title={[
              version.label,
              `commit ${version.commit}`,
              version.when ? `build de ${version.when}, horário de Brasília` : "",
            ]
              .filter(Boolean)
              .join("\n")}
            className="mr-1 hidden cursor-default rounded-full border border-border px-2.5 py-1 text-[11px] font-medium leading-none text-muted-foreground md:inline-block"
          >
            {version.label}
          </span>
          <Link
            to="/studio"
            className="rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-primary sm:px-3"
            activeProps={{ className: "text-primary font-medium" }}
          >
            Studio
          </Link>
          <Link
            to="/colecoes"
            className="rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-primary sm:px-3"
            activeProps={{ className: "text-primary font-medium" }}
          >
            Minhas coleções
          </Link>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Sua conta">
                  <Avatar className="size-9 shrink-0 border border-border">
                    <AvatarFallback className="bg-blush text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {user.email ?? user.phone}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem onSelect={() => void navigate({ to: "/catalogo" })}>
                    <Settings2 className="size-4" strokeWidth={1.5} />
                    Catálogo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={async () => {
                    await signOut();
                    void navigate({ to: "/entrar" });
                  }}
                >
                  <LogOut className="size-4" strokeWidth={1.5} />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/entrar"
              className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:underline"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
