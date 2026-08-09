"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { pauseAlert, resumeAlert, deleteAlert } from "@/app/alertas/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatBRL } from "@/lib/utils/money";

export interface AlertRowData {
  id: string;
  productSlug: string;
  productTitle: string;
  productImageUrl: string | null;
  targetPrice: number | null;
  alertOnAnyDrop: boolean;
  status: "ACTIVE" | "PAUSED" | "TRIGGERED" | "CANCELLED";
  lastCheckedPrice: number | null;
}

const STATUS_LABEL: Record<AlertRowData["status"], { label: string; tone: "green" | "gray" | "amber" }> = {
  ACTIVE: { label: "Ativo", tone: "green" },
  PAUSED: { label: "Pausado", tone: "gray" },
  TRIGGERED: { label: "Disparado", tone: "amber" },
  CANCELLED: { label: "Cancelado", tone: "gray" },
};

export function AlertRow({ alert }: { alert: AlertRowData }) {
  const [isPending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);
  const status = STATUS_LABEL[alert.status];

  if (removed) return null;

  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
          {alert.productImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={alert.productImageUrl} alt={alert.productTitle} className="h-full w-full object-contain p-1" />
          ) : null}
        </div>
        <div>
          <Link href={`/produto/${alert.productSlug}`} className="text-sm font-medium text-foreground hover:underline">
            {alert.productTitle}
          </Link>
          <p className="text-xs text-muted-foreground">
            {alert.alertOnAnyDrop
              ? "Avisar em qualquer queda"
              : `Preço-alvo: ${formatBRL(alert.targetPrice ?? 0)}`}
            {alert.lastCheckedPrice !== null && ` · Preço atual: ${formatBRL(alert.lastCheckedPrice)}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {alert.status === "PAUSED" ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => startTransition(() => resumeAlert(alert.id))}
          >
            Retomar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => startTransition(() => pauseAlert(alert.id))}
          >
            Pausar
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteAlert(alert.id);
              setRemoved(true);
            })
          }
        >
          Excluir
        </Button>
      </div>
    </div>
  );
}
