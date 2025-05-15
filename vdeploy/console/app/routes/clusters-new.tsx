import * as React from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui";
import { useToast } from "../components/ui/use-toast";
import { 
  AlertCircle, 
  Check, 
  CheckCircle, 
  Circle, 
  Clock, 
  Loader2, 
  RefreshCw, 
  Terminal, 
  Plus,
  Server,
  ArrowRight
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { CollapsibleCard } from "../components/ui/collapsible-card";

// Import React Query hooks
import {
  useCreateCluster,
  useGCloudAuth,
  useCheckProject,
  useClusterLogs,
  useGCPProjects,
  type ClusterFormData,
  type ClusterResponse,
} from "../lib/cluster-api";

// Predefined options for select components
const GPU_TYPE_OPTIONS = [
  { value: "nvidia-l4", label: "NVIDIA L4" },
  { value: "nvidia-t4", label: "NVIDIA T4" },
  { value: "nvidia-a100", label: "NVIDIA A100" },
  { value: "nvidia-v100", label: "NVIDIA V100" },
];

const MACHINE_TYPE_OPTIONS = [
  { value: "e2-standard-4", label: "e2-standard-4 (4 vCPU, 16GB memory)" },
  { value: "e2-standard-8", label: "e2-standard-8 (8 vCPU, 32GB memory)" },
  { value: "e2-standard-16", label: "e2-standard-16 (16 vCPU, 64GB memory)" },
];

const GPU_MACHINE_TYPE_OPTIONS = [
  { value: "g2-standard-8", label: "g2-standard-8 (8 vCPU, 30GB memory)" },
  { value: "g2-standard-16", label: "g2-standard-16 (16 vCPU, 60GB memory)" },
  { value: "g2-standard-32", label: "g2-standard-32 (32 vCPU, 120GB memory)" },
];

interface LogDisplayProps {
  clusterId: string | undefined;
}

// Define the cluster creation stages and their descriptions
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
  if (status?.toLowerCase().includes('error') || status?.toLowerCase().includes('fail')) {
    return "failed";
  }
  
  if (progress < 10) return "pending";
  if (progress < 30) return "pending";
  if (progress < 40) return "project_verification";
  if (progress < 50) return "creating_cluster";
  if (progress < 100) return "adding_gpu";
  return "running";
}

