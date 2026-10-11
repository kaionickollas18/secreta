import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "../../store/authStore";
import { useMessageStore } from "../../store/messageStore";
import { useReminderStore } from "../../store/reminderStore";
import { countUnread } from "../../utils/messages";
import { countDue } from "../../utils/reminders";
import { canManageAssistants, isSchoolRole, ROLE_LABELS } from "../../utils/roles";
import { BellIcon, BoardIcon, ChartIcon, ChatIcon, LogoutIcon, UsersIcon } from "../ui/Icons";

export type NavKey = "quadro" | "lembretes" | "mensagens" | "dashboard" | "gestao";

interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  icon: ReactNode;
  /** Contador exibido sobre o ícone (0 = sem aviso). */
  badge?: number;
  /** Texto do contador para leitores de tela. */
  badgeLabel?: string;
}

interface AppShellProps {
  /** Página atual, destacada na barra. */
  active: NavKey;
  children: ReactNode;
}

const ITEM =
  "relative flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium leading-none transition-colors";

/**
 * Moldura das páginas: barra de navegação (lateral no desktop, inferior no celular) + conteúdo.
 * Também carrega lembretes e mensagens, para os avisos da barra valerem em qualquer página.
 */
export function AppShell({ active, children }: AppShellProps) {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const reminders = useReminderStore((s) => s.reminders);
  const doneKeys = useReminderStore((s) => s.doneKeys);
  const loadReminders = useReminderStore((s) => s.load);
  const messages = useMessageStore((s) => s.messages);
  const lastSeen = useMessageStore((s) => s.lastSeen);
  const loadMessages = useMessageStore((s) => s.load);
  const watchMessages = useMessageStore((s) => s.watch);

  const userId = profile?.id;
  const inSchool = profile ? isSchoolRole(profile.role) : false;

  useEffect(() => {
    if (!userId || !inSchool) return;
    void loadReminders();
    void loadMessages(userId);
    return watchMessages(userId);
  }, [userId, inSchool, loadReminders, loadMessages, watchMessages]);

  if (!profile) return <>{children}</>;

  const due = countDue(reminders, doneKeys);
  // Na própria página do mural as mensagens já estão sendo lidas.
  const unread = active === "mensagens" ? 0 : countUnread(messages, lastSeen, profile.id);

  const items: NavItem[] = inSchool
    ? [
        { key: "quadro", label: "Quadro", href: "./", icon: <BoardIcon /> },
        {
          key: "lembretes",
          label: "Lembretes",
          href: "lembretes.html",
          icon: <BellIcon />,
          badge: due,
          badgeLabel: `${due} ${due === 1 ? "lembrete pede" : "lembretes pedem"} atenção`,
        },
        {
          key: "mensagens",
          label: "Mensagens",
          href: "mensagens.html",
          icon: <ChatIcon />,
          badge: unread,
          badgeLabel: `${unread} ${unread === 1 ? "mensagem nova" : "mensagens novas"}`,
        },
        { key: "dashboard", label: "Dashboard", href: "frequencia.html", icon: <ChartIcon /> },
        ...(canManageAssistants(profile.role)
          ? [{ key: "gestao" as const, label: "Equipe", href: "gestao.html", icon: <UsersIcon /> }]
          : []),
      ]
    : [{ key: "gestao", label: "Escolas", href: "gestao.html", icon: <UsersIcon /> }];

  return (
    <div className="min-h-screen md:pl-24">
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 px-1 backdrop-blur-md md:inset-y-0 md:right-auto md:w-24 md:flex-col md:border-r md:border-t-0 md:px-2 md:py-4"
      >
        <p
          aria-hidden="true"
          className="mb-4 hidden text-center text-2xl font-bold text-accent-light md:block"
        >
          ▦
          <span className="mt-1 block text-[11px] tracking-widest text-ink">SECRETA</span>
        </p>
        <ul className="flex flex-1 items-stretch justify-around gap-1 md:flex-none md:flex-col">
          {items.map((item) => {
            const current = item.key === active;
            return (
              <li key={item.key} className="min-w-0 flex-1 md:flex-none">
                <a
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`${ITEM} ${
                    current
                      ? "bg-gradient-to-b from-accent to-accent-strong text-white shadow-glow"
                      : "text-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  <span className="relative">
                    {item.icon}
                    {item.badge ? (
                      <span
                        aria-hidden="true"
                        className="absolute -right-3 -top-2 min-w-[18px] rounded-full bg-prio-urgent px-1 text-center text-[10px] font-bold leading-[18px] text-canvas"
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                  {item.badge ? <span className="sr-only">({item.badgeLabel})</span> : null}
                </a>
              </li>
            );
          })}
          <li className="min-w-0 flex-1 md:hidden">
            <button type="button" onClick={() => void signOut()} className={`${ITEM} text-muted hover:bg-raised hover:text-ink`}>
              <LogoutIcon />
              Sair
            </button>
          </li>
        </ul>

        <div className="mt-auto hidden flex-col items-center gap-2 border-t border-line pt-3 md:flex">
          <p className="w-full text-center text-[11px] leading-tight" title={profile.fullName}>
            <span className="block truncate font-semibold text-ink">{profile.lastName}</span>
            <span className="block text-muted">{ROLE_LABELS[profile.role].split(" ")[0]}</span>
          </p>
          <button type="button" onClick={() => void signOut()} className={`${ITEM} text-muted hover:bg-raised hover:text-ink`}>
            <LogoutIcon />
            Sair
          </button>
        </div>
      </nav>

      <div className="pb-20 md:pb-0">{children}</div>
    </div>
  );
}
