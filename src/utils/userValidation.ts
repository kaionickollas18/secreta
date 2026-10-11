import type { MemberFormErrors, MemberFormValues } from "../types/directory";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

interface MemberRules {
  /** Cadastro novo: e-mail e senha são obrigatórios. Edição: senha em branco mantém a atual. */
  creating: boolean;
  /** O Master cadastra a escola junto com o secretário. */
  withSchoolName: boolean;
}

export function validateMemberForm(
  values: MemberFormValues,
  rules: MemberRules,
): { valid: boolean; errors: MemberFormErrors } {
  const errors: MemberFormErrors = {};

  if (rules.withSchoolName) {
    const school = values.schoolName.trim();
    if (school.length < 2) errors.schoolName = "Informe o nome da escola (mínimo 2 letras).";
    else if (school.length > 120) errors.schoolName = "O nome da escola deve ter até 120 caracteres.";
  }

  const name = values.fullName.trim();
  if (name.length < 2) errors.fullName = "Informe o nome completo.";
  else if (name.length > 120) errors.fullName = "O nome deve ter até 120 caracteres.";

  if (rules.creating) {
    const email = values.email.trim();
    if (!email) errors.email = "Informe o e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Informe um e-mail válido.";
  }

  const needsPassword = rules.creating || values.password.length > 0;
  if (needsPassword && (values.password.length < PASSWORD_MIN || values.password.length > PASSWORD_MAX)) {
    errors.password = `A senha deve ter de ${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
