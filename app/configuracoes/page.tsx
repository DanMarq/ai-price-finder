import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Configurações | BuscaPreço IA" };

const LINKS = [
  { href: "/configuracoes/ia", title: "Provedor de IA", description: "Configure sua chave do Gemini (Google AI Studio)" },
  { href: "/configuracoes/conta", title: "Conta", description: "Seus dados de cadastro" },
];

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Configurações</h1>
      <div className="mt-6 flex flex-col gap-3">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="p-4 transition-shadow hover:shadow-md">
              <p className="text-sm font-medium text-foreground">{link.title}</p>
              <p className="text-xs text-muted-foreground">{link.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
