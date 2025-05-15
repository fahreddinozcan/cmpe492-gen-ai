import * as React from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { 
  PlusCircle, 
  RefreshCw, 
  ExternalLink, 
  Trash2, 
  Cpu,
  Server,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Filter,
  AlertTriangle,
  Plus
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { clusterApiClient } from "../lib/cluster-api";
import type { ClusterStatus } from "../lib/cluster-api";
import { useToast } from "../components/ui/use-toast";

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
}

// Custom hook using React Query for fetching clusters
function useClusters(projectId?: string) {
  return useQuery<ClusterStatus[], Error>({
    queryKey: ["clusters", projectId],
    queryFn: () => clusterApiClient.getClusters(projectId),
    refetchInterval: (query) => {
      // Refresh every 10 seconds if we have active clusters
      const hasActiveClusters = query.state.data?.some(
        (c: ClusterStatus) => c.status === "CREATING" || c.status === "DELETING"
      );
      return hasActiveClusters ? 10000 : false;
    },
    staleTime: 5000, // Consider data fresh for 5 seconds
  });
}

// Function to format timestamps
function formatDate(dateString?: string) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Function to determine status icon and color based on status
function StatusIcon({ status }: { status: string }) {
  if (status === "RUNNING") {
    return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  } else if (status === "CREATING" || status === "PENDING") {
    return <Clock className="w-4 h-4 text-yellow-400" />;
  } else if (status === "DELETING") {
    return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  } else if (status === "ERROR") {
    return <AlertCircle className="w-4 h-4 text-red-400" />;
  }
  return <AlertCircle className="w-4 h-4 text-gray-400" />;
}

// Get status color for badges and background
const getStatusColor = (status: string) => {
  switch (status) {
    case "RUNNING":
      return "text-green-400 bg-green-900/20 border-green-500/30";
    case "CREATING":
    case "PENDING":
      return "text-yellow-400 bg-yellow-900/20 border-yellow-500/30";
    case "DELETING":
      return "text-orange-400 bg-orange-900/20 border-orange-500/30";
    case "ERROR":
      return "text-red-400 bg-red-900/20 border-red-500/30";
    default:
      return "text-gray-400 bg-gray-900/20 border-gray-500/30";
  }
};

