import Link from "next/link";
import { auth } from "@/auth";
import { SearchBar } from "@/components/search/SearchBar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-primary to-indigo-400 text-sm font-bold text-white">
              R
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              BuscaPreço<span className="text-primary">IA</span>
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:hidden">
            <ThemeToggle />
            {session?.user ? (
              <SignOutButton />
            ) : (
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/80 hover:bg-muted"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>

        <div className="hidden flex-1 sm:block">
          <SearchBar size="md" />
        </div>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/monitorar"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Monitorar
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/alertas"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Meus alertas
              </Link>
              <Link
                href="/configuracoes"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Configurações
              </Link>
              <div className="ml-1 h-5 w-px bg-border" />
              <ThemeToggle />
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="ml-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover"
              >
                Criar conta
              </Link>
              <div className="ml-1 h-5 w-px bg-border" />
              <ThemeToggle />
            </>
          )}
        </nav>

        <div className="sm:hidden">
          <SearchBar size="md" />
        </div>

        <nav className="flex items-center gap-4 overflow-x-auto sm:hidden">
          <Link href="/monitorar" className="shrink-0 text-sm font-medium text-muted-foreground">
            Monitorar produto
          </Link>
          {session?.user ? (
            <>
              <Link href="/alertas" className="shrink-0 text-sm font-medium text-muted-foreground">
                Meus alertas
              </Link>
              <Link href="/configuracoes" className="shrink-0 text-sm font-medium text-muted-foreground">
                Configurações
              </Link>
            </>
          ) : (
            <Link href="/cadastro" className="shrink-0 text-sm font-medium text-primary">
              Criar conta
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
