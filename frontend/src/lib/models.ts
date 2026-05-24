export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "deepseek",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
  },
  {
    id: "groq",
    name: "Llama 3.3 70B",
    provider: "Groq",
  },
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B",
    provider: "Groq",
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0]; // DeepSeek Chat
