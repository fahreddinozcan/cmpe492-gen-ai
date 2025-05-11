import * as React from "react";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router";
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
import { AlertCircle, InfoIcon } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import { useClusters } from "../lib/cluster-api";

// Predefined options for select components
const MODEL_OPTIONS = [
  { value: "google/gemma-1.1-2b-it", label: "Google Gemma 1.1 2B (Instruct)" },
  { value: "google/gemma-1.1-7b-it", label: "Google Gemma 1.1 7B (Instruct)" },
  { value: "meta-llama/Llama-2-7b-chat-hf", label: "Meta Llama 2 7B (Chat)" },
  { value: "meta-llama/Llama-2-13b-chat-hf", label: "Meta Llama 2 13B (Chat)" },
  {
    value: "mistralai/Mistral-7B-Instruct-v0.2",
    label: "Mistral 7B Instruct v0.2",
  },
  { value: "microsoft/phi-2", label: "Microsoft Phi-2" },
];

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
  const { mutate: createDeployment, isPending: isSubmitting } =
    useCreateDeployment();
  const [error, setError] = React.useState<string | null>(null);
  
  // Fetch available clusters
  const { data: clusters, isLoading: isClustersLoading, error: clustersError } = useClusters();

  const form = useForm<DeploymentFormData>({
    defaultValues: {
      model_path: "google/gemma-1.1-2b-it",
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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Deployment</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Cluster Selection Dropdown */}
          <FormField
            control={form.control}
            name="cluster_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Cluster</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isClustersLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a cluster for deployment" />
                    </SelectTrigger>
                    <SelectContent>
                      {clusters && clusters.length > 0 ? (
                        clusters.map((cluster) => (
                          <SelectItem key={cluster.cluster_id} value={cluster.cluster_id}>
                            {cluster.cluster_name} ({cluster.zone})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-clusters" disabled>
                          {isClustersLoading ? "Loading clusters..." : "No clusters available"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Select the Kubernetes cluster where this model will be deployed
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model_path"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  The LLM model to deploy from Hugging Face
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="release_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Release Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Namespace field removed - using release name as namespace */}

          <FormField
            control={form.control}
            name="hf_token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hugging Face Token</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="cpu_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPU Count</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="memory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Memory</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select memory size" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Memory allocation for the deployment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="gpu_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GPU Count</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
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
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    The type of GPU to use for inference
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="image_repo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image Repository</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Container image repository (e.g., vlim/vlim-openai)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image_tag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image Tag</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Container image tag (e.g., latest)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="dtype"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Type</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select data type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DTYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Precision format for model weights
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tensor_parallel_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tensor Parallel Size</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="environment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Environment</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENVIRONMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Deployment environment for the model
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enable_chunked_prefill"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Enable Chunked Prefill
                  </FormLabel>
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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Deployment"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
