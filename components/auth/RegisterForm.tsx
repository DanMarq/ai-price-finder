"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerUser } from "@/app/(auth)/cadastro/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await registerUser({ ok: false }, formData);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível criar sua conta");
      setIsPending(false);
      return;
    }

    await signIn("credentials", { email, password, redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nome" name="name" type="text" autoComplete="name" required />
      <Input label="E-mail" name="email" type="email" autoComplete="email" required />
      <Input
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="mt-2 w-full">
        {isPending ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
