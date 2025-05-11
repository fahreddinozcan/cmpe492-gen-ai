import * as React from "react";
import { Terminal } from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";

interface LogDisplayProps {
  clusterId: string;
}

export function LogDisplay({ clusterId }: LogDisplayProps) {
  const [logs, setLogs] = React.useState<Array<{ timestamp: string; level: string; message: string }>>([]);
  const [connected, setConnected] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const wsRef = React.useRef<WebSocket | null>(null);

  const connectWebSocket = React.useCallback(() => {
    // Check if WebSocket is already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Create new WebSocket connection with dynamic host detection
    const host = window.location.hostname;
    const port = 8000; // Backend server port
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${host}:${port}/ws/cluster-logs/${clusterId}`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log("WebSocket connected for cluster logs");
      setConnected(true);
      // Add a connection message
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: "Connected to log stream..."
      }]);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => [...prev, data]);
        
        // Auto-scroll to bottom
        if (scrollAreaRef.current) {
          setTimeout(() => {
            if (scrollAreaRef.current) {
              scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
            }
          }, 10);
        }
      } catch (error) {
        console.error("Error parsing log message:", error);
      }
    };
    
    ws.onclose = () => {
      console.log("WebSocket closed for cluster logs");
      setConnected(false);
      // Add a disconnection message
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: "Disconnected from log stream..."
      }]);
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        level: "ERROR",
        message: "Connection error with log stream"
      }]);
    };
    
    // Clean-up function
    return () => {
      ws.close();
    };
  }, [clusterId]);
  
  React.useEffect(() => {
    // Connect when component mounts
    connectWebSocket();
    
    // Clean up when component unmounts
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);
  
  // Format timestamp to a readable format
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (e) {
      return timestamp;
    }
  };
  
  // Get class name for log level
  const getLevelClass = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return "text-red-500";
      case "WARNING":
        return "text-yellow-500";
      case "INFO":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };
  
  return (
    <div className="border rounded-md bg-black text-white p-2 font-mono text-sm">
      <div className="flex items-center mb-2 text-xs">
        <div className={`rounded-full w-2 h-2 ${connected ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
        <span>{connected ? "Connected" : "Disconnected"}</span>
      </div>
      
      <ScrollArea ref={scrollAreaRef} className="h-[300px] overflow-auto">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Terminal className="h-6 w-6 mb-2" />
            <p>Waiting for logs...</p>
          </div>
        ) : (
          <div className="space-y-1 pb-2">
            {logs.map((log, index) => (
              <div key={index} className="flex">
                <span className="text-gray-500 mr-2">[{formatTimestamp(log.timestamp)}]</span>
                <span className={`mr-2 ${getLevelClass(log.level)}`}>[{log.level}]</span>
                <span className="flex-1 break-all">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
