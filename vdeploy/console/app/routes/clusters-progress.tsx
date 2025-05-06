import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useClusterProgress } from "../lib/api";

export default function ClusterProgressPage() {
  // NOTE: clusterId is now expected in the format 'project_id:zone:cluster_name'
  const { id: clusterId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: progress, isLoading: loading, error } = useClusterProgress(clusterId);

  const status = progress?.status;
  const nodePools = progress?.nodePools || [];

  React.useEffect(() => {
    if (status === "RUNNING") {
      // Redirect to cluster details after 2 seconds
      const timeout = setTimeout(() => navigate(`/clusters/${clusterId}`), 2000);
      return () => clearTimeout(timeout);
    }
  }, [status, navigate, clusterId]);

  return (
    <div className="max-w-xl mx-auto py-10">
      <Card className="p-8">
        <h2 className="text-2xl font-bold mb-4">Cluster Creation Progress</h2>
        {loading && <div className="mb-3">Loading progress...</div>}
        {error && <div className="text-red-500 mb-3">{String(error)}</div>}
        {progress && (
          <>
            <div className="mb-2">
              <span className="font-semibold">Status:</span> {progress.status}
            </div>
            <div className="mb-2">
              <span className="font-semibold">Endpoint:</span> {progress.endpoint || "-"}
            </div>
            <div className="mb-4">
              <span className="font-semibold">Created At:</span> {progress.createTime || "-"}
            </div>
            <div className="mb-4">
              <span className="font-semibold">Node Pools:</span>
              <ul className="list-disc ml-6">
                {nodePools.map((np: any) => (
                  <li key={np.name}>
                    <span className="font-medium">{np.name}</span>: Status: {np.status}, Nodes: {np.currentNodeCount}
                  </li>
                ))}
              </ul>
            </div>
            {status !== "RUNNING" && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-white" />
                <span>Cluster is being provisioned...</span>
              </div>
            )}
            {status === "RUNNING" && (
              <div className="text-green-600 font-semibold">
                Cluster is ready! Redirecting to details...
              </div>
            )}
          </>
        )}
        <div className="mt-6">
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </Card>
    </div>
  );
}
