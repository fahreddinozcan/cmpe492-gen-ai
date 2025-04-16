import { redirect } from "react-router";
import type { Route } from "./+types/home";

export function loader({}: Route.LoaderArgs) {
  return redirect("/deployments");
}

export default function Home() {
  return null;
}
