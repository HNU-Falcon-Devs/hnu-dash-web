"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CoverageRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      isLoading={isPending}
      onClick={() => startTransition(() => router.refresh())}
      aria-label="Refresh checkpoint coverage"
    >
      {isPending ? "Refreshing…" : "Refresh coverage"}
    </Button>
  );
}
