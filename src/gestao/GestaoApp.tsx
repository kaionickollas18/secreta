import { MasterPanel } from "../components/admin/MasterPanel";
import { TeamPanel } from "../components/admin/TeamPanel";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useAuthStore } from "../store/authStore";

export default function GestaoApp() {
  const profile = useAuthStore((s) => s.profile);
  if (!profile) return null;
  const isMaster = profile.role === "master";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header>
        <h1 className="page-title">
          {isMaster ? "Gestão de escolas" : "Equipe da escola"}
        </h1>
        <p className="page-lede">
          {isMaster
            ? "Cadastre escolas e o secretário responsável por cada uma."
            : "Cadastre auxiliares e professores e edite o perfil de cada um."}
        </p>
      </header>
      <main className="flex-1">{isMaster ? <MasterPanel /> : <TeamPanel />}</main>
      <ToastViewport />
    </div>
  );
}
