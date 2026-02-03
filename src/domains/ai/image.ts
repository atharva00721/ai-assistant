import { generateText } from "ai";
import { visionModel } from "./clients.js";

export function detectImageRequest(message: string): boolean {
  const imageKeywords = [
    "generate image",
    "create image",
    "make image",
    "draw",
    "picture of",
    "show me",
    "/image",
    "visualize",
  ];
  const lowerMessage = message.toLowerCase();
  return imageKeywords.some((keyword) => lowerMessage.includes(keyword));
}

export function isSupportedImageSource(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  return imageUrl.startsWith("data:") || imageUrl.startsWith("http");
}

export async function searchImageOnWeb(params: {
  imageSource: string;
  userMessage: string;
  userId: string;
  searchWeb: (query: string) => Promise<string>;
  respondWithContext: (
    userId: string,
    userMessage: string,
    toolContent: string,
    toolType: "search",
  ) => Promise<string>;
}): Promise<string> {
  const { text: rawQuery } = await generateText({
    model: visionModel,
    system:
      "You help turn an image plus the user's question into a short web search query.\n" +
      "- Look at the image and any text on it.\n" +
      "- Infer the product/brand/name or key entities if relevant.\n" +
      "- Reply with ONLY a concise Google-style search query. No explanation, no quotes.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `User message: ${params.userMessage || "(no extra question, just the image)"}\n` +
              "Return only a short search query string that would help answer it.",
          },
          {
            type: "image",
            image: params.imageSource,
          },
        ],
      },
    ],
  });

  const cleaned = rawQuery.trim().replace(/^['\"]|['\"]$/g, "");
  const searchQuery =
    cleaned ||
    "identify and search for the main product or object in this image";

  const searchResult = await params.searchWeb(searchQuery);
  return await params.respondWithContext(
    params.userId,
    params.userMessage || searchQuery,
    searchResult,
    "search",
  );
}
