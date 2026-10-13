import { useMemo, useState } from "react";
import { useClock } from "../../hooks/useClock";
import { useAuthStore } from "../../store/authStore";
import { useFilterStore } from "../../store/filterStore";
import { useReminderStore } from "../../store/reminderStore";
import { useTaskStore } from "../../store/taskStore";
import { todayISO } from "../../utils/date";
import {
  myDueTasks,
  noticeSlot,
  readDismissedNotice,
  reminderNotices,
  summarizeTitles,
  writeDismissedNotice,
} from "../../utils/notices";
import { IconButton } from "../ui/Button";
import { AlertIcon, BellIcon, CloseIcon } from "../ui/Icons";

const ACTION =
  "inline-flex min-h-[32px] shrink-0 items-center rounded-md px-2 text-xs font-semibold text-accent-light underline hover:bg-raised hover:text-ink";

interface NoticeStripProps {
  className?: string;
}

/**
 * Avisos fixos no topo do quadro. Tarefas: só as da própria pessoa que vencem hoje ou estão
 * atrasadas; ficam até serem concluídas. Lembretes: aparecem às 8h e, se forem dispensados,
 * voltam às 12h enquanto não forem marcados como feitos.
 */
export function NoticeStrip({ className = "" }: NoticeStripProps) {
  const profile = useAuthStore((s) => s.profile);
  const tasks = useTaskStore((s) => s.tasks);
  const reminders = useReminderStore((s) => s.reminders);
  const doneKeys = useReminderStore((s) => s.doneKeys);
  const setAssignee = useFilterStore((s) => s.setAssignee);
  const now = useClock();
  const [dismissed, setDismissed] = useState(readDismissedNotice);

  const today = todayISO(now);
  const userId = profile?.id;
  const due = useMemo(() => reminderNotices(reminders, doneKeys, today), [reminders, doneKeys, today]);
  const mine = useMemo(
    () => (userId ? myDueTasks(tasks, userId, today) : { dueToday: [], overdue: [] }),
    [tasks, userId, today],
  );

  const slot = noticeSlot(now);
  const showReminders = slot !== null && slot.key !== dismissed && due.length > 0;
  const overdue = mine.overdue.length;
  const dueToday = mine.dueToday.length;
  if (!userId || (!showReminders && overdue + dueToday === 0)) return null;

  const taskParts = [
    overdue > 0 ? `${overdue} ${overdue === 1 ? "atrasada" : "atrasadas"}` : "",
    dueToday > 0 ? `${dueToday} ${dueToday === 1 ? "vence" : "vencem"} hoje` : "",
  ].filter(Boolean);

  return (
    <section aria-label="Avisos" className={`glass rounded-xl px-3 py-1.5 text-sm ${className}`}>
      <ul className="divide-y divide-line">
        {taskParts.length > 0 && (
          <li className="flex items-center gap-2 py-1">
            <span className="shrink-0 text-prio-urgent">
              <AlertIcon />
            </span>
            <p className="min-w-0 flex-1">
              <span className="font-semibold">Suas tarefas:</span> {taskParts.join(" · ")}
            </p>
            <button type="button" className={ACTION} onClick={() => setAssignee(userId)}>
              Ver minhas
            </button>
          </li>
        )}
        {showReminders && slot && (
          <li className="flex items-center gap-2 py-1">
            <span className="shrink-0 text-prio-medium">
              <BellIcon />
            </span>
            <p className="min-w-0 flex-1">
              <span className="font-semibold">Lembretes ({slot.hour}h):</span>{" "}
              <span className="break-words">{summarizeTitles(due.map((d) => d.reminder.title))}</span>
            </p>
            <a href="lembretes.html" className={ACTION}>
              Abrir
            </a>
            <IconButton
              aria-label="Dispensar o aviso de lembretes"
              title={slot.hour === 8 ? "Dispensar (volta às 12h)" : "Dispensar por hoje"}
              className="shrink-0"
              onClick={() => {
                writeDismissedNotice(slot.key);
                setDismissed(slot.key);
              }}
            >
              <CloseIcon />
            </IconButton>
          </li>
        )}
      </ul>
    </section>
  );
}
