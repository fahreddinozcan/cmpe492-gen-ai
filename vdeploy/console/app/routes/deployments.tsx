import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

interface Deployment {
  name: string;
  namespace: string;
  status: string;
  model: string;
  created_at: string;
  gpu_count: number;
  cpu_count: number;
  service_url: string;
}

export default function Deployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, []);

  async function fetchDeployments() {
    try {
      // Mock data for development
      const mockData = [{
        "name": "gemma-test",
        "namespace": "vllm",
        "status": "Running",
        "model": "google/gemma-1.1-2b-it",
        "created_at": "2025-04-15T21:04:45Z",
        "gpu_count": 1,
        "cpu_count": 2,
        "service_url": "gemma-test.vllm.svc.cluster.local",
      }];

      // Comment out the actual API call for now
      // const response = await fetch("http://localhost:8000/deployments/");
      // if (!response.ok) {
      //   throw new Error("Failed to fetch deployments");
      // }
      // const data = await response.json();
      
      setDeployments(mockData);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      setError("Failed to load deployments");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  if (loading) {
    return <div>Loading deployments...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deployments</h1>
        <Button asChild>
          <Link to="new">New Deployment</Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resources</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Service URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((deployment) => (
              <TableRow
                key={deployment.name}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => window.location.href = `/deployments/${deployment.name}`}
              >
                <TableCell className="font-medium">{deployment.name}</TableCell>
                <TableCell>{deployment.model}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    deployment.status === "Running" 
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  }`}>
                    {deployment.status}
                  </span>
                </TableCell>
                <TableCell>{deployment.gpu_count} GPU, {deployment.cpu_count} CPU</TableCell>
                <TableCell>{formatDate(deployment.created_at)}</TableCell>
                <TableCell className="font-mono text-sm">{deployment.service_url}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
