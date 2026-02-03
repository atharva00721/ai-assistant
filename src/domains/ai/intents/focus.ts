export interface FocusIntent {
  message: string;
  durationMinutes: number;
}

export function detectFocusIntent(message: string): FocusIntent | null {
  const lower = message.toLowerCase();
  if (!/\b(?:focus|pomodoro|timer|concentrate|deep work)\b/i.test(lower)) return null;
  const minMatch = message.match(/(\d+)\s*min(?:ute)?s?/i) || message.match(/(\d+)\s*m\b/i);
  const duration = minMatch?.[1] ? Math.min(120, Math.max(1, parseInt(minMatch[1], 10))) : 25;
  return { message: "Focus session done – great job!", durationMinutes: duration };
}
