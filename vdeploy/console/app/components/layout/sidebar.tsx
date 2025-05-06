import { Link, useLocation } from "react-router";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
  },
  {
    title: "Deployments",
    href: "/deployments",
  },
  {
    title: "Completions",
    href: "/completions",
  },
  {
    title: "Clusters",
    href: "/clusters",
  },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="h-screen w-64 border-r bg-background p-4">
      <div className="space-y-4">
        <div className="py-2">
          <h2 className="text-lg font-semibold">vLLM Platform</h2>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant={location.pathname === item.href ? "secondary" : "ghost"}
              className={cn("w-full justify-start")}
              asChild
            >
              <Link to={item.href}>{item.title}</Link>
            </Button>
          ))}
        </nav>
      </div>
    </div>
  );
}
