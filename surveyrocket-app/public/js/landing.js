(function(){
  "use strict";
  (function faqAccordion(){
    var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function panel(q){ return q.querySelector(".ans"); }
    function collapseQa(q){
      var ans=panel(q);
      if(q.classList.contains("open") && !reduce){
        ans.style.height=ans.scrollHeight+"px";
        void ans.offsetHeight;
      }
      q.classList.remove("open");
      q.querySelector("button").setAttribute("aria-expanded","false");
      ans.style.height="0px";
    }
    function expandQa(q){
      var ans=panel(q);
      q.classList.add("open");
      q.querySelector("button").setAttribute("aria-expanded","true");
      if(reduce){ ans.style.height="auto"; return; }
      ans.style.height=ans.scrollHeight+"px";
    }
    document.querySelectorAll("#view-landing .lp-qa").forEach(function(q){
      var ans=panel(q);
      ans.addEventListener("transitionend", function(ev){
        if(ev.propertyName!=="height") return;
        if(q.classList.contains("open")) ans.style.height="auto";
      });
      if(!q.classList.contains("open")) ans.style.height="0px";
    });
    document.querySelectorAll("#view-landing .lp-qa button").forEach(function(btn){
      btn.addEventListener("click", function(){
        var item=btn.parentElement;
        var wasOpen=item.classList.contains("open");
        document.querySelectorAll("#view-landing .lp-qa.open").forEach(function(q){
          if(q!==item) collapseQa(q);
        });
        if(wasOpen) collapseQa(item);
        else expandQa(item);
      });
    });
  })();

  (function landingMotion(){
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      document.querySelectorAll("#view-landing .lp-reveal").forEach(function(el){ el.classList.add("in"); });
      return;
    }
    function playHero(){
      document.querySelectorAll(".lp-hero .lp-reveal").forEach(function(el){
        el.classList.remove("in");
        el.style.transitionDelay = "0ms";
        void el.offsetWidth;
        el.style.transitionDelay = (el.getAttribute("data-delay") || "0") + "ms";
        requestAnimationFrame(function(){ el.classList.add("in"); });
      });
    }
    document.querySelectorAll("#view-landing h2").forEach(function(h){
      if(h.closest(".lp-feat")) return;
      if(!h.classList.contains("lp-reveal")) h.classList.add("lp-reveal");
    });
    document.querySelectorAll("#view-landing h3").forEach(function(h){
      if(h.closest(".lp-chat") || h.closest(".lp-hero") || h.closest(".lp-step")) return;
      if(!h.classList.contains("lp-reveal")) h.classList.add("lp-reveal");
    });
    function playStepCards(){
      document.querySelectorAll("#view-landing .lp-step.lp-reveal").forEach(function(el){
        el.style.transitionDelay = (el.getAttribute("data-delay") || "0") + "ms";
        el.classList.add("in");
      });
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add("in");
        io.unobserve(el);
        if(el.closest(".lp-steps") && el.tagName === "H2"){
          var done = false;
          function startCards(ev){
            if(done) return;
            if(ev && ev.propertyName && ev.propertyName !== "opacity") return;
            done = true;
            el.removeEventListener("transitionend", startCards);
            playStepCards();
          }
          el.addEventListener("transitionend", startCards);
          window.setTimeout(startCards, 1500);
        }
      });
    }, { threshold: 0.35, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("#view-landing h2.lp-reveal, #view-landing h3.lp-reveal").forEach(function(el){
      if(el.closest(".lp-hero")) return;
      io.observe(el);
    });
    playHero();
    (function heroVideo(){
      var box = document.getElementById("lpVideo");
      var vid = document.getElementById("lpWelcomeVideo");
      if (!box || !vid) return;
      function start(){
        if (box.classList.contains("is-playing")) return;
        box.classList.add("is-playing");
        vid.setAttribute("controls", "");
        var play = vid.play();
        if (play && play.catch) play.catch(function(){});
      }
      box.addEventListener("click", function(e){
        if (box.classList.contains("is-playing")) return;
        e.preventDefault();
        start();
      });
    })();
    (function waterRipple(){
      document.querySelectorAll("[data-water-ripple]").forEach(function (ripple) {
        var canvas = ripple.querySelector("canvas");
        var context = canvas && canvas.getContext("2d");
        var reduceMotion =
          window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
        var baseCanvas = document.createElement("canvas");
        var baseContext = baseCanvas.getContext("2d");
        var glowCanvas = document.createElement("canvas");
        var glowContext = glowCanvas.getContext("2d");
        var frame = null;
        var visible = true;
        var size = 0;
        var pixelSize = 0;

        if (!canvas || !context || !baseContext || !glowContext) return;

        var buildBase = function () {
          var rect = ripple.getBoundingClientRect();
          size = Math.max(1, Math.round(Math.min(rect.width, rect.height)));
          var dpr = size > 1800 ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
          pixelSize = Math.max(1, Math.round(size * dpr));
          canvas.width = pixelSize;
          canvas.height = pixelSize;
          baseCanvas.width = pixelSize;
          baseCanvas.height = pixelSize;
          glowCanvas.width = pixelSize;
          glowCanvas.height = pixelSize;

          var center = pixelSize / 2;
          var gradient = baseContext.createRadialGradient(center, center, 0, center, center, center);
          gradient.addColorStop(0, "rgba(0, 0, 0, .8)");
          gradient.addColorStop(.3702, "rgba(0, 0, 0, .8)");
          gradient.addColorStop(.5817, "rgba(168, 0, 101, .8)");
          gradient.addColorStop(.6635, "rgba(240, 0, 144, .8)");
          gradient.addColorStop(.7548, "rgba(168, 0, 101, .8)");
          gradient.addColorStop(1, "rgba(0, 0, 0, .8)");
          baseContext.fillStyle = "#000";
          baseContext.fillRect(0, 0, pixelSize, pixelSize);
          baseContext.fillStyle = gradient;
          baseContext.fillRect(0, 0, pixelSize, pixelSize);

          var travelingGlow = glowContext.createRadialGradient(center, center, 0, center, center, center);
          travelingGlow.addColorStop(0, "rgba(0, 0, 0, 0)");
          travelingGlow.addColorStop(.44, "rgba(0, 0, 0, 0)");
          travelingGlow.addColorStop(.56, "rgba(168, 0, 101, .25)");
          travelingGlow.addColorStop(.66, "rgba(240, 0, 144, .9)");
          travelingGlow.addColorStop(.76, "rgba(168, 0, 101, .34)");
          travelingGlow.addColorStop(.88, "rgba(0, 0, 0, 0)");
          travelingGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
          glowContext.clearRect(0, 0, pixelSize, pixelSize);
          glowContext.fillStyle = travelingGlow;
          glowContext.fillRect(0, 0, pixelSize, pixelSize);
        };

        var draw = function (time) {
          var reduced = reduceMotion && reduceMotion.matches;
          var center = pixelSize / 2;
          var radius = pixelSize / 2;
          var seconds = time / 1000;
          var breathe = reduced ? 1 : 1 + Math.sin(seconds * Math.PI / 7) * .008;
          var drawSize = pixelSize * breathe;
          var drawOffset = (pixelSize - drawSize) / 2;

          context.clearRect(0, 0, pixelSize, pixelSize);
          context.fillStyle = "#000";
          context.fillRect(0, 0, pixelSize, pixelSize);
          context.globalAlpha = 1;
          context.drawImage(baseCanvas, drawOffset, drawOffset, drawSize, drawSize);
          context.globalAlpha = 1;

          if (!reduced) {
            context.save();
            context.globalCompositeOperation = "screen";
            var primaryPhase = (seconds / 18) % 1;
            var primaryEased = primaryPhase * primaryPhase * (3 - 2 * primaryPhase);
            var primaryScale = .38 + primaryEased * 1.42;
            var primarySize = pixelSize * primaryScale;
            var primaryOffset = (pixelSize - primarySize) / 2;
            var primaryEnvelope = Math.sin(Math.PI * primaryPhase);
            context.globalAlpha = Math.pow(primaryEnvelope, 1.35) * .68;
            context.drawImage(glowCanvas, primaryOffset, primaryOffset, primarySize, primarySize);
            context.globalAlpha = 1;

            for (var i = 0; i < 3; i += 1) {
              var phase = (seconds / 18 + i / 3) % 1;
              var eased = phase * phase * (3 - 2 * phase);
              var waveRadius = radius * (.3 + eased * .78);
              var envelope = Math.sin(Math.PI * phase);
              var alpha = envelope * envelope * .075;
              context.globalAlpha = 1;
              context.beginPath();
              context.arc(center, center, waveRadius, 0, Math.PI * 2);
              context.strokeStyle = "rgba(240, 0, 144, " + alpha + ")";
              context.lineWidth = radius * (.042 - phase * .018);
              context.shadowColor = "rgba(240, 0, 144, " + alpha * .8 + ")";
              context.shadowBlur = radius * .045;
              context.stroke();
            }
            context.restore();
          }

          ripple.setAttribute("data-ripple-state", reduced ? "reduced" : "running");
          if (!reduced && visible && !document.hidden) {
            frame = window.requestAnimationFrame(draw);
          } else {
            frame = null;
          }
        };

        var start = function () {
          if (frame || !visible || document.hidden) return;
          frame = window.requestAnimationFrame(draw);
        };

        var stop = function () {
          if (frame) window.cancelAnimationFrame(frame);
          frame = null;
          ripple.setAttribute("data-ripple-state", "paused");
        };

        var resize = function () {
          buildBase();
          if (reduceMotion && reduceMotion.matches) draw(0);
          else start();
        };

        if ("ResizeObserver" in window) {
          new ResizeObserver(resize).observe(ripple);
        } else {
          window.addEventListener("resize", resize);
        }

        if ("IntersectionObserver" in window) {
          new IntersectionObserver(
            function (entries) {
              visible = entries[0].isIntersecting;
              if (visible) start();
              else stop();
            },
            { rootMargin: "100px" }
          ).observe(ripple);
        }

        document.addEventListener("visibilitychange", function () {
          if (document.hidden) stop();
          else start();
        });
        if (reduceMotion && reduceMotion.addEventListener) {
          reduceMotion.addEventListener("change", function () {
            stop();
            draw(0);
            if (!reduceMotion.matches) start();
          });
        }

        var hero = ripple.closest("[data-hero-builder]");
        var releaseHeroContent = function () {
          if (hero) hero.classList.add("is-hero-sequence-started");
        };
        var startHeroSequence = function () {
          if (reduceMotion && reduceMotion.matches) {
            ripple.classList.add("is-canvas-revealed");
            releaseHeroContent();
            return;
          }
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
              ripple.classList.add("is-canvas-revealed");
              window.setTimeout(releaseHeroContent, 2000);
            });
          });
        };
        ripple.addEventListener("animationend", function (event) {
          if (event.animationName === "lp-hero-canvas-reveal") releaseHeroContent();
        });
        resize();
        startHeroSequence();
      });
    })();
    (function featurePin(){
      var pin = document.querySelector("#view-landing .lp-feat-pin");
      if(!pin) return;
      var steps = pin.querySelectorAll(".lp-feat-col .lp-feat");
      var mq = window.matchMedia("(max-width:980px)");
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      var last = -1;
      function sync(){
        if(mq.matches || reduce.matches){
          steps.forEach(function(el){ el.classList.add("is-on"); });
          last = 0;
          return;
        }
        var mid = window.innerHeight * 0.5;
        var best = 0, bestDist = Infinity;
        steps.forEach(function(el, i){
          var r = el.getBoundingClientRect();
          var d = Math.abs((r.top + r.height / 2) - mid);
          if(d < bestDist){ bestDist = d; best = i; }
        });
        if(best === last) return;
        last = best;
        steps.forEach(function(el, i){ el.classList.toggle("is-on", i === best); });
      }
      var ticking = false;
      function onScroll(){
        if(ticking) return;
        ticking = true;
        requestAnimationFrame(function(){ ticking = false; sync(); });
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      sync();
    })();
  })();
})();
