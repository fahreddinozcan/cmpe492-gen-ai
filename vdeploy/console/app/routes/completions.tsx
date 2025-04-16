import { useState } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";

interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    text: string;
    logprobs: null;
    finish_reason: string;
    stop_reason: null;
    prompt_logprobs: null;
  }[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
    completion_tokens: number;
    prompt_tokens_details: null;
  };
}

export default function Completions() {
  const [prompt, setPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState("100");
  const [model, setModel] = useState("google/gemma-1.1-2b-it");
  const [response, setResponse] = useState<CompletionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    try {
      // Mock response for now
      const mockResponse: CompletionResponse = {
        "id": "cmpl-" + Math.random().toString(36).substring(2, 15),
        "object": "text_completion",
        "created": Math.floor(Date.now() / 1000),
        "model": model,
        "choices": [{
          "index": 0,
          "text": " and its impact on humanity.\n\nArtificial Intelligence\n\nIn circuits bright, where thoughts take flight,\nA mind conceived, a brilliant light.\nAI emerges, with power untold,\nBlending knowledge, shaping worlds of gold.\n\nIts algorithms dance, a guided hand,\nOptimizing systems, transcending land.\nPredictive analytics, a clear view,\nPredicting futures, easing human grief.\n\nYet, with this progress, shadows lie,\nA potentiality that makes",
          "logprobs": null,
          "finish_reason": "length",
          "stop_reason": null,
          "prompt_logprobs": null
        }],
        "usage": {
          "prompt_tokens": 6,
          "total_tokens": 106,
          "completion_tokens": 100,
          "prompt_tokens_details": null
        }
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setResponse(mockResponse);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Completions</h1>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={model}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModel(e.target.value)}
            placeholder="Enter model name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here"
            className="min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxTokens">Max Tokens</Label>
          <Input
            id="maxTokens"
            type="number"
            value={maxTokens}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxTokens(e.target.value)}
            placeholder="Enter max tokens"
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={loading} 
          className="w-full"
        >
          {loading ? "Generating..." : "Generate"}
        </Button>
      </div>

      {response && (
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold">Response</h3>
            <pre className="mt-2 whitespace-pre-wrap bg-muted p-4 rounded-lg">
              {response.choices[0].text}
            </pre>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>Model: {response.model}</p>
            <p>Tokens: {response.usage.completion_tokens} / {response.usage.total_tokens}</p>
            <p>ID: {response.id}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
