import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup } from "@/components/app-shared";
import { ChevronRightIcon } from "lucide-react";

export function NavGroup({ label, items }: SidebarNavGroup) {
	return (
		<SidebarGroup className="px-2 py-0">
			{label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
			<SidebarMenu className="gap-2">
				{items.map((item) =>
					item.subItems?.length ? (
						<Collapsible
							className="group/collapsible"
							defaultOpen={!!item.isActive || item.subItems.some((i) => !!i.isActive)}
							key={item.title}
							render={<SidebarMenuItem />}
						>
							<CollapsibleTrigger
								render={
									<SidebarMenuButton
										className="h-8 py-1.5 text-[13px]"
										isActive={item.isActive}
									/>
								}
							>
								{item.icon}
								<span>{item.title}</span>
								<ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
							</CollapsibleTrigger>
							<CollapsibleContent>
								<SidebarMenuSub>
									{item.subItems.map((subItem) => (
										<SidebarMenuSubItem key={subItem.title}>
											<SidebarMenuSubButton
												isActive={subItem.isActive}
												render={<a href={subItem.path} />}
											>
												{subItem.icon}
												<span>{subItem.title}</span>
											</SidebarMenuSubButton>
										</SidebarMenuSubItem>
									))}
								</SidebarMenuSub>
							</CollapsibleContent>
						</Collapsible>
					) : (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								className="h-8 py-1.5 text-[13px]"
								isActive={item.isActive}
								render={<a href={item.path} />}
							>
								{item.icon}
								<span>{item.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					)
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
