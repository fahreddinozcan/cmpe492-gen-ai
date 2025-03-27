"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  BarChart3,
  Boxes,
  CreditCard,
  Database,
  LayoutDashboard,
  Layers,
  ScrollText,
  Settings,
  Terminal,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

export function AppSidebar() {
  const pathname = usePathname()

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      activeColor: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400",
    },
    {
      title: "Deployments",
      href: "/deployments",
      icon: Boxes,
      activeColor: "bg-purple-500/10 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400",
    },
    {
      title: "Models",
      href: "/models",
      icon: Database,
      activeColor: "bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400",
    },
    {
      title: "Metrics",
      href: "/metrics",
      icon: BarChart3,
      activeColor: "bg-yellow-500/10 text-yellow-500 dark:bg-yellow-500/20 dark:text-yellow-400",
    },
    {
      title: "Logs",
      href: "/logs",
      icon: ScrollText,
      activeColor: "bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400",
    },
    {
      title: "Terminal",
      href: "/terminal",
      icon: Terminal,
      activeColor: "bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400",
    },
    {
      title: "Cost Explorer",
      href: "/cost-explorer",
      icon: CreditCard,
      activeColor: "bg-pink-500/10 text-pink-500 dark:bg-pink-500/20 dark:text-pink-400",
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
      activeColor: "bg-slate-500/10 text-slate-500 dark:bg-slate-500/20 dark:text-slate-400",
    },
  ]

  const activeItem = navItems.find((item) => item.href === pathname) || navItems[0]

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center justify-center px-3">
        <div className="flex items-center gap-3">
          <Image 
            src="/cloud-computing.svg" 
            alt="vDeploy Console Logo" 
            width={32} 
            height={32} 
            className="h-8 w-8"
          />
          <span className="text-xl font-semibold">vDeploy Console</span>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                <Link 
                  href={item.href} 
                  className={`py-3 px-4 rounded-lg transition-colors ${pathname === item.href ? item.activeColor : 'hover:bg-accent'}`}
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-base">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/deployments/new">Create New Cluster</Link>
          </Button>
          <ModeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
