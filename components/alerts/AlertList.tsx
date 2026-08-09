import { AlertRow, type AlertRowData } from "./AlertRow";

export function AlertList({ alerts }: { alerts: AlertRowData[] }) {
  if (alerts.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Você ainda não tem alertas. Busque um produto e clique em &ldquo;Criar alerta de preço&rdquo;.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4">
      {alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
