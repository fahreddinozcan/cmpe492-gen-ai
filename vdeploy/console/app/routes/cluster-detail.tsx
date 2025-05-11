import * as React from "react";
import { useParams, useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge, Skeleton, useToast } from "../components/ui";
import { RefreshCw, Trash2, ArrowLeft, Terminal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

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

// Custom hook for fetching a single cluster
function useCluster(clusterId: string) {
  const [cluster, setCluster] = React.useState<Cluster | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchCluster = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clusters/${clusterId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cluster: ${response.statusText}`);
      }
      
      const data = await response.json();
      setCluster(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [clusterId]);

  React.useEffect(() => {
    fetchCluster();
    
    // Set up auto-refresh for active clusters
    const interval = setInterval(() => {
      if (cluster && ['PENDING', 'CREATING', 'DELETING'].includes(cluster.status)) {
        fetchCluster();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchCluster, cluster]);

  return { cluster, isLoading, error, refetch: fetchCluster };
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

export default function ClusterDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const clusterId = params.id as string;
  const { cluster, isLoading, error, refetch } = useCluster(clusterId);

  const handleDeleteCluster = async () => {
    if (!cluster) return;
    
    if (!confirm(`Are you sure you want to delete the cluster "${cluster.cluster_name}"?`)) {
      return;
    }
    
    try {
      const response = await fetch('/api/clusters/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: cluster.project_id,
          zone: cluster.zone,
          cluster_name: cluster.cluster_name,
          force_delete: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete cluster');
      }
      
      toast({
        title: "Cluster deletion started",
        description: `Deleting cluster ${cluster.cluster_name}`,
      });
      
      refetch();
    } catch (err) {
      toast({
        title: "Failed to delete cluster",
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => navigate("/clusters")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clusters
        </Button>
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Card className="mb-6 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate("/clusters")}>
              Back to Clusters
            </Button>
          </CardFooter>
        </Card>
      ) : !cluster ? (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle>Cluster Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The requested cluster could not be found.</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate("/clusters")}>
              Back to Clusters
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                {cluster.cluster_name}
                {getStatusBadge(cluster.status)}
              </h1>
              <p className="text-gray-500 mt-1">
                Project: {cluster.project_id} | Zone: {cluster.zone}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteCluster}
                disabled={cluster.status === 'DELETING'}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Cluster
              </Button>
            </div>
          </div>

          {cluster.error_message && (
            <Card className="mb-6 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-500">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{cluster.error_message}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Cluster Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Status</TableCell>
                      <TableCell>{getStatusBadge(cluster.status)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Created</TableCell>
                      <TableCell>{formatDate(cluster.created_at)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Project ID</TableCell>
                      <TableCell>{cluster.project_id}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Zone</TableCell>
                      <TableCell>{cluster.zone}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Endpoint</TableCell>
                      <TableCell>{cluster.endpoint || 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Node Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">CPU Nodes</TableCell>
                      <TableCell>{cluster.node_count || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">GPU Nodes</TableCell>
                      <TableCell>{cluster.gpu_node_count || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">GPU Type</TableCell>
                      <TableCell>{cluster.gpu_type || 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {cluster.status === 'RUNNING' && (
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Next steps to start using your GKE cluster
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">1. Connect to the cluster</h3>
                  <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto">
                    {`gcloud container clusters get-credentials ${cluster.cluster_name} \\
  --zone=${cluster.zone} \\
  --project=${cluster.project_id}`}
                  </pre>
                </div>

                <div>
                  <h3 className="font-medium mb-2">2. Check GPU nodes</h3>
                  <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto">
                    kubectl get nodes -l cloud.google.com/gke-accelerator
                  </pre>
                </div>

                <div>
                  <h3 className="font-medium mb-2">3. Deploy a vLLM service</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    You can now deploy a vLLM service on this cluster from the Deployments section.
                  </p>
                  <Button onClick={() => navigate("/deployments/new")}>
                    Create a Deployment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
