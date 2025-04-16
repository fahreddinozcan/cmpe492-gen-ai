"use client"

import { useState } from "react"
import { CheckCircle2, Filter, MoreHorizontal, Search, Trash2, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Model {
  id: string
  name: string
  architecture: string
  task: string
  parameters: string
  quantization: string | null
  size: string
  lastUpdated: string
  status: "available" | "downloading" | "error"
  source: "huggingface" | "custom"
}

const models: Model[] = [
  {
    id: "model-1",
    name: "llama3-8b",
    architecture: "LlamaForCausalLM",
    task: "text-generation",
    parameters: "8B",
    quantization: null,
    size: "16GB",
    lastUpdated: "2024-03-10",
    status: "available",
    source: "huggingface"
  },
  {
    id: "model-2",
    name: "llama3-8b-q4",
    architecture: "LlamaForCausalLM",
    task: "text-generation",
    parameters: "8B",
    quantization: "Q4_K_M",
    size: "4.2GB",
    lastUpdated: "2024-03-12",
    status: "available",
    source: "huggingface"
  },
  {
    id: "model-3",
    name: "t5-large",
    architecture: "T5ForConditionalGeneration",
    task: "text2text-generation",
    parameters: "770M",
    quantization: null,
    size: "2.9GB",
    lastUpdated: "2024-03-15",
    status: "available",
    source: "huggingface"
  },
  {
    id: "model-4",
    name: "bert-large",
    architecture: "BertForSequenceClassification",
    task: "text-classification",
    parameters: "340M",
    quantization: "Q4_K_M",
    size: "1.2GB",
    lastUpdated: "2024-03-16",
    status: "available",
    source: "huggingface"
  },
  {
    id: "model-5",
    name: "mistral-7b",
    architecture: "MistralForCausalLM",
    task: "text-generation",
    parameters: "7B",
    quantization: null,
    size: "14GB",
    lastUpdated: "2024-02-20",
    status: "available",
    source: "huggingface"
  },
  {
    id: "model-6",
    name: "falcon-7b",
    architecture: "FalconForCausalLM",
    task: "text-generation",
    parameters: "7B",
    quantization: "Q4_K_M",
    size: "3.8GB",
    lastUpdated: "2024-02-22",
    status: "available",
    source: "huggingface"
  }
]

export function ModelsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [architectureFilter, setArchitectureFilter] = useState("all")
  const [taskFilter, setTaskFilter] = useState("all")
  const [quantizationFilter, setQuantizationFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesArchitecture = architectureFilter === "all" || model.architecture === architectureFilter
    const matchesTask = taskFilter === "all" || model.task === taskFilter
    const matchesQuantization =
      quantizationFilter === "all" ||
      (quantizationFilter === "quantized" && model.quantization !== null) ||
      (quantizationFilter === "full" && model.quantization === null)
    const matchesSource = sourceFilter === "all" || model.source === sourceFilter

    return matchesSearch && matchesArchitecture && matchesTask && matchesQuantization && matchesSource
  })

  // Get unique architectures and tasks for filters
  const architectures = Array.from(new Set(models.map(m => m.architecture)))
  const tasks = Array.from(new Set(models.map(m => m.task)))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Models</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Models are loaded from HuggingFace Hub by default.<br />Check supported_models.md for more details.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-muted-foreground">Manage your LLM models</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search models..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={architectureFilter} onValueChange={setArchitectureFilter}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Architecture" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Architectures</SelectItem>
                {architectures.map(arch => (
                  <SelectItem key={arch} value={arch}>{arch}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Task" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                {tasks.map(task => (
                  <SelectItem key={task} value={task}>{task}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={quantizationFilter} onValueChange={setQuantizationFilter}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Quantization" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem value="full">Full Precision</SelectItem>
                <SelectItem value="quantized">Quantized</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Source" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="huggingface">HuggingFace Hub</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredModels.map((model) => (
            <Card key={model.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium flex items-center">
                  <span>{model.name}</span>
                  {model.status === "available" && (
                    <CheckCircle2 className="ml-2 h-4 w-4 text-green-500 flex-shrink-0" />
                  )}
                </CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant="outline" 
                      className="whitespace-nowrap h-6 px-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-500"
                    >
                      {model.architecture}
                    </Badge>
                    <Badge 
                      variant="outline"
                      className="whitespace-nowrap h-6 px-2 bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 hover:text-purple-500"
                    >
                      {model.task}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    <div>Parameters: {model.parameters}</div>
                    <div>Size: {model.size}</div>
                    {model.quantization && <div>Quantization: {model.quantization}</div>}
                    <div>Last Updated: {model.lastUpdated}</div>
                    <div>Source: {model.source === "huggingface" ? "HuggingFace Hub" : "Custom"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
