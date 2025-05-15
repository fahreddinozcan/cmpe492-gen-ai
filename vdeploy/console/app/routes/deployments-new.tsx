import * as React from "react";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import { useNavigate, useSearchParams } from "react-router";
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
import { Switch } from "../components/ui/switch";
import { useCreateDeployment, type DeploymentFormData } from "../lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { 
  AlertCircle, 
  ChevronDown, 
  Plus,
  Server,
  ArrowLeft,
  Settings
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import { useClusters } from "../lib/cluster-api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";

const GPU_TYPE_OPTIONS = [
  { value: "nvidia-l4", label: "NVIDIA L4" },
  { value: "nvidia-t4", label: "NVIDIA T4" },
  { value: "nvidia-a100", label: "NVIDIA A100" },
  { value: "nvidia-v100", label: "NVIDIA V100" },
];

const MEMORY_OPTIONS = [
  { value: "4Gi", label: "4 GB" },
  { value: "8Gi", label: "8 GB" },
  { value: "16Gi", label: "16 GB" },
  { value: "32Gi", label: "32 GB" },
];

const DTYPE_OPTIONS = [
  { value: "bfloat16", label: "BFloat16" },
  { value: "float16", label: "Float16" },
  { value: "float32", label: "Float32" },
];

const ENVIRONMENT_OPTIONS = [
  { value: "dev", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "prod", label: "Production" },
];

