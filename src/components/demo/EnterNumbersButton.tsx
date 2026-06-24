import Link from "next/link";
import { clsx } from "clsx";
import { ArrowRight, Pencil } from "lucide-react";

// The demo's "make it yours" action. It must read as an action, not another
// readout — so it rests as a copper ghost (outline on the Ink ground) and inverts
// to solid copper with Ink text on hover/focus: the clearest "this is a button"
// signal there is. The pencil marks it as data entry; the trailing arrow as "go".
// Copper (the brand action voice), never a health hue — green/yellow/red stay
// reserved for financial status.
export function EnterNumbersButton({
  href,
  label = "Enter your numbers",
  helper,
  className,
}: {
  href: string;
  label?: string;
  /** Optional second line, e.g. "See this dashboard with your own figures". */
  helper?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "group flex min-h-[44px] flex-col justify-center gap-1 rounded-md border border-copper-soft bg-ink px-3.5 py-2",
        "transition-colors hover:border-copper hover:bg-copper focus-visible:border-copper focus-visible:bg-copper",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-soft focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
        "motion-reduce:transition-none",
        className,
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-[#E6E8E4] group-hover:text-ink group-focus-visible:text-ink">
          <Pencil size={15} aria-hidden className="text-copper-soft group-hover:text-ink group-focus-visible:text-ink" />
          {label}
        </span>
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-copper/20 text-copper-soft transition-colors group-hover:bg-ink/15 group-hover:text-ink group-focus-visible:bg-ink/15 group-focus-visible:text-ink motion-reduce:transition-none">
          <ArrowRight size={14} aria-hidden />
        </span>
      </span>
      {helper && (
        <span className="text-[11px] text-muted group-hover:text-ink/70 group-focus-visible:text-ink/70">{helper}</span>
      )}
    </Link>
  );
}
