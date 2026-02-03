export function detectExplicitWebSearch(message: string): boolean {
  const lower = message.toLowerCase().trim();
  const patterns = [
    /^search\s+(?:for\s+)?/i,
    /^look\s+up\s+/i,
    /^lookup\s+/i,
    /search\s+the\s+web/i,
    /search\s+online/i,
    /google\s+/i,
    /find\s+online/i,
    /look\s+it\s+up/i,
    /search\s+for\s+/i,
  ];
  return patterns.some((re) => re.test(lower));
}

export function detectSearchIntent(message: string): boolean {
  const lower = message.toLowerCase();
  if (detectExplicitWebSearch(message)) return true;
  const timeSensitive = [
    "latest news",
    "recent news",
    "current news",
    "today's news",
    "news about",
    "latest on",
    "current events",
    "latest update",
    "current price",
    "live score",
    "right now",
  ];
  return timeSensitive.some((phrase) => lower.includes(phrase));
}

export function detectWeatherIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const weatherWords = ["weather", "temperature", "forecast", "how hot", "how cold", "will it rain", "humidity", "what's the temp"];
  return weatherWords.some((w) => lower.includes(w)) || /weather\s+(?:in|for|today)?/i.test(message);
}
