import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { useState } from "react";

interface DeploymentFormData {
  model_path: string;
  release_name: string;
  namespace: string;
  hf_token: string;
  gpu_type: string;
  cpu_count: number;
  memory: string;
  gpu_count: number;
  environment: string;
  image_repo: string;
  image_tag: string;
  dtype: string;
  tensor_parallel_size: number;
  enable_chunked_prefill: boolean;
}

export default function NewDeployment() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<DeploymentFormData>({
    defaultValues: {
      model_path: "google/gemma-1.1-2b-it",
      release_name: "gemma-test",
      namespace: "vllm",
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
    },
  });

  async function onSubmit(data: DeploymentFormData) {
    try {
      setIsSubmitting(true);
      
      const response = await fetch("http://localhost:8000/deployments/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create deployment");
      }

      window.location.href = "/deployments";
    } catch (error) {
      console.error("Error creating deployment:", error);
      // Handle error (show error message to user)
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Deployment</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="model_path"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model Path</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
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

          <FormField
            control={form.control}
            name="namespace"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Namespace</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cpu_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPU Count</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gpu_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GPU Count</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="image_repo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image Repository</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dtype"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Type</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
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
                  <Input {...field} />
                </FormControl>
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
                  <FormLabel className="text-base">Enable Chunked Prefill</FormLabel>
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
