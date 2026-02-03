import { generateText } from "ai";
import { textModel } from "../clients.js";

/**
 * Single global intent: which tool (or chat) should handle this message.
 * The AI chooses one; we then run only that tool's detector and handler.
 */
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

Reply with ONLY one word: note, habit, weather, search, focus_timer, reminder, ${hasTodoist ? "todoist, " : ""}github, job_digest, or chat. No explanation.

User message: `;
}

/**
 * Global classifier: AI picks which tool (or chat) handles the message.
 * Run once per message; then we only invoke that tool's detector.
 */
export async function classifyIntent(
  message: string,
  options: { hasTodoist: boolean; hasSearch: boolean },
): Promise<GlobalIntent> {
  if (!textModel) return "chat";
  try {
    const { text } = await generateText({
      model: textModel,
      prompt: getGlobalClassifyPrompt(options) + message,
    });
    const label = text.trim().toLowerCase().replace(/\s+/g, " ").split(/[.,]/)[0];
  const valid: GlobalIntent[] = [
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
    if (valid.includes(label as GlobalIntent)) {
      if (label === "todoist" && !options.hasTodoist) return "chat";
      return label as GlobalIntent;
    }
    return "chat";
  } catch (error) {
    console.error("Intent classifier error:", error);
    return "chat";
  }
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
