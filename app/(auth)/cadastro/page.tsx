import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "Criar conta | BuscaPreço IA" };

export default function CadastroPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-foreground">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre-se para receber alertas quando o preço dos seus produtos cair.
        </p>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
