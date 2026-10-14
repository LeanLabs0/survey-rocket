/* Respondent-facing charts of completed answers. No free-text responses. */
(function (global) {
  "use strict";

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function picked(answers, q, option) {
    var value = answers && answers[q.id];
    if (Array.isArray(value)) return value.indexOf(option) >= 0;
    if (q.nps && value != null && value !== "") return String(value) === String(option);
    return value === option;
  }

  function formatAvg(n) {
    var rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function optionList(q, choices) {
    var options = Array.isArray(q.options) ? q.options.slice() : [];
    Object.keys(choices || {}).forEach(function (key) {
      if (options.indexOf(key) < 0) options.push(key);
    });
    return options;
  }

  var BAR_MAX = 148;

  function columnPlot(pct) {
    var bar = el("span", "rs-graph-bar");
    var height = Math.round((Math.max(0, Math.min(100, pct)) / 100) * BAR_MAX);
    bar.style.height = Math.max(height, 2) + "px";
    bar.appendChild(el("span", "rs-graph-val", pct + "%"));
    return bar;
  }

  function columnChart(title, series, note) {
    var block = el("figure", "rs-graph" + (series.length > 6 ? " is-nps" : ""));
    block.appendChild(el("figcaption", "rs-graph-q", title));
    var chart = el("div", "rs-graph-chart");
    var axis = el("div", "rs-graph-y");
    axis.setAttribute("aria-hidden", "true");
    ["100", "50", "0"].forEach(function (tick) { axis.appendChild(el("span", "", tick)); });
    var plots = el("div", "rs-graph-plots");
    var names = el("div", "rs-graph-names");
    series.forEach(function (item) {
      var plot = el("div", "rs-graph-plot" + (item.you ? " is-you" : ""));
      plot.appendChild(columnPlot(item.pct));
      plots.appendChild(plot);
      var name = el("div", "rs-graph-namecol");
      name.appendChild(el("p", "rs-graph-name", item.label));
      name.appendChild(el("p", "rs-graph-you", item.you ? "You" : ""));
      names.appendChild(name);
    });
    chart.appendChild(axis);
    chart.appendChild(plots);
    chart.appendChild(names);
    block.appendChild(chart);
    if (note) block.appendChild(el("p", "rs-crowd-note", note));
    return block;
  }

  function choiceChart(q, stat, answers) {
    var choices = (stat && stat.choices) || {};
    var options = optionList(q, choices);
    if (!options.length) return null;
    var denom = q.type === "multi"
      ? ((stat && stat.answers) || 0)
      : options.reduce(function (sum, option) { return sum + (choices[option] || 0); }, 0);
    var series = options.map(function (option) {
      var count = choices[option] || 0;
      return {
        label: option,
        pct: denom ? Math.round((count / denom) * 100) : 0,
        you: picked(answers, q, option),
      };
    });
    return columnChart(
      q.q || q.id,
      series,
      q.type === "multi" ? "People could pick more than one." : "",
    );
  }

  function npsChart(q, stat, answers) {
    var choices = (stat && stat.choices) || {};
    var series = [];
    var total = 0;
    for (var n = 0; n <= 10; n++) total += choices[String(n)] || 0;
    for (var i = 0; i <= 10; i++) {
      var count = choices[String(i)] || 0;
      series.push({
        label: String(i),
        pct: total ? Math.round((count / total) * 100) : 0,
        you: picked(answers, q, String(i)),
      });
    }
    var title = q.q || q.id;
    if (stat && typeof stat.average === "number") title += "  ·  Average " + formatAvg(stat.average);
    return columnChart(title, series, "");
  }

  function numberChart(q, stat, answers) {
    var block = el("div", "rs-crowd");
    block.appendChild(el("p", "rs-result-q", q.q || q.id));
    var avg = stat && typeof stat.average === "number" ? stat.average : null;
    block.appendChild(el("p", "rs-crowd-avg", avg == null ? "No numbers yet" : ("Average " + formatAvg(avg))));
    var mine = answers && answers[q.id];
    if (typeof mine === "number" && !Number.isNaN(mine)) {
      block.appendChild(el("p", "rs-crowd-note", "You said " + formatAvg(mine) + "."));
    }
    return block;
  }

  function render(box, opts) {
    opts = opts || {};
    var questions = opts.questions || [];
    var payload = opts.payload || {};
    var stats = payload.questions || {};
    box.innerHTML = "";
    var shown = 0;
    questions.forEach(function (q) {
      if (!q || q.type === "text") return;
      var stat = stats[q.id] || null;
      var block = q.nps
        ? npsChart(q, stat, opts.answers)
        : (q.type === "number" ? numberChart(q, stat, opts.answers) : choiceChart(q, stat, opts.answers));
      if (!block) return;
      shown++;
      box.appendChild(block);
    });
    if (!shown) {
      var total = payload.responses || 0;
      box.appendChild(el("p", "rs-crowd-empty", total
        ? "These questions don't have a chart yet."
        : "No one else has finished this survey yet."));
    }
  }

  function meta(payload) {
    var n = payload && payload.responses ? payload.responses : 0;
    if (!n) return "No completed responses yet.";
    return n === 1 ? "1 completed response" : (n + " completed responses");
  }

  global.SRCrowd = { render: render, meta: meta };
})(window);
