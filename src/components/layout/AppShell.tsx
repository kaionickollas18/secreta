import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthStore } from "../../store/authStore";
import { useMessageStore } from "../../store/messageStore";
import { useReminderStore } from "../../store/reminderStore";
import { countUnread } from "../../utils/messages";
import { readNavCollapsed, writeNavCollapsed } from "../../utils/navPreference";
import { countDue } from "../../utils/reminders";
import { canManageAssistants, isSchoolRole, ROLE_LABELS } from "../../utils/roles";
import { Avatar } from "../ui/Avatar";
import {
  BellIcon,
  BoardIcon,
  CalendarIcon,
  ChartIcon,
  ChatIcon,
  ChevronLeftIcon,
  LogoutIcon,
  NoteIcon,
  UsersIcon,
} from "../ui/Icons";

export type NavKey = "quadro" | "lembretes" | "calendario" | "notas" | "mensagens" | "dashboard" | "gestao" | "perfil";

interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  icon: ReactNode;
  /** Contador exibido sobre o ícone (0 = sem aviso). */
  badge?: number;
  /** Texto do contador para leitores de tela. */
  badgeLabel?: string;
  /** Só na barra do celular (no computador, o topo do menu já leva ao perfil). */
  mobileOnly?: boolean;
}

interface AppShellProps {
  /** Página atual, destacada no menu. */
  active: NavKey;
  children: ReactNode;
}

