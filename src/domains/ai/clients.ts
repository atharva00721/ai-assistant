import { createOpenAI } from "@ai-sdk/openai";

const apiKey = Bun.env.ANANNAS_API_KEY;
const baseURL = Bun.env.OPENAI_BASE_URL;
const hasAIConfig = Boolean(apiKey && baseURL);

export const openai = hasAIConfig
  ? createOpenAI({
      baseURL: baseURL as string,
      apiKey: apiKey as string,
    })
  : null;

export const textModel = openai?.chat("glm-4.5v");
export const visionModel = textModel;

const perplexityApiKey = Bun.env.PERPLEXITY_API_KEY;
const perplexity = perplexityApiKey
  ? createOpenAI({
      baseURL: "https://api.perplexity.ai",
      apiKey: perplexityApiKey,
    })
  : null;

export const searchModel = perplexity?.chat("sonar-pro");
export const hasSearch = Boolean(searchModel);
export const hasTextModel = Boolean(textModel);
