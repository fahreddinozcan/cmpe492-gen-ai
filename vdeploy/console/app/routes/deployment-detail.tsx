import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  useDeployment,
  useDeleteDeployment,
  useRefreshDeploymentStatus,
  useVLLMPodLogs,
} from "~/lib/api";
import React from "react";

// Simple icons
function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.6 2.4L12 0.8V4H8.8V5.6H14.4V0H13.6V2.4ZM12 8.8C12 10.88 10.32 12.56 8.24 12.56C6.16 12.56 4.48 10.88 4.48 8.8C4.48 6.72 6.16 5.04 8.24 5.04V8L11.44 4.8L8.24 1.6V4.48C5.84 4.48 3.92 6.4 3.92 8.8C3.92 11.2 5.84 13.12 8.24 13.12C10.64 13.12 12.56 11.2 12.56 8.8H12Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 12.8C4 13.68 4.72 14.4 5.6 14.4H10.4C11.28 14.4 12 13.68 12 12.8V4H4V12.8ZM12.8 2.4H10.4L9.6 1.6H6.4L5.6 2.4H3.2V4H12.8V2.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function DeploymentDetail() {
  const { id } = useParams<{ id: string }>();
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const [logMessages, setLogMessages] = React.useState<string[]>([]);
  const [isStreamingLogs, setIsStreamingLogs] = React.useState<boolean>(false);

  // Fixed data fetching hooks by removing useMemo
  const { data: deployment, isLoading, error, refetch } = useDeployment(id);

  // Use vLLM pod logs instead of router logs, but don't fetch automatically
  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useVLLMPodLogs(id);

  const { mutate: refreshDeployment, isPending: isRefreshing } =
    useRefreshDeploymentStatus();

  const { mutate: deleteDeployment, isPending: isDeleting } =
    useDeleteDeployment();

  // Setup WebSocket for real-time logs
  React.useEffect(() => {
    if (!id || !isStreamingLogs) return;

    // Create WebSocket connection for log streaming with vLLM pod type
    const ws = new WebSocket(`ws://localhost:8000/ws/logs/${id}?pod_type=vllm`);

    // Connection opened
    ws.addEventListener("open", (event) => {
      console.log("WebSocket connection opened");
    });

    // Listen for messages
    ws.addEventListener("message", (event) => {
      try {
        const logEntry = JSON.parse(event.data);
        setLogMessages((prev) => [...prev, logEntry.log]);

        // Auto-scroll to bottom when new logs arrive
        if (logsEndRef.current) {
          logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      } catch (err) {
        console.error("Error parsing log message:", err);
      }
    });

    // Connection closed
    ws.addEventListener("close", (event) => {
      console.log("WebSocket connection closed");
      setIsStreamingLogs(false);
    });

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [id, isStreamingLogs]); // Added isStreamingLogs to dependencies

  // Handle refresh deployment status
  const handleRefreshStatus = () => {
    if (!id) return;
    refreshDeployment(id);
  };

  // Handle delete deployment
  const handleDeleteDeployment = () => {
    if (
      !id ||
      !window.confirm("Are you sure you want to delete this deployment?")
    )
      return;
    deleteDeployment(id);
    window.location.href = "/deployments";
  };

  // Redirect if no ID
  if (!id) {
    window.location.href = "/deployments";
    return <div>Redirecting...</div>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-white">Loading deployment details...</p>
        </div>
      </div>
    );
  }

  // Show error state with retry button
  if (error) {
    return (
      <div className="py-8 max-w-3xl mx-auto text-center bg-gray-900 text-white min-h-screen">
        <div className="text-red-500 mb-4">
          {(error as Error).message || "Failed to load deployment details"}
        </div>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => refetch()}>
            Try Again
          </Button>
          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/deployments")}
          >
            Back to Deployments
          </Button>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!deployment) {
    return (
      <div className="py-8 max-w-3xl mx-auto text-center bg-gray-900 text-white min-h-screen">
        <h2 className="text-xl font-bold mb-4">Deployment Not Found</h2>
        <p className="text-gray-400 mb-6">
          The deployment you're looking for could not be found.
        </p>
        <Button onClick={() => (window.location.href = "/deployments")}>
          Back to Deployments
        </Button>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // Main content with deployment details
  return (
    <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{deployment.name}</h1>
          <p className="text-gray-400">
            Namespace: {deployment.namespace} | Created:{" "}
            {formatDate(deployment.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
          >
            <RefreshIcon />
            {isRefreshing ? "Refreshing..." : "Refresh Status"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteDeployment}
            disabled={isDeleting}
          >
            <DeleteIcon />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">
              Deployment Status
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    deployment.status === "deployed"
                      ? "bg-green-500"
                      : "bg-yellow-500"
                  }`}
                ></div>
                <span className="font-medium text-white">
                  {deployment.status}
                </span>
              </div>
              <dl className="space-y-2">
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-gray-500">ID:</dt>
                  <dd className="col-span-2 font-mono text-sm text-gray-300">
                    {deployment.deployment_id}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-gray-500">Model:</dt>
                  <dd className="col-span-2 text-gray-300">
                    {deployment.model}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-gray-500">Health:</dt>
                  <dd className="col-span-2 text-gray-300">
                    {deployment.health_status || "Unknown"}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-gray-500">Ready:</dt>
                  <dd className="col-span-2 text-gray-300">
                    {deployment.ready ? "Yes" : "No"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">
              Deployment Configuration
            </h2>
            <dl className="space-y-2">
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-gray-500">Name:</dt>
                <dd className="col-span-2 text-gray-300">{deployment.name}</dd>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <dt className="text-gray-500">Namespace:</dt>
                <dd className="col-span-2 text-gray-300">
                  {deployment.namespace}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Code Snippet Section */}
        <div className="space-y-2 mb-6">
          <h2 className="text-lg font-semibold text-white">
            API Usage Examples
          </h2>
          <div className="bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-md font-medium mb-3 text-white">
              Completions API
            </h3>
            <div className="bg-gray-900 p-3 rounded-md text-sm font-mono overflow-x-auto">
              <pre className="text-green-400 whitespace-pre-wrap break-all">
                {`curl -X POST \\
${
  deployment?.external_ip
    ? `http://${deployment.external_ip}`
    : deployment?.public_url || "http://[DEPLOYMENT-IP]"
}/v1/completions \\
-H "Content-Type: application/json" \\
-d '{  
  "model": "${deployment?.model || "deployed-model"}",
  "prompt": "Write a poem about AI",
  "max_tokens": 100,
  "temperature": 0.7
}'`}
              </pre>
              <button
                className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded"
                onClick={() => {
                  const curlCommand = `curl -X POST \\
${
  deployment?.external_ip
    ? `http://${deployment.external_ip}`
    : deployment?.public_url || "http://[DEPLOYMENT-IP]"
}/v1/completions \\
-H "Content-Type: application/json" \\
-d '{  
  "model": "${deployment?.model || "deployed-model"}",
  "prompt": "Write a poem about AI",
  "max_tokens": 100,
  "temperature": 0.7
}'`;
                  navigator.clipboard.writeText(curlCommand);
                  alert("Curl command copied to clipboard!");
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>

        {/* vLLM Pod Logs Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-white">vLLM Pod Logs</h2>
            <div className="flex space-x-2">
              <button
                className="px-3 py-1 rounded text-sm bg-gray-600 hover:bg-gray-700 text-white"
                onClick={() => {
                  refetchLogs();
                }}
              >
                Refresh Logs
              </button>
              <button
                className={`px-3 py-1 rounded text-sm ${
                  isStreamingLogs
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                onClick={() => {
                  if (!isStreamingLogs) {
                    // Start streaming logs
                    setLogMessages([]);
                    setIsStreamingLogs(true);
                    // Also fetch logs once to populate initial data
                    refetchLogs();
                  } else {
                    // Stop streaming logs
                    setIsStreamingLogs(false);
                  }
                }}
              >
                {isStreamingLogs ? "Stop Streaming" : "Start Streaming Logs"}
              </button>
            </div>
          </div>
          <div className="rounded-md border border-gray-700 bg-black text-white p-4 h-96 overflow-y-auto font-mono text-sm">
            {logMessages.length === 0 ? (
              <div className="text-gray-400">
                {isStreamingLogs
                  ? "Waiting for logs..."
                  : 'Click "Start Streaming Logs" to view vLLM pod logs'}
              </div>
            ) : (
              logMessages.map((entry, index) => (
                <div key={index} className="whitespace-pre-wrap mb-1">
                  {typeof entry === "string" ? entry : JSON.stringify(entry)}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
