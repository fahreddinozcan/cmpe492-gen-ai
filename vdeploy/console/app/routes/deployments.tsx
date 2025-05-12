import * as React from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import {
  useDeployments,
  useRefreshDeploymentStatus,
  type Deployment,
} from "../lib/api";
import { useClusters } from "../lib/cluster-api";

// Simple refresh icon component
function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.6 2.4L12 0.8V4H8.8V5.6H14.4V0H13.6V2.4ZM12 8.8C12 10.88 10.32 12.56 8.24 12.56C6.16 12.56 4.48 10.88 4.48 8.8C4.48 6.72 6.16 5.04 8.24 5.04V8L11.44 4.8L8.24 1.6V4.48C5.84 4.48 3.92 6.4 3.92 8.8C3.92 11.2 5.84 13.12 8.24 13.12C10.64 13.12 12.56 11.2 12.56 8.8H12Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Deployments() {
  const {
    data: deployments = [],
    isLoading,
    error,
    refetch,
  } = useDeployments();
  
  // Fetch clusters to check if any are available
  const { data: clusters = [] } = useClusters();

  const { mutate: refreshDeployment, isPending: isRefreshing } =
    useRefreshDeploymentStatus();

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  // Check if there are no clusters first
  if (clusters.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-white min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Deployments</h1>
            <p className="text-gray-400">Manage your model deployments</p>
          </div>
        </div>
        
        <div className="bg-yellow-800 border border-yellow-600 text-yellow-200 px-4 py-3 rounded mb-6 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-bold">No Kubernetes clusters found</p>
            <p className="text-sm">
              Please create a cluster first before deploying models.
            </p>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = "/clusters")}
              className="bg-yellow-700 hover:bg-yellow-600 border-yellow-600"
            >
              Go to Clusters
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return <div className="py-8 text-center">Loading deployments...</div>;
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="text-red-500 mb-4">
          {(error as Error).message || "Failed to load deployments"}
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  // Handle refresh for a specific deployment
  const handleRefreshDeployment = (
    e: React.MouseEvent,
    deploymentId: string | undefined
  ) => {
    e.stopPropagation(); // Prevent navigation when clicking refresh
    if (deploymentId) {
      refreshDeployment(deploymentId);
    }
  };

  // Get health status color
  const getHealthStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "healthy":
        return "bg-green-500";
      case "unhealthy":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  // Get deployment status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "deployed":
      case "running":
        return "bg-green-100 text-green-800";
      case "pending":
      case "provisioning":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case "deployed":
      case "running":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
      case "provisioning":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto text-white min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Deployments</h1>
          <p className="text-gray-400">Manage your model deployments</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshIcon />
            <span className="ml-2">Refresh All</span>
          </Button>
          <Button asChild>
            <Link to="new">New Deployment</Link>
          </Button>
        </div>
      </div>

      {deployments.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-medium mb-2 text-white">
            No deployments found
          </h3>
          <p className="text-gray-400 mb-6">
            Create a new deployment to get started.
          </p>
          <Button asChild>
            <Link to="new">Create Deployment</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {deployments.map((deployment) => {
            // Use deployment_id as the primary identifier
            const deploymentId = deployment.deployment_id || deployment.id;

            return (
              <div
                key={deploymentId}
                className="bg-gray-800 rounded-lg border border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  if (deploymentId) {
                    window.location.href = `/deployments/${deploymentId}`;
                  } else {
                    console.error(
                      "No valid ID found for deployment:",
                      deployment
                    );
                    alert(
                      "Could not navigate to deployment details: Missing ID"
                    );
                  }
                }}
              >
                <div className="p-5 border-b border-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {deployment.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {deployment.model}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleRefreshDeployment(e, deploymentId)}
                      disabled={isRefreshing}
                    >
                      <RefreshIcon />
                    </Button>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(
                        deployment.status
                      )}`}
                    >
                      {deployment.status}
                    </span>
                    <span className="text-gray-600 mx-1">|</span>
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${getHealthStatusColor(
                          deployment.health_status
                        )}`}
                      ></div>
                      <span className="text-xs text-gray-400">
                        {deployment.health_status || "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Namespace:</span>
                      <span className="ml-2 text-gray-300">
                        {deployment.namespace}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <span className="ml-2 text-gray-300">
                        {formatDate(deployment.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
