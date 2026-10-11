import { useCallback, useEffect } from "react";
import { ATTENDANCE_REFRESH_MS } from "../constants/attendance";
import { useAttendanceStore } from "../store/attendanceStore";
import { useAuthStore } from "../store/authStore";

/**
 * Dados de frequência da escola do usuário logado, vindos da fonte que o secretário
 * configurou. Com a planilha online, atualiza ao abrir, a cada minuto e ao voltar para a aba;
 * se ela não responder, usa a base offline (quando existe).
 */
export function useAttendanceData() {
  const schoolId = useAuthStore((s) => s.profile?.schoolId ?? null);
  const data = useAttendanceStore((s) => s.data);
  const status = useAttendanceStore((s) => s.status);
  const refreshing = useAttendanceStore((s) => s.refreshing);
  const source = useAttendanceStore((s) => s.settings.source);
  const init = useAttendanceStore((s) => s.init);
  const refreshStore = useAttendanceStore((s) => s.refresh);

  const refresh = useCallback(async () => {
    if (schoolId) await refreshStore(schoolId);
  }, [schoolId, refreshStore]);

  useEffect(() => {
    if (schoolId) void init(schoolId);
  }, [schoolId, init]);

  // Só a planilha muda sozinha; a base offline só muda quando o secretário envia arquivos.
  useEffect(() => {
    if (source !== "sheet") return;
    const timer = window.setInterval(() => void refresh(), ATTENDANCE_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [source, refresh]);

  return { data, status, refreshing, refresh };
}
