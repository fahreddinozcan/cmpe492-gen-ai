import { type RouteConfig, route, index, layout } from "@react-router/dev/routes";

export default [
  layout("components/layout/main-layout.tsx", [
    index("routes/home.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
    route("deployments", "routes/deployments.tsx"),
    route("deployments/new", "routes/deployments-new.tsx"),
    route("deployments/:id", "routes/deployment-detail.tsx"),
    route("deployment-progress/:id", "routes/deployment-progress.tsx"),
    route("completions", "routes/completions.tsx"),
  ]),
] satisfies RouteConfig;
