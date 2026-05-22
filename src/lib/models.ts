export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "groq",
    name: "Llama 3.3 70B",
    provider: "Groq",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    provider: "DeepSeek",
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "Cloudflare",
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "Cloudflare",
  },
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B",
    provider: "Meta",
  },
  {
    id: "qwen-2.5-7b",
    name: "Qwen 2.5 7B",
    provider: "Alibaba",
  },
  {
    id: "gemma-2-2b",
    name: "Gemma 2 2B",
    provider: "Google",
  },
  {
    id: "mistral-7b",
    name: "Mistral 7B",
    provider: "Mistral",
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];
