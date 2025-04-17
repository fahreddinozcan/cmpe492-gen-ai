import * as React from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { useDeployment, useRefreshDeploymentStatus } from "../lib/api";
import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";

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
  const { mutate: refreshStatus } = useRefreshDeploymentStatus();
  
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
  
  // No automatic redirection - user must click the button to view details
  // We've removed the automatic redirection that was previously here
  
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
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg">Loading deployment information...</p>
      </div>
    );
  }
  
  if (deploymentError || error) {
    const errorMessage = error || (deploymentError instanceof Error ? deploymentError.message : 'Unknown error');
    
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Error Loading Deployment</h2>
        <div className="text-muted-foreground mb-4 max-w-md text-center">
          <p className="mb-2">{errorMessage}</p>
          
          {/* Show more detailed troubleshooting information */}
          <div className="mt-4 text-sm bg-gray-800 p-4 rounded-md text-left">
            <p className="font-semibold mb-2">Troubleshooting steps:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Check if the Kubernetes cluster is accessible</li>
              <li>Verify that the deployment exists in the specified namespace</li>
              <li>Check if the deployment pods are running correctly</li>
              <li>Examine the deployment logs for any errors</li>
            </ul>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRetry}>Retry</Button>
          <Button onClick={handleViewDetails}>View Deployment Details</Button>
        </div>
      </div>
    );
  }
  
  if (!deployment) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Deployment Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The deployment you're looking for could not be found.
        </p>
        <Button onClick={() => navigate("/deployments")}>Back to Deployments</Button>
      </div>
    );
  }
  
  const currentStageIndex = DEPLOYMENT_STAGES.findIndex(stage => stage.id === currentStage);
  // More robust failure detection that matches the mapStatusToStage function
  const isFailed = deployment.status?.toLowerCase().includes('fail') || 
                  deployment.status?.toLowerCase().includes('error');
  
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">Deployment Progress</h1>
      <p className="text-muted-foreground mb-8">
        Tracking progress for deployment: <span className="font-medium">{deployment.release_name}</span>
      </p>
      
      {isFailed && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-8">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 mr-2" />
            <div>
              <h3 className="font-medium">Deployment Failed</h3>
              <p className="text-sm text-muted-foreground">
                There was an error deploying your model. Please check the logs for more details.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleViewDetails}
              >
                View Logs
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
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
              <div className="mr-4 mt-1">
                {status === "complete" && (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
                {status === "current" && (
                  <Clock className={`h-6 w-6 text-primary animate-pulse`} />
                )}
                {status === "failed" && (
                  <AlertCircle className="h-6 w-6 text-destructive" />
                )}
                {status === "upcoming" && (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="font-medium">{stage.label}</h3>
                  {status === "current" && !isFailed && (
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      In Progress
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{stage.description}</p>
                {index < DEPLOYMENT_STAGES.length - 1 && (
                  <div className="h-6 border-l border-dashed border-muted ml-3 mt-1"></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-12 flex justify-end space-x-4">
        {isFailed && (
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        )}
        <Button onClick={handleViewDetails}>
          {currentStage === "running" ? "View Deployment" : "View Details"}
        </Button>
      </div>
    </div>
  );
}
