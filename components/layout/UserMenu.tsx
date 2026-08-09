"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

export interface UserMenuProps {
  name: string;
  isMaster: boolean;
}

export function UserMenu({ name, isMaster }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {name}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg shadow-black/5 dark:shadow-black/30">
          <Link
            href="/configuracoes"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2 text-sm text-foreground/90 hover:bg-muted"
          >
            Configurações
          </Link>
          {isMaster && (
            <Link
              href="/usuarios"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-sm text-foreground/90 hover:bg-muted"
            >
              Usuários
            </Link>
          )}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => signOut({ redirectTo: "/" })}
            className="block w-full px-3.5 py-2 text-left text-sm text-foreground/90 hover:bg-muted"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
