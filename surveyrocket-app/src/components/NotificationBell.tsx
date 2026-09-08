"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useAppShell } from "@/components/app-shell-context";
import {
	NotificationCards,
	type NotificationNote,
} from "@/components/latest-change";

export default function NotificationBell() {
	const { slug } = useAppShell();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<NotificationNote[]>([]);

	function load() {
		fetch(`/api/app/notifications?client=${encodeURIComponent(slug)}`)
			.then((r) => r.json())
			.then((d) => setItems(d.notifications || []))
			.catch(() => setItems([]));
	}

	useEffect(() => {
		load();
		const t = window.setInterval(load, 30000);
		return () => window.clearInterval(t);
	}, [slug]);

	const unread = items.filter((n) => !n.read);
	const count = unread.length > 9 ? "9+" : String(unread.length);

	async function markAll() {
		const ids = unread.map((n) => n.id);
		if (!ids.length) return;
		await fetch("/api/app/notifications", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ids }),
		});
		setItems((prev) => prev.map((n) => ({ ...n, read: true })));
	}

	async function dismiss(id: string) {
		setItems((prev) => prev.filter((n) => n.id !== id));
		await fetch("/api/app/notifications", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ids: [id], dismiss: true }),
		});
	}

	function onOpenChange(next: boolean) {
		setOpen(next);
		if (next) markAll();
	}

	return (
		<Popover onOpenChange={onOpenChange} open={open}>
			<PopoverTrigger
				render={
					<Button
						aria-label="Notifications"
						className="relative"
						size="icon-sm"
						type="button"
						variant="ghost"
					/>
				}
			>
				<BellIcon />
				{unread.length > 0 ? (
					<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-semibold text-[10px] text-primary-foreground">
						{count}
					</span>
				) : null}
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 p-2"
				side="bottom"
				sideOffset={8}
			>
				<PopoverHeader className="px-1 py-1">
					<PopoverTitle>Notifications</PopoverTitle>
					<PopoverDescription>
						{unread.length ? `${unread.length} unread` : "No unread"}
					</PopoverDescription>
				</PopoverHeader>
				<div className="max-h-80 overflow-y-auto">
					<NotificationCards items={items} onDismiss={dismiss} />
				</div>
			</PopoverContent>
		</Popover>
	);
}
