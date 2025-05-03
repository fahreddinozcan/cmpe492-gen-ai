import React from "react";
import { useParams, Link, Outlet, useNavigate } from "react-router-dom";
import { useCluster } from "../lib/api";
import { Button } from "../components/ui/button";

export default function ClusterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: cluster, isLoading, error } = useCluster(id!);

  if (isLoading) return <div className="py-8 text-center">Loading cluster...</div>;
  if (error || !cluster) return <div className="py-8 text-red-500">Cluster not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{cluster.name}</h1>
          <div className="text-muted-foreground text-sm">{cluster.zone} • {cluster.project_id}</div>
          <div className="text-xs text-muted-foreground">Status: {cluster.status}</div>
        </div>
        <Button variant="outline" onClick={() => navigate("/clusters")}>Back to Clusters</Button>
      </div>
      {/* Removed tab links (Deployments, Models, Metrics, Logs, Settings) */}
      <Outlet />
    </div>
  );
}
