import type { ReactNode } from "react";
import {
  LayoutGridIcon,
  ListChecksIcon,
  BarChart3Icon,
  SearchIcon,
  SettingsIcon,
  LogOutIcon,
} from "lucide-react";
import type { AppShellData } from "@/components/app-shell-context";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

export function getAppNav({ slug, current, isSuperadmin }: AppShellData) {
  const base = `/app/${slug}`;
  const navGroups: SidebarNavGroup[] = [
    {
      items: [
        {
          title: "Dashboard",
          path: `${base}/dashboard`,
          icon: <LayoutGridIcon />,
          isActive: current === "dashboard",
        },
        {
          title: "Surveys",
          path: `${base}/surveys`,
          icon: <ListChecksIcon />,
          isActive: current === "surveys",
        },
        {
          title: "Scan a page",
          path: `${base}/scan`,
          icon: <SearchIcon />,
          isActive: current === "scan",
        },
        {
          title: "Results",
          path: `${base}/results`,
          icon: <BarChart3Icon />,
          isActive: current === "results",
        },
        {
          title: "Settings",
          path: `${base}/settings`,
          icon: <SettingsIcon />,
          isActive: current === "settings",
        },
      ],
    },
  ];

  const footerNavLinks: SidebarNavItem[] = isSuperadmin
    ? [
        {
          title: "Exit portal",
          path: "/admin",
          icon: <LogOutIcon />,
        },
      ]
    : [];

  const navLinks: SidebarNavItem[] = [
    ...navGroups.flatMap((group) =>
      group.items.flatMap((item) =>
        item.subItems?.length ? [item, ...item.subItems] : [item]
      )
    ),
    ...footerNavLinks,
  ];

  const activeItem = navLinks.find((item) => item.isActive) ?? null;
  return { base, navGroups, footerNavLinks, navLinks, activeItem };
}
