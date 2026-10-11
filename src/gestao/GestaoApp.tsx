import { AssistantsPanel } from "../components/admin/AssistantsPanel";
import { MasterPanel } from "../components/admin/MasterPanel";
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
          {isMaster ? "Gestão de escolas" : "Equipe da secretaria"}
        </h1>
        <p className="page-lede">
          {isMaster
            ? "Cadastre escolas e o secretário responsável por cada uma."
            : "Cadastre e gerencie os auxiliares administrativos da sua escola."}
        </p>
      </header>
      <main className="flex-1">{isMaster ? <MasterPanel /> : <AssistantsPanel />}</main>
      <ToastViewport />
    </div>
  );
}
