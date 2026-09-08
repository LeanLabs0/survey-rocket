import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavGroup } from "@/components/nav-group";
import { getAppNav } from "@/components/app-shared";
import { useAppShell } from "@/components/app-shell-context";
import { loadOnboard } from "@/lib/onboard";
import { HelpCircleIcon, PlusIcon, SearchIcon } from "lucide-react";

function SidebarHelp() {
	const [tourDone, setTourDone] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		function sync() {
			setTourDone(loadOnboard().tourDone);
		}
		sync();
		window.addEventListener("sr-onboard-changed", sync);
		return () => window.removeEventListener("sr-onboard-changed", sync);
	}, []);

	function run(eventName: "sr-start-tour" | "sr-show-tip") {
		setOpen(false);
		window.dispatchEvent(new CustomEvent(eventName));
	}

	return (
		<SidebarMenuItem>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<SidebarMenuButton
							className="h-7 py-1 text-muted-foreground"
							size="sm"
						/>
					}
				>
					<HelpCircleIcon />
					<span>Help Center</span>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="w-56 p-1"
					side="top"
					sideOffset={8}
				>
					<PopoverHeader className="px-2 py-1.5">
						<PopoverTitle>Help Center</PopoverTitle>
					</PopoverHeader>
					<Button
						className="w-full justify-start font-normal"
						onClick={() => run("sr-start-tour")}
						size="sm"
						variant="ghost"
					>
						{tourDone ? "Replay the tour" : "Take the tour"}
					</Button>
					<Button
						className="w-full justify-start font-normal"
						onClick={() => run("sr-show-tip")}
						size="sm"
						variant="ghost"
					>
						Show the tip for this view
					</Button>
				</PopoverContent>
			</Popover>
		</SidebarMenuItem>
	);
}

export function AppSidebar() {
	const shell = useAppShell();
	const { base, navGroups, footerNavLinks } = getAppNav(shell);
	const homeHref = shell.isSuperadmin ? "/admin" : `${base}/dashboard`;

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader className="h-14 justify-center">
				<SidebarMenuButton
					aria-label="Survey Rocket"
					className="h-10 overflow-hidden px-1.5"
					render={<a href={homeHref} />}
					tooltip="Survey Rocket"
				>
					<span className="flex h-7 w-[6.9rem] items-center overflow-hidden group-data-[collapsible=icon]:size-5 group-data-[collapsible=icon]:w-5">
						<img
							src="/assets/landing/survey-rocket.svg"
							alt=""
							className="h-7 w-auto max-w-none shrink-0 group-data-[collapsible=icon]:h-5"
						/>
					</span>
				</SidebarMenuButton>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup className="px-2 pt-1 pb-6">
					<SidebarMenuItem className="flex items-center gap-1">
						<SidebarMenuButton
							className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
							tooltip="New survey"
							render={<a href={`${base}/surveys`} />}
						>
							<PlusIcon />
							<span>New survey</span>
						</SidebarMenuButton>
						<Button
							aria-label="Scan a page"
							className="size-8 group-data-[collapsible=icon]:opacity-0"
							nativeButton={false}
							render={<a href={`${base}/scan`} />}
							size="icon"
							variant="outline"
						>
							<SearchIcon />
							<span className="sr-only">Scan a page</span>
						</Button>
					</SidebarMenuItem>
				</SidebarGroup>
				{navGroups.map((group, index) => (
					<NavGroup key={`sidebar-group-${index}`} {...group} />
				))}
			</SidebarContent>
			<SidebarFooter className="gap-1 p-2">
				<SidebarMenu className="gap-0">
					<SidebarHelp />
					{footerNavLinks.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								className="h-7 py-1 text-muted-foreground"
								isActive={item.isActive}
								render={<a href={item.path} />}
								size="sm"
							>
								{item.icon}
								<span>{item.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