export default function Clusters() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for filtering clusters by project
  const [selectedProjectId, setSelectedProjectId] = React.useState<
    string | undefined
  >(undefined);

  // Fetch clusters with React Query
  const {
    data: clusters = [],
    isLoading,
    error,
    refetch,
  } = useClusters(selectedProjectId);

  // Delete cluster mutation
  const deleteMutation = useMutation({
    mutationFn: (cluster: ClusterStatus) =>
      clusterApiClient.deleteCluster({
        project_id: cluster.project_id,
        zone: cluster.zone,
        cluster_name: cluster.cluster_name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clusters"] });
    },
  });

  // Delete a cluster
  const deleteCluster = async (cluster: ClusterStatus) => {
    if (
      !confirm(
        `Are you sure you want to delete cluster ${cluster.cluster_name}?`
      )
    ) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(cluster);

      toast({
        title: "Cluster Deletion Started",
        description: `Cluster ${cluster.cluster_name} is being deleted.`,
      });
    } catch (error) {
      toast({
        title: "Deletion Failed",
        description: `Failed to delete cluster: ${
          error instanceof Error ? error.message : "Unknown error"
        }.`,
        variant: "destructive",
      });
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
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center shadow-lg">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Clusters</h1>
                <p className="text-gray-400">Manage your GKE clusters for model deployments</p>
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
                <span className="ml-2">Refresh</span>
              </Button>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <span onClick={() => navigate("/clusters/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Cluster
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-6xl mx-auto">
        {/* Project Filter */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Filter className="w-5 h-5 mr-2 text-gray-400" />
                <span className="text-white font-medium">Filter Clusters</span>
              </div>
              <div className="w-64">
                <Select
                  value={selectedProjectId || "all"}
                  onValueChange={(value) =>
                    setSelectedProjectId(value === "all" ? undefined : value)
                  }
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                    <SelectValue placeholder="Filter by project" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="all">All Projects</SelectItem>
                    {/* Only show existing projects from clusters data */}
                    {[...new Set(clusters.map((cluster) => cluster.project_id))]
                      .filter(Boolean)
                      .map((projectId) => (
                        <SelectItem key={projectId} value={projectId}>
                          {projectId}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedProjectId && (
              <Button
                variant="ghost"
                onClick={() => setSelectedProjectId(undefined)}
                className="text-gray-400 hover:text-white hover:bg-gray-700/50"
              >
                Clear Filter
              </Button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-200 px-6 py-4 rounded-xl backdrop-blur-sm mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 mr-3" />
              <div className="flex-1">
                <p className="font-semibold">Error Loading Clusters</p>
                <p className="text-sm text-red-200/80 mt-1">
                  {error instanceof Error ? error.message : String(error)}
                </p>
              </div>
              <Button
                onClick={() => refetch()}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Clusters Display */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-white">Loading clusters...</p>
            </div>
          </div>
        ) : clusters.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
            <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Server className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-white">
              No clusters found
            </h3>
            <p className="text-gray-400 mb-6">
              Create a new cluster to get started with deployments.
            </p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <span onClick={() => navigate("/clusters/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Cluster
              </span>
            </Button>
          </div>
        ) : (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="p-6 border-b border-gray-700/50">
              <h2 className="text-xl font-semibold text-white">All Clusters</h2>
              <p className="text-gray-400 text-sm mt-1">
                GKE clusters available for vLLM deployments
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="border-gray-700/50 bg-gray-800/50">
                    <TableHead className="text-gray-300">Cluster Name</TableHead>
                    <TableHead className="text-gray-300">Project ID</TableHead>
                    <TableHead className="text-gray-300">Zone</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">GPU Type</TableHead>
                    <TableHead className="text-gray-300">GPU Count</TableHead>
                    <TableHead className="text-gray-300">Created</TableHead>
                    <TableHead className="text-right text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clusters.map((cluster) => (
                    <TableRow 
                      key={cluster.cluster_id} 
                      className="border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                      onClick={() => navigate(`/clusters/${cluster.cluster_id}`)}
                    >
                      <TableCell className="font-medium text-white">
                        {cluster.cluster_name}
                      </TableCell>
                      <TableCell className="text-gray-300">{cluster.project_id}</TableCell>
                      <TableCell className="text-gray-300">{cluster.zone}</TableCell>
                      <TableCell>
                        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${getStatusColor(cluster.status)}`}>
                          <StatusIcon status={cluster.status} />
                          <span className="text-sm font-medium">{cluster.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">{cluster.gpu_type || "N/A"}</TableCell>
                      <TableCell className="text-gray-300">{cluster.gpu_node_count || "N/A"}</TableCell>
                      <TableCell className="text-gray-300">{formatDate(cluster.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/clusters/${cluster.cluster_id}`);
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:bg-gray-700/50"
                            title="View Details"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCluster(cluster);
                            }}
                            disabled={cluster.status === "DELETING"}
                            className="text-red-400 hover:text-red-300 hover:bg-gray-700/50 disabled:opacity-50"
                            title="Delete Cluster"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:shadow-lg transition-shadow group cursor-pointer"
            onClick={() => navigate("/deployments/new")}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-blue-400" />
              </div>
              <ArrowRight className="w-5 h-5 text-blue-400 transform group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">New Deployment</h3>
            <p className="text-gray-400 text-sm">Deploy a model on your cluster</p>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:shadow-lg transition-shadow group cursor-pointer"
            onClick={() => navigate("/clusters/new")}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                <Cpu className="w-6 h-6 text-green-400" />
              </div>
              <ArrowRight className="w-5 h-5 text-green-400 transform group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">New Cluster</h3>
            <p className="text-gray-400 text-sm">Configure a new GKE cluster</p>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:shadow-lg transition-shadow group cursor-pointer"
            onClick={() => navigate("/dashboard")}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-purple-400" />
              </div>
              <ArrowRight className="w-5 h-5 text-purple-400 transform group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Dashboard</h3>
            <p className="text-gray-400 text-sm">View system overview and metrics</p>
          </div>
        </div>
      </div>
    </div>
  );
}