"use client";

import { useActionState, useState, useTransition } from "react";
import { updateUser, deleteUser, type UserAdminActionState } from "@/app/usuarios/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const initialState: UserAdminActionState = { ok: false };

export interface UserCardSearchLog {
  id: string;
  query: string;
  resultsCount: number;
  createdAtLabel: string;
}

export interface UserCardProps {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "MASTER";
  createdAtLabel: string;
  searchCount: number;
  alertCount: number;
  recentSearches: UserCardSearchLog[];
  isSelf: boolean;
}

export function UserCard({
  id,
  name,
  email,
  role,
  createdAtLabel,
  searchCount,
  alertCount,
  recentSearches,
  isSelf,
}: UserCardProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateUser, initialState);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fecha o formulário assim que a submissão for bem-sucedida, ajustando o estado durante a
  // renderização (em vez de um efeito) — mesmo padrão usado em AlertButton.tsx.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.ok) setEditing(false);
  }

  function handleDelete() {
    if (!window.confirm(`Excluir a conta de ${email}? Essa ação não pode ser desfeita.`)) return;
    startDeleteTransition(async () => {
      const result = await deleteUser(id);
      if (!result.ok) setDeleteError(result.error ?? "Falha ao excluir");
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{name ?? "(sem nome)"}</p>
            {role === "MASTER" && <Badge tone="blue">MASTER</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Cadastrado em {createdAtLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gray">
            {searchCount} busca{searchCount === 1 ? "" : "s"}
          </Badge>
          <Badge tone="gray">
            {alertCount} alerta{alertCount === 1 ? "" : "s"}
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancelar" : "Editar"}
          </Button>
          {!isSelf && (
            <Button type="button" variant="danger" size="sm" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          )}
        </div>
      </div>

      {deleteError && <p className="mt-2 text-sm text-destructive">{deleteError}</p>}

      {editing && (
        <form
          action={formAction}
          className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="userId" value={id} />
          <Input label="Nome" name="name" defaultValue={name ?? ""} className="sm:max-w-56" required />
          <Input
            label="Nova senha (opcional)"
            name="password"
            type="password"
            placeholder="Deixe em branco para manter"
            autoComplete="new-password"
            className="sm:max-w-56"
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      )}
      {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}

      {recentSearches.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">Últimas buscas</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {recentSearches.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground">&ldquo;{log.query}&rdquo;</span>
                <span className="shrink-0 text-muted-foreground">
                  {log.resultsCount} resultado{log.resultsCount === 1 ? "" : "s"} · {log.createdAtLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
