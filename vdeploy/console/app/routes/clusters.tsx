import React from "react";
import { useNavigate } from "react-router-dom";
import { useClusters, useDeleteCluster } from "../lib/api";
import { Button } from "../components/ui/button";

export default function Clusters() {
  const navigate = useNavigate();
  const { data: clusters = [], isLoading, error, refetch } = useClusters();
  const { mutate: deleteCluster } = useDeleteCluster();

  const handleCreate = () => navigate("/clusters/new");
  const handleSelect = (id: string) => navigate(`/clusters/${id}`);
  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this cluster?")) {
      deleteCluster(id);
    }
  };

  if (isLoading) return <div className="py-8 text-center">Loading clusters...</div>;
  if (error) return <div className="py-8 text-red-500">Failed to load clusters</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Clusters</h1>
        <Button onClick={handleCreate}>Create Cluster</Button>
      </div>
      {clusters.length === 0 ? (
        <div className="text-gray-400">No clusters found.</div>
      ) : (
        <div className="space-y-4">
          {clusters.map((cluster) => (
            <div key={cluster.cluster_id} className="p-4 border rounded flex justify-between items-center bg-card">
              <div onClick={() => handleSelect(cluster.cluster_id)} className="cursor-pointer flex-1">
                <div className="font-semibold">{cluster.name}</div>
                <div className="text-sm text-muted-foreground">{cluster.zone} • {cluster.project_id}</div>
                <div className="text-xs text-muted-foreground">Status: {cluster.status}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(cluster.cluster_id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
