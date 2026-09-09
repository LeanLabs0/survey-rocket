import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppShell } from "@/components/app-shell-context";
import { getAppNav } from "@/components/app-shared";
import { SettingsIcon, LogOutIcon, ShieldIcon } from "lucide-react";

function initials(name?: string | null, email?: string | null, fallback?: string) {
	const source = (name || email || fallback || "?").trim();
	const parts = source.split(/[\s@.]+/).filter((part) => /^[a-z]/i.test(part));
	if (parts.length >= 2) {
		return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
	}
	return (parts[0]?.[0] || source.charAt(0)).toUpperCase();
}

export function NavUser() {
	const shell = useAppShell();
	const { base } = getAppNav(shell);
	const workspace = shell.clientName || "Survey Rocket";
	const email = shell.email || "";
	const displayName = shell.fullName?.trim() || email || workspace;
	const roleLabel = shell.isSuperadmin ? `${displayName} (Admin)` : displayName;
	const [avatarUrl, setAvatarUrl] = useState(shell.avatarUrl || null);

	useEffect(() => {
		setAvatarUrl(shell.avatarUrl || null);
	}, [shell.avatarUrl]);

	useEffect(() => {
		function onAvatar(e: Event) {
			const url = (e as CustomEvent<string | null>).detail;
			if (typeof url === "string" || url === null) setAvatarUrl(url);
		}
		window.addEventListener("sr-avatar-changed", onAvatar);
		return () => window.removeEventListener("sr-avatar-changed", onAvatar);
	}, []);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label="Account menu"
						className="rounded-full"
						size="icon-sm"
						type="button"
						variant="ghost"
					/>
				}
			>
				<Avatar className="size-7">
					{avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
					<AvatarFallback>
						{initials(shell.fullName, email, workspace)}
					</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-60 w-60">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="font-normal text-foreground">
						<div className="flex min-w-0 flex-col gap-0.5">
							<span className="truncate font-medium">{roleLabel}</span>
							{email ? (
								<span className="truncate text-muted-foreground text-xs">
									{email}
								</span>
							) : null}
							<span className="truncate text-muted-foreground text-xs">
								{workspace}
							</span>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						nativeButton={false}
						render={<a href={`${base}/settings`} />}
					>
						<SettingsIcon />
						Account settings
					</DropdownMenuItem>
					{shell.isSuperadmin && (
						<DropdownMenuItem nativeButton={false} render={<a href="/admin" />}>
							<ShieldIcon />
							Back to admin
						</DropdownMenuItem>
					)}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						nativeButton={false}
						render={<a href="/logout" />}
						variant="destructive"
					>
						<LogOutIcon />
						Logout
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
