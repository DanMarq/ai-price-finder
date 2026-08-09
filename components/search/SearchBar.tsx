"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  defaultValue?: string;
  size?: "md" | "lg";
}

export function SearchBar({ defaultValue = "", size = "md" }: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    router.push(`/buscar?q=${encodeURIComponent(query)}`);
  }

  const isLarge = size === "lg";

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <div className="relative flex-1">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar produto, ex: iPhone 15 128GB"
          className={
            isLarge
              ? "h-14 w-full rounded-xl border border-input bg-card pl-11 pr-4 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              : "h-10 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
          }
        />
      </div>
      <button
        type="submit"
        className={
          isLarge
            ? "h-14 shrink-0 rounded-xl bg-primary px-6 font-medium text-primary-foreground hover:bg-primary-hover"
            : "h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        }
      >
        Buscar
      </button>
    </form>
  );
}
