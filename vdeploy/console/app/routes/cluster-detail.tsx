import * as React from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { useToast } from "../components/ui/use-toast";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Cpu,
  Info as InfoIcon,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Server as ServerIcon,
  Terminal,
  Trash2,
  Zap,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  useCluster,
  useClusterLogs,
  useDeleteCluster,
} from "../lib/cluster-api";
import type { ClusterStatus, LogEntry } from "../lib/cluster-api";

// Define the cluster stages for progress display
const CLUSTER_STAGES = [
  {
    id: "pending",
    label: "Cluster Creation Initiated",
    description: "Cluster creation request has been submitted",
  },
  {
    id: "project_verification",
    label: "Project Verification",
    description: "Verifying project access and enabling required APIs",
  },
  {
    id: "creating_cluster",
    label: "Creating GKE Cluster",
    description: "Setting up the standard node pool and cluster infrastructure",
  },
  {
    id: "adding_gpu",
    label: "Adding GPU Node Pool",
    description: "Configuring GPU nodes for machine learning workloads",
  },
  {
    id: "running",
    label: "Cluster Ready",
    description: "The cluster is now running and ready to use",
  },
];

// Map progress percentage to stage
function mapProgressToStage(progress: number, status: string): string {
  if (
    status?.toLowerCase().includes("error") ||
    status?.toLowerCase().includes("fail")
  ) {
    return "failed";
  }
  
  // If the status is RUNNING, always return running regardless of progress
  if (status === "RUNNING") {
    return "running";
  }

  if (progress < 10) return "pending";
  if (progress < 30) return "project_verification";
  if (progress < 50) return "creating_cluster";
  if (progress < 100) return "adding_gpu";
  return "running";
}

// Define the cluster interface
interface Cluster {
  cluster_id: string;
  project_id: string;
  zone: string;
  cluster_name: string;
  status: string;
  created_at?: string;
  node_count?: number;
  gpu_node_count?: number;
  gpu_type?: string;
  endpoint?: string;
  error_message?: string;
  progress?: number;
}

// Create a context to share logs data between components
interface ClusterLogsContextType {
  logs: LogEntry[];
  isLoading: boolean;
  error: string | null;
  refreshLogs: () => void;
  clusterInfo: ClusterStatus | null;
  progress: number;
}

const ClusterLogsContext = React.createContext<ClusterLogsContextType | null>(null);

// Provider component to fetch logs once and share with child components
function ClusterLogsProvider({ clusterId, children }: { clusterId: string, children: React.ReactNode }) {
  const logsData = useClusterLogs(clusterId);
  
  return (
    <ClusterLogsContext.Provider value={logsData}>
      {children}
    </ClusterLogsContext.Provider>
  );
}

// Hook to use the shared logs context
function useClusterLogsContext() {
  const context = React.useContext(ClusterLogsContext);
  if (!context) {
    throw new Error('useClusterLogsContext must be used within a ClusterLogsProvider');
  }
  return context;
}

