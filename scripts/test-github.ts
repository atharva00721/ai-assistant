const token = Bun.env.GITHUB_TEST_TOKEN;
const repo = Bun.env.GITHUB_TEST_REPO;
const baseUrl = Bun.env.GITHUB_API_BASE_URL || "https://api.github.com";

if (!token) {
  console.error("GITHUB_TEST_TOKEN is required");
  process.exit(1);
}

async function request(path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${token}`,
      "user-agent": "ai-assistant-test",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  const me = await request("/user");
  console.log(`✅ Auth OK as ${me?.login || "unknown"}`);

  if (repo) {
    const [owner, name] = repo.split("/");
    if (!owner || !name) throw new Error("GITHUB_TEST_REPO must be owner/name");
    const repoInfo = await request(`/repos/${owner}/${name}`);
    console.log(`✅ Repo OK: ${repoInfo?.full_name || repo}`);
  } else {
    console.log("ℹ️  GITHUB_TEST_REPO not set; skipping repo access check.");
  }
}

main().catch((err) => {
  console.error("GitHub connection test failed:", err.message || err);
  process.exit(1);
});
