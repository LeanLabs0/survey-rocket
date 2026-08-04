/* SurveyChat: the Survey Rocket chat engine.
   Config-driven, asks only the questions it is given.
   Question types: choice (options, nps flag), multi, number (min/max, validated), text (optional, skip exits).
   Optional closing quote flow with sentiment gate (negative answers stay private, no permission ask). */
(function (global) {
  "use strict";

  var VAGUE = ["most", "many", "a lot", "lots", "some", "few", "several", "majority", "all", "tons", "plenty", "idk", "dunno", "not sure", "no idea"];
  var NEG_RX = [/\bnot recommend\b/, /\bnever recommend\b/, /\bwouldn'?t recommend\b/, /\bwould not recommend\b/, /\bterrible\b/, /\bawful\b/, /\bworst\b/, /\ba mess\b/, /\bwaste\b/, /\bdisappoint/, /\bhate\b/, /\buseless\b/, /\bconfusing\b/, /\bregret\b/, /\bdon'?t like\b/, /\bdo not like\b/, /\bfrustrat/, /\bbroken\b/, /\bnever (use|again)\b/, /\bbad experience\b/];
  var WORDNUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000 };

  var QUOTE_Q = "Last one. What would you say to someone in a role like yours who is considering this? Optional, type skip to finish.";
  var QUOTE_PERM = "Mind if we use that as a quote on our website?";
  var QUOTE_ATTR = "Thanks. What is your name, your role, and how long you have worked with us?";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function whole(n) { return (n % 1 !== 0) ? { decimal: true } : { ok: true, n: n }; }

  function parseNumber(raw) {
    var s = raw.toLowerCase().replace(/,/g, "").replace(/\b(about|around|roughly|approx\.?|maybe|like)\b/g, "").replace(/~/g, "").trim();
    var m;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*k$/))) return whole(parseFloat(m[1]) * 1000);
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(m|million)$/))) return whole(parseFloat(m[1]) * 1000000);
    if (/^-?\d+(\.\d+)?$/.test(s)) return whole(parseFloat(s));
    var parts = s.split(/\s+/);
    if (parts.length === 2 && WORDNUM.hasOwnProperty(parts[0]) && (parts[1] === "hundred" || parts[1] === "thousand"))
      return whole(WORDNUM[parts[0]] * (parts[1] === "hundred" ? 100 : 1000));
    if (parts.length === 1 && WORDNUM.hasOwnProperty(s)) return whole(WORDNUM[s]);
    if ((m = s.match(/(^|\s)(-?\d+(\.\d+)?)($|\s)/))) return whole(parseFloat(m[2]));
    for (var i = 0; i < VAGUE.length; i++) { if (new RegExp("\\b" + VAGUE[i] + "\\b").test(s)) return { vague: true }; }
    return { none: true };
  }
  function isNegative(text) {
    var s = text.toLowerCase();
    for (var i = 0; i < NEG_RX.length; i++) { if (NEG_RX[i].test(s)) return true; }
    return false;
  }

  /* opts: {log, input, sendBtn, progEl, script, quoteAsk, intro, quoteCopy?, onAnswer?, onComplete?} */
  function SurveyChat(opts) {
    this.o = opts;
    this.quoteCopy = opts.quoteCopy || { q: QUOTE_Q, perm: QUOTE_PERM, attr: QUOTE_ATTR };
    this.gen = 0;
    this._wire();
  }

  SurveyChat.prototype._wire = function () {
    var self = this;
    if (this._wired) return;
    this._wired = true;
    this.o.sendBtn.addEventListener("click", function () { self._handle(); });
    this.o.input.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      if (e.key === "Enter") self._handle();
    });
  };

  SurveyChat.prototype.start = function () {
    var self = this;
    this.gen++;
    this.nagPending = false;
    this.state = 0;
    this.phase = null;
    this.multi = [];
    this.answers = {};
    this.quotePending = !!this.o.quoteAsk;
    this.done = false;
    this.o.log.innerHTML = "";
    this._input(false);
    this._prog();
    if (!this.o.script.length) {
      this._bot("This survey has no questions yet.");
      return;
    }
    this._bot(this.o.intro || ("Hi. Thanks for making time. " + this.o.script.length + " quick questions" + (this.quotePending ? ", plus an optional quote at the end" : "") + ". Most answers are one tap."), function () { self._ask(); });
  };

  SurveyChat.prototype._bot = function (text, cb) {
    var self = this, g = this.gen;
    var t = el("div", "typing"); t.appendChild(el("i")); t.appendChild(el("i")); t.appendChild(el("i"));
    this.o.log.appendChild(t); this._scroll();
    setTimeout(function () {
      t.remove();
      if (g !== self.gen) return;
      self.o.log.appendChild(el("div", "bub bot", text));
      self._scroll();
      if (cb) cb();
    }, 420);
  };
  SurveyChat.prototype._nag = function (text) {
    var self = this;
    if (this.nagPending) return;
    this.nagPending = true;
    this._bot(text, function () { self.nagPending = false; });
  };
  SurveyChat.prototype._me = function (text) {
    this.o.log.appendChild(el("div", "bub me", text)); this._scroll();
  };
  SurveyChat.prototype._scroll = function () { this.o.log.scrollTop = this.o.log.scrollHeight; };
  SurveyChat.prototype._input = function (enabled, ph) {
    this.o.input.disabled = !enabled;
    this.o.sendBtn.disabled = !enabled;
    this.o.input.placeholder = ph || "Tap an option above";
    if (enabled) { this.o.input.value = ""; this.o.input.focus(); }
  };
  SurveyChat.prototype._chips = function (options, onPick, chipOpts) {
    chipOpts = chipOpts || {};
    var g = this.gen, self = this;
    var box = el("div", "opts" + (chipOpts.nps ? " nps" : ""));
    options.forEach(function (o) {
      var b = el("button", "opt" + (o.cls ? " " + o.cls : ""), o.text);
      b.addEventListener("click", function () { if (g !== self.gen) return; onPick(o, b, box); });
      box.appendChild(b);
    });
    this.o.log.appendChild(box); this._scroll();
    var f = box.querySelector(".opt"); if (f) f.focus();
    return box;
  };
  SurveyChat.prototype._lock = function (box, picked) {
    box.classList.add("locked");
    box.querySelectorAll(".opt").forEach(function (b) { b.disabled = true; });
    (picked || []).forEach(function (b) { b.classList.add("picked"); });
  };
  SurveyChat.prototype._prog = function () {
    if (!this.o.progEl) return;
    if (this.done) { this.o.progEl.textContent = "Done"; return; }
    this.o.progEl.textContent = this.state < this.o.script.length
      ? ("Question " + (this.state + 1) + " of " + this.o.script.length)
      : (this.quotePending ? "Wrapping up" : "Done");
  };
  SurveyChat.prototype._record = function (id, value) {
    this.answers[id] = value;
    if (this.o.onAnswer) this.o.onAnswer(id, value, this.answers);
  };
  SurveyChat.prototype._next = function () {
    var self = this;
    this.phase = null;
    this.state++;
    this.gen++;
    this.nagPending = false;
    this._wireGen();
    if (this.state >= this.o.script.length) {
      if (this.quotePending) { this._prog(); this.quotePending = false; this._askQuote(); }
      else this._finish();
      return;
    }
    this._prog();
    this._ask();
  };
  SurveyChat.prototype._wireGen = function () { /* placeholder for symmetry; gen captured per closure */ };

  SurveyChat.prototype._ask = function () {
    var self = this;
    var q = this.o.script[this.state];
    var noOpts = (q.type === "choice" || q.type === "multi") && !(q.options && q.options.length);
    this._bot(q.q || "(empty question)", function () {
      if (noOpts) {
        self._bot("This question has no answer options configured yet. Type your answer instead.", function () {
          self.phase = "text"; self._curId = q.id; self._input(true, "Type your answer…");
        });
      } else if (q.type === "choice") {
        self._input(false);
        self._chips(q.options.map(function (o) { return { text: o }; }), function (o, b, box) {
          self._lock(box, [b]); self._me(o.text); self._record(q.id, o.text); self._next();
        }, { nps: !!q.nps });
      } else if (q.type === "multi") {
        self._input(false); self.multi = [];
        var box = self._chips(q.options.map(function (o) { return { text: o }; }).concat([{ text: "Done", cls: "done-chip" }]),
          function (o, b) {
            if (o.cls === "done-chip") {
              if (self.multi.length === 0) { self._nag("Pick at least one, then tap Done."); return; }
              self.multi.sort(function (a, c) { return q.options.indexOf(a.text) - q.options.indexOf(c.text); });
              var picked = self.multi.map(function (p) { return p.text; });
              self._lock(box, self.multi.map(function (p) { return p.btn; }));
              self._me(picked.join(", "));
              self._record(q.id, picked);
              self._next();
            } else {
              var idx = -1;
              self.multi.forEach(function (p, i) { if (p.text === o.text) idx = i; });
              if (idx >= 0) { self.multi.splice(idx, 1); b.classList.remove("on"); }
              else { self.multi.push({ text: o.text, btn: b }); b.classList.add("on"); }
            }
          });
      } else if (q.type === "number") {
        self.phase = "number"; self._input(true, "Type a number…");
      } else {
        self.phase = "text"; self._input(true, q.optional ? "Type your answer, or skip…" : "Type your answer…");
      }
    });
  };

  SurveyChat.prototype._askQuote = function () {
    var self = this;
    this._bot(this.quoteCopy.q, function () {
      self.phase = "quote"; self._input(true, "Type your answer, or skip…");
    });
  };

  SurveyChat.prototype._handle = function () {
    var self = this;
    if (this.done) return;
    var raw = this.o.input.value.trim();
    if (!raw) return;
    var q = this.o.script[this.state];
    this._me(raw); this.o.input.value = "";

    if (this.phase === "number") {
      var p = parseNumber(raw);
      var mn = (q && typeof q.min === "number" && !isNaN(q.min)) ? q.min : 0;
      var mx = (q && typeof q.max === "number" && !isNaN(q.max)) ? q.max : 100000;
      if (mn > mx) { var sw = mn; mn = mx; mx = sw; }
      if (p.ok && p.n >= mn && p.n <= mx) { this._record(q.id, p.n); this._input(false); this._next(); }
      else if (p.vague) { this._nag("I need a number for this one. A rough count works. 100? 300? 500?"); }
      else if (p.decimal) { this._nag("Whole numbers work best here. What is the closest whole number?"); }
      else if (p.ok) { this._nag("That number looks off, it should be between " + mn + " and " + mx.toLocaleString("en-US") + ". Try again?"); }
      else { this._nag("I did not catch a number in that. Digits work best, 100? 300? 500?"); }
    } else if (this.phase === "text") {
      var id = this._curId || (q && q.id);
      this._curId = null;
      if (raw.toLowerCase() === "skip" && (!q || q.optional !== false)) {
        this._record(id, null); this._input(false);
        this._bot("No problem.", function () { self._next(); });
      } else {
        this._record(id, raw); this._input(false); this._next();
      }
    } else if (this.phase === "quote") {
      if (raw.toLowerCase() === "skip") { this._input(false); this._finish(); }
      else if (isNegative(raw)) {
        this._record("_quote", raw);
        this._record("_quotePermission", "private feedback");
        this._input(false);
        this._bot("Thank you for the honesty. That stays private feedback, it will not be published anywhere.", function () { self._finish(); });
      } else {
        this._record("_quote", raw);
        this._input(false);
        this._bot(this.quoteCopy.perm, function () {
          self._chips([{ text: "Yes, use it" }, { text: "No thanks" }], function (o, b, box) {
            self._lock(box, [b]); self._me(o.text);
            if (o.text === "Yes, use it") {
              self._record("_quotePermission", "approved");
              self.phase = "attribution";
              self._bot(self.quoteCopy.attr, function () {
                self._input(true, "Name, role, years… or skip");
              });
            } else {
              self._record("_quotePermission", "declined");
              self._finish();
            }
          });
        });
      }
    } else if (this.phase === "attribution") {
      this.phase = null;
      this._record("_quoteAttribution", raw.toLowerCase() === "skip" ? null : raw);
      this._input(false);
      this._finish();
    }
  };

  SurveyChat.prototype._finish = function () {
    var self = this;
    this.done = true;
    this._prog();
    this._bot(this.o.outro || "That is everything. Thank you. Your answers are saved.", function () {
      self._input(false);
      self.o.input.placeholder = "Survey complete";
      if (self.o.onComplete) self.o.onComplete(self.answers);
    });
  };

  global.SurveyChat = SurveyChat;
  global.SurveyChat.parseNumber = parseNumber;
  global.SurveyChat.isNegative = isNegative;
})(window);
