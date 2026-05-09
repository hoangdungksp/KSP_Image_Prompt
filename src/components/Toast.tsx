import { useAppStore } from "../store/useAppStore";

export function Toast() {
  const { toast, hideToast } = useAppStore();

  if (!toast) return null;

  const colors = {
    info: "bg-ksp-accent text-black",
    success: "bg-ksp-good text-black",
    error: "bg-ksp-bad text-white",
  };

  return (
    <div
      onClick={hideToast}
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow-lg text-xs font-medium cursor-pointer ${colors[toast.type]}`}
    >
      {toast.message}
    </div>
  );
}
