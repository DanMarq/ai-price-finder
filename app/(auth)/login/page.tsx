import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "Entrar | BuscaPreço IA" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-foreground">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse sua conta para criar alertas de preço e monitorar produtos.
        </p>
        <div className="mt-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>
      </Card>
    </div>
  );
}
