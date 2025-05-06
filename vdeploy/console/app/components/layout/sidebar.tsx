import { Link, useLocation } from "react-router";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  LayoutDashboard,
  Rocket,
  Boxes,
  MessageSquare,
  Server,
} from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    activeColor: "text-blue-500",
  },
  {
    title: "Deployments",
    href: "/deployments",
    icon: Rocket,
    activeColor: "text-green-500",
  },
  {
    title: "Models",
    href: "/models",
    icon: Boxes,
    activeColor: "text-purple-500",
  },
  {
    title: "Completions",
    href: "/completions",
    icon: MessageSquare,
    activeColor: "text-orange-500",
  },
  {
    title: "Clusters",
    href: "/clusters",
    icon: Server,
    activeColor: "text-cyan-500",
  },
];

export function Sidebar() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="h-screen w-64 border-r bg-background p-4">
      <div className="space-y-4">
        <div className="py-2">
          <h2 className="text-lg font-semibold tracking-tight">vLLM Platform</h2>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Button
                key={item.href}
                variant={active ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 transition-colors",
                  active && item.activeColor
                )}
                asChild
              >
                <Link to={item.href}>
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
