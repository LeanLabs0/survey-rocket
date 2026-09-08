import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { clients, notificationReads, notifications } from "./schema";

export async function createClientNotification(input: {
  clientId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  payload?: Record<string, unknown>;
}) {
  if (!db) return null;
  const [row] = await db
    .insert(notifications)
    .values({
      clientId: input.clientId,
      type: input.type,
      title: input.title,
      body: input.body || null,
      href: input.href || null,
      payload: input.payload || {},
    })
    .returning();
  return row;
}

async function clientHref(clientId: string, surveyId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return client ? `/app/${client.slug}/results/${surveyId}` : null;
}

export async function notifyReview(input: {
  clientId: string;
  surveyId: string;
  surveyName?: string | null;
  respondentName?: string | null;
  quoteText?: string | null;
  reviewOutcome?: string | null;
}) {
  const quote = (input.quoteText || "").trim();
  const clicked = input.reviewOutcome === "clicked";
  if (!quote && !clicked) return null;
  const who = input.respondentName?.trim() || "Someone";
  const survey = input.surveyName?.trim() || "a survey";
  return createClientNotification({
    clientId: input.clientId,
    type: "review",
    title: quote ? `${who} left a review` : `${who} opened the review page`,
    body: quote || `Opened the review page after ${survey}.`,
    href: await clientHref(input.clientId, input.surveyId),
    payload: {
      surveyId: input.surveyId,
      surveyName: survey,
      quote,
      reviewOutcome: input.reviewOutcome || null,
    },
  });
}

export async function notifyResponse(input: {
  clientId: string;
  surveyId: string;
  surveyName?: string | null;
  respondentName?: string | null;
  answerCount?: number;
}) {
  const who = input.respondentName?.trim() || "Someone";
  const survey = input.surveyName?.trim() || "a survey";
  const count = input.answerCount || 0;
  return createClientNotification({
    clientId: input.clientId,
    type: "response",
    title: `${who} submitted answers`,
    body: count
      ? `${survey} · ${count} answer${count === 1 ? "" : "s"}`
      : survey,
    href: await clientHref(input.clientId, input.surveyId),
    payload: {
      surveyId: input.surveyId,
      surveyName: survey,
      answerCount: count,
    },
  });
}

export async function notifySystemUpdate(input: {
  title: string;
  body?: string | null;
  href?: string | null;
  clientId?: string;
}) {
  const rows = input.clientId
    ? [{ id: input.clientId }]
    : await db.select({ id: clients.id }).from(clients);
  const created = await Promise.all(
    rows.map((row) =>
      createClientNotification({
        clientId: row.id,
        type: "system",
        title: input.title,
        body: input.body || null,
        href: input.href || null,
        payload: { broadcast: !input.clientId },
      }),
    ),
  );
  return created.filter(Boolean);
}

export async function listNotifications(clientId: string, userId: string, notifyReviews: boolean) {
  const rows = await db
    .select({ note: notifications, read: notificationReads })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId)),
    )
    .where(eq(notifications.clientId, clientId))
    .orderBy(desc(notifications.createdAt))
    .limit(40);

  return rows
    .filter((r) => notifyReviews || r.note.type !== "review")
    .filter((r) => !r.read?.dismissedAt)
    .map((r) => ({
      id: r.note.id,
      type: r.note.type,
      title: r.note.title,
      body: r.note.body,
      href: r.note.href,
      createdAt: r.note.createdAt,
      read: Boolean(r.read),
    }));
}

export async function markNotificationsRead(userId: string, ids: string[]) {
  if (!ids.length) return;
  await db
    .insert(notificationReads)
    .values(ids.map((id) => ({ notificationId: id, userId })))
    .onConflictDoNothing();
}

export async function dismissNotifications(userId: string, ids: string[]) {
  if (!ids.length) return;
  const now = new Date();
  await db
    .insert(notificationReads)
    .values(ids.map((id) => ({ notificationId: id, userId, readAt: now, dismissedAt: now })))
    .onConflictDoUpdate({
      target: [notificationReads.notificationId, notificationReads.userId],
      set: { dismissedAt: now },
    });
}
