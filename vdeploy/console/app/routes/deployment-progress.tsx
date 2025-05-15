import * as React from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { useDeployment, useRefreshDeploymentStatus } from "../lib/api";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  ArrowLeft,
  Server,
  RefreshCw,
  BarChart3
} from "lucide-react";

// Define the deployment stages and their descriptions
const DEPLOYMENT_STAGES = [
  {
    id: "created",
    label: "Deployment Created",
    description: "Deployment request has been submitted to the platform",
  },
  {
    id: "provisioning",
    label: "Provisioning Resources",
    description: "Kubernetes resources are being provisioned",
  },
  {
    id: "downloading",
    label: "Downloading Model",
    description: "The model is being downloaded from Hugging Face",
  },
  {
    id: "initializing",
    label: "Initializing Model",
    description: "The model is being loaded and initialized",
  },
  {
    id: "running",
    label: "Deployment Running",
    description: "The deployment is now running and ready to use",
  },
];

// Map status values to stage IDs
function mapStatusToStage(status: string): string {
  // Convert status to lowercase for case-insensitive matching
  const statusLower = status?.toLowerCase() || '';
  
  // Handle various status values that might come from the backend
  if (statusLower.includes('pending') || statusLower.includes('created')) {
    return "created";
  } else if (statusLower.includes('provisioning') || statusLower.includes('creating')) {
    return "provisioning";
  } else if (statusLower.includes('download')) {
    return "downloading";
  } else if (statusLower.includes('initializing') || statusLower.includes('loading')) {
    return "initializing";
  } else if (statusLower.includes('running') || statusLower.includes('ready')) {
    return "running";
  } else if (statusLower.includes('fail') || statusLower.includes('error')) {
    return "failed";
  }
  
  // Default fallback
  console.log(`Unrecognized status: ${status}, defaulting to 'created'`);
  return "created";
}