// Cluster Creation Progress Component
function LogDisplay({ clusterId }: LogDisplayProps) {
  const { logs, isLoading, error, refreshLogs, clusterInfo, progress } = useClusterLogs(clusterId);
  const [currentStage, setCurrentStage] = React.useState<string>("pending");
  
  // Update current stage based on progress
  React.useEffect(() => {
    if (clusterInfo) {
      const stage = mapProgressToStage(progress, clusterInfo.status);
      setCurrentStage(stage);
    }
  }, [clusterInfo, progress]);

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Cluster Creation Progress</h2>
        <div>
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
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-700/50 text-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {clusterInfo && (
        <div className="bg-gray-800/50 p-4 rounded-xl mb-6 flex justify-between items-center border border-gray-700/50">
          <div>
            <p className="text-sm text-gray-300">
              <span className="font-medium text-white">Cluster:</span> {clusterInfo.cluster_name}
            </p>
            <p className="text-sm text-gray-300">
              <span className="font-medium text-white">Project:</span> {clusterInfo.project_id}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-300">
              <span className="font-medium text-white">Status:</span>{" "}
              <span className={clusterInfo.status === "RUNNING" ? "text-green-400" : 
                clusterInfo.status === "ERROR" ? "text-red-400" : "text-blue-400"}>
                {clusterInfo.status}
              </span>
            </p>
            {progress > 0 && progress < 100 && (
              <p className="text-sm text-gray-300">
                <span className="font-medium text-white">Progress:</span> {progress}%
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6 text-gray-300">
        {CLUSTER_STAGES.map((stage, index) => {
          const currentStageIndex = CLUSTER_STAGES.findIndex(s => s.id === currentStage);
          let status: "complete" | "current" | "upcoming" | "failed" = "upcoming";
          
          if (index < currentStageIndex) {
            status = "complete";
          } else if (index === currentStageIndex) {
            status = clusterInfo?.status === "ERROR" ? "failed" : "current";
          }
          
          return (
            <div 
              key={stage.id}
              className={`flex items-start ${status === "upcoming" ? "opacity-50" : ""}`}
            >
              <div className="mr-4 mt-1">
                {status === "complete" && (
                  <CheckCircle className="h-6 w-6 text-green-400" />
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
                    <span className="ml-2 text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full">
                      In Progress
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{stage.description}</p>
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

export default function NewCluster() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clusterId, setClusterId] = React.useState<string | undefined>(
    undefined
  );
  const [showLogs, setShowLogs] = React.useState(false);

  // Use React Query hooks for state management
  const { data: authData, isLoading: isCheckingAuth } = useGCloudAuth();

  // Fetch available GCP projects
  const { data: projectOptions, isLoading: isLoadingProjects } =
    useGCPProjects();

  // More robust authentication check
  const isAuthenticated = authData?.authenticated === true;

  // Use effect to log auth data whenever it changes
  React.useEffect(() => {
    console.log("Auth data changed:", authData);
    console.log("isAuthenticated:", isAuthenticated);
    console.log("isCheckingAuth:", isCheckingAuth);
  }, [authData, isAuthenticated, isCheckingAuth]);

  // State for custom project entry
  const [useCustomProject, setUseCustomProject] = React.useState(false);
  const [customProjectId, setCustomProjectId] = React.useState("");

  // Form state
  const form = useForm<ClusterFormData>({
    defaultValues: {
      project_id: "",
      zone: "us-central1-a",
      cluster_name: "vllm-cluster",
      machine_type: "e2-standard-4",
      num_nodes: 3,
      gpu_pool_name: "gpu-pool",
      gpu_machine_type: "g2-standard-8",
      gpu_type: "nvidia-l4",
      gpu_nodes: 1,
      gpus_per_node: 1,
      min_gpu_nodes: 0,
      max_gpu_nodes: 5,
      debug: false,
    },
  });

  // Update project_id when customProjectId changes
  React.useEffect(() => {
    if (useCustomProject) {
      form.setValue("project_id", customProjectId);
    }
  }, [customProjectId, useCustomProject, form]);

  // Watch project_id to check if it exists
  const watchedProjectId = form.watch("project_id");

  // Use React Query to check if project exists
  const {
    data: projectData,
    isLoading: isCheckingProject,
    error: projectError,
  } = useCheckProject(watchedProjectId);

  const projectExists = projectData?.exists || false;

  // Use React Query mutation for cluster creation
  const {
    mutate: createCluster,
    isPending: isSubmitting,
    error: mutationError,
    data: clusterResponse,
  } = useCreateCluster();

  // Generate a unique cluster name based on a prefix
  React.useEffect(() => {
    const timestamp = new Date().getTime().toString().slice(-6);
    form.setValue("cluster_name", `vllm-cluster-${timestamp}`);
  }, [form]);

  // Store the cluster ID when the cluster is created
  React.useEffect(() => {
    if (clusterResponse?.cluster_id && !clusterId) {
      setClusterId(clusterResponse.cluster_id);
      setShowLogs(true);
    }
  }, [clusterResponse, clusterId]);

  const onSubmit = (data: ClusterFormData) => {
    try {
      createCluster(data, {
        onSuccess: (response) => {
          toast({
            title: "Cluster creation started",
            description: `Creating cluster ${data.cluster_name} in project ${data.project_id}`,
          });
          
          // Redirect to the cluster details page
          if (response.cluster_id) {
            navigate(`/clusters/${response.cluster_id}`);
          }
        },
        onError: (error) => {
          console.error("Error creating cluster:", error);
          toast({
            title: "Failed to create cluster",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    } catch (err) {
      console.error("Exception during cluster creation:", err);
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
                <h1 className="text-3xl font-bold text-white">Create New Cluster</h1>
                <p className="text-gray-400">Create a GKE cluster with GPU support for vLLM deployments</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => navigate("/clusters")}
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                View All Clusters
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-6xl mx-auto">
        {/* Show terminal logs if a cluster is being created */}
        {showLogs && clusterId && (
          <Card className="mb-8 bg-gray-800/50 backdrop-blur-sm border-gray-700/50 shadow-xl">
            <CardHeader className="border-b border-gray-700/50">
              <CardTitle className="flex items-center text-white">
                <Terminal className="mr-2 h-5 w-5" />
                Cluster Creation Logs
              </CardTitle>
              <CardDescription className="text-gray-400">
                Real-time logs from the cluster creation process
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <LogDisplay clusterId={clusterId} />
            </CardContent>
            <CardFooter className="border-t border-gray-700/50 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/clusters")}
                className="mr-2 bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                View All Clusters
              </Button>
              <Button 
                onClick={() => setShowLogs(false)} 
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-gray-700/50"
              >
                Hide Logs
              </Button>
            </CardFooter>
          </Card>
        )}

        {isCheckingAuth ? (
          <div className="flex items-center justify-center py-8 text-white">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            <span>Checking gcloud authentication...</span>
          </div>
        ) : !isAuthenticated ? (
          <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-700/50 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Issue</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                {!authData
                  ? "Could not connect to the backend server. Make sure the server is running."
                  : "You need to authenticate with gcloud before creating a cluster."}
              </p>
              <div className="mt-2">
                <p>Try these steps:</p>
                <ol className="list-decimal list-inside ml-2">
                  <li>
                    Run{" "}
                    <code className="bg-gray-700/50 p-1 rounded text-gray-200">
                      gcloud auth login
                    </code>{" "}
                    in your terminal
                  </li>
                  <li>Restart the backend server</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {mutationError && (
              <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-700/50 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {mutationError instanceof Error
                    ? mutationError.message
                    : "Failed to create cluster"}
                </AlertDescription>
              </Alert>
            )}

            {projectError && (
              <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-700/50 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>GCP Error</AlertTitle>
                <AlertDescription>
                  {projectError instanceof Error
                    ? projectError.message
                    : "Error checking project"}
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex gap-4 flex-col"
              >
                {/* Project Information Section */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-700/50">
                    <h3 className="text-lg font-semibold text-white">Project Information</h3>
                    <p className="text-sm text-gray-400">Basic information about your GCP project</p>
                  </div>
                  <div className="p-6 space-y-4">
                    <FormField
                      control={form.control}
                      name="project_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Project ID</FormLabel>
                          <FormControl>
                            <div className="flex gap-2 items-center">
                              <div className="space-y-2 w-full">
                                {/* Use the dropdown for existing projects */}
                                {!useCustomProject && (
                                  <div className="flex flex-col space-y-2 w-full">
                                    <Select
                                      onValueChange={(value) => {
                                        if (value === "custom") {
                                          setUseCustomProject(true);
                                        } else {
                                          field.onChange(value);
                                        }
                                      }}
                                      defaultValue={field.value}
                                      value={field.value || ""}
                                    >
                                      <SelectTrigger
                                        className={`w-full bg-gray-900/80 border-gray-700 text-gray-300 ${
                                          projectExists === false
                                            ? "border-red-500"
                                            : ""
                                        }`}
                                      >
                                        <SelectValue placeholder="Select a GCP project" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-gray-900 border-gray-700 text-gray-300">
                                        {isLoadingProjects ? (
                                          <div className="flex items-center justify-center p-2">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            <span>Loading projects...</span>
                                          </div>
                                        ) : (
                                          <>
                                            {projectOptions &&
                                              projectOptions.length > 0 &&
                                              projectOptions.map((projectId) => (
                                                <SelectItem
                                                  key={projectId}
                                                  value={projectId}
                                                >
                                                  {projectId}
                                                </SelectItem>
                                              ))}
                                            <SelectItem
                                              value="custom"
                                              className="border-t border-gray-700 mt-2 pt-2"
                                            >
                                              <span className="font-medium">
                                                Use a custom project ID
                                              </span>
                                            </SelectItem>
                                          </>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {/* Show text input for custom project */}
                                {useCustomProject && (
                                  <div className="space-y-2">
                                    <div className="flex">
                                      <Input
                                        placeholder="Enter your GCP project ID"
                                        value={customProjectId}
                                        onChange={(e) =>
                                          setCustomProjectId(e.target.value)
                                        }
                                        className={`flex-grow bg-gray-900/80 border-gray-700 text-gray-300 ${
                                          projectExists === false
                                            ? "border-red-500"
                                            : ""
                                        }`}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="ml-2 bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
                                        onClick={() => {
                                          setUseCustomProject(false);
                                          setCustomProjectId("");
                                          field.onChange("");
                                        }}
                                      >
                                        <AlertCircle className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      Enter your GCP project ID (e.g.,
                                      my-project-123)
                                    </p>
                                  </div>
                                )}
                              </div>
                              {isCheckingProject && (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                              )}
                              {projectExists === true && (
                                <span className="text-green-400 text-sm">
                                  ✓ Project exists
                                </span>
                              )}
                              {projectExists === false && (
                                <span className="text-red-400 text-sm">
                                  Project not found
                                </span>
                              )}
                            </div>
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            Your Google Cloud Platform project ID
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Zone</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="us-central1-a" 
                              {...field} 
                              className="bg-gray-900/80 border-gray-700 text-gray-300"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            GCP zone where the cluster will be created (e.g.,
                            us-central1-a)
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cluster_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Cluster Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="bg-gray-900/80 border-gray-700 text-gray-300"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            A unique name for your GKE cluster
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Networking Section (Optional) */}
                <CollapsibleCard 
                  title="Networking (Optional)" 
                  description="VPC network settings for your cluster"
                  className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg overflow-hidden"
                  defaultOpen={false}
                >
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="network"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">VPC Network</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="default"
                              {...field}
                              value={field.value || ""}
                              className="bg-gray-900/80 border-gray-700 text-gray-300"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            Optional: The VPC network for your cluster
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subnetwork"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Subnetwork</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="default"
                              {...field}
                              value={field.value || ""}
                              className="bg-gray-900/80 border-gray-700 text-gray-300"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            Optional: The subnetwork for your cluster
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleCard>

                {/* CPU Node Configuration */}
                <CollapsibleCard 
                  title="CPU Node Configuration" 
                  description="Settings for the CPU nodes in your cluster"
                  className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg overflow-hidden"
                  defaultOpen={false}
                >
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="machine_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Machine Type</FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <SelectTrigger className="w-full bg-gray-900/80 border-gray-700 text-gray-300">
                                <SelectValue placeholder="Select machine type" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-gray-700 text-gray-300">
                                {MACHINE_TYPE_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            Machine type for the CPU nodes
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="num_nodes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Number of Nodes</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                              className="bg-gray-900/80 border-gray-700 text-gray-300"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            Number of CPU nodes in the cluster (1-10)
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleCard>

                {/* GPU Node Configuration */}
                <CollapsibleCard 
                  title="GPU Node Configuration" 
                  description="Settings for the GPU nodes in your cluster"
                  className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg overflow-hidden"
                  defaultOpen={false}
                >
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="gpu_pool_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">GPU Pool Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="bg-gray-900/80 border-gray-700 text-gray-300"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            Name for the GPU node pool
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gpu_machine_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">GPU Machine Type</FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <SelectTrigger className="w-full bg-gray-900/80 border-gray-700 text-gray-300">
                                <SelectValue placeholder="Select GPU machine type" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-gray-700 text-gray-300">
                                {GPU_MACHINE_TYPE_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription className="text-gray-500">
                            Machine type for the GPU nodes
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gpu_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">GPU Type</FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <SelectTrigger className="w-full bg-gray-900/80 border-gray-700 text-gray-300">
                                <SelectValue placeholder="Select GPU type" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-gray-700 text-gray-300">
                                {GPU_TYPE_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription className="text-gray-500">Type of GPU to use</FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="gpu_nodes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">GPU Nodes</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                                className="bg-gray-900/80 border-gray-700 text-gray-300"
                              />
                            </FormControl>
                            <FormDescription className="text-gray-500">
                              Number of GPU nodes (1-10)
                            </FormDescription>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="gpus_per_node"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">GPUs per Node</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="8"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                                className="bg-gray-900/80 border-gray-700 text-gray-300"
                              />
                            </FormControl>
                            <FormDescription className="text-gray-500">
                              Number of GPUs per node (1-8)
                            </FormDescription>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="min_gpu_nodes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Min GPU Nodes</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max={form.getValues("max_gpu_nodes")}
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                                className="bg-gray-900/80 border-gray-700 text-gray-300"
                              />
                            </FormControl>
                            <FormDescription className="text-gray-500">
                              Minimum GPU nodes for autoscaling
                            </FormDescription>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="max_gpu_nodes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Max GPU Nodes</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={form.getValues("min_gpu_nodes")}
                                max="10"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                                className="bg-gray-900/80 border-gray-700 text-gray-300"
                              />
                            </FormControl>
                            <FormDescription className="text-gray-500">
                              Maximum GPU nodes for autoscaling
                            </FormDescription>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CollapsibleCard>

                {/* Advanced Options */}
                <CollapsibleCard 
                  title="Advanced Options" 
                  description="Additional configuration settings"
                  className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 shadow-lg overflow-hidden"
                  defaultOpen={false}
                >
                  <div>
                    <FormField
                      control={form.control}
                      name="debug"
                      render={({ field }) => (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="debug"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-gray-600 data-[state=checked]:bg-blue-600"
                          />
                          <label
                            htmlFor="debug"
                            className="text-sm font-medium text-gray-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Enable debug output
                          </label>
                        </div>
                      )}
                    />
                  </div>
                </CollapsibleCard>

                {/* Action Buttons */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-lg overflow-hidden">
                  <div className="p-6 flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/clusters")}
                      className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || !projectExists || isCheckingProject}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Cluster
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}