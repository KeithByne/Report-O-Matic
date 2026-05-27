/** Shared dimensions for top-right header control blocks (language, display, support, sign out). */
export const HEADER_CONTROL_BLOCK =
  "box-border flex h-16 w-[6.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-200 bg-white px-1.5 py-1 text-zinc-800 shadow-sm";

export const HEADER_CONTROL_BLOCK_INTERACTIVE =
  `${HEADER_CONTROL_BLOCK} transition-colors hover:bg-emerald-50/80`;

export const HEADER_CONTROL_SELECT =
  "w-full min-w-0 cursor-pointer rounded border border-emerald-200 bg-white px-1 py-0.5 text-[10px] font-medium leading-tight text-zinc-900";
