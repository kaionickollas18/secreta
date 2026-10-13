import { useEffect, useState } from "react";

/** Hora atual, renovada a cada minuto: o que depende do horário muda sem recarregar a página. */
export function useClock(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
