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
import { PlusCircle, RefreshCw, ExternalLink, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge, Skeleton } from "../components/ui";
import { useToast } from "../components/ui/use-toast";
import { clusterApiClient } from "../lib/cluster-api";
import type { ClusterStatus } from "../lib/cluster-api";


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
    queryKey: ['clusters', projectId],
    queryFn: () => clusterApiClient.getClusters(projectId),
    refetchInterval: (query) => {
      // Refresh every 10 seconds if we have active clusters
      const hasActiveClusters = query.state.data?.some(
        (c: ClusterStatus) => c.status === 'CREATING' || c.status === 'DELETING'
      );
      return hasActiveClusters ? 10000 : false;
    },
    staleTime: 5000, // Consider data fresh for 5 seconds
  });
}

// Function to format timestamps
function formatDate(dateString?: string) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
}

// Function to determine badge color based on status
function getStatusBadge(status: string) {
  switch (status) {
    case 'RUNNING':
      return <Badge className="bg-green-500">Running</Badge>;
    case 'CREATING':
    case 'PENDING':
      return <Badge className="bg-blue-500">Creating</Badge>;
    case 'DELETING':
      return <Badge className="bg-orange-500">Deleting</Badge>;
    case 'ERROR':
      return <Badge className="bg-red-500">Error</Badge>;
    case 'NOT_FOUND':
      return <Badge variant="outline">Not Found</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function Clusters() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for filtering clusters by project
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | undefined>(undefined);
  
  // Fetch clusters with React Query
  const { data: clusters = [], isLoading, error, refetch } = useClusters(selectedProjectId);

  // Delete cluster mutation
  const deleteMutation = useMutation({
    mutationFn: (cluster: ClusterStatus) => 
      clusterApiClient.deleteCluster({
        project_id: cluster.project_id,
        zone: cluster.zone,
        cluster_name: cluster.cluster_name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
    }
  });
  
  // Delete a cluster
  const deleteCluster = async (cluster: ClusterStatus) => {
    if (!confirm(`Are you sure you want to delete cluster ${cluster.cluster_name}?`)) {
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
        description: `Failed to delete cluster: ${error instanceof Error ? error.message : 'Unknown error'}.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Clusters</h1>
          <p className="text-muted-foreground">
            Manage your GKE clusters for model deployments
          </p>
        </div>
        <div className="flex space-x-3 items-center">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate("/clusters/new")}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Cluster
          </Button>
        </div>
      </div>
      
      {/* Project selector */}
      <div className="mb-4">
        <div className="flex items-center space-x-4">
          <div className="w-64">
            <Select 
              value={selectedProjectId || "all"} 
              onValueChange={(value) => setSelectedProjectId(value === "all" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {/* Only show existing projects from clusters data */}
                {[...new Set(clusters.map(cluster => cluster.project_id))]
                  .filter(Boolean)
                  .map(projectId => (
                    <SelectItem key={projectId} value={projectId}>
                      {projectId}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          {selectedProjectId && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedProjectId(undefined)}
            >
              Clear Filter
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error instanceof Error ? error.message : String(error)}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>All Clusters</CardTitle>
          <CardDescription>
            GKE clusters available for vLLM deployments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : clusters.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No clusters found</p>
              <Button
                variant="link"
                onClick={() => navigate("/clusters/new")}
                className="mt-2"
              >
                Create your first cluster
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cluster Name</TableHead>
                  <TableHead>Project ID</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>GPU Type</TableHead>
                  <TableHead>GPU Count</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clusters.map((cluster) => (
                  <TableRow key={cluster.cluster_id}>
                    <TableCell className="font-medium">
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => navigate(`/clusters/${cluster.cluster_id}`)}
                      >
                        {cluster.cluster_name}
                      </Button>
                    </TableCell>
                    <TableCell>{cluster.project_id}</TableCell>
                    <TableCell>{cluster.zone}</TableCell>
                    <TableCell>{getStatusBadge(cluster.status)}</TableCell>
                    <TableCell>{cluster.gpu_type || 'N/A'}</TableCell>
                    <TableCell>{cluster.gpu_node_count || 'N/A'}</TableCell>
                    <TableCell>{formatDate(cluster.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        {cluster.status === 'RUNNING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/clusters/${cluster.cluster_id}`)}
                            title="View Details"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCluster(cluster)}
                          disabled={cluster.status === 'DELETING'}
                          title="Delete Cluster"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
