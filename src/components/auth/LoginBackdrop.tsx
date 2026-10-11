import poster from "../../assets/login-bg.jpg";
import video from "../../assets/login-bg.mp4";
import { prefersReducedMotion } from "../../utils/arrivals";

/** O navegador avisou que a pessoa quer economizar dados (plano de celular limitado). */
function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * Fundo da tela de login: um feixe de luz azul, roxo e magenta em movimento lento.
 * A imagem parada aparece na hora e fica no lugar do vídeo para quem pediu menos movimento
 * ou economia de dados. É decorativo e não recebe cliques.
 */
export function LoginBackdrop() {
  const animated = !prefersReducedMotion() && !savesData();

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {animated && (
        <video
          src={video}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Escurece a base para o conteúdo abaixo do login continuar legível. */}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/20 via-transparent to-canvas/70" />
    </div>
  );
}
