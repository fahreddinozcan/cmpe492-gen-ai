"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ResourceUsage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource Usage</CardTitle>
        <CardDescription>Detailed view of cluster resource utilization</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gpu" className="space-y-4">
          <TabsList>
            <TabsTrigger value="gpu">GPU Resources</TabsTrigger>
            <TabsTrigger value="cpu">CPU Resources</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
          </TabsList>

          <TabsContent value="gpu" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "A100 Node 1", usage: 92, memory: "38.5GB / 40GB" },
                { name: "A100 Node 2", usage: 87, memory: "36.2GB / 40GB" },
                { name: "A100 Node 3", usage: 76, memory: "30.4GB / 40GB" },
                { name: "A100 Node 4", usage: 82, memory: "32.8GB / 40GB" },
                { name: "A100 Node 5", usage: 65, memory: "26.0GB / 40GB" },
                { name: "A100 Node 6", usage: 78, memory: "31.2GB / 40GB" },
                { name: "A100 Node 7", usage: 45, memory: "18.0GB / 40GB" },
                { name: "A100 Node 8", usage: 88, memory: "35.2GB / 40GB" },
              ].map((node, i) => (
                <Card key={i}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium">{node.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Utilization</span>
                        <span>{node.usage}%</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: `${node.usage}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Memory</span>
                        <span>{node.memory}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cpu" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "CPU Node 1", usage: 45, cores: "18/40 cores" },
                { name: "CPU Node 2", usage: 32, cores: "13/40 cores" },
                { name: "CPU Node 3", usage: 68, cores: "27/40 cores" },
                { name: "CPU Node 4", usage: 22, cores: "9/40 cores" },
              ].map((node, i) => (
                <Card key={i}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium">{node.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Utilization</span>
                        <span>{node.usage}%</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: `${node.usage}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Active Cores</span>
                        <span>{node.cores}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="memory" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">GPU Memory Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>llama3-70b</span>
                        <span>78.5GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "45%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>llama3-8b</span>
                        <span>37.2GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "22%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>mistral-7b</span>
                        <span>30.6GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "18%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>gemma-7b</span>
                        <span>25.8GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "15%" }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">System Memory Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Ray Head Node</span>
                        <span>12.4GB / 32GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "39%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Ray Worker Nodes</span>
                        <span>86.5GB / 128GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "68%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>vLLM Controller</span>
                        <span>3.2GB / 8GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "40%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Monitoring Stack</span>
                        <span>4.8GB / 8GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "60%" }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Model Storage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>llama3-70b</span>
                        <span>140GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "35%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>llama3-8b</span>
                        <span>16GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "4%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>mistral-7b</span>
                        <span>14GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "3.5%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>gemma-7b</span>
                        <span>14GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "3.5%" }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">System Storage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Model Registry</span>
                        <span>184GB / 500GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "37%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Log Storage</span>
                        <span>42GB / 100GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "42%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Metrics Database</span>
                        <span>28GB / 100GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "28%" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>System Volumes</span>
                        <span>18GB / 50GB</span>
                      </div>
                      <div className="gpu-usage-bar">
                        <div className="gpu-usage-fill" style={{ width: "36%" }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