// Progress display component for clusters being created
function ClusterProgressDisplay() {
  const { clusterInfo, progress, error, refreshLogs, isLoading } = useClusterLogsContext();
  const [currentStage, setCurrentStage] = React.useState<string>("pending");

  // Update current stage based on progress
  React.useEffect(() => {
    if (clusterInfo) {
      const stage = mapProgressToStage(progress, clusterInfo.status);
      setCurrentStage(stage);
    }
  }, [clusterInfo, progress]);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 mb-6 shadow-xl">
      <div className="flex items-center mb-2">
        <Clock className="h-5 w-5 text-blue-400 mr-2 animate-pulse" />
        <h3 className="text-lg font-semibold text-white">Cluster Creation Progress</h3>
      </div>
      <p className="text-gray-400 mb-4">
        Your cluster is being created. This process may take 10-15 minutes.
      </p>
      
      {error && (
        <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-800 text-red-300">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.toString()}</AlertDescription>
        </Alert>
      )}

      {clusterInfo && (
        <div className="bg-gray-900/70 p-4 rounded-md mb-6 flex justify-between items-center border border-gray-700">
          <div>
            <p className="text-sm text-gray-300">
              <span className="font-medium">Status:</span>{" "}
              <span
                className={
                  clusterInfo.status === "RUNNING"
                    ? "text-green-400 font-semibold"
                    : clusterInfo.status === "ERROR"
                    ? "text-red-400 font-semibold"
                    : "text-blue-400 font-semibold"
                }
              >
                {clusterInfo.status}
              </span>
            </p>
            <div className="flex items-center mt-1">
              <span className="font-medium text-sm mr-2 text-gray-300">Progress:</span>
              <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-in-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-300">{progress}%</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshLogs}
            disabled={isLoading}
            className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {CLUSTER_STAGES.map((stage, index) => {
          const currentStageIndex = CLUSTER_STAGES.findIndex(
            (s) => s.id === currentStage
          );
          let status: "complete" | "current" | "upcoming" | "failed" =
            "upcoming";

          if (index < currentStageIndex) {
            status = "complete";
          } else if (index === currentStageIndex) {
            status = clusterInfo?.status === "ERROR" ? "failed" : "current";
          }

          return (
            <div
              key={stage.id}
              className={`flex items-start ${
                status === "upcoming" ? "opacity-50" : ""
              }`}
            >
              <div className="mr-4 mt-1">
                {status === "complete" && (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
                {status === "current" && (
                  <Clock className="h-6 w-6 text-blue-400 animate-pulse" />
                )}
                {status === "failed" && (
                  <AlertCircle className="h-6 w-6 text-red-400" />
                )}
                {status === "upcoming" && (
                  <Circle className="h-6 w-6 text-gray-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="font-medium text-white">{stage.label}</h3>
                  {status === "current" && (
                    <span className="ml-2 text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full">
                      In Progress
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {stage.description}
                </p>
                {index < CLUSTER_STAGES.length - 1 && (
                  <div className="h-6 border-l border-dashed border-gray-700 ml-3 mt-1"></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Function to format timestamps
function formatDate(dateString?: string) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString();
}

// Function to determine badge color based on status
function getStatusBadge(status: string) {
  switch (status) {
    case "RUNNING":
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">Running</span>;
    case "CREATING":
    case "PENDING":
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">Creating</span>;
    case "DELETING":
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">Deleting</span>;
    case "ERROR":
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">Error</span>;
    case "NOT_FOUND":
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">Not Found</span>;
    default:
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">{status}</span>;
  }
}

export default function ClusterDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const clusterId = params.id as string;
  const { data: cluster, isLoading, error, refetch } = useCluster(clusterId);
  const { mutateAsync: deleteCluster } = useDeleteCluster();

  const handleDeleteCluster = async () => {
    if (!cluster) return;

    if (
      !confirm(
        `Are you sure you want to delete the cluster "${cluster.cluster_name}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/clusters/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: cluster.project_id,
          zone: cluster.zone,
          cluster_name: cluster.cluster_name,
          force_delete: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete cluster");
      }

      toast({
        title: "Cluster deletion started",
        description: `Deleting cluster ${cluster.cluster_name}`,
      });

      refetch();
    } catch (err) {
      toast({
        title: "Failed to delete cluster",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center shadow-lg">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {isLoading ? (
                    <Skeleton className="h-8 w-32 bg-gray-700" />
                  ) : cluster ? (
                    cluster.cluster_name
                  ) : (
                    "Cluster Details"
                  )}
                </h1>
                <p className="text-gray-400">
                  {!isLoading && cluster && (
                    <>Manage your Kubernetes cluster ({cluster.cluster_id})</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
                disabled={isLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/clusters")}
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Clusters
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6">
            <Skeleton className="h-64 w-full bg-gray-800/50" />
            <Skeleton className="h-64 w-full bg-gray-800/50" />
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-700/50 text-red-200 px-6 py-4 rounded-xl backdrop-blur-sm mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 mr-3 text-red-400" />
              <div className="flex-1">
                <p className="font-semibold">Error Loading Cluster</p>
                <p className="text-sm text-red-300/80 mt-1">
                  {error.message}
                </p>
              </div>
              <Button
                onClick={() => navigate("/clusters")}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                Back to Clusters
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : !cluster ? (
          <div className="bg-yellow-900/20 border border-yellow-700/50 text-yellow-200 px-6 py-4 rounded-xl backdrop-blur-sm mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3 text-yellow-400" />
              <div className="flex-1">
                <p className="font-semibold">Cluster Not Found</p>
                <p className="text-sm text-yellow-300/80 mt-1">
                  The requested cluster could not be found.
                </p>
              </div>
              <Button
                onClick={() => navigate("/clusters")}
                className="bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
              >
                Back to Clusters
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress Display for Creating Clusters */}
            {cluster.status === "CREATING" && (
              <ClusterLogsProvider clusterId={clusterId}>
                <ClusterProgressDisplay />
              </ClusterLogsProvider>
            )}

            {/* Status Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Status Card */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">
                      Status
                    </p>
                    <p className="text-2xl font-bold text-white mt-2">
                      {cluster.status}
                    </p>
                    <div className="flex items-center mt-2">
                      {cluster.status === "RUNNING" ? (
                        <span className="text-green-400 text-sm">
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Operational
                        </span>
                      ) : cluster.status === "CREATING" ? (
                        <span className="text-blue-400 text-sm">
                          <Clock className="w-3 h-3 inline mr-1" />
                          In Progress
                        </span>
                      ) : cluster.status === "ERROR" ? (
                        <span className="text-red-400 text-sm">
                          <AlertCircle className="w-3 h-3 inline mr-1" />
                          Error
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          {cluster.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <ServerIcon className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </div>

              {/* Project Card */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">
                      Project ID
                    </p>
                    <p className="text-lg font-bold text-white mt-2 truncate max-w-[150px]">
                      {cluster.project_id}
                    </p>
                    <div className="flex items-center mt-2">
                      <span className="text-gray-400 text-sm">
                        Zone: {cluster.zone}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </div>

              {/* CPU Nodes Card */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">
                      CPU Nodes
                    </p>
                    <p className="text-2xl font-bold text-white mt-2">
                      {cluster.node_count || "0"}
                    </p>
                    <div className="flex items-center mt-2">
                      <span className="text-gray-400 text-sm">
                        Standard Nodes
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                    <ServerIcon className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </div>

              {/* GPU Nodes Card */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">
                      GPU Nodes
                    </p>
                    <p className="text-2xl font-bold text-white mt-2">
                      {cluster.gpu_node_count || "0"}
                    </p>
                    <div className="flex items-center mt-2">
                      <span className="text-gray-400 text-sm">
                        {cluster.gpu_type || "No GPU"}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-orange-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Cluster Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Cluster Information */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Cluster Information
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">Created</span>
                    <span className="text-white">{formatDate(cluster.created_at)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">Cluster ID</span>
                    <span className="text-white font-mono text-sm">{cluster.cluster_id}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">Endpoint</span>
                    <span className="text-white">{cluster.endpoint || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Status</span>
                    <span>{getStatusBadge(cluster.status)}</span>
                  </div>
                </div>
              </div>

              {/* Getting Started Section (for running clusters) */}
              {cluster.status === "RUNNING" && (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      Getting Started
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-300 font-medium mb-2">
                        1. Connect to the cluster
                      </p>
                      <div className="bg-black/40 p-3 rounded-md font-mono text-xs text-gray-300 overflow-x-auto border border-gray-700/50">
                        {`gcloud container clusters get-credentials ${cluster.cluster_name} \\
  --zone=${cluster.zone} \\
  --project=${cluster.project_id}`}
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-300 font-medium mb-2">
                        2. Check GPU nodes
                      </p>
                      <div className="bg-black/40 p-3 rounded-md font-mono text-xs text-gray-300 overflow-x-auto border border-gray-700/50">
                        kubectl get nodes -l cloud.google.com/gke-accelerator
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button 
                        className="bg-blue-600 hover:bg-blue-700 w-full" 
                        onClick={() => navigate("/deployments/new")}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Deployment on this Cluster
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            {cluster.status !== "DELETING" && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 shadow-xl">
                <div className="flex items-center mb-4">
                  <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Danger Zone</h3>
                </div>
                <div className="flex items-center justify-between p-4 bg-red-900/20 rounded-lg border border-red-700/30">
                  <div>
                    <h3 className="font-medium text-red-400">Delete Cluster</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      This will permanently delete the cluster and all associated resources.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteCluster}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Cluster
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}