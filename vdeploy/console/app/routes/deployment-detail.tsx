import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  useDeployment,
  useDeleteDeployment,
  useRefreshDeploymentStatus,
  useVLLMPodLogs,
} from "~/lib/api";
import React from "react";
import {
  RefreshCw,
  Trash2,
  Server,
  Clock,
  Copy,
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Settings,
  Activity,
  Terminal,
  Calendar,
  Hash,
} from "lucide-react";

function StatusIcon({ status }: { status: string }) {
  if (status === "deployed" || status === "running") {
    return <CheckCircle2 className="w-5 h-5 text-green-400" />;
  }
  return <AlertCircle className="w-5 h-5 text-yellow-400" />;
}

export default function DeploymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const [logMessages, setLogMessages] = React.useState<string[]>([]);
  const [isStreamingLogs, setIsStreamingLogs] = React.useState<boolean>(false);
  const [isCopied, setIsCopied] = React.useState<boolean>(false);

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
    navigate("/deployments");
  };

  // Redirect if no ID
  if (!id) {
    navigate("/deployments");
    return <div>Redirecting...</div>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
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
          <Button variant="secondary" onClick={() => navigate("/deployments")}>
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
        <Button onClick={() => navigate("/deployments")}>
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

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "deployed":
      case "running":
        return "text-green-400 bg-green-900/20 border-green-500/30";
      case "pending":
      case "provisioning":
        return "text-yellow-400 bg-yellow-900/20 border-yellow-500/30";
      case "failed":
        return "text-red-400 bg-red-900/20 border-red-500/30";
      default:
        return "text-gray-400 bg-gray-900/20 border-gray-500/30";
    }
  };

  // Main content with deployment details
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section with improved design */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {deployment.name}
                </h1>
                <div className="flex items-center space-x-6 text-sm text-gray-400">
                  <span className="flex items-center space-x-2">
                    <Server className="w-4 h-4" />
                    <span>Namespace: {deployment.namespace}</span>
                  </span>
                  <span className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Created: {formatDate(deployment.created_at)}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshStatus}
                disabled={isRefreshing}
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span className="ml-2">
                  {isRefreshing ? "Refreshing..." : "Refresh Status"}
                </span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteDeployment}
                disabled={isDeleting}
                className="bg-red-600/80 hover:bg-red-600 text-white"
              >
                <Trash2 className="w-4 h-4" />
                <span className="ml-2">
                  {isDeleting ? "Deleting..." : "Delete"}
                </span>
              </Button>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center space-x-4 mt-6">
            <div
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${getStatusColor(
                deployment.status
              )}`}
            >
              <StatusIcon status={deployment.status} />
              <span className="font-medium">{deployment.status}</span>
            </div>
            <div className="text-gray-400 text-sm flex items-center space-x-2">
              <Hash className="w-4 h-4" />
              <span>
                ID:{" "}
                <span className="font-mono text-gray-300">
                  {deployment.deployment_id}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold mb-4 text-white flex items-center">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center mr-3">
                <Activity className="w-4 h-4 text-blue-400" />
              </div>
              Deployment Status
            </h2>
            <div className="space-y-4">
              <dl className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-700/30">
                  <dt className="text-gray-400">Model:</dt>
                  <dd className="text-gray-200 font-medium">
                    {deployment.model || "unknown"}
                  </dd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-700/30">
                  <dt className="text-gray-400">Health:</dt>
                  <dd className="text-gray-200 font-medium">
                    {deployment.health_status || "unknown"}
                  </dd>
                </div>
                <div className="flex justify-between items-center py-2">
                  <dt className="text-gray-400">Ready:</dt>
                  <dd
                    className={`font-medium ${
                      deployment.ready ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {deployment.ready ? "Yes" : "No"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold mb-4 text-white flex items-center">
              <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center mr-3">
                <Settings className="w-4 h-4 text-purple-400" />
              </div>
              Configuration
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-700/30">
                <dt className="text-gray-400">Name:</dt>
                <dd className="text-gray-200 font-medium">{deployment.name}</dd>
              </div>
              <div className="flex justify-between items-center py-2">
                <dt className="text-gray-400">Namespace:</dt>
                <dd className="text-gray-200 font-medium">
                  {deployment.namespace}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Chat with this model button */}
        <div className="mb-8">
          <button
            onClick={() =>
              navigate(`/completions?model=${deployment?.model || ""}`)
            }
            className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-medium py-3 px-6 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center space-x-3"
          >
            <Terminal className="w-5 h-5" />
            <span className="text-lg">Chat with this model</span>
          </button>
        </div>

        {/* API Usage Examples */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center mr-3">
                <Terminal className="w-4 h-4 text-green-400" />
              </div>
              API Usage Examples
            </h2>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors duration-200 flex items-center space-x-2"
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
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
              }}
            >
              {isCopied ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>{isCopied ? "Copied!" : "Copy to Clipboard"}</span>
            </button>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-medium mb-4 text-white">
              Completions API
            </h3>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 overflow-x-auto">
              <pre className="text-sm text-green-400 whitespace-pre-wrap">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
