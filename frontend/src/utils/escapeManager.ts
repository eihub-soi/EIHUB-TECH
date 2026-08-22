type EscapeHandler = () => void;
const stack: EscapeHandler[] = [];

export const registerEscapeHandler = (handler: EscapeHandler): () => void => {
  stack.push(handler);
  return () => {
    const index = stack.indexOf(handler);
    if (index !== -1) {
      stack.splice(index, 1);
    }
  };
};

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (stack.length > 0) {
        // Prevent default browser actions
        e.preventDefault();
        e.stopPropagation();
        
        // Execute the topmost handler
        const topHandler = stack[stack.length - 1];
        topHandler();
      }
    }
  });
}
