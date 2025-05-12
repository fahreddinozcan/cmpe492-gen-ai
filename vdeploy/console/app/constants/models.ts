export const supportedModels = [
    {
      architecture: "AquilaForCausalLM",
      models: ["Aquila", "Aquila2"],
      exampleHFModels: ["BAAI/Aquila-7B", "BAAI/AquilaChat-7B"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "ArcticForCausalLM",
      models: ["Arctic"],
      exampleHFModels: ["Snowflake/snowflake-arctic-base", "Snowflake/snowflake-arctic-instruct"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "BaiChuanForCausalLM",
      models: ["Baichuan2", "Baichuan"],
      exampleHFModels: ["baichuan-inc/Baichuan2-13B-Chat", "baichuan-inc/Baichuan-7B"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "BambaForCausalLM",
      models: ["Bamba"],
      exampleHFModels: ["ibm-ai-platform/Bamba-9B-fp8", "ibm-ai-platform/Bamba-9B"],
      loRA: false,
      pp: false,
      taskTag: "generation"
    },
    {
      architecture: "BloomForCausalLM",
      models: ["BLOOM", "BLOOMZ", "BLOOMChat"],
      exampleHFModels: ["bigscience/bloom", "bigscience/bloomz"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "BartForConditionalGeneration",
      models: ["BART"],
      exampleHFModels: ["facebook/bart-base", "facebook/bart-large-cnn"],
      loRA: false,
      pp: false,
      taskTag: "generation"
    },
    {
      architecture: "ChatGLMModel",
      models: ["ChatGLM"],
      exampleHFModels: ["THUDM/chatglm2-6b", "THUDM/chatglm3-6b", "ShieldLM-6B-chatglm3"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "CohereForCausalLM",
      models: ["Command-R"],
      exampleHFModels: ["CohereForAI/c4ai-command-r-v01", "CohereForAI/c4ai-command-r7b-12-2024"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "DbrxForCausalLM",
      models: ["DBRX"],
      exampleHFModels: ["databricks/dbrx-base", "databricks/dbrx-instruct"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "DeciLMForCausalLM",
      models: ["DeciLM"],
      exampleHFModels: ["nvidia/Llama-3_3-Nemotron-Super-49B-v1"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "DeepseekForCausalLM",
      models: ["DeepSeek"],
      exampleHFModels: ["deepseek-ai/deepseek-llm-67b-base", "deepseek-ai/deepseek-llm-7b-chat"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "DeepseekV2ForCausalLM",
      models: ["DeepSeek-V2"],
      exampleHFModels: ["deepseek-ai/DeepSeek-V2", "deepseek-ai/DeepSeek-V2-Chat"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "DeepseekV3ForCausalLM",
      models: ["DeepSeek-V3"],
      exampleHFModels: ["deepseek-ai/DeepSeek-V3-Base", "deepseek-ai/DeepSeek-V3"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "ExaoneForCausalLM",
      models: ["EXAONE-3"],
      exampleHFModels: ["LGAI-EXAONE/EXAONE-3.0-7.8B-Instruct"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "FalconForCausalLM",
      models: ["Falcon"],
      exampleHFModels: ["tiiuae/falcon-7b", "tiiuae/falcon-40b", "tiiuae/falcon-rw-7b"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "FalconMambaForCausalLM",
      models: ["FalconMamba"],
      exampleHFModels: ["tiiuae/falcon-mamba-7b", "tiiuae/falcon-mamba-7b-instruct"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GemmaForCausalLM",
      models: ["Gemma"],
      exampleHFModels: ["google/gemma-2b", "google/gemma-1.1-2b-it"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Gemma2ForCausalLM",
      models: ["Gemma 2"],
      exampleHFModels: ["google/gemma-2-9b", "google/gemma-2-27b"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Gemma3ForCausalLM",
      models: ["Gemma 3"],
      exampleHFModels: ["google/gemma-3-1b-it"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GlmForCausalLM",
      models: ["GLM-4"],
      exampleHFModels: ["THUDM/glm-4-9b-chat-hf"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Glm4ForCausalLM",
      models: ["GLM-4-0414"],
      exampleHFModels: ["THUDM/GLM-4-32B-0414"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GPT2LMHeadModel",
      models: ["GPT-2"],
      exampleHFModels: ["gpt2", "gpt2-xl"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GPTBigCodeForCausalLM",
      models: ["StarCoder", "SantaCoder", "WizardCoder"],
      exampleHFModels: ["bigcode/starcoder", "bigcode/gpt_bigcode-santacoder", "WizardLM/WizardCoder-15B-V1.0"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GPTJForCausalLM",
      models: ["GPT-J"],
      exampleHFModels: ["EleutherAI/gpt-j-6b", "nomic-ai/gpt4all-j"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GPTNeoXForCausalLM",
      models: ["GPT-NeoX", "Pythia", "OpenAssistant", "Dolly V2", "StableLM"],
      exampleHFModels: ["EleutherAI/gpt-neox-20b", "EleutherAI/pythia-12b", "OpenAssistant/oasst-sft-4-pythia-12b-epoch-3.5", "databricks/dolly-v2-12b", "stabilityai/stablelm-tuned-alpha-7b"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GraniteForCausalLM",
      models: ["Granite 3.0", "Granite 3.1", "PowerLM"],
      exampleHFModels: ["ibm-granite/granite-3.0-2b-base", "ibm-granite/granite-3.1-8b-instruct", "ibm/PowerLM-3b"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GraniteMoeForCausalLM",
      models: ["Granite 3.0 MoE", "PowerMoE"],
      exampleHFModels: ["ibm-granite/granite-3.0-1b-a400m-base", "ibm-granite/granite-3.0-3b-a800m-instruct", "ibm/PowerMoE-3b"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GraniteMoeHybridForCausalLM",
      models: ["Granite 4.0 MoE Hybrid"],
      exampleHFModels: ["ibm-granite/granite-4.0-tiny-preview"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GraniteMoeSharedForCausalLM",
      models: ["Granite MoE Shared"],
      exampleHFModels: ["ibm-research/moe-7b-1b-active-shared-experts"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "GritLM",
      models: ["GritLM"],
      exampleHFModels: ["parasail-ai/GritLM-7B-vllm"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Grok1ModelForCausalLM",
      models: ["Grok1"],
      exampleHFModels: ["hpcai-tech/grok-1"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "InternLMForCausalLM",
      models: ["InternLM"],
      exampleHFModels: ["internlm/internlm-7b", "internlm/internlm-chat-7b"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "InternLM2ForCausalLM",
      models: ["InternLM2"],
      exampleHFModels: ["internlm/internlm2-7b", "internlm/internlm2-chat-7b"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "InternLM3ForCausalLM",
      models: ["InternLM3"],
      exampleHFModels: ["internlm/internlm3-8b-instruct"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "JAISLMHeadModel",
      models: ["Jais"],
      exampleHFModels: ["inceptionai/jais-13b", "inceptionai/jais-13b-chat", "inceptionai/jais-30b-v3", "inceptionai/jais-30b-chat-v3"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "JambaForCausalLM",
      models: ["Jamba"],
      exampleHFModels: ["ai21labs/AI21-Jamba-1.5-Large", "ai21labs/AI21-Jamba-1.5-Mini", "ai21labs/Jamba-v0.1"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "LlamaForCausalLM",
      models: ["Llama 3.1", "Llama 3", "Llama 2", "LLaMA", "Yi"],
      exampleHFModels: ["meta-llama/Meta-Llama-3.1-405B-Instruct", "meta-llama/Meta-Llama-3.1-70B", "meta-llama/Meta-Llama-3-70B-Instruct", "meta-llama/Llama-2-70b-hf", "01-ai/Yi-34B"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "MambaForCausalLM",
      models: ["Mamba"],
      exampleHFModels: ["state-spaces/mamba-130m-hf", "state-spaces/mamba-790m-hf", "state-spaces/mamba-2.8b-hf"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "MiniCPMForCausalLM",
      models: ["MiniCPM"],
      exampleHFModels: ["openbmb/MiniCPM-2B-sft-bf16", "openbmb/MiniCPM-2B-dpo-bf16", "openbmb/MiniCPM-S-1B-sft"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "MiniCPM3ForCausalLM",
      models: ["MiniCPM3"],
      exampleHFModels: ["openbmb/MiniCPM3-4B"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "MistralForCausalLM",
      models: ["Mistral", "Mistral-Instruct"],
      exampleHFModels: ["mistralai/Mistral-7B-v0.1", "mistralai/Mistral-7B-Instruct-v0.1"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "MixtralForCausalLM",
      models: ["Mixtral-8x7B", "Mixtral-8x7B-Instruct"],
      exampleHFModels: ["mistralai/Mixtral-8x7B-v0.1", "mistralai/Mixtral-8x7B-Instruct-v0.1", "mistral-community/Mixtral-8x22B-v0.1"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "MPTForCausalLM",
      models: ["MPT", "MPT-Instruct", "MPT-Chat", "MPT-StoryWriter"],
      exampleHFModels: ["mosaicml/mpt-7b", "mosaicml/mpt-7b-storywriter", "mosaicml/mpt-30b"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "NemotronForCausalLM",
      models: ["Nemotron-3", "Nemotron-4", "Minitron"],
      exampleHFModels: ["nvidia/Minitron-8B-Base", "mgoin/Nemotron-4-340B-Base-hf-FP8"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "OLMoForCausalLM",
      models: ["OLMo"],
      exampleHFModels: ["allenai/OLMo-1B-hf", "allenai/OLMo-7B-hf"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "OLMo2ForCausalLM",
      models: ["OLMo2"],
      exampleHFModels: ["allenai/OLMo2-7B-1124"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "OLMoEForCausalLM",
      models: ["OLMoE"],
      exampleHFModels: ["allenai/OLMoE-1B-7B-0924", "allenai/OLMoE-1B-7B-0924-Instruct"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "OPTForCausalLM",
      models: ["OPT", "OPT-IML"],
      exampleHFModels: ["facebook/opt-66b", "facebook/opt-iml-max-30b"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "OrionForCausalLM",
      models: ["Orion"],
      exampleHFModels: ["OrionStarAI/Orion-14B-Base", "OrionStarAI/Orion-14B-Chat"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "PhiForCausalLM",
      models: ["Phi"],
      exampleHFModels: ["microsoft/phi-1_5", "microsoft/phi-2"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Phi3ForCausalLM",
      models: ["Phi-4", "Phi-3"],
      exampleHFModels: ["microsoft/Phi-4-mini-instruct", "microsoft/Phi-4", "microsoft/Phi-3-mini-4k-instruct", "microsoft/Phi-3-mini-128k-instruct", "microsoft/Phi-3-medium-128k-instruct"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Phi3SmallForCausalLM",
      models: ["Phi-3-Small"],
      exampleHFModels: ["microsoft/Phi-3-small-8k-instruct", "microsoft/Phi-3-small-128k-instruct"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "PhiMoEForCausalLM",
      models: ["Phi-3.5-MoE"],
      exampleHFModels: ["microsoft/Phi-3.5-MoE-instruct"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "PersimmonForCausalLM",
      models: ["Persimmon"],
      exampleHFModels: ["adept/persimmon-8b-base", "adept/persimmon-8b-chat"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Plamo2ForCausalLM",
      models: ["PLaMo2"],
      exampleHFModels: ["pfnet/plamo-2-1b", "pfnet/plamo-2-8b"],
      loRA: false,
      pp: false,
      taskTag: "generation"
    },
    {
      architecture: "QWenLMHeadModel",
      models: ["Qwen"],
      exampleHFModels: ["Qwen/Qwen-7B", "Qwen/Qwen-7B-Chat"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Qwen2ForCausalLM",
      models: ["QwQ", "Qwen2"],
      exampleHFModels: ["Qwen/QwQ-32B-Preview", "Qwen/Qwen2-7B-Instruct", "Qwen/Qwen2-7B"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Qwen2MoeForCausalLM",
      models: ["Qwen2MoE"],
      exampleHFModels: ["Qwen/Qwen1.5-MoE-A2.7B", "Qwen/Qwen1.5-MoE-A2.7B-Chat"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Qwen3ForCausalLM",
      models: ["Qwen3"],
      exampleHFModels: ["Qwen/Qwen3-8B"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Qwen3MoeForCausalLM",
      models: ["Qwen3MoE"],
      exampleHFModels: ["Qwen/Qwen3-30B-A3B"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "StableLmForCausalLM",
      models: ["StableLM"],
      exampleHFModels: ["stabilityai/stablelm-3b-4e1t", "stabilityai/stablelm-base-alpha-7b-v2"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Starcoder2ForCausalLM",
      models: ["Starcoder2"],
      exampleHFModels: ["bigcode/starcoder2-3b", "bigcode/starcoder2-7b", "bigcode/starcoder2-15b"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "SolarForCausalLM",
      models: ["Solar Pro"],
      exampleHFModels: ["upstage/solar-pro-preview-instruct"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "TeleChat2ForCausalLM",
      models: ["TeleChat2"],
      exampleHFModels: ["Tele-AI/TeleChat2-3B", "Tele-AI/TeleChat2-7B", "Tele-AI/TeleChat2-35B"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "TeleFLMForCausalLM",
      models: ["TeleFLM"],
      exampleHFModels: ["CofeAI/FLM-2-52B-Instruct-2407", "CofeAI/Tele-FLM"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "XverseForCausalLM",
      models: ["XVERSE"],
      exampleHFModels: ["xverse/XVERSE-7B-Chat", "xverse/XVERSE-13B-Chat", "xverse/XVERSE-65B-Chat"],
      loRA: true,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "MiniMaxText01ForCausalLM",
      models: ["MiniMax-Text"],
      exampleHFModels: ["MiniMaxAI/MiniMax-Text-01"],
      loRA: false,
      pp: true,
      taskTag: "generation"
    },
    {
      architecture: "Zamba2ForCausalLM",
      models: ["Zamba2"],
      exampleHFModels: ["Zyphra/Zamba2-7B-instruct", "Zyphra/Zamba2-2.7B-instruct", "Zyphra/Zamba2-1.2B-instruct"],
      loRA: false,
      pp: false,
      taskTag: "generation"
    }
  ];