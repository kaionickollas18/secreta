/** Um dia de chamada de uma turma, com os nomes dos alunos ausentes. */
export interface DayRecord {
  /** YYYY-MM-DD */
  date: string;
  absent: string[];
}

export interface ClassData {
  name: string;
  records: DayRecord[];
}

/** Frequência de todas as turmas (lida da planilha ou da base offline da escola). */
export interface AttendanceData {
  generatedAt: string;
  classes: ClassData[];
}

export const DATA_SOURCES = ["sheet", "file"] as const;
/** `sheet`: planilha do Google (ao vivo) · `file`: arquivos CSV enviados (base offline). */
export type DataSource = (typeof DATA_SOURCES)[number];

/** Configuração da base de dados do dashboard de uma escola (tabela `school_settings`). */
export interface AttendanceSettings {
  /** `null` enquanto o secretário não configurou. */
  source: DataSource | null;
  sheetUrl: string;
  /** Nomes das abas da planilha, uma por turma. */
  classNames: string[];
  /** Existe base offline enviada. */
  hasFile: boolean;
  /** ISO 8601 */
  fileUpdatedAt?: string;
}

/**
 * loading: buscando · unconfigured: sem base definida · live: planilha ao vivo ·
 * file: base offline · fallback: planilha falhou, mostrando a base offline · error: nada para mostrar.
 */
export type AttendanceStatus = "loading" | "unconfigured" | "live" | "file" | "fallback" | "error";

export type RiskLevel = "critical" | "warning" | "ok";

export interface StudentSummary {
  name: string;
  className: string;
  absences: number;
  /** Dias de chamada da turma no período. */
  schoolDays: number;
  /** Faltas / dias de chamada (0 a 1). */
  rate: number;
  /** Faltas seguidas até o último dia registrado. */
  streak: number;
  risk: RiskLevel;
}

/** Frequência de um aluno em um mês. */
export interface MonthStat {
  /** YYYY-MM */
  month: string;
  /** Ex.: "Junho de 2026" */
  label: string;
  /** Dias de chamada da turma no mês. */
  schoolDays: number;
  absences: number;
  /** Presenças / dias de chamada (0 a 1). */
  presenceRate: number;
  risk: RiskLevel;
  /** Datas das faltas no mês (YYYY-MM-DD), em ordem. */
  dates: string[];
}

/** Resumo individual de um aluno, com a frequência mês a mês. */
export interface StudentReport extends StudentSummary {
  /** Presenças / dias de chamada no período (0 a 1). */
  presenceRate: number;
  /** YYYY-MM-DD */
  lastAbsence?: string;
  months: MonthStat[];
  /** Mês (YYYY-MM) com a menor frequência, se houve falta. */
  worstMonth?: string;
}

export interface ClassSummary {
  name: string;
  days: number;
  absences: number;
  avgPerDay: number;
  studentsWithAbsence: number;
  critical: number;
  topStudent?: { name: string; absences: number };
}

export interface DayPoint {
  date: string;
  absences: number;
  /** Média móvel dos últimos 7 dias de chamada. */
  average: number;
}

export interface WeekdayStat {
  /** 1 (segunda) a 5 (sexta) */
  weekday: number;
  label: string;
  /** Média de faltas por dia de chamada nesse dia da semana. */
  avgAbsences: number;
  days: number;
}
