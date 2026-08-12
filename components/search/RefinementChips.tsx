"use client"

import { useRouter } from "next/navigation"

interface RefinementChipsProps {
  query: string
  options: string[]
}

export function RefinementChips({ query, options }: RefinementChipsProps) {
  const router = useRouter()

  function refineWith(option: string) {
    router.push(`/buscar?q=${encodeURIComponent(`${query} ${option}`)}`)
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => refineWith(option)}
          className="rounded-full border border-input bg-background px-3.5 py-1.5 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {option}
        </button>
      ))}
    </div>
  )
}