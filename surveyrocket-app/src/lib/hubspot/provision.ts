import { eq } from "drizzle-orm";
import { db } from "../db";
import { hubspotConnections } from "../schema";
import { resolveAccessToken } from "./tokens";

export const SIGNIN_FORM_NAME = "[LL] SurveyRocket Sign in";

const FORM_FIELDS = [
  { name: "firstname", label: "First name", fieldType: "single_line_text", required: true },
  { name: "lastname", label: "Last name", fieldType: "single_line_text", required: true },
  { name: "email", label: "Email", fieldType: "email", required: true },
  { name: "company", label: "Company name", fieldType: "single_line_text", required: true },
  { name: "website", label: "Website URL", fieldType: "single_line_text", required: true },
] as const;

type FormField = (typeof FORM_FIELDS)[number];

async function hubspotFetch(
  accessToken: string,
  url: string,
  { method = "GET", body, allowNotFound = false }: { method?: string; body?: unknown; allowNotFound?: boolean } = {},
) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (allowNotFound && res.status === 404) return null;
  if (res.status === 204) return null;
  const text = await res.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const msg =
      (payload.message as string) || (payload.error as string) || text || res.statusText;
    throw new Error(`${method} ${url} → ${res.status}: ${msg}`);
  }
  return payload;
}

function buildFormField(field: FormField) {
  const base: Record<string, unknown> = {
    objectTypeId: "0-1",
    name: field.name,
    label: field.label,
    required: field.required,
    hidden: false,
    fieldType: field.fieldType,
    dependentFields: [],
  };
  if (field.fieldType === "email") {
    base.validation = {
      blockedEmailDomains: [],
      useDefaultBlockList: false,
    };
  }
  return base;
}

function buildCreateFormBody() {
  const now = new Date().toISOString();
  return {
    name: SIGNIN_FORM_NAME,
    formType: "hubspot",
    createdAt: now,
    updatedAt: now,
    archived: false,
    fieldGroups: FORM_FIELDS.map((field) => ({
      groupType: "default_group",
      richTextType: "text",
      fields: [buildFormField(field)],
    })),
    configuration: {
      language: "en",
      cloneable: true,
      editable: true,
      archivable: true,
      createNewContactForNewEmail: true,
      allowLinkToResetKnownValues: true,
      lifecycleStages: [],
      postSubmitAction: {
        type: "thank_you",
        value: "Thanks — you can continue the survey.",
      },
      prePopulateKnownValues: true,
      notifyContactOwner: false,
      notifyRecipients: [],
      recaptchaEnabled: false,
    },
    displayOptions: {
      renderRawHtml: false,
      theme: "default_style",
      submitButtonText: "Begin survey",
      style: {
        backgroundWidth: "100%",
        fontFamily: "arial, helvetica, sans-serif",
        helpTextColor: "#7C98B6",
        helpTextSize: "11px",
        labelTextColor: "#33475b",
        labelTextSize: "13px",
        legalConsentTextColor: "#33475b",
        legalConsentTextSize: "14px",
        submitAlignment: "left",
        submitColor: "#121212",
        submitFontColor: "#ffffff",
        submitSize: "14px",
      },
    },
    legalConsentOptions: {
      type: "none",
    },
  };
}

async function listForms(accessToken: string) {
  const out: { id?: string; name?: string }[] = [];
  let after: string | undefined;
  do {
    const url = new URL("https://api.hubapi.com/marketing/v3/forms/");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const page = (await hubspotFetch(accessToken, url.toString())) as {
      results?: { id?: string; name?: string }[];
      paging?: { next?: { after?: string } };
    } | null;
    out.push(...(page?.results || []));
    after = page?.paging?.next?.after;
  } while (after);
  return out;
}

export async function ensureLeadForm(accessToken: string) {
  const forms = await listForms(accessToken);
  const match = forms.find((f) => String(f.name || "").trim() === SIGNIN_FORM_NAME);
  if (match?.id) {
    return { status: "exists" as const, id: match.id, name: match.name || SIGNIN_FORM_NAME };
  }
  const created = (await hubspotFetch(accessToken, "https://api.hubapi.com/marketing/v3/forms/", {
    method: "POST",
    body: buildCreateFormBody(),
  })) as { id?: string; name?: string } | null;
  if (!created?.id) throw new Error("HubSpot did not return a form id");
  return { status: "created" as const, id: created.id, name: created.name || SIGNIN_FORM_NAME };
}

export async function saveSigninFormId(clientId: string, formId: string) {
  await db
    .update(hubspotConnections)
    .set({ signinFormId: formId })
    .where(eq(hubspotConnections.clientId, clientId));
}

export async function ensureClientSignInForm(clientId: string) {
  const access = await resolveAccessToken(clientId);
  if (!access) return null;
  const form = await ensureLeadForm(access.token);
  await saveSigninFormId(clientId, form.id);
  return {
    portalId: access.conn.portalId,
    formId: form.id,
    name: form.name,
  };
}
