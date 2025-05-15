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
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Logs() {
  const navigate = useNavigate();
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
  
  // Function to format date
  const formatDate = (dateString: any) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };
  
  if (isLoadingDeployments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-white">Loading deployments...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center shadow-lg">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Logs</h1>
                <p className="text-gray-400">Monitor deployment logs in real-time</p>
              </div>
            </div>
            <div className="flex gap-3">
              {selectedDeploymentId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              )}
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <span onClick={() => navigate("/deployments")}>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  View Deployments
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-6 max-w-6xl mx-auto">
        {deployments.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
            <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Terminal className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-white">No deployments found</h3>
            <p className="text-gray-400 mb-6">
              Create a deployment first to view logs.
            </p>
            <Button onClick={() => navigate("/deployments/new")} className="bg-blue-600 hover:bg-blue-700">
              Create Deployment
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Deployment Selector */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Select Deployment</h3>
                  <p className="text-sm text-gray-400">Choose a deployment to view its logs</p>
                </div>
                <select
                  value={selectedDeploymentId}
                  onChange={(e) => setSelectedDeploymentId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 md:min-w-64"
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
            
            {!selectedDeployment ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50 text-center">
                <h3 className="text-xl font-semibold text-white mb-3">Select a deployment</h3>
                <p className="text-gray-400 mb-6">
                  Choose a deployment from the dropdown above to view its logs.
                </p>
                <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto">
                  <Terminal className="w-6 h-6 text-gray-400" />
                </div>
              </div>
            ) : (
              <>
                {/* Deployment Info */}
                <div className="bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-gray-700/50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                        <Server className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedDeployment.name}</h2>
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              selectedDeployment.status === 'deployed' || selectedDeployment.status === 'running' 
                                ? 'bg-green-500' 
                                : selectedDeployment.status === 'pending' 
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}></div>
                            <span className="text-gray-400 text-sm">
                              {selectedDeployment.status}
                            </span>
                          </div>
                          <span className="text-gray-400 text-sm">
                            Model: {selectedDeployment.model || 'unknown'}
                          </span>
                          <span className="text-gray-400 text-sm">
                            Created: {formatDate(selectedDeployment.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-3">
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
                          <Square className="w-4 h-4 mr-2" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {isStreamingLogs ? "Stop Streaming" : "Start Streaming"}
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Logs Status Banner */}
                {isStreamingLogs && (
                  <div className="bg-green-900/20 border border-green-500/30 text-green-200 px-6 py-4 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                      <p>Live streaming active - logs are updating in real-time</p>
                    </div>
                  </div>
                )}
                
                {/* Logs Display */}
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden shadow-xl">
                  <div className="p-4 bg-gray-700/30 border-b border-gray-700/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-white">vLLM Pod Logs</h3>
                      <p className="text-sm text-gray-400">
                        {isStreamingLogs ? (
                          <span className="text-green-400 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                            Live streaming active
                          </span>
                        ) : (
                          "Click 'Start Streaming' to view real-time logs"
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchLogs()}
                      className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
                      disabled={isLoadingLogs}
                    >
                      <RotateCcw className={`w-4 h-4 mr-2 ${isLoadingLogs ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                  <div className="p-4 h-96 overflow-y-auto font-mono text-sm bg-black/80">
                    {logMessages.length === 0 ? (
                      <div className="text-gray-400 text-center py-20">
                        {isStreamingLogs
                          ? "Waiting for logs..."
                          : 'Click "Start Streaming" to view logs'}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Total Log Lines */}
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm font-medium">
                          Total Log Lines
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">
                          {logMessages.length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                        <Terminal className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Streaming Status */}
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm font-medium">
                          Streaming Status
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">
                          {isStreamingLogs ? 'Active' : 'Inactive'}
                        </p>
                        <div className="flex items-center mt-2">
                          {isStreamingLogs ? (
                            <span className="text-green-400 text-sm">
                              <CheckCircle2 className="w-3 h-3 inline mr-1" />
                              Receiving data
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">
                              <Clock className="w-3 h-3 inline mr-1" />
                              Waiting to start
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                        <div className={`w-6 h-6 rounded-full ${isStreamingLogs ? 'bg-green-500' : 'bg-gray-500'} flex items-center justify-center`}>
                          {isStreamingLogs ? (
                            <span className="text-xs text-black font-bold">ON</span>
                          ) : (
                            <span className="text-xs text-black font-bold">OFF</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Deployment Status */}
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm font-medium">
                          Deployment Status
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">
                          {selectedDeployment.status}
                        </p>
                        <div className="flex items-center mt-2">
                          {selectedDeployment.status === 'deployed' || selectedDeployment.status === 'running' ? (
                            <span className="text-green-400 text-sm">
                              <CheckCircle2 className="w-3 h-3 inline mr-1" />
                              Operational
                            </span>
                          ) : selectedDeployment.status === 'pending' ? (
                            <span className="text-yellow-400 text-sm">
                              <Clock className="w-3 h-3 inline mr-1" />
                              Pending
                            </span>
                          ) : (
                            <span className="text-red-400 text-sm">
                              <AlertCircle className="w-3 h-3 inline mr-1" />
                              Issue detected
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
                        <Server className="w-6 h-6 text-orange-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}