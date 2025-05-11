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
import { AlertCircle, Loader2, RefreshCw, Terminal } from "lucide-react";
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
  { value: "n1-standard-8", label: "n1-standard-8 (8 vCPU, 30GB memory)" },
  { value: "n1-standard-16", label: "n1-standard-16 (16 vCPU, 60GB memory)" },
  { value: "n1-standard-32", label: "n1-standard-32 (32 vCPU, 120GB memory)" },
];

// This interface is now imported from cluster-api.ts
// import { ClusterFormData } from '../lib/cluster-api';

interface LogDisplayProps {
  clusterId: string | undefined;
}

// Log Display Component for terminal output
function LogDisplay({ clusterId }: LogDisplayProps) {
  const { logs, isConnected, error, reconnect } = useClusterLogs(clusterId);

  // Auto-scroll to bottom when new logs arrive
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!clusterId) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No cluster logs available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {!isConnected && (
        <div className="absolute top-0 right-0 m-2">
          <Button variant="outline" size="sm" onClick={reconnect}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconnect
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        ref={logContainerRef}
        className="bg-black text-green-400 p-4 rounded-md font-mono text-sm overflow-auto"
        style={{ height: "400px" }}
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">
              {isConnected
                ? "Waiting for logs..."
                : "Not connected to log stream"}
            </p>
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="pb-1">
              {log.timestamp && (
                <span className="text-gray-500 mr-2">[{log.timestamp}]</span>
              )}
              {log.level && (
                <span
                  className={`mr-2 ${
                    log.level.toLowerCase().includes("error")
                      ? "text-red-400"
                      : ""
                  }`}
                >
                  {log.level}
                </span>
              )}
              <span>{log.message}</span>
            </div>
          ))
        )}
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
      gpu_machine_type: "n1-standard-8",
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

  function onSubmit(data: ClusterFormData) {
    // Call the React Query mutation
    createCluster(data, {
      onSuccess: (response) => {
        toast({
          title: "Cluster creation started",
          description: `Creating cluster ${data.cluster_name} in ${data.zone}`,
        });

        // Store the cluster ID for logs display
        if (response.cluster_id) {
          setClusterId(response.cluster_id);
          setShowLogs(true);
        } else {
          // If no cluster ID received, redirect to clusters page
          navigate("/clusters");
        }
      },
      onError: (error) => {
        toast({
          title: "Failed to create cluster",
          description:
            error instanceof Error ? error.message : "An error occurred",
          variant: "destructive",
        });
      },
    });
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Cluster</h1>
        <p className="text-gray-500 mt-1">
          Create a GKE cluster with GPU support for vLLM deployments
        </p>
      </div>

      {/* Show terminal logs if a cluster is being created */}
      {showLogs && clusterId && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Terminal className="mr-2 h-5 w-5" />
              Cluster Creation Logs
            </CardTitle>
            <CardDescription>
              Real-time logs from the cluster creation process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogDisplay clusterId={clusterId} />
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => navigate("/clusters")}
              className="mr-2"
            >
              View All Clusters
            </Button>
            <Button onClick={() => setShowLogs(false)} variant="ghost">
              Hide Logs
            </Button>
          </CardFooter>
        </Card>
      )}

      {isCheckingAuth ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Checking gcloud authentication...</span>
        </div>
      ) : !isAuthenticated ? (
        <Alert variant="destructive" className="mb-6">
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
                  <code className="bg-gray-100 p-1 rounded">
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
            <Alert variant="destructive" className="mb-6">
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
            <Alert variant="destructive" className="mb-6">
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
              <CollapsibleCard
                title="Project Information"
                description="Basic information about your GCP project"
                defaultOpen={true}
                className="mb-0"
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="project_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project ID</FormLabel>
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
                                      className={`w-full ${
                                        projectExists === false
                                          ? "border-red-500"
                                          : ""
                                      }`}
                                    >
                                      <SelectValue placeholder="Select a GCP project" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                                            className="border-t mt-2 pt-2"
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
                                      className={`flex-grow ${
                                        projectExists === false
                                          ? "border-red-500"
                                          : ""
                                      }`}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="ml-2"
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
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {projectExists === true && (
                              <span className="text-green-500 text-sm">
                                ✓ Project exists
                              </span>
                            )}
                            {projectExists === false && (
                              <span className="text-red-500 text-sm">
                                Project not found
                              </span>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Your Google Cloud Platform project ID
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zone</FormLabel>
                        <FormControl>
                          <Input placeholder="us-central1-a" {...field} />
                        </FormControl>
                        <FormDescription>
                          GCP zone where the cluster will be created (e.g.,
                          us-central1-a)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cluster_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cluster Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          A unique name for your GKE cluster
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleCard>

              {/* Networking Section (Optional) */}
              <CollapsibleCard
                title="Networking (Optional)"
                description="VPC network settings for your cluster"
                defaultOpen={false}
                className="mb-0"
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="network"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VPC Network</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="default"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: The VPC network for your cluster
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subnetwork"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subnetwork</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="default"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional: The subnetwork for your cluster
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleCard>

              {/* CPU Node Configuration */}
              <CollapsibleCard
                title="CPU Node Configuration"
                description="Settings for the CPU nodes in your cluster"
                defaultOpen={false}
                className="mb-0"
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="machine_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Machine Type</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select machine type" />
                            </SelectTrigger>
                            <SelectContent>
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
                        <FormDescription>
                          Machine type for the CPU nodes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="num_nodes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Nodes</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Number of CPU nodes in the cluster (1-10)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleCard>

              {/* GPU Node Configuration */}
              <CollapsibleCard
                title="GPU Node Configuration"
                description="Settings for the GPU nodes in your cluster"
                defaultOpen={false}
                className="mb-0"
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="gpu_pool_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GPU Pool Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          Name for the GPU node pool
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gpu_machine_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GPU Machine Type</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select GPU machine type" />
                            </SelectTrigger>
                            <SelectContent>
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
                        <FormDescription>
                          Machine type for the GPU nodes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gpu_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GPU Type</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select GPU type" />
                            </SelectTrigger>
                            <SelectContent>
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
                        <FormDescription>Type of GPU to use</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gpu_nodes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GPU Nodes</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Number of GPU nodes (1-10)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gpus_per_node"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GPUs per Node</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="8"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Number of GPUs per node (1-8)
                          </FormDescription>
                          <FormMessage />
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
                          <FormLabel>Min GPU Nodes</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max={form.getValues("max_gpu_nodes")}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum GPU nodes for autoscaling
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_gpu_nodes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max GPU Nodes</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={form.getValues("min_gpu_nodes")}
                              max="10"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum GPU nodes for autoscaling
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CollapsibleCard>

              {/* Advanced Options */}
              <CollapsibleCard
                title="Advanced Options"
                defaultOpen={false}
                className="mb-0"
              >
                <FormField
                  control={form.control}
                  name="debug"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="debug"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <label
                        htmlFor="debug"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Enable debug output
                      </label>
                    </div>
                  )}
                />
              </CollapsibleCard>

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/clusters")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !projectExists || isCheckingProject}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Cluster"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}
