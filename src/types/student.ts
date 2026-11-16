/**
 * Cadastro de um aluno (tabela `students`): matrícula, responsável e endereço.
 * Campos sem informação na origem ficam vazios.
 */
export interface StudentRecord {
  schoolYear: number;
  /** Mesmo nome da turma usado no dashboard (ex.: "6 ano A"). */
  className: string;
  name: string;
  sex: "F" | "M" | "";
  /** YYYY-MM-DD, ou vazio. */
  birthDate: string;
  guardianName: string;
  guardianNis: string;
  phone: string;
  /** Logradouro e número. */
  address: string;
  neighborhood: string;
  /** Guardado como 00000-000. */
  cep: string;
}
