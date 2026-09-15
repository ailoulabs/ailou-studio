import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Indicador de carregamento discreto, no traço fino da marca. */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-4 animate-spin", className)}
      strokeWidth={1.5}
      aria-hidden="true"
    />
  );
}