export default function DeploymentProgress() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [refreshInterval, setRefreshInterval] = React.useState<number | null>(5000); // 5 seconds
  const [currentStage, setCurrentStage] = React.useState<string>("created");
  const [error, setError] = React.useState<string | null>(null);
  
  // Use React Query to fetch deployment data
  const { 
    data: deployment, 
    isLoading, 
    error: deploymentError,
    refetch
  } = useDeployment(id);
  
  // Use mutation for refreshing status
  const { mutate: refreshStatus, isPending: isRefreshing } = useRefreshDeploymentStatus();
  
  // Update current stage based on deployment status
  React.useEffect(() => {
    if (deployment) {
      const stage = mapStatusToStage(deployment.status);
      setCurrentStage(stage);
      
      // If deployment is running or failed, stop polling
      if (stage === "running" || stage === "failed") {
        setRefreshInterval(null);
      }
    }
  }, [deployment]);
  
  // Set up polling to check deployment status
  React.useEffect(() => {
    if (!id || !refreshInterval) return;
    
    const timer = setInterval(() => {
      if (id) {
        console.log(`Refreshing deployment status for ID: ${id}`);
        refreshStatus(id as string, {
          onSuccess: (data) => {
            console.log("Refresh successful:", data);
            // If deployment is in a failed state, show the error
            if (data.status?.toLowerCase().includes('fail') || data.status?.toLowerCase().includes('error')) {
              setError(`Deployment failed: ${data.status}`);
            } else {
              // Clear any previous errors if the deployment is now in a good state
              setError(null);
            }
          },
          onError: (err) => {
            console.error("Error refreshing deployment status:", err);
            // Show a more detailed error message
            setError(`Failed to refresh deployment status: ${err.message || 'Unknown error'}`);
            // Don't stop polling immediately on first error - give it a few more tries
            if (refreshInterval && refreshInterval <= 5000) {
              // Only stop polling after multiple errors with short intervals
              setRefreshInterval(null);
            } else if (refreshInterval) {
              // Increase polling interval on error to reduce load
              setRefreshInterval(10000); // 10 seconds
            }
          }
        });
      }
    }, refreshInterval);
    
    return () => clearInterval(timer);
  }, [id, refreshInterval, refreshStatus]);
  
  function handleViewDetails() {
    // Use deployment_id (or id as fallback) as the path
    const deploymentId = deployment?.deployment_id || id;
    navigate(`/deployments/${deploymentId}`);
  }
  
  function handleRetry() {
    if (id) {
      setError(null);
      setRefreshInterval(5000);
      refreshStatus(id as string);
    }
  }
  
  function handleManualRefresh() {
    if (id) {
      refreshStatus(id as string);
      refetch();
    }
  }
  
  const currentStageIndex = DEPLOYMENT_STAGES.findIndex(stage => stage.id === currentStage);
  const isFailed = deployment?.status?.toLowerCase().includes('fail') || 
                  deployment?.status?.toLowerCase().includes('error');
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-white">Loading deployment information...</p>
        </div>
      </div>
    );
  }
  
  if (deploymentError || error) {
    const errorMessage = error || 
      (deploymentError instanceof Error ? deploymentError.message : 'Unknown error');
    
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="relative p-6 max-w-6xl mx-auto">
            <div className="flex items-center mb-6">
              <Button 
                variant="ghost" 
                className="mr-4 text-gray-400 hover:text-white" 
                onClick={() => navigate("/deployments")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center shadow-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Deployment Error</h1>
                  <p className="text-gray-400">There was a problem with your deployment</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 max-w-6xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-red-700/50 shadow-xl">
            <div className="flex items-start space-x-4">
              <AlertCircle className="w-8 h-8 text-red-500 mt-1 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Error Loading Deployment</h2>
                <p className="text-gray-300 mb-4">{errorMessage}</p>
                
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 mb-6">
                  <h3 className="text-white font-medium mb-2">Troubleshooting Steps:</h3>
                  <ul className="text-gray-300 space-y-2">
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 mr-2"></span>
                      <span>Check if the Kubernetes cluster is accessible</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 mr-2"></span>
                      <span>Verify that the deployment exists in the specified namespace</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 mr-2"></span>
                      <span>Check if the deployment pods are running correctly</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 mr-2"></span>
                      <span>Examine the deployment logs for any errors</span>
                    </li>
                  </ul>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleRetry}
                    className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Deployment
                  </Button>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleViewDetails}
                  >
                    View Deployment Details
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!deployment) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="relative p-6 max-w-6xl mx-auto">
            <div className="flex items-center mb-6">
              <Button 
                variant="ghost" 
                className="mr-4 text-gray-400 hover:text-white" 
                onClick={() => navigate("/deployments")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center shadow-lg">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Deployment Not Found</h1>
                  <p className="text-gray-400">The requested deployment could not be located</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 max-w-6xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700/50 text-center">
            <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Server className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-medium mb-2 text-white">No Deployment Found</h2>
            <p className="text-gray-400 mb-6">
              The deployment you're looking for could not be found.
            </p>
            <Button 
              onClick={() => navigate("/deployments")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Back to Deployments
            </Button>
          </div>
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
              <Button 
                variant="ghost" 
                className="mr-2 text-gray-400 hover:text-white" 
                onClick={() => navigate("/deployments")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Deployment Progress</h1>
                <p className="text-gray-400">
                  {deployment.name || deployment.release_name || "Deployment"} • {deployment.model || "Model"}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                <RefreshCw 
                  className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} 
                />
                Refresh Status
              </Button>
              <Button 
                onClick={handleViewDetails}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Details
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-6xl mx-auto">
        {/* Main Content Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 shadow-xl">
          {isFailed && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-white">Deployment Failed</h3>
                  <p className="text-sm text-gray-300 mt-1">
                    There was an error deploying your model. Please check the logs for more details.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 bg-red-900/30 border-red-500/30 hover:bg-red-800/50 text-white"
                    onClick={handleViewDetails}
                  >
                    View Logs
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-8 px-4">
            {DEPLOYMENT_STAGES.map((stage, index) => {
              let status: "complete" | "current" | "upcoming" | "failed" = "upcoming";
              
              if (index < currentStageIndex) {
                status = "complete";
              } else if (index === currentStageIndex) {
                status = isFailed ? "failed" : "current";
              }
              
              return (
                <div 
                  key={stage.id}
                  className={`flex items-start ${
                    status === "upcoming" ? "opacity-50" : ""
                  }`}
                >
                  <div className="mr-4 mt-1 flex-shrink-0">
                    {status === "complete" && (
                      <div className="w-8 h-8 bg-green-600/30 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                      </div>
                    )}
                    {status === "current" && (
                      <div className="w-8 h-8 bg-blue-600/30 rounded-full flex items-center justify-center animate-pulse">
                        <Clock className="h-5 w-5 text-blue-400" />
                      </div>
                    )}
                    {status === "failed" && (
                      <div className="w-8 h-8 bg-red-600/30 rounded-full flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      </div>
                    )}
                    {status === "upcoming" && (
                      <div className="w-8 h-8 bg-gray-600/30 rounded-full flex items-center justify-center">
                        <Circle className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className={`font-medium ${status === "current" ? "text-blue-300" : 
                        status === "complete" ? "text-white" : 
                        status === "failed" ? "text-red-300" : 
                        "text-gray-400"}`}
                      >
                        {stage.label}
                      </h3>
                      {status === "current" && !isFailed && (
                        <span className="ml-2 text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded-full">
                          In Progress
                        </span>
                      )}
                      {status === "complete" && (
                        <span className="ml-2 text-xs bg-green-600/20 text-green-300 px-2 py-0.5 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{stage.description}</p>
                    {index < DEPLOYMENT_STAGES.length - 1 && (
                      <div className="h-8 border-l border-dashed border-gray-600 ml-3 mt-2"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-700/30 flex justify-end space-x-4">
            {isFailed && (
              <Button 
                variant="outline"
                onClick={handleRetry}
                className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Deployment
              </Button>
            )}
            <Button 
              onClick={handleViewDetails}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {currentStage === "running" ? "View Deployment" : "View Details"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
