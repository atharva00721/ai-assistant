export async function fetchGithubUsername(token: string): Promise<string | null> {
  const baseUrl = Bun.env.GITHUB_API_BASE_URL || "https://api.github.com";
  const res = await fetch(`${baseUrl}/user`, {
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${token}`,
      "user-agent": "ai-assistant-bot",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.login || null;
}
