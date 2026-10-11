/** Traduz erros do Supabase Auth para mensagens claras, sem revelar se o e-mail existe. */
export function loginErrorMessage(error: { message: string; status?: number }): string {
  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("banned") || message.includes("user is banned")) {
    return "Este acesso está desativado. Procure o responsável pela sua escola.";
  }
  if (message.includes("rate limit") || error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  if (message.includes("fetch") || message.includes("network")) {
    return "Sem conexão. Verifique sua internet e tente de novo.";
  }
  return "Não foi possível entrar. Tente novamente.";
}

export function validateLogin(email: string, password: string): string | null {
  if (!email.trim()) return "Informe o e-mail.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Informe um e-mail válido.";
  if (!password) return "Informe a senha.";
  return null;
}
