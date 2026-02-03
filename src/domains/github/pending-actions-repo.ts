import { and, eq, lt, sql, isNotNull } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { pendingActions } from "../../shared/db/schema.js";

export async function createPendingAction(params: {
  userId: string;
  type: string;
  payload: any;
  expiresAt?: Date | null;
}) {
  const [row] = await db
    .insert(pendingActions)
    .values({
      userId: params.userId,
      type: params.type,
      payload: params.payload,
      expiresAt: params.expiresAt ?? null,
    })
    .returning();
  return row ?? null;
}

export async function getPendingActionById(id: number) {
  const rows = await db.select().from(pendingActions).where(eq(pendingActions.id, id));
  return rows[0] ?? null;
}

export async function findPendingActionByTypeAndState(type: string, state: string) {
  const rows = await db
    .select()
    .from(pendingActions)
    .where(
      and(
        eq(pendingActions.type, type),
        sql`(${pendingActions.payload} ->> 'state') = ${state}`,
      ),
    );
  return rows[0] ?? null;
}

export async function deletePendingAction(id: number) {
  await db.delete(pendingActions).where(eq(pendingActions.id, id));
}

export async function deleteExpiredPendingActions(now: Date) {
  await db
    .delete(pendingActions)
    .where(and(isNotNull(pendingActions.expiresAt), lt(pendingActions.expiresAt, now)));
}
