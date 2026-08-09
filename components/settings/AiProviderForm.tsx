"use client";

import { useActionState, useTransition } from "react";
import { saveAiProviderConfig, removeAiProviderConfig, type AiConfigActionState } from "@/app/configuracoes/ia/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const initialState: AiConfigActionState = { ok: false };

export interface AiProviderFormProps {
  hasKey: boolean;
  maskedKey: string | null;
  model: string;
  enableGroundingSearch: boolean;
  defaultModel: string;
}

export function AiProviderForm({ hasKey, maskedKey, model, enableGroundingSearch, defaultModel }: AiProviderFormProps) {
  const [state, formAction, isPending] = useActionState(saveAiProviderConfig, initialState);
  const [isRemoving, startRemoveTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      {hasKey && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Chave configurada</p>
            <p className="text-xs text-muted-foreground">{maskedKey} · modelo {model}</p>
          </div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={isRemoving}
            onClick={() =>
              startRemoveTransition(async () => {
                await removeAiProviderConfig();
              })
            }
          >
            {isRemoving ? "Removendo..." : "Remover"}
          </Button>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <Input
          label="Chave da API do Google AI Studio"
          name="apiKey"
          type="password"
          placeholder="AIza..."
          autoComplete="off"
          required
        />
        <Input
          label="Modelo preferido (opcional)"
          name="model"
          type="text"
          placeholder={defaultModel}
          defaultValue={model !== defaultModel ? model : undefined}
        />
        <p className="-mt-2 text-xs text-muted-foreground">
          Se esse modelo estiver com cota esgotada ou indisponível, o sistema tenta
          automaticamente vários outros modelos Gemini (2.5, 3, 3.1, 3.5...) antes de desistir.
        </p>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="enableGroundingSearch"
            defaultChecked={enableGroundingSearch}
            className="accent-primary"
          />
          Habilitar busca com IA (Gemini + Google Search) como fonte extra
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-600 dark:text-emerald-400">Chave salva com sucesso.</p>}
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "Validando..." : hasKey ? "Atualizar chave" : "Salvar chave"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Crie sua chave gratuita em{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          Google AI Studio
        </a>
        . Sua chave fica criptografada e nunca é exibida novamente em texto puro.
      </p>
    </div>
  )
}