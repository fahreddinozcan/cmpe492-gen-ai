import { Outlet } from "react-router";
import { Sidebar } from "./sidebar";

export default function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
