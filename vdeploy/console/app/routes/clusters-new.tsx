import React from "react";
import { useForm, useWatch } from "react-hook-form";
import { useCreateCluster } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useGCloudProjects } from "../lib/api";

export default function NewCluster() {
  const { mutate: createCluster, isPending } = useCreateCluster();
  const navigate = useNavigate();
  const defaultValues = {
    project_id: "cmpe492-451815",
    zone: "us-central1-a",
    cluster_name: "vllm-cluster",
    machine_type: "e2-standard-4",
    num_nodes: 3,
    gpu_machine_type: "g2-standard-8",
    gpu_type: "nvidia-l4",
    gpu_nodes: 1,
    gpus_per_node: 1,
    min_gpu_nodes: 0,
    max_gpu_nodes: 5,
  };
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({ defaultValues });
  const [error, setError] = React.useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading, error: projectsError } = useGCloudProjects();

  const onSubmit = (data: any) => {
    setError(null);
    createCluster(data, {
      onSuccess: (response) => {
        if (response.success && response.cluster_id) {
          // Build cluster_id as 'project_id:zone:cluster_name'
          const clusterId = `${data.project_id}:${data.zone}:${data.cluster_name}`;
          navigate(`/clusters-progress/${clusterId}`);
        } else {
          setError(response.message || "Failed to create cluster");
        }
      },
      onError: (err) => setError("Failed to create cluster"),
    });
  };

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Cluster</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="project_id" className="block font-medium mb-1">Project ID</label>
          {projectsLoading ? (
            <Input id="project_id" disabled value="Loading..." />
          ) : projectsError || !projects ? (
            <Input id="project_id" placeholder="Project ID" {...register("project_id", { required: true })} defaultValue={defaultValues.project_id} />
          ) : (
            <Select
              value={String(watch("project_id") || defaultValues.project_id)}
              onValueChange={v => setValue("project_id", v)}
            >
              <SelectTrigger id="project_id" className="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.project_id} value={project.project_id}>
                    {project.name} ({project.project_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <label htmlFor="zone" className="block font-medium mb-1">Zone</label>
          <Input id="zone" placeholder="Zone" {...register("zone", { required: true })} defaultValue={defaultValues.zone} />
        </div>
        <div>
          <label htmlFor="cluster_name" className="block font-medium mb-1">Cluster Name</label>
          <Input id="cluster_name" placeholder="Cluster Name" {...register("cluster_name", { required: true })} defaultValue={defaultValues.cluster_name} />
        </div>
        <div>
          <label htmlFor="machine_type" className="block font-medium mb-1">Machine Type</label>
          <Input id="machine_type" placeholder="Machine Type" {...register("machine_type", { required: true })} defaultValue={defaultValues.machine_type} />
        </div>
        <div>
          <label htmlFor="num_nodes" className="block font-medium mb-1">Num Nodes</label>
          <Input id="num_nodes" placeholder="Num Nodes" type="number" {...register("num_nodes", { required: true, valueAsNumber: true })} defaultValue={defaultValues.num_nodes} />
        </div>
        <div>
          <label htmlFor="gpu_machine_type" className="block font-medium mb-1">GPU Machine Type</label>
          <Input id="gpu_machine_type" placeholder="GPU Machine Type" {...register("gpu_machine_type", { required: true })} defaultValue={defaultValues.gpu_machine_type} />
        </div>
        <div>
          <label htmlFor="gpu_type" className="block font-medium mb-1">GPU Type</label>
          <Input id="gpu_type" placeholder="GPU Type" {...register("gpu_type", { required: true })} defaultValue={defaultValues.gpu_type} />
        </div>
        <div>
          <label htmlFor="gpu_nodes" className="block font-medium mb-1">GPU Nodes</label>
          <Input id="gpu_nodes" placeholder="GPU Nodes" type="number" {...register("gpu_nodes", { valueAsNumber: true })} defaultValue={defaultValues.gpu_nodes} />
        </div>
        <div>
          <label htmlFor="gpus_per_node" className="block font-medium mb-1">GPUs per Node</label>
          <Input id="gpus_per_node" placeholder="GPUs per Node" type="number" {...register("gpus_per_node", { valueAsNumber: true })} defaultValue={defaultValues.gpus_per_node} />
        </div>
        <div>
          <label htmlFor="min_gpu_nodes" className="block font-medium mb-1">Min GPU Nodes</label>
          <Input id="min_gpu_nodes" placeholder="Min GPU Nodes" type="number" {...register("min_gpu_nodes", { valueAsNumber: true })} defaultValue={defaultValues.min_gpu_nodes} />
        </div>
        <div>
          <label htmlFor="max_gpu_nodes" className="block font-medium mb-1">Max GPU Nodes</label>
          <Input id="max_gpu_nodes" placeholder="Max GPU Nodes" type="number" {...register("max_gpu_nodes", { valueAsNumber: true })} defaultValue={defaultValues.max_gpu_nodes} />
        </div>
        <Button type="submit" disabled={isPending} className="w-full">Create</Button>
        {error && <div className="text-red-500 text-sm">{error}</div>}
      </form>
    </div>
  );
}
