import { Link, useLocation } from "react-router";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  LayoutDashboard,
  Rocket,
  Boxes,
  MessageSquare,
  Server,
  LineChart,
  Terminal,
  Cpu,
} from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    activeColor: "text-blue-400",
    bgActiveColor: "bg-blue-900/20",
    borderColor: "border-blue-500/30",
  },
  {
    title: "Deployments",
    href: "/deployments",
    icon: Rocket,
    activeColor: "text-green-400",
    bgActiveColor: "bg-green-900/20",
    borderColor: "border-green-500/30",
  },
  {
    title: "Models",
    href: "/models",
    icon: Boxes,
    activeColor: "text-purple-400",
    bgActiveColor: "bg-purple-900/20",
    borderColor: "border-purple-500/30",
  },
  {
    title: "Completions",
    href: "/completions",
    icon: MessageSquare,
    activeColor: "text-orange-400",
    bgActiveColor: "bg-orange-900/20",
    borderColor: "border-orange-500/30",
  },
  {
    title: "Clusters",
    href: "/clusters",
    icon: Cpu,
    activeColor: "text-cyan-400",
    bgActiveColor: "bg-cyan-900/20",
    borderColor: "border-cyan-500/30",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: LineChart,
    activeColor: "text-yellow-400",
    bgActiveColor: "bg-yellow-900/20",
    borderColor: "border-yellow-500/30",
  },
  {
    title: "Logs",
    href: "/logs",
    icon: Terminal,
    activeColor: "text-red-400",
    bgActiveColor: "bg-red-900/20",
    borderColor: "border-red-500/30",
  },
];

export function Sidebar() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="fixed h-screen w-64 bg-gray-900 border-r border-gray-700/50 py-6 overflow-y-auto">
      {/* Logo Section */}
      <div className="px-6 mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
            <Server className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            vLLM Cloud
          </h2>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="px-3">
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Button
                key={item.href}
                variant={active ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 py-2.5 px-3 transition-all duration-200",
                  active 
                    ? `${item.activeColor} ${item.bgActiveColor} border-l-2 ${item.borderColor} font-medium`
                    : "text-gray-400 hover:text-white border-l-2 border-transparent hover:bg-gray-800/50"
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
      
      {/* Footer Section */}
      <div className="absolute bottom-0 w-64 p-6 border-t border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-sm text-gray-400">System Operational</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Version 1.2.0
        </div>
      </div>
    </div>
  );
}