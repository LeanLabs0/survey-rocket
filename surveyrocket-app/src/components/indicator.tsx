import { cn } from "@/lib/utils";

export function StatusIndicator({ className }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={cn("relative inline-flex size-2 shrink-0", className)}
		>
			<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
			<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
		</span>
	);
}
