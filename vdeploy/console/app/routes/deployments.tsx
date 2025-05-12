import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  useDeployments,
  useRefreshDeploymentStatus,
  type Deployment,
} from "../lib/api";
import { useClusters } from "../lib/cluster-api";
import {
  RefreshCw,
  Plus,
  Server,
  Calendar,
  Activity,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  BarChart3,
  Settings,
  ArrowRight,
  Hash,
} from "lucide-react";

function StatusIcon({ status }: { status: string }) {
  if (status === "deployed" || status === "running") {
    return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  }
  return <Clock className="w-4 h-4 text-yellow-400" />;
}

function HealthIcon({ health }: { health: string }) {
  switch (health?.toLowerCase()) {
    case "healthy":
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case "unhealthy":
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
  }
}

export default function Deployments() {
  const navigate = useNavigate();
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
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  // Check if there are no clusters first
  if (clusters.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="relative p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Deployments</h1>
                <p className="text-gray-400">Manage your model deployments</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-6xl mx-auto">
          <div className="bg-yellow-900/20 border border-yellow-500/30 text-yellow-200 px-6 py-4 rounded-xl backdrop-blur-sm">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3" />
              <div className="flex-1">
                <p className="font-semibold">No Kubernetes clusters found</p>
                <p className="text-sm text-yellow-200/80 mt-1">
                  Please create a cluster first before deploying models.
                </p>
              </div>
              <Button
                onClick={() => navigate("/clusters")}
                className="bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
              >
                Go to Clusters
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-white">Loading deployments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            {(error as Error).message || "Failed to load deployments"}
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
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

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "deployed":
      case "running":
        return "text-green-400 bg-green-900/20 border-green-500/30";
      case "pending":
      case "provisioning":
        return "text-yellow-400 bg-yellow-900/20 border-yellow-500/30";
      case "failed":
        return "text-red-400 bg-red-900/20 border-red-500/30";
      default:
        return "text-gray-400 bg-gray-900/20 border-gray-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Deployments</h1>
                <p className="text-gray-400">Manage your model deployments</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
                <span className="ml-2">Refresh All</span>
              </Button>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link to="new">
                  <Plus className="w-4 h-4 mr-2" />
                  New Deployment
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-6xl mx-auto">
        {deployments.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
            <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Server className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-white">
              No deployments found
            </h3>
            <p className="text-gray-400 mb-6">
              Create a new deployment to get started.
            </p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link to="new">
                <Plus className="w-4 h-4 mr-2" />
                Create Deployment
              </Link>
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
                  className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer group"
                  onClick={() => {
                    if (deploymentId) {
                      navigate(`/deployments/${deploymentId}`);
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
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-700/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white group-hover:text-blue-300 transition-colors">
                          {deployment.name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Activity className="w-4 h-4 text-gray-400" />
                          <p className="text-sm text-gray-400">
                            {deployment.model || "unknown"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) =>
                          handleRefreshDeployment(e, deploymentId)
                        }
                        disabled={isRefreshing}
                        className="hover:bg-gray-700/50"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${
                            isRefreshing ? "animate-spin" : ""
                          }`}
                        />
                      </Button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6">
                    {/* Status and Health */}
                    <div className="flex items-center space-x-4 mb-4">
                      <div
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${getStatusColor(
                          deployment.status
                        )}`}
                      >
                        <StatusIcon status={deployment.status} />
                        <span className="text-sm font-medium">
                          {deployment.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-700/30 rounded-lg border border-gray-600/30">
                        <HealthIcon health={deployment.health_status} />
                        <span className="text-sm text-gray-300">
                          {deployment.health_status || "unknown"}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2 text-gray-400">
                          <Server className="w-4 h-4" />
                          <span>Namespace:</span>
                        </div>
                        <span className="text-gray-300">
                          {deployment.namespace}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2 text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>Created:</span>
                        </div>
                        <span className="text-gray-300">
                          {formatDate(deployment.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2 text-gray-400">
                          <Hash className="w-4 h-4" />
                          <span>ID:</span>
                        </div>
                        <span className="text-gray-300 font-mono text-xs">
                          {deploymentId}
                        </span>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center justify-end mt-6 pt-4 border-t border-gray-700/30">
                      <div className="flex items-center text-blue-400 text-sm group-hover:text-blue-300 transition-colors">
                        <span>View Details</span>
                        <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
