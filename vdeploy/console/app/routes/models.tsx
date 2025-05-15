import React, { useState } from 'react';
import { supportedModels } from '../constants/models';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
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
import { useNavigate } from "react-router";
import { SearchIcon, Database, Activity, CheckCircle2, XCircle, Filter, Plus, ArrowRight } from 'lucide-react';

const ModelsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [loraFilter, setLoraFilter] = useState<string>('all');
  const [ppFilter, setPpFilter] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<typeof supportedModels[0] | null>(null);

  const filteredModels = supportedModels.filter(model => {
    // Text search
    const matchesSearch = 
      model.models.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      model.architecture.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.exampleHFModels.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Task filter
    const matchesTask = taskFilter === 'all' || taskFilter === model.taskTag;

    // LoRA filter
    const matchesLora = loraFilter === 'all' || 
      (loraFilter === 'yes' && model.loRA) || 
      (loraFilter === 'no' && !model.loRA);

    // PP filter
    const matchesPp = ppFilter === 'all' || 
      (ppFilter === 'yes' && model.pp) || 
      (ppFilter === 'no' && !model.pp);

    return matchesSearch && matchesTask && matchesLora && matchesPp;
  });

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Models</h1>
                <p className="text-gray-400">Browse and search through {supportedModels.length} supported vLLM models</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                asChild 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate("/deployments/new")}
              >
                <span>
                  <Plus className="w-4 h-4 mr-2" />
                  New Deployment
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 max-w-6xl mx-auto">
        {/* Search and Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 mb-6">
          <div className="flex flex-row gap-2">
            <div className="w-full">
              <div className="flex items-center relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by model name or architecture..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
            <Select value={loraFilter} onValueChange={setLoraFilter}>
              <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                <div className="flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-purple-400" />
                  <SelectValue placeholder="LoRA Filter" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="all">All LoRA</SelectItem>
                <SelectItem value="yes">Has LoRA</SelectItem>
                <SelectItem value="no">No LoRA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ppFilter} onValueChange={setPpFilter}>
              <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                <div className="flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-blue-400" />
                  <SelectValue placeholder="PP Filter" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="all">All PP</SelectItem>
                <SelectItem value="yes">Has PP</SelectItem>
                <SelectItem value="no">No PP</SelectItem>
              </SelectContent>
            </Select>
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                <div className="flex items-center">
                  <Filter className="w-4 h-4 mr-2 text-green-400" />
                  <SelectValue placeholder="Task Filter" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="all">All Tasks</SelectItem>
                {Array.from(new Set(supportedModels.map(model => model.taskTag))).map(task => (
                  <SelectItem key={task} value={task}>{task}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-400 mt-4">
              Found {filteredModels.length} models matching "{searchTerm}"
            </p>
          )}
        </div>
        
        {/* Model Cards */}
        {filteredModels.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
            <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Database className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-white">
              No models found
            </h3>
            <p className="text-gray-400 mb-6">
              Try adjusting your search or filters.
            </p>
            <Button 
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setTaskFilter('all');
                setLoraFilter('all');
                setPpFilter('all');
              }}
              className="bg-gray-800/50 border-gray-600 hover:bg-gray-700 text-white"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModels.map((model, index) => (
              <div
                key={index}
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer group"
                onClick={() => setSelectedModel(model)}
              >
                {/* Card Header */}
                <div className="p-6 border-b border-gray-700/50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white group-hover:text-blue-300 transition-colors">
                        {model.architecture}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-400">
                          {model.taskTag}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-6">
                  {/* Status */}
                  <div className="flex items-center space-x-4 mb-4">
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${model.loRA ? 'text-green-400 bg-green-900/20 border-green-500/30' : 'text-red-400 bg-red-900/20 border-red-500/30'}`}>
                      {model.loRA ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span className="text-sm font-medium">LoRA</span>
                    </div>
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${model.pp ? 'text-green-400 bg-green-900/20 border-green-500/30' : 'text-red-400 bg-red-900/20 border-red-500/30'}`}>
                      {model.pp ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span className="text-sm font-medium">PP</span>
                    </div>
                  </div>

                  {/* Example Models */}
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">Supported Models:</p>
                    <div className="flex flex-wrap gap-2">
                      {model.models.slice(0, 3).map((name, i) => (
                        <div key={i} className="px-3 py-1 bg-gray-700/30 rounded-lg text-xs text-gray-300">
                          {name}
                        </div>
                      ))}
                      {model.models.length > 3 && (
                        <div className="px-3 py-1 bg-gray-700/30 rounded-lg text-xs text-gray-300">
                          +{model.models.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center justify-end mt-6 pt-4 border-t border-gray-700/30">
                    <div className="flex items-center text-blue-400 text-sm group-hover:text-blue-300 transition-colors">
                      <span>View Details</span>
                      <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model Detail Dialog */}
      <Dialog open={!!selectedModel} onOpenChange={(open) => !open && setSelectedModel(null)}>
        <DialogContent className="bg-gray-800 border border-gray-700 text-white max-w-2xl">
          {selectedModel && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-white">{selectedModel.architecture}</DialogTitle>
                <DialogDescription className="flex flex-wrap gap-2 mt-2 text-gray-400">
                  <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${selectedModel.loRA ? 'text-green-400 bg-green-900/20 border-green-500/30' : 'text-red-400 bg-red-900/20 border-red-500/30'}`}>
                    {selectedModel.loRA ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span className="text-sm font-medium">LoRA</span>
                  </div>
                  <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${selectedModel.pp ? 'text-green-400 bg-green-900/20 border-green-500/30' : 'text-red-400 bg-red-900/20 border-red-500/30'}`}>
                    {selectedModel.pp ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span className="text-sm font-medium">PP</span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-purple-600/20 rounded-lg border border-purple-500/30 text-purple-400">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-medium">{selectedModel.taskTag}</span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 my-3">
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-white">Supported Models</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedModel.models.map((name, i) => (
                      <div key={i} className="px-3 py-2 bg-gray-700/30 rounded-lg text-sm text-gray-300">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-white">Example HuggingFace Models</h3>
                  <div className="space-y-2">
                    {selectedModel.exampleHFModels.map((name, i) => (
                      <Button 
                        key={i} 
                        variant="outline" 
                        className="w-full justify-between h-auto py-2 px-3 whitespace-normal text-left font-mono text-sm break-all bg-gray-700/30 border-gray-600 hover:bg-gray-600/30 text-gray-300"
                        onClick={() => {
                          navigate(`/deployments/new?model=${encodeURIComponent(name)}`);
                        }}
                      >
                        {name}
                        <Plus className="w-4 h-4 ml-2 text-blue-400" />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t border-gray-700">
                <Button 
                  onClick={() => {
                    if (selectedModel.exampleHFModels.length > 0) {
                      navigate(`/deployments/new?model=${encodeURIComponent(selectedModel.exampleHFModels[0])}`);
                    } else {
                      navigate(`/deployments/new`);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Deploy This Model
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModelsPage;