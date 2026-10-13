import { useEffect, useMemo, useState } from "react";
import { DayPanel } from "../components/calendar/DayPanel";
import { HolidayForm } from "../components/calendar/HolidayForm";
import { MonthGrid } from "../components/calendar/MonthGrid";
import { Button, IconButton } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ChevronLeftIcon, PlusIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useBoardAccess } from "../hooks/useBoardAccess";
import { useClock } from "../hooks/useClock";
import { useDirectoryStore } from "../store/directoryStore";
import { useHolidayStore } from "../store/holidayStore";
import { useReminderStore } from "../store/reminderStore";
import { useTaskStore } from "../store/taskStore";
import { useToastStore } from "../store/toastStore";
import type { Holiday } from "../types/calendar";
import { buildCalendar, monthGrid, monthLabel, shiftMonth } from "../utils/calendar";
import { todayISO } from "../utils/date";
import { nationalHolidays } from "../utils/holidays";
import { canManageHolidays } from "../utils/roles";

type ModalState = { mode: "create"; date: string } | { mode: "edit"; holiday: Holiday } | null;

/**
 * Calendário da escola: feriados (nacionais calculados + os cadastrados), tarefas pelo prazo
 * e lembretes pelo período. O AppShell já carrega os lembretes.
 */
export default function CalendarioApp() {
  const { role, schoolId, nameOf } = useBoardAccess();
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.load);
  const loadDirectory = useDirectoryStore((s) => s.load);
  const reminders = useReminderStore((s) => s.reminders);
  const doneKeys = useReminderStore((s) => s.doneKeys);
  const { holidays, status, load, save, remove } = useHolidayStore();
  const pushToast = useToastStore((s) => s.push);

  const today = todayISO(useClock());
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<Holiday | null>(null);

  useEffect(() => {
    void load();
    void loadTasks();
    void loadDirectory();
  }, [load, loadTasks, loadDirectory]);

  const weeks = useMemo(() => monthGrid(month), [month]);
  const events = useMemo(() => {
    const from = weeks[0]?.[0] ?? `${month}-01`;
    const to = weeks[weeks.length - 1]?.[6] ?? from;
    // A grade pode mostrar dias de dezembro e de janeiro: vale o feriado dos dois anos.
    const years = [...new Set([from, to].map((d) => Number(d.slice(0, 4))))];
    return buildCalendar(from, to, {
      tasks,
      reminders,
      doneKeys,
      holidays: [...years.flatMap(nationalHolidays), ...holidays],
    });
  }, [weeks, month, tasks, reminders, doneKeys, holidays]);

  if (!schoolId) return null;
  const school = schoolId;
  const canManage = canManageHolidays(role);

  function goTo(nextMonth: string) {
    setMonth(nextMonth);
    // O dia escolhido acompanha o mês: hoje, se estiver nele; senão, o dia 1.
    setSelected(nextMonth === today.slice(0, 7) ? today : `${nextMonth}-01`);
  }

  function select(date: string) {
    setSelected(date);
    if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7));
  }

  async function handleDelete() {
    if (!toDelete) return;
    const error = await remove(toDelete.id);
    setToDelete(null);
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Evento excluído." });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Calendário</h1>
          <p className="page-lede">Feriados, eventos da escola, prazos das tarefas e lembretes em um só lugar.</p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setModal({ mode: "create", date: selected })}>
            <PlusIcon />
            Novo evento
          </Button>
        )}
      </header>

      {status === "error" && (
        <p role="alert" className="text-sm text-prio-urgent">
          Não foi possível carregar os eventos da escola.{" "}
          <button className="underline" onClick={() => void load()}>
            Tentar de novo
          </button>
        </p>
      )}

      <main className="grid flex-1 content-start items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <IconButton aria-label="Mês anterior" onClick={() => goTo(shiftMonth(month, -1))}>
              <ChevronLeftIcon />
            </IconButton>
            <h2 aria-live="polite" className="panel-title min-w-0 flex-1 text-center first-letter:uppercase sm:flex-none sm:px-2">
              {monthLabel(month)}
            </h2>
            <IconButton aria-label="Próximo mês" onClick={() => goTo(shiftMonth(month, 1))}>
              <span className="rotate-180">
                <ChevronLeftIcon />
              </span>
            </IconButton>
            <Button
              variant="ghost"
              className="sm:ml-auto"
              disabled={month === today.slice(0, 7) && selected === today}
              onClick={() => goTo(today.slice(0, 7))}
            >
              Hoje
            </Button>
          </div>
          <MonthGrid
            weeks={weeks}
            month={month}
            today={today}
            selected={selected}
            events={events}
            onSelect={select}
          />
        </div>

        <DayPanel
          date={selected}
          events={events.get(selected)}
          canManage={canManage}
          nameOf={nameOf}
          onAddHoliday={(date) => setModal({ mode: "create", date })}
          onEditHoliday={(holiday) => setModal({ mode: "edit", holiday })}
          onDeleteHoliday={setToDelete}
        />
      </main>

      <Modal
        open={modal !== null}
        title={modal?.mode === "edit" ? "Editar evento" : "Novo evento no calendário"}
        onClose={() => setModal(null)}
      >
        {modal && (
          <HolidayForm
            key={modal.mode === "edit" ? modal.holiday.id : "new"}
            holiday={modal.mode === "edit" ? modal.holiday : undefined}
            initialDate={modal.mode === "create" ? modal.date : undefined}
            onCancel={() => setModal(null)}
            onSubmit={async (input) => {
              const editing = modal.mode === "edit";
              const error = await save(school, input, editing ? modal.holiday.id : undefined);
              if (!error) {
                setModal(null);
                select(input.start);
                pushToast({ tone: "success", message: editing ? "Evento atualizado." : "Evento adicionado." });
              }
              return error;
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir evento?"
        message={toDelete ? `“${toDelete.name}” sairá do calendário de toda a escola.` : ""}
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
      <ToastViewport />
    </div>
  );
}
