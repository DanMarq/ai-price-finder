"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils/cn"

export type SortOption = "price_asc" | "price_desc";

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: "price_asc", label: "Menor preço primeiro" },
  { value: "price_desc", label: "Maior preço primeiro" },
];

export function SortSelect({ value, className }: { value: SortOption; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "price_asc") {
      // é o padrão — mantém a URL limpa em vez de sempre carregar ?sort=price_asc
      params.delete("sort")
    } else {
      params.set("sort", next)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <label className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      Ordenar por
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}