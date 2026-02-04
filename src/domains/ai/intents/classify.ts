import { generateText } from "ai";
import { textModel } from "../clients.js";

export type GlobalIntent =
  | "note"
  | "habit"
  | "weather"
  | "search"
  | "focus_timer"
  | "reminder"
  | "todoist"
  | "github"
  | "job_digest"
  | "chat";

/**
 * Structured routing decision from the classifier.
 * We keep "intent" as the single chosen tool, but also expose
 * confidence + whether we should ask the user a clarifying question first.
 */
export interface GlobalRoutingDecision {
  intent: GlobalIntent;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string | null;
}

const VALID_INTENTS: GlobalIntent[] = [
  "note",
  "habit",
  "weather",
  "search",
  "focus_timer",
  "reminder",
  "todoist",
  "github",
  "job_digest",
  "chat",
];

function normalizeJsonFromModel(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    // Strip ``` or ```json fences if the model added them.
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

function getGlobalClassifyPrompt(options: {
  hasTodoist: boolean;
  hasSearch: boolean;
}): string {
  const { hasTodoist, hasSearch } = options;

  const tools: string[] = [
    "note - Save or search the user's notes. Phrases: \"remember that\", \"save note\", \"note:\", \"what did I save about\", \"my notes about\", \"recall\".",
    "habit - Log or check habits. Phrases: \"log X today\", \"did I X today\", \"X streak\", \"habit\".",
    "weather - Current weather or forecast. Words: weather, temperature, forecast, rain, humidity.",
    "search - Look up something on the web (facts, news, prices, how-to). Phrases: \"search for\", \"look up\", \"google\", \"find\", \"latest news\", \"current price\". NOT the user's own notes or tasks.",
  ];

  tools.push(
    "focus_timer - COUNTDOWN from now (focus session). Phrases: \"timer 25 min\", \"focus 25 min\", \"pomodoro\", \"set a timer for X min\", \"concentrate for X\". NOT \"remind me\" — that is reminder.",
    "reminder - One-off notification at a time or \"in X\". Phrases: \"remind me to\", \"remind me in/at\", \"don't forget\", \"notify me at\", \"alert me at\".",
  );

  if (hasTodoist) {
    tools.push(
      "todoist - Manage TASK LIST: add task, list tasks, complete, delete, due dates. Phrases: \"add task\", \"add to my list\", \"my tasks\", \"mark done\", \"what's on my list\". NOT \"remind me to X\" — that is reminder.",
    );
  }

  tools.push(
    "job_digest - Morning JOB LIST (Twitter accounts to text for jobs): add/remove handles, show list, set time, enable/disable daily digest. Phrases: \"add @x to my job list\", \"morning job list\", \"send my job list at 9am\", \"who to text for jobs\", \"twitter accounts for job\".",
  );

  tools.push(
    "github - GitHub actions: create issues, comment on PRs, assign reviewers, request changes, edit code and open PRs. Phrases: \"create an issue\", \"comment on PR\", \"assign reviewers\", \"request changes\", \"edit code in repo\".",
  );

  tools.push(
    "chat - General conversation, question that doesn't need a tool, unclear, or none of the above.",
  );

  const toolList = tools.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return `You are an intent classifier. Choose exactly ONE tool (or chat) that should handle the user's message.

Tools:
${toolList}

Rules:
- Pick the BEST matching tool. If multiple could apply, choose the one the user is most clearly asking for.
- "Remind me to X" / "don't forget" → reminder. "Timer X min" / "focus X min" → focus_timer. "Add X to my tasks" → todoist.
- "Remember that X" / "save note" / "what did I save about X" → note.
- "Log X today" / "did I X today" / "X streak" → habit.
- "Weather in X" / "will it rain" → weather.
- "Search for X" / "look up X" / "latest on X" → search.
- Add/show/set morning job list, Twitter accounts to text for jobs → job_digest.
- Otherwise or unclear → chat.

Output format (MUST be valid JSON, no extra text):
{
  "intent": "note" | "habit" | "weather" | "search" | "focus_timer" | "reminder" | ${hasTodoist ? '"todoist" | ' : ""}"github" | "job_digest" | "chat",
  "confidence": number,        // between 0 and 1
  "needsClarification": boolean,
  "clarificationQuestion": string | null
}

Guidance:
- If you're reasonably sure (confidence >= 0.7), set needsClarification to false and clarificationQuestion to null.
- If the message is ambiguous between multiple tools, or you feel less than 0.7 confident, set needsClarification to true and provide ONE short, direct clarification question (plain natural language, no quotes).
- The clarification question should help you choose the right tool (e.g. "Do you want a one-time reminder or to add this to your task list?").

Reply with ONLY the JSON object. No explanation, no markdown, no code fences.

User message: `;
}

/**
 * Global classifier: AI picks which tool (or chat) handles the message,
 * and also returns confidence + whether to ask a clarification question.
 */
export async function classifyIntentDetailed(
  message: string,
  options: { hasTodoist: boolean; hasSearch: boolean },
): Promise<GlobalRoutingDecision> {
  // Safe fallback when the text model is not configured.
  if (!textModel) {
    return {
      intent: "chat",
      confidence: 0,
      needsClarification: false,
      clarificationQuestion: null,
    };
  }

  try {
    const { text } = await generateText({
      model: textModel,
      prompt: getGlobalClassifyPrompt(options) + message,
    });

    const raw = normalizeJsonFromModel(text);
    let parsed: Partial<GlobalRoutingDecision & { intent: string }> | null = null;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    if (!parsed || typeof parsed.intent !== "string") {
      // Fallback: try to interpret the model output as a plain label like before.
      const fallbackLabel = raw.trim().toLowerCase().replace(/\s+/g, " ").split(/[.,]/)[0];
      const labelIsValid = VALID_INTENTS.includes(fallbackLabel as GlobalIntent);
      const safeIntent: GlobalIntent = labelIsValid ? (fallbackLabel as GlobalIntent) : "chat";
      return {
        intent: safeIntent,
        confidence: 0.5,
        needsClarification: false,
        clarificationQuestion: null,
      };
    }

    let intent = parsed.intent.trim().toLowerCase() as GlobalIntent;
    if (!VALID_INTENTS.includes(intent)) {
      intent = "chat";
    }

    // Respect hasTodoist: if the classifier picks todoist but user has none, downgrade to chat.
    if (intent === "todoist" && !options.hasTodoist) {
      intent = "chat";
    }

    const confidenceRaw = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
    const confidence = Math.max(0, Math.min(1, confidenceRaw));
    const needsClarification =
      typeof parsed.needsClarification === "boolean" ? parsed.needsClarification : false;
    const clarificationQuestion =
      parsed.clarificationQuestion && typeof parsed.clarificationQuestion === "string"
        ? parsed.clarificationQuestion.trim() || null
        : null;

    return {
      intent,
      confidence,
      needsClarification,
      clarificationQuestion,
    };
  } catch (error) {
    console.error("Intent classifier error:", error);
    return {
      intent: "chat",
      confidence: 0,
      needsClarification: false,
      clarificationQuestion: null,
    };
  }
}

/**
 * Backwards-compatible wrapper that returns only the intent label.
 * Existing callers can keep using this while newer code can use
 * classifyIntentDetailed for more nuance.
 */
export async function classifyIntent(
  message: string,
  options: { hasTodoist: boolean; hasSearch: boolean },
): Promise<GlobalIntent> {
  const decision = await classifyIntentDetailed(message, options);
  return decision.intent;
}

/** @deprecated Use classifyIntent instead. Kept for compatibility during migration. */
export type TimeTaskIntent = "focus_timer" | "reminder" | "todoist" | "other";

/** @deprecated Use classifyIntent instead. */
export async function classifyTimeAndTaskIntent(
  message: string,
  opts: { hasTodoist: boolean },
): Promise<TimeTaskIntent> {
  const intent = await classifyIntent(message, {
    hasTodoist: opts.hasTodoist,
    hasSearch: true,
  });
  if (intent === "focus_timer" || intent === "reminder" || intent === "todoist")
    return intent;
  return "other";
}
