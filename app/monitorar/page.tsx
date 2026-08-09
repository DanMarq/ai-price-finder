import type { Metadata } from "next";
import { SearchBar } from "@/components/search/SearchBar";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Monitorar produto | BuscaPreço IA" };

export default function MonitorarPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-foreground">Monitorar um produto</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Descreva o produto que você quer acompanhar (ex: &ldquo;iPhone 15 128GB&rdquo;). A gente
          busca nas lojas agora e, depois de você abrir o produto e criar um alerta de preço,
          continuamos verificando os preços periodicamente e avisamos por e-mail quando cair.
        </p>
        <div className="mt-6">
          <SearchBar size="md" />
        </div>
      </Card>
    </div>
  );
}
