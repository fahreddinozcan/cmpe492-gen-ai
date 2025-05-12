import { redirect } from "react-router-dom";
import type { Route } from "./+types/home";

export function loader({}: Route.LoaderArgs) {
  return redirect("/clusters");
}

export default function Home() {
  return null;
}
