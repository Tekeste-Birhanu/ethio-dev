const buttonVariants = {
  primary:
    "min-h-12 w-full cursor-pointer rounded-xl border-0 bg-accent px-4 font-bold text-[#06251a] transition-[background,transform] duration-[120ms] hover:enabled:bg-[#28dfa5] hover:enabled:-translate-y-px focus-visible:outline-3 focus-visible:outline-[#9af1d0] focus-visible:outline-offset-3 disabled:cursor-wait disabled:opacity-70",
  secondary:
    "inline-flex min-h-[42px] cursor-pointer items-center rounded-[10px] border border-[#303a3e] bg-[#1b2327] px-[15px] font-semibold text-ink no-underline hover:border-[#59696c] hover:bg-[#222d31]",
  danger:
    "min-h-[42px] cursor-pointer rounded-[10px] border border-[#923e48] bg-[#8f303c] px-4 font-[inherit] font-semibold text-[#fff5f5] hover:enabled:border-[#b84b58] hover:enabled:bg-[#a83b48] disabled:cursor-wait disabled:opacity-70",
};

export function Button({ variant = "secondary", className = "", ...props }) {
  return (
    <button
      className={`${buttonVariants[variant]} ${className}`.trim()}
      {...props}
    />
  );
}

export function FormField({ className = "", ...props }) {
  return (
    <div
      className={`form-field grid gap-2 mb-[18px] [&_input::placeholder]:text-[#788588] [&_input[aria-invalid=true]]:border-[#f27a7a] [&_select[aria-invalid=true]]:border-[#f27a7a] [&_textarea[aria-invalid=true]]:border-[#f27a7a] ${className}`.trim()}
      {...props}
    />
  );
}

export function ModalHeader({ className = "", children }) {
  return (
    <header
      className={`flex flex-none items-center justify-between gap-4 border-b border-[#252d31] px-4 py-[15px] ${className}`.trim()}
    >
      {children}
    </header>
  );
}

export function ModalFooter({ className = "", children }) {
  return (
    <footer
      className={`flex flex-none justify-end gap-2 border-t border-[#252d31] bg-surface px-4 py-3 pb-[calc(14px+env(safe-area-inset-bottom))] ${className}`.trim()}
    >
      {children}
    </footer>
  );
}

export function ModalCloseButton({
  label,
  className = "",
  children = "×",
  ...props
}) {
  return (
    <button
      className={`grid size-[38px] flex-none cursor-pointer place-items-center rounded-full border border-[#303a3e] bg-transparent text-[25px] leading-none text-[#c0cece] hover:bg-[#222d31] hover:text-white disabled:cursor-wait disabled:opacity-60 ${className}`.trim()}
      type="button"
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}
