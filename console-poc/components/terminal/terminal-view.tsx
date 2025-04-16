"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ChevronRight, Copy, Download, Maximize2, Minimize2, RotateCcw, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

interface TerminalHistory {
  command: string
  output: string
  timestamp: string
}

export function TerminalView() {
  const [command, setCommand] = useState("")
  const [history, setHistory] = useState<TerminalHistory[]>([
    {
      command: "vdeploy list",
      output:
        "NAME               MODEL        REPLICAS  STATUS\nllama3-8b-prod     llama3-8b    3         Running\nmistral-7b-prod    mistral-7b   2         Running\nllama3-70b-prod    llama3-70b   4         Warning\ngemma-7b-staging   gemma-7b     1         Running\nllama3-8b-staging  llama3-8b    1         Running\nmistral-7b-dev     mistral-7b   1         Pending",
      timestamp: "2024-03-20 14:35:12",
    },
    {
      command: "vdeploy get llama3-8b-prod",
      output:
        "Name: llama3-8b-prod\nModel: llama3-8b\nReplicas: 3\nStatus: Running\nCreated: 2023-12-15\nLast Updated: 2024-03-10\n\nResource Usage:\n  CPU: 12 cores\n  Memory: 24GB\n  GPU: 3x A100\n\nConfiguration:\n  Max Batch Size: 32\n  Max Input Length: 4096\n  Max Output Length: 2048\n  Tensor Parallelism: 1\n  Pipeline Parallelism: 1",
      timestamp: "2024-03-20 14:36:28",
    },
  ])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault()

    if (!command.trim()) return

    // Mock command processing
    let output = ""

    if (command.includes("list")) {
      output =
        "NAME               MODEL        REPLICAS  STATUS\nllama3-8b-prod     llama3-8b    3         Running\nmistral-7b-prod    mistral-7b   2         Running\nllama3-70b-prod    llama3-70b   4         Warning\ngemma-7b-staging   gemma-7b     1         Running\nllama3-8b-staging  llama3-8b    1         Running\nmistral-7b-dev     mistral-7b   1         Pending"
    } else if (command.includes("get")) {
      if (command.includes("llama3-8b")) {
        output =
          "Name: llama3-8b-prod\nModel: llama3-8b\nReplicas: 3\nStatus: Running\nCreated: 2023-12-15\nLast Updated: 2024-03-10\n\nResource Usage:\n  CPU: 12 cores\n  Memory: 24GB\n  GPU: 3x A100\n\nConfiguration:\n  Max Batch Size: 32\n  Max Input Length: 4096\n  Max Output Length: 2048\n  Tensor Parallelism: 1\n  Pipeline Parallelism: 1"
      } else if (command.includes("mistral")) {
        output =
          "Name: mistral-7b-prod\nModel: mistral-7b\nReplicas: 2\nStatus: Running\nCreated: 2024-01-05\nLast Updated: 2024-03-15\n\nResource Usage:\n  CPU: 8 cores\n  Memory: 16GB\n  GPU: 2x A100\n\nConfiguration:\n  Max Batch Size: 32\n  Max Input Length: 4096\n  Max Output Length: 2048\n  Tensor Parallelism: 1\n  Pipeline Parallelism: 1"
      } else {
        output = "Error: Deployment not found"
      }
    } else if (command.includes("help")) {
      output =
        "vDeploy CLI Help:\n\nDeployment Commands:\n  vdeploy list                List all deployments\n  vdeploy get <name>          Get deployment details\n  vdeploy create <name>       Create a new deployment\n  vdeploy delete <name>       Delete a deployment\n  vdeploy scale <name>        Scale a deployment\n\nModel Commands:\n  vdeploy models list         List all available models\n  vdeploy models get <name>   Get model details\n  vdeploy models pull <name>  Pull a model from HuggingFace\n\nOther Commands:\n  vdeploy logs <name>         View deployment logs\n  vdeploy metrics <name>      View deployment metrics\n  vdeploy help                Show this help message"
    } else if (command.includes("create") || command.includes("scale") || command.includes("delete")) {
      output = "Operation initiated. Use 'vdeploy list' to check status."
    } else {
      output = `Command not recognized: ${command}\nType 'vdeploy help' for available commands.`
    }

    const now = new Date()
    const timestamp = now.toISOString().replace("T", " ").substring(0, 19)

    setHistory([...history, { command, output, timestamp }])
    setCommand("")

    // Scroll to bottom
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    }, 0)
  }

  const clearHistory = () => {
    setHistory([])
  }

  const copyToClipboard = () => {
    const text = history.map((item) => `$ ${item.command}\n${item.output}`).join("\n\n")
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: "Terminal history has been copied to clipboard",
    })
  }

  const downloadHistory = () => {
    const text = history.map((item) => `[${item.timestamp}] $ ${item.command}\n${item.output}`).join("\n\n")
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "vdeploy-terminal-history.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // Focus input when terminal is clicked
  useEffect(() => {
    const handleClick = () => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }

    if (terminalRef.current) {
      terminalRef.current.addEventListener("click", handleClick)
    }

    return () => {
      if (terminalRef.current) {
        terminalRef.current.removeEventListener("click", handleClick)
      }
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Terminal</h1>
        <p className="text-muted-foreground">Command-line interface for the vDeploy platform</p>
      </div>

      <Tabs defaultValue="cli" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cli">CLI Terminal</TabsTrigger>
          <TabsTrigger value="help">Command Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="cli" className="space-y-4">
          <Card className={isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""}>
            <CardHeader className="flex flex-row items-center justify-between p-4">
              <div>
                <CardTitle>vDeploy CLI</CardTitle>
                <CardDescription>Command-line interface for managing model deployments</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={clearHistory}>
                  <RotateCcw className="h-4 w-4" />
                  <span className="sr-only">Clear</span>
                </Button>
                <Button variant="outline" size="icon" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Copy</span>
                </Button>
                <Button variant="outline" size="icon" onClick={downloadHistory}>
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Download</span>
                </Button>
                <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  <span className="sr-only">Toggle fullscreen</span>
                </Button>
                {isFullscreen && (
                  <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={terminalRef}
                className="terminal-output bg-black text-green-400 p-4 rounded-b-lg font-mono text-sm overflow-auto"
                style={{ height: isFullscreen ? "calc(100vh - 120px)" : "400px" }}
              >
                <div className="mb-4">
                  <p>vDeploy CLI v1.0.0</p>
                  <p>Type 'vdeploy help' for available commands</p>
                </div>

                {history.map((item, index) => (
                  <div key={index} className="mb-4">
                    <div className="flex items-center gap-2 text-white">
                      <span className="text-gray-500">[{item.timestamp}]</span>
                      <ChevronRight className="h-4 w-4 text-green-500" />
                      <span>{item.command}</span>
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap">{item.output}</pre>
                  </div>
                ))}

                <form onSubmit={handleCommand} className="flex items-center gap-2 text-white">
                  <ChevronRight className="h-4 w-4 text-green-500" />
                  <Input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="flex-1 bg-transparent border-none text-white focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                    placeholder="Type a command..."
                    autoComplete="off"
                    spellCheck="false"
                  />
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="help" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Command Reference</CardTitle>
              <CardDescription>Available commands for the vDeploy CLI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Deployment Management</h3>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy list</div>
                      <div>List all deployments</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy get &lt;name&gt;</div>
                      <div>Get deployment details</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy create &lt;name&gt;</div>
                      <div>Create a new deployment</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy delete &lt;name&gt;</div>
                      <div>Delete a deployment</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy scale &lt;name&gt;</div>
                      <div>Scale a deployment</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Model Management</h3>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy models list</div>
                      <div>List all available models</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy models get &lt;name&gt;</div>
                      <div>Get model details</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy models pull &lt;name&gt;</div>
                      <div>Pull a model from HuggingFace</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy models delete &lt;name&gt;</div>
                      <div>Delete a model</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy models quantize &lt;name&gt;</div>
                      <div>Quantize a model</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Cluster Management</h3>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy cluster status</div>
                      <div>Get cluster status</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy cluster nodes</div>
                      <div>List cluster nodes</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy cluster scale</div>
                      <div>Scale the cluster</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Utilities</h3>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy help</div>
                      <div>Show help message</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy version</div>
                      <div>Show version information</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="font-mono">vdeploy logs &lt;deployment&gt;</div>
                      <div>Show logs for a deployment</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
