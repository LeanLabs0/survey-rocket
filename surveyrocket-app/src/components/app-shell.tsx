import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import {
	AppShellContext,
	type AppShellData,
} from "@/components/app-shell-context";

export type AppShellProps = AppShellData & {
	children?: ReactNode;
};

export function AppShell({
	children,
	slug,
	clientName,
	current,
	isSuperadmin,
	email,
	fullName,
}: AppShellProps) {
	return (
		<AppShellContext.Provider
			value={{ slug, clientName, current, isSuperadmin, email, fullName }}
		>
			<div className="overflow-hidden">
				<TooltipProvider>
					<SidebarProvider className="relative h-svh">
						<AppSidebar />
						<SidebarInset
							id="main"
							className="md:peer-data-[variant=inset]:ml-0"
						>
							<AppHeader />
							<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
								{children}
							</div>
						</SidebarInset>
					</SidebarProvider>
				</TooltipProvider>
			</div>
		</AppShellContext.Provider>
	);
}
