import { desc, eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertAuditLog,
  InsertEvidenceItem,
  InsertFormSession,
  InsertSavedProfile,
  InsertTranslationJob,
  InsertUser,
  auditLogs,
  evidenceItems,
  formSessions,
  savedProfiles,
  translationJobs,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createTranslationJob(data: InsertTranslationJob) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(translationJobs).values(data);
  return Number(result[0].insertId);
}

export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getTranslationJobsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(translationJobs)
    .where(eq(translationJobs.userId, userId))
    .orderBy(desc(translationJobs.createdAt))
    .limit(40);
}

export async function deleteTranslationJob(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(translationJobs)
    .where(and(eq(translationJobs.userId, userId), eq(translationJobs.id, id)));
}

export async function clearTranslationJobs(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(translationJobs).where(eq(translationJobs.userId, userId));
}

export async function createSavedProfile(data: InsertSavedProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(savedProfiles).values(data);
  return Number(result[0].insertId);
}

export async function getSavedProfilesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(savedProfiles)
    .where(eq(savedProfiles.userId, userId))
    .orderBy(desc(savedProfiles.updatedAt));
}

export async function deleteSavedProfile(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(savedProfiles)
    .where(and(eq(savedProfiles.userId, userId), eq(savedProfiles.id, id)));
}

export async function getTranslationById(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(translationJobs)
    .where(and(eq(translationJobs.userId, userId), eq(translationJobs.id, id)))
    .limit(1);
  return result[0];
}

export async function createFormSession(data: InsertFormSession) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(formSessions).values(data);
  return Number(result[0].insertId);
}

export async function getFormSessionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(formSessions)
    .where(eq(formSessions.userId, userId))
    .orderBy(desc(formSessions.updatedAt))
    .limit(20);
}

export async function updateFormSession(userId: number, id: number, data: Partial<InsertFormSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(formSessions)
    .set(data)
    .where(and(eq(formSessions.userId, userId), eq(formSessions.id, id)));
}

export async function deleteFormSession(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(formSessions).where(and(eq(formSessions.userId, userId), eq(formSessions.id, id)));
}

export async function createEvidenceItem(data: InsertEvidenceItem) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(evidenceItems).values(data);
  return Number(result[0].insertId);
}

export async function getEvidenceItemsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.userId, userId))
    .orderBy(desc(evidenceItems.eventDate), desc(evidenceItems.createdAt))
    .limit(250);
}

export async function updateEvidenceItem(userId: number, id: number, data: Partial<InsertEvidenceItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(evidenceItems)
    .set(data)
    .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, id)));
}

export async function deleteEvidenceItem(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(evidenceItems).where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, id)));
}

/** Removes all account-owned Bridge records. Files become unreachable when their stored key is removed. */
export async function deleteAllBridgeData(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(auditLogs).where(eq(auditLogs.userId, userId));
  await db.delete(translationJobs).where(eq(translationJobs.userId, userId));
  await db.delete(savedProfiles).where(eq(savedProfiles.userId, userId));
  await db.delete(formSessions).where(eq(formSessions.userId, userId));
  await db.delete(evidenceItems).where(eq(evidenceItems.userId, userId));
}
