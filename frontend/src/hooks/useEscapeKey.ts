import { useEffect } from "react";
import { registerEscapeHandler } from "../utils/escapeManager";

export const useEscapeKey = (onClose: () => void, isOpen: boolean) => {
  useEffect(() => {
    if (!isOpen) return;
    const unregister = registerEscapeHandler(onClose);
    return unregister;
  }, [onClose, isOpen]);
};
