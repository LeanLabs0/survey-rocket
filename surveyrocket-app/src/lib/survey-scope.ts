import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { responses, surveys } from "./schema";

export function liveSurveys(clientId?: string) {
  return clientId ? and(eq(surveys.clientId, clientId), isNull(surveys.deletedAt)) : isNull(surveys.deletedAt);
}

export function ownedLiveSurvey(clientId: string, id: string) {
  return and(eq(surveys.id, id), eq(surveys.clientId, clientId), isNull(surveys.deletedAt));
}

export function completedResponses() {
  return isNotNull(responses.completedAt);
}
