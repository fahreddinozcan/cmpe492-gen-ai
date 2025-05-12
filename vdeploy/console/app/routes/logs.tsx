import React from "react";
import { Button } from "../components/ui/button";
import {
  useDeployments,
  useVLLMPodLogs,
  type Deployment,
} from "~/lib/api";
import {
  Play,
  Square,
  RotateCcw,
  Terminal,
  Server,
} from "lucide-react";

export default function Logs() {
  // State for selected deployment
  const [selectedDeploymentId, setSelectedDeploymentId] = React.useState<string>("");
  const [selectedDeployment, setSelectedDeployment] = React.useState<Deployment | null>(null);
  
  // Logs state
  const [logMessages, setLogMessages] = React.useState<string[]>([]);
  const [isStreamingLogs, setIsStreamingLogs] = React.useState<boolean>(false);
  const [wsRef, setWsRef] = React.useState<WebSocket | null>(null);
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  
  // Fetch all deployments for the dropdown
  const { data: deployments = [], isLoading: isLoadingDeployments } = useDeployments();
  
  // Fetch logs for selected deployment
  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useVLLMPodLogs(selectedDeploymentId || undefined);
  
  // Update selected deployment when dropdown changes
  React.useEffect(() => {
    if (selectedDeploymentId && deployments.length > 0) {
      const deployment = deployments.find(d => 
        d.deployment_id === selectedDeploymentId || d.id === selectedDeploymentId
      );
      setSelectedDeployment(deployment || null);
    }
  }, [selectedDeploymentId, deployments]);
  
  // Auto-select first deployment if available
  React.useEffect(() => {
    if (!selectedDeploymentId && deployments.length > 0) {
      const firstDeployment = deployments[0];
      const deploymentId = firstDeployment.deployment_id || firstDeployment.id;
      if (deploymentId) {
        setSelectedDeploymentId(deploymentId);
      }
    }
  }, [deployments, selectedDeploymentId]);
  
  // Setup WebSocket for real-time logs
  React.useEffect(() => {
    if (!selectedDeploymentId || !isStreamingLogs) {
      if (wsRef) {
        wsRef.close();
        setWsRef(null);
      }
      return;
    }
    
    // Create WebSocket connection for log streaming with vLLM pod type
    const ws = new WebSocket(`ws://localhost:8000/ws/logs/${selectedDeploymentId}?pod_type=vllm`);
    setWsRef(ws);
    
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
  }, [selectedDeploymentId, isStreamingLogs]);
  
  // Clean up WebSocket when component unmounts
  React.useEffect(() => {
    return () => {
      if (wsRef) {
        wsRef.close();
      }
    };
  }, [wsRef]);
  
  // Handle deployment change - stop streaming and clear logs
  React.useEffect(() => {
    setIsStreamingLogs(false);
    setLogMessages([]);
  }, [selectedDeploymentId]);
  
  if (isLoadingDeployments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-white">Loading deployments...</p>
        </div>
      </div>
    );
  }
  
  if (deployments.length === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
        <h1 className="text-2xl font-bold text-white mb-6">Logs</h1>
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-medium mb-2 text-white">No deployments found</h3>
          <p className="text-gray-400 mb-6">
            Create a deployment first to view logs.
          </p>
          <Button onClick={() => (window.location.href = "/deployments/new")}>
            Create Deployment
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <div className="w-8 h-8 bg-orange-600/20 rounded-lg flex items-center justify-center mr-3">
            <Terminal className="w-5 h-5 text-orange-400" />
          </div>
          Deployment Logs
        </h1>
        
        {/* Deployment Selector */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Deployment:</span>
            <select
              value={selectedDeploymentId}
              onChange={(e) => setSelectedDeploymentId(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 min-w-48"
            >
              <option value="">Select a deployment</option>
              {deployments.map((deployment) => {
                const deploymentId = deployment.deployment_id || deployment.id;
                return (
                  <option key={deploymentId} value={deploymentId}>
                    {deployment.name} ({deployment.model || 'unknown'})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>
      
      {!selectedDeployment ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-medium mb-2 text-white">Select a deployment</h3>
          <p className="text-gray-400">
            Choose a deployment from the dropdown above to view its logs.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deployment Info */}
          <div className="bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedDeployment.name}</h2>
                  <p className="text-gray-400">
                    Model: {selectedDeployment.model || 'unknown'} | 
                    Namespace: {selectedDeployment.namespace}
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="ml-2">Refresh Logs</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!isStreamingLogs) {
                      setLogMessages([]);
                      setIsStreamingLogs(true);
                      refetchLogs();
                    } else {
                      setIsStreamingLogs(false);
                    }
                  }}
                  className={`${
                    isStreamingLogs
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white`}
                >
                  {isStreamingLogs ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span className="ml-2">
                    {isStreamingLogs ? "Stop Streaming" : "Start Streaming Logs"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Logs Display */}
          <div className="bg-black/80 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 bg-gray-800/50 border-b border-gray-700/50">
              <h3 className="text-lg font-medium text-white">vLLM Pod Logs</h3>
              <p className="text-sm text-gray-400">
                {isStreamingLogs ? (
                  <span className="text-green-400">● Live streaming active</span>
                ) : (
                  "Click 'Start Streaming Logs' to view real-time logs"
                )}
              </p>
            </div>
            <div className="p-4 h-96 overflow-y-auto font-mono text-sm">
              {logMessages.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  {isStreamingLogs
                    ? "Waiting for logs..."
                    : 'Click "Start Streaming Logs" to view logs'}
                </div>
              ) : (
                logMessages.map((entry, index) => (
                  <div
                    key={index}
                    className="text-green-400 whitespace-pre-wrap mb-1 hover:bg-gray-800/30 p-1 rounded"
                  >
                    {typeof entry === "string" ? entry : JSON.stringify(entry)}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
          
          {/* Logs Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-400 mb-1">Total Log Lines</h4>
              <p className="text-xl font-bold text-white">{logMessages.length}</p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-400 mb-1">Streaming Status</h4>
              <p className={`text-xl font-bold ${isStreamingLogs ? 'text-green-400' : 'text-gray-400'}`}>
                {isStreamingLogs ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-400 mb-1">Deployment Status</h4>
              <p className={`text-xl font-bold ${
                selectedDeployment.status === 'deployed' || selectedDeployment.status === 'running' 
                  ? 'text-green-400' 
                  : 'text-yellow-400'
              }`}>
                {selectedDeployment.status}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}