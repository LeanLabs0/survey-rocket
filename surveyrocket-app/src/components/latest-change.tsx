"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

export type NotificationNote = {
	id: string;
	type?: string;
	title: string;
	body: string | null;
	href: string | null;
	createdAt: string;
	read: boolean;
};

function badge(note: NotificationNote) {
	if (note.type === "system") return "UPDATE";
	return note.read ? "UPDATE" : "NEW";
}

function linkLabel(note: NotificationNote) {
	if (note.type === "system") return "Release notes";
	if (note.type === "response") return "View answers";
	return "Open";
}

function when(iso: string) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function NotificationCards({
	items,
	onDismiss,
}: {
	items: NotificationNote[];
	onDismiss: (id: string) => void;
}) {
	if (!items.length) {
		return (
			<p className="px-1 py-8 text-center text-muted-foreground text-sm">
				You're all caught up.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			{items.map((note) => (
				<div
					key={note.id}
					className={cn(
						"group/latest-change relative flex flex-col gap-0.5 overflow-hidden rounded-lg border bg-background px-2.5 py-1.5",
						!note.read && "ring-1 ring-primary/30",
					)}
				>
					<span className="font-light font-mono text-[10px] text-muted-foreground">
						{badge(note)}
					</span>
					<p className="pr-6 font-medium text-xs">{note.title}</p>
					{note.body ? (
						<span className="line-clamp-2 text-[10px] text-muted-foreground">
							{note.body}
						</span>
					) : null}
					<small className="text-[10px] text-muted-foreground">{when(note.createdAt)}</small>
					{note.href ? (
						<Button
							className="w-max px-0 font-light text-xs"
							nativeButton={false}
							render={<a href={note.href} />}
							size="sm"
							variant="link"
						>
							{linkLabel(note)}
						</Button>
					) : null}
					<Button
						aria-label={`Dismiss ${note.title}`}
						className="absolute top-1.5 right-1.5 size-6 rounded-full opacity-0 transition-opacity group-hover/latest-change:opacity-100"
						onClick={() => onDismiss(note.id)}
						size="icon-sm"
						variant="ghost"
					>
						<XIcon />
					</Button>
				</div>
			))}
		</div>
	);
}
