import { askAI } from "../src/ai.js";

const message = Bun.argv.slice(2).join(" ") || "Hi";
const userId = "local-test";
const timeoutMs = Number(Bun.env.TEST_TIMEOUT_MS) || 15000;

const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(new Error(`Timeout after ${timeoutMs}ms`));
  }, timeoutMs);
});

try {
  const result = await Promise.race([askAI(message, userId), timeoutPromise]);
  console.log(result);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
