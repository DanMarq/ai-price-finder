import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 sm:grid-cols-[240px_1fr]">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-10 w-56" />
        </div>
      </div>
      <Skeleton className="mt-10 h-48 w-full" />
      <Skeleton className="mt-10 h-64 w-full" />
    </div>
  );
}
