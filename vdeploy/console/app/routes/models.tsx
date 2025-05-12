import React, { useState } from "react";
import { supportedModels } from "../constants/models";
import { Input } from "../components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useNavigate } from "react-router-dom";

const ModelsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [taskFilter, setTaskFilter] = useState<string>("all");
  const [loraFilter, setLoraFilter] = useState<string>("all");
  const [ppFilter, setPpFilter] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<
    (typeof supportedModels)[0] | null
  >(null);

  const filteredModels = supportedModels.filter((model) => {
    // Text search
    const matchesSearch =
      model.models.some((name) =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      model.architecture.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.exampleHFModels.some((name) =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
      );

    // Task filter
    const matchesTask = taskFilter === "all" || taskFilter === model.taskTag;

    // LoRA filter
    const matchesLora =
      loraFilter === "all" ||
      (loraFilter === "yes" && model.loRA) ||
      (loraFilter === "no" && !model.loRA);

    // PP filter
    const matchesPp =
      ppFilter === "all" ||
      (ppFilter === "yes" && model.pp) ||
      (ppFilter === "no" && !model.pp);

    return matchesSearch && matchesTask && matchesLora && matchesPp;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">vLLM Models</h1>
          <p className="text-muted-foreground mt-2">
            Browse and search through {supportedModels.length} supported models
          </p>
        </div>
        <div className="flex gap-4">
          <Input
            type="text"
            placeholder="Search by model name or architecture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Select value={loraFilter} onValueChange={setLoraFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="LoRA Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All LoRA</SelectItem>
              <SelectItem value="yes">Has LoRA</SelectItem>
              <SelectItem value="no">No LoRA</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ppFilter} onValueChange={setPpFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="PP Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PP</SelectItem>
              <SelectItem value="yes">Has PP</SelectItem>
              <SelectItem value="no">No PP</SelectItem>
            </SelectContent>
          </Select>
          <Select value={taskFilter} onValueChange={setTaskFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Task Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              {Array.from(
                new Set(supportedModels.map((model) => model.taskTag))
              ).map((task) => (
                <SelectItem key={task} value={task}>
                  {task}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {searchTerm && (
          <p className="text-sm text-muted-foreground">
            Found {filteredModels.length} models
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModels.map((model, index) => (
          <Card
            key={index}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => setSelectedModel(model)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{model.architecture}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {model.models.map((name, i) => (
                  <Badge key={i} variant="outline" className="bg-muted/50">
                    {name}
                  </Badge>
                ))}
                <Badge
                  variant="outline"
                  className={
                    model.loRA
                      ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                      : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                  }
                >
                  LoRA {model.loRA ? "✓" : "×"}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    model.pp
                      ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                      : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                  }
                >
                  PP {model.pp ? "✓" : "×"}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-purple-500/20 text-purple-500 hover:bg-purple-500/30"
                >
                  {model.taskTag}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={!!selectedModel}
        onOpenChange={(open: boolean) => !open && setSelectedModel(null)}
      >
        <DialogContent className="max-w-2xl">
          {selectedModel && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {selectedModel.architecture}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className={
                      selectedModel.loRA
                        ? "bg-green-500/20 text-green-500"
                        : "bg-red-500/20 text-red-500"
                    }
                  >
                    LoRA {selectedModel.loRA ? "✓" : "×"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      selectedModel.pp
                        ? "bg-green-500/20 text-green-500"
                        : "bg-red-500/20 text-red-500"
                    }
                  >
                    PP {selectedModel.pp ? "✓" : "×"}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-purple-500/20 text-purple-500"
                  >
                    {selectedModel.taskTag}
                  </Badge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Supported Models
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedModel.models.map((name, i) => (
                      <Badge key={i} variant="outline" className="bg-muted/50">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Example HuggingFace Models
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedModel.exampleHFModels.map((name, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className="h-auto py-2 px-3 whitespace-normal text-left font-mono text-sm break-all"
                        onClick={() => {
                          navigate(
                            `/deployments/new?model=${encodeURIComponent(name)}`
                          );
                        }}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModelsPage;