export default function NewDeployment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modelFromUrl = searchParams.get("model");

  const { mutate: createDeployment, isPending: isSubmitting } =
    useCreateDeployment();
  const [error, setError] = React.useState<string | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);

  // Fetch available clusters
  const {
    data: clusters,
    isLoading: isClustersLoading,
    error: clustersError,
  } = useClusters();

  const form = useForm<DeploymentFormData>({
    defaultValues: {
      model_path: modelFromUrl || "google/gemma-1.1-2b-it",
      release_name: "gemma-test",
      // namespace removed (using release_name as namespace)
      gpu_type: "nvidia-l4",
      cpu_count: 2,
      memory: "8Gi",
      gpu_count: 1,
      environment: "dev",
      image_repo: "vllm/vllm-openai",
      image_tag: "latest",
      dtype: "bfloat16",
      tensor_parallel_size: 1,
      enable_chunked_prefill: false,
      cluster_id: "no-clusters", // Use a non-empty placeholder value
    },
  });

  // Generate a unique release name based on the model to avoid conflicts
  React.useEffect(() => {
    const modelPath = form.watch("model_path");
    if (modelPath) {
      // Extract model name from path and add a timestamp suffix
      const modelName = modelPath.split("/").pop()?.split("-")[0] || "model";
      const timestamp = new Date().getTime().toString().slice(-6); // Last 6 digits of timestamp
      form.setValue("release_name", `${modelName}-${timestamp}`);
    }
  }, [form.watch("model_path")]);

  function onSubmit(data: DeploymentFormData) {
    // Clear any previous errors
    setError(null);

    // Validate form data
    if (!data.release_name) {
      setError("Release name is required");
      return;
    }

    // Check if a valid cluster is selected (not the placeholder)
    if (!data.cluster_id || data.cluster_id === "no-clusters") {
      setError("Please select a cluster for deployment");
      return;
    }

    // Ensure release name is valid (lowercase, no spaces, etc.)
    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(data.release_name)) {
      setError(
        "Release name must consist of lowercase alphanumeric characters or '-', and must start and end with an alphanumeric character"
      );
      return;
    }

    try {
      createDeployment(data, {
        onSuccess: (response) => {
          // Redirect to the deployment progress page with the deployment ID
          const deploymentId = response.deployment_id || response.id;
          if (deploymentId) {
            navigate(`/deployment-progress/${deploymentId}`);
          } else {
            console.error("No deployment ID returned from API");
            setError("Failed to get deployment ID from server response");
          }
        },
        onError: (error) => {
          console.error("Error creating deployment:", error);
          setError(
            `Failed to create deployment: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        },
      });
    } catch (err) {
      console.error("Exception during deployment creation:", err);
      setError(
        `An unexpected error occurred: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  }

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
                <h1 className="text-3xl font-bold text-white">New Deployment</h1>
                <p className="text-gray-400">Deploy a new model to your cluster</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => navigate("/deployments")}
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Deployments
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl p-6 mb-6">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Main Form Section */}
              <div className="grid grid-cols-1 gap-6">
                {/* Cluster Selection Dropdown */}
                <FormField
                  control={form.control}
                  name="cluster_id"
                  render={({ field }) => (
                    <FormItem className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                      <FormLabel className="text-white">Target Cluster</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isClustersLoading}
                        >
                          <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                            <SelectValue placeholder="Select a cluster for deployment" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            {clusters && clusters.length > 0 ? (
                              clusters.map((cluster) => (
                                <SelectItem
                                  key={cluster.cluster_id}
                                  value={cluster.cluster_id}
                                  className="text-white hover:bg-gray-700"
                                >
                                  {cluster.cluster_name} ({cluster.zone})
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-clusters" disabled className="text-gray-400">
                                {isClustersLoading
                                  ? "Loading clusters..."
                                  : "No clusters available"}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription className="text-gray-400">
                        Select the Kubernetes cluster where this model will be deployed
                      </FormDescription>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model_path"
                  render={({ field }) => (
                    <FormItem className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                      <FormLabel className="text-white">Model</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter HuggingFace model path"
                            className="bg-gray-800 border-gray-700 text-white"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate("/models")}
                          className="border-gray-600 text-white hover:bg-gray-700"
                        >
                          Browse
                        </Button>
                      </div>
                      <FormDescription className="text-gray-400">
                        Enter a valid HuggingFace model path (e.g., google/gemma-1.1-2b-it)
                      </FormDescription>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="release_name"
                  render={({ field }) => (
                    <FormItem className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                      <FormLabel className="text-white">Deployment Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </FormControl>
                      <FormDescription className="text-gray-400">
                        A unique name for this deployment
                      </FormDescription>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hf_token"
                  render={({ field }) => (
                    <FormItem className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                      <FormLabel className="text-white">Hugging Face Token</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          {...field} 
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </FormControl>
                      <FormDescription className="text-gray-400">
                        Required for accessing private models
                      </FormDescription>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {/* Advanced Settings */}
                <div className="bg-gray-900/50 rounded-lg border border-gray-700/50">
                  <Collapsible 
                    open={isAdvancedOpen} 
                    onOpenChange={setIsAdvancedOpen} 
                    className="w-full"
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-4 font-medium text-white hover:bg-gray-800/50 rounded-t-lg">
                      <div className="flex items-center space-x-2">
                        <Settings className="h-5 w-5 text-blue-400" />
                        <span>Advanced Settings</span>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="p-4 pt-2 space-y-6 border-t border-gray-700/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="cpu_count"
                          render={({ field }) => (
                            <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                              <FormLabel className="text-white">CPU Count</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  className="bg-gray-800 border-gray-700 text-white"
                                />
                              </FormControl>
                              <FormDescription className="text-gray-400">
                                Number of CPU cores to allocate
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memory"
                          render={({ field }) => (
                            <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                              <FormLabel className="text-white">Memory</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                                    <SelectValue placeholder="Select memory size" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                    {MEMORY_OPTIONS.map((option) => (
                                      <SelectItem 
                                        key={option.value} 
                                        value={option.value}
                                        className="text-white hover:bg-gray-700"
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormDescription className="text-gray-400">
                                Memory allocation for the deployment
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="gpu_count"
                          render={({ field }) => (
                            <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                              <FormLabel className="text-white">GPU Count</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  className="bg-gray-800 border-gray-700 text-white"
                                />
                              </FormControl>
                              <FormDescription className="text-gray-400">
                                Number of GPUs to allocate
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="gpu_type"
                          render={({ field }) => (
                            <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                              <FormLabel className="text-white">GPU Type</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                                    <SelectValue placeholder="Select GPU type" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                    {GPU_TYPE_OPTIONS.map((option) => (
                                      <SelectItem 
                                        key={option.value} 
                                        value={option.value}
                                        className="text-white hover:bg-gray-700"
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormDescription className="text-gray-400">
                                The type of GPU to use for inference
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="image_repo"
                          render={({ field }) => (
                            <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                              <FormLabel className="text-white">Image Repository</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-gray-800 border-gray-700 text-white"
                                />
                              </FormControl>
                              <FormDescription className="text-gray-400">
                                Container image repository (e.g., vllm/vllm-openai)
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="image_tag"
                          render={({ field }) => (
                            <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                              <FormLabel className="text-white">Image Tag</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="bg-gray-800 border-gray-700 text-white"
                                />
                              </FormControl>
                              <FormDescription className="text-gray-400">
                                Container image tag (e.g., latest)
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="dtype"
                          render={({ field }) => (
                            <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                              <FormLabel className="text-white">Data Type</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                                    <SelectValue placeholder="Select data type" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                    {DTYPE_OPTIONS.map((option) => (
                                      <SelectItem 
                                        key={option.value} 
                                        value={option.value}
                                        className="text-white hover:bg-gray-700"
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormDescription className="text-gray-400">
                                Precision format for model weights
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="tensor_parallel_size"
                          render={({ field }) => (
                            <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                              <FormLabel className="text-white">Tensor Parallel Size</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  className="bg-gray-800 border-gray-700 text-white"
                                />
                              </FormControl>
                              <FormDescription className="text-gray-400">
                                Number of GPUs to split tensors across
                              </FormDescription>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="environment"
                        render={({ field }) => (
                          <FormItem className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                            <FormLabel className="text-white">Environment</FormLabel>
                            <FormControl>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                                  <SelectValue placeholder="Select environment" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                  {ENVIRONMENT_OPTIONS.map((option) => (
                                    <SelectItem 
                                      key={option.value} 
                                      value={option.value}
                                      className="text-white hover:bg-gray-700"
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormDescription className="text-gray-400">
                              Deployment environment for the model
                            </FormDescription>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="enable_chunked_prefill"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-white text-base">
                                Enable Chunked Prefill
                              </FormLabel>
                              <FormDescription className="text-gray-400">
                                Optimizes memory usage for large context windows
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-700/50">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Creating..." : "Create Deployment"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
