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
