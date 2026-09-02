"""Live acceptance against the deployed product.

Context A: a fresh phone answers survey.html?id= served from the SERVER
(no localStorage anywhere), sees results + review, dismisses.
Context B: a fresh desktop connects the admin key through the inline gate
in Results and reads the answer back, saves the editor and watches the
publish toast, checks the onboarding layers and the scan gate.
"""
import re
import sys

from playwright.sync_api import sync_playwright

ADMIN = sys.argv[1]
B = "https://leanlabs0.github.io/survey-rocket/"
SHOTS = sys.argv[2]

results = []


def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS " if ok else "FAIL ") + name + (("  " + str(detail)[:110]) if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- context A: respondent on a phone, nothing local
    a = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True)
    pg = a.new_page()
    pg.goto(B + "survey.html?id=client-outcomes", wait_until="networkidle")
    pg.wait_for_timeout(2500)
    check("survey served from server", pg.locator("#gate").is_visible())
    check("start card names the survey", "Client outcomes" in pg.locator("#g-title").inner_text())
    check("meta spelled out", "Five quick questions" in pg.locator("#g-meta").inner_text(),
          pg.locator("#g-meta").inner_text())
    pg.screenshot(path=SHOTS + "/live-start-card.png")
    pg.locator("#g-go").click()
    pg.wait_for_timeout(2000)

    def tap(label):
        pg.locator("button.opt", has_text=re.compile("^" + re.escape(label) + "$")).first.click()
        pg.wait_for_timeout(1600)

    def say(text, wait=9000):
        pg.wait_for_function("() => !document.getElementById('rs-inp').disabled", timeout=25000)
        pg.locator("#rs-inp").fill(text)
        pg.locator("#rs-inp").press("Enter")
        pg.wait_for_timeout(wait)

    tap("AEO program")
    say("about sixty a month")
    tap("26 to 75% up")
    say("skip", 5000)
    tap("9")
    pg.wait_for_timeout(4000)
    check("results block", pg.locator("#afterResults").is_visible())
    check("review ask copy", "Thanks for your answers. Would you be open" in pg.inner_text("body"))
    check("review button label", pg.locator("#reviewBtns a").first.inner_text() == "Leave a review")
    pg.screenshot(path=SHOTS + "/live-ending.png", full_page=True)
    pg.get_by_role("button", name="Maybe later").click()
    pg.wait_for_timeout(2500)
    check("respondent stored nothing", pg.evaluate(
        "Object.keys(localStorage).filter(k=>k.indexOf('sr:surveys')===0||k.indexOf('sr:responses')===0).length") == 0)
    a.close()

    # ---------- context B: the client on desktop, fresh browser
    c = b.new_context(viewport={"width": 1280, "height": 900})
    pg2 = c.new_page()
    errors = []
    pg2.on("pageerror", lambda e: errors.append(str(e)))

    # onboarding on first load
    pg2.goto(B + "app.html", wait_until="networkidle")
    pg2.wait_for_timeout(1200)
    check("first-run panel", pg2.locator(".firstrun").is_visible())
    check("driver.js from cdnjs", pg2.evaluate("!!(window.driver && window.driver.js)"))
    pg2.screenshot(path=SHOTS + "/live-firstrun.png")

    # Results: locked -> connect through the inline gate
    pg2.goto(B + "app.html#/results", wait_until="networkidle")
    pg2.wait_for_timeout(1800)
    check("connect gate in Results", pg2.locator(".gatebox").is_visible())
    pg2.screenshot(path=SHOTS + "/live-gate.png")
    pg2.locator(".gateinp").fill(ADMIN)
    pg2.locator(".gatebox .btn.primary").click()
    pg2.wait_for_timeout(3500)
    rows = pg2.locator("table.raw tbody tr.rrow")
    check("results unlocked with rows", rows.count() > 0, f"rows={rows.count()}")
    body = pg2.inner_text("body")
    check("review outcome humanized", ("Passed" in body) or ("Not asked" in body))
    check("no raw enums", "not_asked" not in body and "dismissed" not in body)
    check("tiles render", pg2.locator(".tile").count() >= 2)
    pg2.screenshot(path=SHOTS + "/live-results.png", full_page=True)

    # editor: Save publishes
    pg2.goto(B + "app.html#/editor/client-outcomes", wait_until="networkidle")
    pg2.wait_for_timeout(1200)
    pg2.locator("#saveBtn").click()
    pg2.wait_for_timeout(3500)
    toast = pg2.locator("#toast").inner_text()
    check("save publishes", "link now serves this version" in toast, toast)

    # scan screen: no fake labels, gate-free with key present
    pg2.goto(B + "app.html#/scan", wait_until="networkidle")
    pg2.wait_for_timeout(800)
    sbody = pg2.inner_text("#v-scan")
    check("scan is one screen, no preview label", "preview of a later phase" not in sbody.lower())
    check("optional stat field", "(optional)" in sbody)
    check("no vendor prefill", pg2.locator("#scan-url").input_value() == ""
          or "lean-labs.com" not in pg2.locator("#scan-url").input_value())

    # tour on the deployed page: step 1 opens
    pg2.goto(B + "app.html#/surveys", wait_until="networkidle")
    pg2.wait_for_timeout(800)
    if pg2.locator(".fr-foot .btn", has_text="Take the tour").count():
        pg2.locator(".fr-foot .btn", has_text="Take the tour").click()
        pg2.wait_for_timeout(1200)
        check("tour opens", pg2.locator(".driver-popover").is_visible())
        prog = pg2.locator(".driver-popover-progress-text")
        check("tour progress", prog.count() > 0 and "of 5" in prog.inner_text())
        pg2.screenshot(path=SHOTS + "/live-tour.png")
        pg2.keyboard.press("Escape")
    else:
        check("tour opens", False, "panel missing")

    check("no page errors", len(errors) == 0, errors[:2])
    c.close()
    b.close()

bad = [n for n, ok in results if not ok]
print(f"\n{len(results)-len(bad)}/{len(results)} passed" + (("  FAILED: " + ", ".join(bad)) if bad else ""))
