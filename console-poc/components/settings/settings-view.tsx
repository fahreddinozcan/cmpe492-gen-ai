"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function SettingsView() {
  const [autoScaling, setAutoScaling] = useState(true)
  const [loggingLevel, setLoggingLevel] = useState("info")
  const [defaultGpuType, setDefaultGpuType] = useState("a100")
  const [defaultRegion, setDefaultRegion] = useState("us-central1")
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your vLLM deployment platform
        </p>
      </div>
      
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="cluster">Cluster</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure general platform settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform-name">Platform Name</Label>
                <Input id="platform-name" defaultValue="vLLM Platform" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="default-region">Default Region</Label>
                <Select value={defaultRegion} onValueChange={setDefaultRegion}>
                  <SelectTrigger id="default-region">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-central1">US Central (Iowa)</SelectItem>
                    <SelectItem value="us-east1">US East (South Carolina)</SelectItem>
                    <SelectItem value="us-west1">US West (Oregon)</SelectItem>
                    <SelectItem value="europe-west4">Europe West (Netherlands)</SelectItem>
                    <SelectItem value="asia-east1">Asia East (Taiwan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="logging-level">Logging Level</Label>
                <Select value={loggingLevel} onValueChange={setLoggingLevel}>
                  <SelectTrigger id="logging-level">
                    <SelectValue placeholder="Select logging level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-scaling">Auto Scaling</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically scale deployments based on demand
                  </p>
                </div>
                <Switch 
                  id="auto-scaling" 
                  checked={autoScaling}
                  onCheckedChange={setAutoScaling}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="cluster" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cluster Configuration</CardTitle>
              <CardDescription>
                Configure your cluster settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-gpu">Default GPU Type</Label>
                <Select value={defaultGpuType} onValueChange={setDefaultGpuType}>
                  <SelectTrigger id="default-gpu">
                    <SelectValue placeholder="Select GPU type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a100">NVIDIA A100</SelectItem>
                    <SelectItem value="h100">NVIDIA H100</SelectItem>
                    <SelectItem value="l4">NVIDIA L4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure your API settings and view documentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-endpoint">API Endpoint</Label>
                <Input id="api-endpoint" value="https://api.vdeploy.ai/v1" readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate-limit">Rate Limit</Label>
                <Select defaultValue="1000">
                  <SelectTrigger id="rate-limit">
                    <SelectValue placeholder="Select rate limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100 requests/min</SelectItem>
                    <SelectItem value="500">500 requests/min</SelectItem>
                    <SelectItem value="1000">1000 requests/min</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>API Documentation</Label>
                <p className="text-sm text-muted-foreground">
                  View our API documentation at{" "}
                  <a href="#" className="text-primary hover:underline">
                    docs.vdeploy.ai
                  </a>
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
