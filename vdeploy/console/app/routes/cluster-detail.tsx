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
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle,
  Circle,
  Clock,
  Loader2,
  RefreshCw,
  Terminal,
  Trash2,
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

  if (progress < 10) return "pending";
  if (progress < 30) return "pending";
  if (progress < 40) return "project_verification";
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

// Progress display component for clusters being created
function ClusterProgressDisplay({ clusterId }: { clusterId: string }) {
  const { logs, isLoading, error, refreshLogs, clusterInfo, progress } =
    useClusterLogs(clusterId);
  const [currentStage, setCurrentStage] = React.useState<string>("pending");

  // Update current stage based on progress
  React.useEffect(() => {
    if (clusterInfo) {
      const stage = mapProgressToStage(progress, clusterInfo.status);
      setCurrentStage(stage);
    }
  }, [clusterInfo, progress]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Cluster Creation Progress</CardTitle>
        <CardDescription>
          Your cluster is being created. This process may take 10-15 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.toString()}</AlertDescription>
          </Alert>
        )}

        {clusterInfo && (
          <div className="bg-muted/20 p-3 rounded-md mb-6 flex justify-between items-center">
            <div>
              <p className="text-sm">
                <span className="font-medium">Status:</span>{" "}
                <span
                  className={
                    clusterInfo.status === "RUNNING"
                      ? "text-green-600"
                      : clusterInfo.status === "ERROR"
                      ? "text-red-600"
                      : "text-blue-600"
                  }
                >
                  {clusterInfo.status}
                </span>
              </p>
              {progress > 0 && progress < 100 && (
                <p className="text-sm">
                  <span className="font-medium">Progress:</span> {progress}%
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshLogs}
              disabled={isLoading}
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
                    <Clock className="h-6 w-6 text-primary animate-pulse" />
                  )}
                  {status === "failed" && (
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  )}
                  {status === "upcoming" && (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="font-medium">{stage.label}</h3>
                    {status === "current" && (
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {stage.description}
                  </p>
                  {index < CLUSTER_STAGES.length - 1 && (
                    <div className="h-6 border-l border-dashed border-muted ml-3 mt-1"></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
      return <Badge className="bg-green-500">Running</Badge>;
    case "CREATING":
    case "PENDING":
      return <Badge className="bg-blue-500">Creating</Badge>;
    case "DELETING":
      return <Badge className="bg-orange-500">Deleting</Badge>;
    case "ERROR":
      return <Badge className="bg-red-500">Error</Badge>;
    case "NOT_FOUND":
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
            <p>{error.message}</p>
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
          {cluster.status === "CREATING" && (
            <ClusterProgressDisplay clusterId={clusterId} />
          )}

          <div className="grid gap-6 mb-6">
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
                      <TableCell>{cluster.endpoint || "N/A"}</TableCell>
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
                      <TableCell>{cluster.node_count || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">GPU Nodes</TableCell>
                      <TableCell>{cluster.gpu_node_count || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">GPU Type</TableCell>
                      <TableCell>{cluster.gpu_type || "N/A"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {cluster.status === "RUNNING" && (
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Next steps to start using your GKE cluster
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">
                    1. Connect to the cluster
                  </h3>
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
                    You can now deploy a vLLM service on this cluster from the
                    Deployments section.
                  </p>
                  <Button onClick={() => navigate("/deployments/new")}>
                    Create a Deployment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {cluster.status !== "DELETING" && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 border border-red-200 rounded-md">
                  <div>
                    <h3 className="font-medium text-red-600">Delete Cluster</h3>
                    <p className="text-sm text-gray-600">
                      This will permanently delete the cluster and all
                      associated resources.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteCluster}
                    // disabled={isDeleting}
                  >
                    {/* {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : ( */}
                    <Trash2 className="h-4 w-4 mr-2" />
                    {/* )} */}
                    Delete Cluster
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
