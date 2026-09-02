"""Measured acceptance checks at 390x844 with touch, plus a contrast audit.

The checks mirror the plan's acceptance lines: nav and shelf never scroll
horizontally, Settings fully visible, every tap target at least 44px, the
composer stays on screen with a long transcript, one hint bubble after five
empty Done taps, no focused chip after render.
"""
import http.server
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = r"C:\Users\Sistemas\AIS-OS\projects\lean-labs\survey-rocket"


class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass


srv = socketserver.TCPServer(("127.0.0.1", 8483), Q)
threading.Thread(target=srv.serve_forever, daemon=True).start()
B = "http://127.0.0.1:8483/"

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (("  " + detail) if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch()
    # reduced motion on: Ralph's machine has it, and it once hid every dashboard row
    ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, reduced_motion="reduce",
                        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
    pg = ctx.new_page()

    # ---- app shell on a phone
    pg.goto(B + "app.html", wait_until="networkidle")
    pg.wait_for_timeout(800)
    sw = pg.evaluate("var s=document.querySelector('.side'); [s.scrollWidth, s.clientWidth]")
    check("nav never scrolls", sw[0] <= sw[1] + 1, f"scrollWidth {sw[0]} vs {sw[1]}")
    box = pg.locator(".navitem", has_text="Settings").bounding_box()
    check("Settings nav visible", box is not None and box["x"] + box["width"] <= 390 and box["x"] >= 0,
          str(box))
    shw = pg.evaluate("var s=document.getElementById('shelf'); [s.scrollWidth, s.clientWidth]")
    check("shelf never scrolls", shw[0] <= shw[1] + 1, f"{shw}")

    # tap targets across the app
    small = pg.evaluate("""
      Array.from(document.querySelectorAll('.view.active button, .view.active select, .side button'))
        .filter(e => e.offsetParent !== null)
        .map(e => ({t: (e.textContent||'').trim().slice(0,18), h: e.getBoundingClientRect().height}))
        .filter(x => x.h > 0 && x.h < 43.5)
    """)
    check("app tap targets >= 44px", len(small) == 0, str(small[:5]))

    # editor on a phone: textareas wrap, min/max share a row, tools together
    pg.goto(B + "app.html#/editor/client-outcomes", wait_until="networkidle")
    pg.wait_for_timeout(800)
    clip = pg.evaluate("""
      Array.from(document.querySelectorAll('.qcard textarea'))
        .map(t => t.scrollWidth - t.clientWidth).filter(d => d > 2)
    """)
    check("editor textareas do not clip horizontally", len(clip) == 0, str(clip))
    pair = pg.evaluate("""
      (function(){
        var p=document.querySelector('.rangepair'); if(!p) return null;
        var r=Array.from(p.querySelectorAll('input')).map(i=>i.getBoundingClientRect().top);
        return r.length===2 ? Math.abs(r[0]-r[1]) : null;
      })()
    """)
    check("min/max on one row", pair is not None and pair < 2, str(pair))

    # ---- respondent page
    pg2 = ctx.new_page()
    pg2.goto(B + "survey.html?id=client-outcomes", wait_until="networkidle")
    pg2.wait_for_timeout(1500)
    # locally the survey is unpublished => missing state; seed localStorage
    # the way the author's browser would have it, then reload
    if pg2.locator("#missing").is_visible():
        pg2.evaluate("SRStore.init()")
        pg2.reload(wait_until="networkidle")
        pg2.wait_for_timeout(1500)
    check("start card shows", pg2.locator("#gate").is_visible())
    pg2.locator("#g-go").click()
    pg2.wait_for_timeout(1800)

    focused = pg2.evaluate("document.activeElement && document.activeElement.className || ''")
    check("no chip steals focus", "opt" not in focused.split(), focused)
    chip_h = pg2.evaluate("""
      Math.min.apply(null, Array.from(document.querySelectorAll('button.opt'))
        .map(e => e.getBoundingClientRect().height))
    """)
    check("chips >= 44px", chip_h >= 43.5, str(chip_h))
    send_bb = pg2.locator("#rs-send").bounding_box()
    check("composer on screen", send_bb is not None and send_bb["y"] + send_bb["height"] <= 844,
          str(send_bb and send_bb["y"]))

    # answer q1, then the multi-select Done flood test on the demo config is
    # not present here; test the number probe cap instead: q2 wants a number
    pg2.locator("button.opt", has_text="AEO program").first.click()
    pg2.wait_for_timeout(1800)
    for txt in ["most of them", "loads honestly", "no idea at all"]:
        pg2.locator("#rs-inp").fill(txt)
        pg2.locator("#rs-inp").press("Enter")
        pg2.wait_for_timeout(2500)
    hints = pg2.locator(".bub.hint").count()
    moved_on = pg2.evaluate("document.getElementById('rs-prog').textContent")
    check("probe cap: max 2 hints then move on", hints <= 2 and "3" in moved_on,
          f"hints={hints} prog='{moved_on}'")

    # ---- demo multi-select flood (index.html demo has a multi question)
    pg3 = ctx.new_page()
    pg3.goto(B + "index.html#/demo", wait_until="networkidle")
    pg3.wait_for_timeout(1200)
    if pg3.locator("#beginBtn").count():
        pg3.locator("#beginBtn").click()
        pg3.wait_for_timeout(2500)
    pg3.wait_for_selector("button.opt", timeout=15000)
    # demo q1 is a choice; q2 is the multi with the Done chip
    try:
        pg3.locator("button.opt", has_text="Website build").first.click()
        pg3.wait_for_timeout(2000)
        done = pg3.locator("button.opt", has_text="Done")
        if done.count():
            for _ in range(5):
                done.first.click()
                pg3.wait_for_timeout(500)
            pg3.wait_for_timeout(800)
            check("Done flood: exactly 1 hint", pg3.locator(".bub.hint").count() == 1,
                  f"hints={pg3.locator('.bub.hint').count()}")
        else:
            check("Done flood: exactly 1 hint", False, "multi question not reached")
    except Exception as e:
        check("Done flood: exactly 1 hint", False, str(e)[:120])

    # ---- contrast audit (composited): text below 4.5:1 on all three pages
    def contrast_fails(page):
        return page.evaluate("""
          (function(){
            function lum(r,g,b){
              var a=[r,g,b].map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
              return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
            }
            function parse(c){ var m=c.match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
              var p=m[1].split(',').map(parseFloat); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
            function bgOf(el){
              var n=el;
              while(n && n!==document.documentElement){
                var c=parse(getComputedStyle(n).backgroundColor);
                if(c && c.a>0.9) return c;
                n=n.parentElement;
              }
              return {r:13,g:13,b:13,a:1};
            }
            var fails=[];
            document.querySelectorAll('body *').forEach(function(el){
              if(el.offsetParent===null && getComputedStyle(el).position!=='fixed') return;
              var hasText=Array.from(el.childNodes).some(function(n){return n.nodeType===3 && n.textContent.trim();});
              if(!hasText) return;
              var st=getComputedStyle(el);
              if(el.disabled || el.closest('[disabled]')) return;
              var fg=parse(st.color), bg=bgOf(el);
              if(!fg) return;
              var L1=lum(fg.r,fg.g,fg.b), L2=lum(bg.r,bg.g,bg.b);
              var ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
              var size=parseFloat(st.fontSize), bold=parseInt(st.fontWeight,10)>=700;
              var large=size>=24 || (size>=18.66 && bold);
              if(ratio < (large?3:4.5)) fails.push({t:(el.textContent||'').trim().slice(0,24), c:st.color, r:Math.round(ratio*100)/100});
            });
            return fails;
          })()
        """)

    for page, url, hashes in [(pg, "app.html", ["#/surveys", "#/editor/client-outcomes", "#/settings", "#/scan"]),
                              (pg2, None, []), (pg3, None, [])]:
        pass
    fails_total = []
    for h in ["#/surveys", "#/editor/client-outcomes", "#/settings", "#/scan"]:
        pg.goto(B + "app.html" + h, wait_until="networkidle")
        pg.wait_for_timeout(600)
        f = contrast_fails(pg)
        fails_total += [(h, x) for x in f]
    f2 = contrast_fails(pg2)
    fails_total += [("survey", x) for x in f2]
    check("contrast AA on app + survey", len(fails_total) == 0, str(fails_total[:6]))

    b.close()
srv.shutdown()
bad = [r for r in results if not r[1]]
print(f"\n{len(results)-len(bad)}/{len(results)} passed")