/** Contador sobre o ícone. "Pulsa" quando o número aumenta (chegou mensagem ou lembrete). */
function NavBadge({ count }: { count: number }) {
  const previous = useRef(count);
  const [bumps, setBumps] = useState(0);

  useEffect(() => {
    if (count > previous.current) setBumps((n) => n + 1);
    previous.current = count;
  }, [count]);

  return (
    <span
      // Trocar a chave reinicia a animação a cada aumento.
      key={bumps}
      aria-hidden="true"
      className={`absolute -right-3 -top-2 min-w-[18px] rounded-full bg-prio-urgent px-1 text-center text-2xs font-bold tabular-nums leading-[18px] text-canvas ${
        bumps > 0 ? "animate-pop" : ""
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/*
 * No computador o menu tem dois modos. Os ícones ocupam sempre a mesma casa de 40 px, na
 * mesma posição; ao retrair, só a largura diminui e os rótulos somem. Por isso nada "pula".
 */
const EASE = "duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
/** Texto que some ao retrair: encolhe para largura zero e fica transparente. */
const fading = (collapsed: boolean) =>
  `md:overflow-hidden md:whitespace-nowrap md:transition-[max-width,opacity] ${EASE} ${
    collapsed ? "md:max-w-0 md:opacity-0" : "md:max-w-[10rem] md:opacity-100"
  }`;

/** Item: no celular, ícone sobre o rótulo; no computador, ícone e rótulo em linha. */
const ITEM =
  "relative flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-2xs font-medium leading-none transition-colors md:min-h-[44px] md:flex-row md:justify-start md:gap-1 md:px-2 md:py-0 md:text-sm";
const ICON_SLOT = "relative flex shrink-0 items-center justify-center md:h-10 md:w-10";

/**
 * Moldura das páginas: menu (lateral no computador, estendido ou retraído; barra inferior no
 * celular) + conteúdo. Também carrega lembretes e mensagens, para os avisos do menu valerem
 * em qualquer página.
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
  // Lido já no primeiro desenho, para o menu não abrir num modo e mudar em seguida.
  const [collapsed, setCollapsed] = useState(readNavCollapsed);

  const currentLink = useRef<HTMLAnchorElement>(null);

  // Na barra do celular, o item da página atual fica à vista mesmo quando a barra rola.
  useEffect(() => {
    currentLink.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);

  const userId = profile?.id;
  const inSchool = profile ? isSchoolRole(profile.role) : false;

  useEffect(() => {
    if (!userId || !inSchool) return;
    void loadReminders();
    void loadMessages(userId);
    return watchMessages(userId);
  }, [userId, inSchool, loadReminders, loadMessages, watchMessages]);

  if (!profile) return <>{children}</>;

  function toggle() {
    const next = !collapsed;
    writeNavCollapsed(next);
    setCollapsed(next);
  }

  const due = countDue(reminders, doneKeys);
  // Na própria página do mural as mensagens já estão sendo lidas.
  const unread = active === "mensagens" ? 0 : countUnread(messages, lastSeen, profile.id);
  const roleLabel = ROLE_LABELS[profile.role];

  const profileItem: NavItem = {
    key: "perfil",
    label: "Perfil",
    href: "perfil.html",
    mobileOnly: true,
    icon: (
      <Avatar
        id={profile.id}
        name={profile.lastName}
        url={profile.avatarUrl}
        className="h-[22px] w-[22px] text-2xs"
      />
    ),
  };

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
        { key: "calendario", label: "Calendário", href: "calendario.html", icon: <CalendarIcon /> },
        { key: "notas", label: "Notas", href: "notas.html", icon: <NoteIcon /> },
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
        profileItem,
      ]
    : [{ key: "gestao", label: "Escolas", href: "gestao.html", icon: <UsersIcon /> }, profileItem];

  const onProfile = active === "perfil";

  return (
    <div
      className={`min-h-screen md:transition-[padding] ${EASE} ${collapsed ? "md:pl-[72px]" : "md:pl-60"}`}
    >
      <nav
        aria-label="Navegação principal"
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md md:inset-y-0 md:right-auto md:border-r md:border-t-0 md:transition-[width] ${EASE} ${
          collapsed ? "md:w-[72px]" : "md:w-60"
        }`}
      >

        <div className="flex h-full px-1 md:flex-col md:overflow-hidden md:px-2 md:py-4">
          <p aria-hidden="true" className="hidden items-center md:flex md:px-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl font-bold text-accent-light">
              ▦
            </span>
            <span className={`text-sm font-bold tracking-widest text-ink ${fading(collapsed)}`}>
              SECRETA
            </span>
          </p>

          {/* Quem está usando: a foto leva ao perfil. */}
          <a
            href="perfil.html"
            aria-current={onProfile ? "page" : undefined}
            aria-label={`Meu perfil: ${profile.fullName}, ${roleLabel}`}
            title={collapsed ? `${profile.fullName} · ${roleLabel}` : undefined}
            className="group mb-4 mt-4 hidden flex-col items-center rounded-2xl py-2 transition-colors hover:bg-raised/60 md:flex"
          >
            <Avatar
              id={profile.id}
              name={profile.lastName}
              url={profile.avatarUrl}
              className={`ring-2 transition-[width,height,font-size] ${EASE} ${
                onProfile ? "ring-accent" : "ring-line group-hover:ring-accent/60"
              } ${collapsed ? "h-10 w-10 text-sm" : "h-16 w-16 text-xl"}`}
            />
            <span
              className={`flex flex-col items-center overflow-hidden text-center transition-[max-height,opacity,margin] ${EASE} ${
                collapsed ? "mt-0 max-h-0 opacity-0" : "mt-2 max-h-12 opacity-100"
              }`}
            >
              <span className="max-w-[12rem] truncate text-sm font-semibold text-ink">
                {profile.lastName}
              </span>
              <span className="max-w-[12rem] truncate text-xs text-muted">{roleLabel}</span>
            </span>
          </a>

          {/* No celular os itens têm largura mínima e a barra rola de lado quando não cabem todos. */}
          <ul className="nav-items flex flex-1 items-stretch gap-1 overflow-x-auto [scrollbar-width:none] md:flex-none md:flex-col md:overflow-visible">
            {items.map((item) => {
              const current = item.key === active;
              return (
                <li
                  key={item.key}
                  className={`min-w-[72px] flex-1 shrink-0 md:min-w-0 md:flex-none ${item.mobileOnly ? "md:hidden" : ""}`}
                >
                  <a
                    href={item.href}
                    ref={current ? currentLink : undefined}
                    aria-current={current ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`${ITEM} ${current ? "text-white" : "text-muted hover:bg-raised hover:text-ink"}`}
                  >
                    {/* O destaque é uma camada própria: na troca de página ele desliza até o item novo. */}
                    {current && (
                      <span
                        aria-hidden="true"
                        className="nav-pill absolute inset-0 rounded-xl bg-gradient-to-b from-accent to-accent-strong shadow-glow"
                      />
                    )}
                    <span className={ICON_SLOT}>
                      <span className="relative">
                        {item.icon}
                        {item.badge ? <NavBadge count={item.badge} /> : null}
                      </span>
                    </span>
                    <span className={`relative max-w-full truncate ${fading(collapsed)}`}>{item.label}</span>
                    {item.badge ? <span className="sr-only">({item.badgeLabel})</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto hidden space-y-1 border-t border-line pt-3 md:block">
            {/* Alterna entre estendido e retraído (só no computador). */}
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Estender o menu" : "Retrair o menu"}
              title={collapsed ? "Estender o menu" : undefined}
              className={`${ITEM} text-muted hover:bg-raised hover:text-ink`}
            >
              <span className={ICON_SLOT}>
                <span className={`transition-transform ${EASE} ${collapsed ? "rotate-180" : ""}`}>
                  <ChevronLeftIcon />
                </span>
              </span>
              <span className={fading(collapsed)}>Retrair menu</span>
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              title={collapsed ? "Sair" : undefined}
              className={`${ITEM} text-muted hover:bg-raised hover:text-ink`}
            >
              <span className={ICON_SLOT}>
                <LogoutIcon />
              </span>
              <span className={fading(collapsed)}>Sair</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="page-view pb-20 md:pb-0">{children}</div>
    </div>
  );
}
