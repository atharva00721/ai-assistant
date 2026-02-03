import { and, eq } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { userAutomations } from "../../shared/db/schema.js";

const MORNING_JOB_DIGEST = "morning_job_digest";

export type MorningJobDigestConfig = {
  time: string; // "09:00" HH:mm 24h
  twitterHandles: string[];
};

export async function findMorningJobDigest(userId: string) {
  const rows = await db
    .select()
    .from(userAutomations)
    .where(
      and(
        eq(userAutomations.userId, userId),
        eq(userAutomations.type, MORNING_JOB_DIGEST),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertMorningJobDigest(
  userId: string,
  config: MorningJobDigestConfig,
  enabled: boolean = true,
) {
  const existing = await findMorningJobDigest(userId);
  const now = new Date();
  if (existing) {
    const [updated] = await db
      .update(userAutomations)
      .set({
        config: config as any,
        enabled,
        updatedAt: now,
      })
      .where(eq(userAutomations.id, existing.id))
      .returning();
    return updated ?? existing;
  }
  const [inserted] = await db
    .insert(userAutomations)
    .values({
      userId,
      type: MORNING_JOB_DIGEST,
      enabled,
      config: config as any,
      updatedAt: now,
    })
    .returning();
  return inserted ?? null;
}

export async function updateMorningJobDigestLastSent(userId: string, sentAt: Date) {
  const existing = await findMorningJobDigest(userId);
  if (!existing) return;
  await db
    .update(userAutomations)
    .set({ lastSentAt: sentAt, updatedAt: new Date() })
    .where(eq(userAutomations.id, existing.id));
}

/** All enabled morning_job_digest automations (scheduler uses with user timezone to decide when to send). */
export async function getAllEnabledMorningJobDigests() {
  return db
    .select()
    .from(userAutomations)
    .where(
      and(
        eq(userAutomations.type, MORNING_JOB_DIGEST),
        eq(userAutomations.enabled, true),
      ),
    );
}
