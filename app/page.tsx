import Link from "next/link";
import { SearchBar } from "@/components/search/SearchBar";
import { Card } from "@/components/ui/Card";

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 5-9 5-9-5 9-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l9 5 9-5" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V9M12 19V5M20 19v-7" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8a6 6 0 0112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 17a2.5 2.5 0 005 0" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: LayersIcon,
    title: "Várias fontes, um resultado",
    description: "Combinamos APIs de lojas, buscas na web e IA para juntar as melhores ofertas.",
  },
  {
    icon: ChartIcon,
    title: "Histórico de preços",
    description: "Veja a variação de preço nos últimos dias, semanas e meses antes de comprar.",
  },
  {
    icon: BellIcon,
    title: "Alertas de preço",
    description: "Monitore um produto e receba um e-mail assim que o preço cair.",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-120 w-225 -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:py-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Comparação de preços com apoio de IA
        </span>

        <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          Compare preços entre lojas confiáveis, <span className="text-primary">com apoio de IA</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Busque um produto e a gente cruza ofertas de várias lojas para achar o melhor preço, frete
          e disponibilidade — tudo em um só lugar.
        </p>

        <div className="mt-8 w-full max-w-2xl">
          <SearchBar size="lg" />
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Não achou o que procurava?{" "}
          <Link href="/monitorar" className="font-medium text-primary hover:underline">
            Monitore um produto
          </Link>{" "}
          e avisamos quando encontrarmos.
        </p>

        <div className="mt-16 grid w-full gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="p-5 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <feature.icon className="h-4.5 w-4.5" />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-foreground">{feature.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
