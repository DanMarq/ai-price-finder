"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createOrUpdateAlert, type AlertActionState } from "@/app/produto/[slug]/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AlertActionState = { ok: false };

export interface ExistingAlert {
  targetPrice: number | null;
  alertOnAnyDrop: boolean;
}

interface AlertButtonProps {
  productId: string;
  slug: string;
  isAuthenticated: boolean;
  existingAlert?: ExistingAlert | null;
}

export function AlertButton({ productId, slug, isAuthenticated, existingAlert }: AlertButtonProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"target" | "any">(existingAlert?.alertOnAnyDrop ? "any" : "target");
  const [state, formAction, isPending] = useActionState(createOrUpdateAlert, initialState);

  // Fecha o formulário assim que a submissão for bem-sucedida, ajustando o estado durante a
  // renderização (em vez de um efeito) — padrão recomendado para reagir a uma mudança de estado.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.ok) setOpen(false);
  }

  if (!isAuthenticated) {
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(`/produto/${slug}`)}`}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        Entrar para criar alerta de preço
      </Link>
    );
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button variant={existingAlert ? "secondary" : "primary"} onClick={() => setOpen(true)}>
          {existingAlert ? "Editar alerta de preço" : "Criar alerta de preço"}
        </Button>
        {state.ok && <span className="text-sm text-emerald-600 dark:text-emerald-400">Alerta salvo!</span>}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="alertOnAnyDrop" value={mode === "any" ? "on" : ""} />

      <div className="flex flex-col gap-2 text-sm text-foreground sm:flex-row sm:gap-4">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={mode === "target"}
            onChange={() => setMode("target")}
            className="accent-primary"
          />
          Avisar num preço-alvo
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={mode === "any"}
            onChange={() => setMode("any")}
            className="accent-primary"
          />
          Avisar em qualquer queda
        </label>
      </div>

      {mode === "target" && (
        <Input
          name="targetPrice"
          type="number"
          step="0.01"
          min="0"
          placeholder="Ex: 1999.90"
          defaultValue={existingAlert?.targetPrice ?? undefined}
          required
        />
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar alerta"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
