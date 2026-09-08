import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  brand: jsonb("brand").$type<Record<string, unknown>>().notNull().default({}),
  reviewLinks: jsonb("review_links").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  theme: text("theme").notNull().default("dark"),
  locale: text("locale").notNull().default("en"),
  notifyReviews: boolean("notify_reviews").notNull().default(true),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
});

export const clientMembers = pgTable(
  "client_members",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clientId] })],
);

export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    publicId: text("public_id").notNull().unique(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    cadence: text("cadence"),
    status: text("status").notNull().default("Draft"),
    intro: text("intro"),
    outro: text("outro"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull().default({}),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("surveys_client_slug_idx").on(t.clientId, t.slug),
    index("surveys_client_idx").on(t.clientId),
  ],
);

export const surveyPublications = pgTable(
  "survey_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    publishedBy: uuid("published_by"),
  },
  (t) => [uniqueIndex("survey_publications_survey_version_idx").on(t.surveyId, t.version)],
);

export const respondents = pgTable(
  "respondents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    hubspotContactId: text("hubspot_contact_id"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("respondents_client_email_idx").on(t.clientId, t.email),
    index("respondents_client_idx").on(t.clientId),
  ],
);

export const responses = pgTable(
  "responses",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    publicationId: uuid("publication_id").references(() => surveyPublications.id),
    respondentId: uuid("respondent_id").references(() => respondents.id),
    clientResponseId: text("client_response_id").notNull(),
    source: text("source").notNull().default("share"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer("duration_ms"),
    country: text("country"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    reviewAsked: boolean("review_asked").notNull().default(false),
    reviewOutcome: text("review_outcome").notNull().default("not_asked"),
    quote: jsonb("quote").$type<Record<string, unknown>>().notNull().default({}),
    hubspotStatus: text("hubspot_status").notNull().default("skipped"),
    hubspotWrittenAt: timestamp("hubspot_written_at", { withTimezone: true }),
    hubspotError: text("hubspot_error"),
    record: jsonb("record").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    uniqueIndex("responses_survey_client_response_idx").on(t.surveyId, t.clientResponseId),
    index("responses_survey_idx").on(t.surveyId),
    index("responses_client_idx").on(t.clientId),
    index("responses_hubspot_status_idx").on(t.hubspotStatus),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    responseId: text("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    questionKey: text("question_key").notNull(),
    questionText: text("question_text"),
    type: text("type").notNull(),
    nps: boolean("nps").notNull().default(false),
    valueText: text("value_text"),
    valueNumber: integer("value_number"),
    valueList: jsonb("value_list").$type<string[] | null>(),
    skipped: boolean("skipped").notNull().default(false),
  },
  (t) => [
    index("answers_survey_question_idx").on(t.surveyId, t.questionKey),
    index("answers_response_idx").on(t.responseId),
  ],
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    targetStat: text("target_stat"),
    status: text("status").notNull().default("pending"),
    gaps: jsonb("gaps").$type<unknown[]>().notNull().default([]),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scans_client_idx").on(t.clientId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_client_idx").on(t.clientId)],
);

export const notificationReads = pgTable(
  "notification_reads",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] })],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("user_sessions_user_idx").on(t.userId)],
);

export const userPasskeys = pgTable("user_passkeys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Passkey"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hubspotConnections = pgTable("hubspot_connections", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  portalId: text("portal_id"),
  portalName: text("portal_name"),
  refreshTokenEnc: text("refresh_token_enc"),
  accessTokenEnc: text("access_token_enc"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  surveyObjectTypeId: text("survey_object_type_id"),
  status: text("status").notNull().default("disconnected"),
  connectedBy: uuid("connected_by"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
});
