import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptContact,
  hasIdentityParams,
  parseLinkIdentity,
  sanitizeRespondent,
  stripIdentityParams,
} from "./link-identity.ts";

const full =
  "?email=ada%40example.com&firstname=Ada&lastname=Lovelace&company=Analytical%20Engines&website=https%3A%2F%2Fanalytical.example&_hsenc=abc+def%2Fghi%3D&utm_source=hs_email";

test("full HubSpot link skips the form and keeps tracking params verbatim", () => {
  const identity = parseLinkIdentity(full);
  assert.deepEqual(identity, {
    email: "ada@example.com",
    firstname: "Ada",
    lastname: "Lovelace",
    company: "Analytical Engines",
    website: "https://analytical.example",
  });
  assert.equal(stripIdentityParams(full), "?_hsenc=abc+def%2Fghi%3D&utm_source=hs_email");
});

test("email only is enough", () => {
  assert.equal(parseLinkIdentity("?email=ada%40example.com")?.email, "ada@example.com");
  assert.equal(parseLinkIdentity("?email=ada%40example.com")?.firstname, null);
  assert.equal(stripIdentityParams("?email=ada%40example.com"), "");
});

test("unencoded and encoded plus stay plus, a real space does not", () => {
  assert.equal(parseLinkIdentity("?email=ada+tag@example.com")?.email, "ada+tag@example.com");
  assert.equal(parseLinkIdentity("?email=ada%2Btag%40example.com")?.email, "ada+tag@example.com");
  assert.equal(parseLinkIdentity("?email=ada%20tag@example.com"), null);
  assert.equal(parseLinkIdentity("?email=ada tag@example.com"), null);
});

test("missing, blank, token, and junk emails fall back", () => {
  assert.equal(parseLinkIdentity(""), null);
  assert.equal(parseLinkIdentity("?firstname=Ada"), null);
  assert.equal(parseLinkIdentity("?email="), null);
  assert.equal(parseLinkIdentity("?email={{contact.email}}"), null);
  assert.equal(parseLinkIdentity("?email={{contact.email}}@example.com"), null);
  assert.equal(parseLinkIdentity("?email=not-an-email"), null);
  assert.equal(parseLinkIdentity("?email=user@localhost"), null);
  assert.equal(parseLinkIdentity("?utm_source=hs_email"), null);
  assert.equal(hasIdentityParams("?email={{contact.email}}&_hsenc=abc+def"), true);
  assert.equal(stripIdentityParams("?email={{contact.email}}&_hsenc=abc+def"), "?_hsenc=abc+def");
  assert.equal(hasIdentityParams("?utm_source=hs_email"), false);
});

test("unsafe optional fields are dropped and the email still skips the form", () => {
  const identity = parseLinkIdentity(
    "?email=ada@example.com&firstname=%3Cscript%3E&company=AT%26T&website=javascript:alert(1)&lastname=Lovelace",
  );
  assert.equal(identity?.email, "ada@example.com");
  assert.equal(identity?.firstname, null);
  assert.equal(identity?.lastname, "Lovelace");
  assert.equal(identity?.company, "AT&T");
  assert.equal(identity?.website, null);
});

test("link websites must be public http(s)", () => {
  assert.equal(parseLinkIdentity("?email=ada@example.com&website=www.example.com")?.website, "https://www.example.com");
  assert.equal(parseLinkIdentity("?email=ada@example.com&website=http://example.com/path")?.website, "http://example.com/path");
  assert.equal(parseLinkIdentity("?email=ada@example.com&website=https://user:pass@example.com")?.website, null);
  assert.equal(parseLinkIdentity("?email=ada@example.com&website=http://127.0.0.1")?.website, null);
  assert.equal(parseLinkIdentity("?email=ada@example.com&website=http://169.254.169.254/latest")?.website, null);
  assert.equal(parseLinkIdentity("?email=ada@example.com&website=n/a")?.website, null);
});

test("the first email wins and other keys are not treated as email", () => {
  assert.equal(
    parseLinkIdentity("?email=ada@example.com&email=other@example.com")?.email,
    "ada@example.com",
  );
  assert.equal(parseLinkIdentity("?email_address=ada@example.com"), null);
  assert.equal(stripIdentityParams("?email_address=ada@example.com&utm=1"), "?email_address=ada@example.com&utm=1");
});

test("a malformed email still strips, and a huge query is ignored", () => {
  assert.equal(parseLinkIdentity("?email=%ZZ"), null);
  assert.equal(hasIdentityParams("?email=%ZZ&utm=1"), true);
  assert.equal(stripIdentityParams("?email=%ZZ&utm=1"), "?utm=1");
  const huge = `?email=ada@example.com&utm=${"x".repeat(20_000)}`;
  assert.equal(parseLinkIdentity(huge), null);
  assert.equal(hasIdentityParams(huge), false);
});

test("stored submissions keep form values and drop broken emails and script urls", () => {
  assert.deepEqual(
    sanitizeRespondent({
      email: " Ada@Example.com ",
      firstname: "Ada",
      lastname: "Lovelace",
      company: "Analytical Engines",
      website: "n/a",
      name: "Ada Lovelace",
    }),
    {
      email: "ada@example.com",
      firstname: "Ada",
      lastname: "Lovelace",
      company: "Analytical Engines",
      website: "n/a",
      name: "Ada Lovelace",
    },
  );
  assert.equal(sanitizeRespondent({ email: "not an email", name: "Ada" }).email, null);
  assert.equal(sanitizeRespondent({ email: "not an email", name: "Ada" }).name, null);
  assert.equal(sanitizeRespondent({ email: "", name: "Ada" }).name, "Ada");
  assert.equal(sanitizeRespondent({ email: "ada@example.com", website: "javascript:alert(1)" }).website, null);
  assert.equal(acceptContact({ email: "ada@example.com" })?.email, "ada@example.com");
  assert.equal(acceptContact({ email: "{{contact.email}}" }), null);
  assert.equal(acceptContact({ email: "user@localhost" })?.email, "user@localhost");
});
