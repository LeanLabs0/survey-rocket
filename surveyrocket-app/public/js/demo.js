(function(){
  "use strict";
  var chat=null;
  var SCRIPT=[
    {id:"work", type:"choice", q:"Which work did Lean Labs do for you?", options:["Website build","Growth retainer","AEO and AI visibility","More than one of these"]},
    {id:"parts", type:"multi", q:"Which parts have been worth the time? Pick all that apply, then tap Done.", options:["The website itself","Conversion strategy","Content and messaging","AEO and AI visibility","HubSpot setup"]},
    {id:"leads", type:"number", min:0, max:1000, unit:"leads a month", q:"Roughly how many inbound leads a month does your website bring in now?"},
    {id:"conv", type:"choice", q:"How did your visitor to lead conversion rate change after working with Lean Labs?", options:["Up more than 50%","Up 20 to 50%","Up less than 20%","About the same","Down"]},
    {id:"nps", type:"choice", nps:true, q:"How likely are you to recommend Lean Labs to a peer?", options:["0","1","2","3","4","5","6","7","8","9","10"]}
  ];

  var screenState="welcome";

  function setStep(i, allDone){
    var steps=document.querySelectorAll("#steps .rs-step");
    steps.forEach(function(el, idx){
      var done=!!allDone || idx<i;
      var on=!allDone && idx===i;
      el.classList.toggle("on", on);
      el.classList.toggle("done", done && !on);
      var pill=el.querySelector(".pill");
      if(pill) pill.textContent=done && !on ? "Completed" : (on ? "In Progress" : "Pending");
    });
    document.querySelectorAll("#steps .rs-step-line").forEach(function(line, idx){
      line.classList.toggle("fill", !!allDone || idx<i);
      line.classList.toggle("partial", !allDone && idx===i);
    });
  }

  function showScreen(name){
    screenState=name;
    document.getElementById("welcome").style.display = name==="welcome" ? "flex" : "none";
    document.getElementById("chatWrap").style.display = name==="chat" ? "flex" : "none";
    document.getElementById("stageDash").style.display = name==="dash" ? "flex" : "none";
    document.querySelector(".rs-page").classList.toggle("is-chat", name==="chat");
    if(name==="welcome") setStep(0);
    if(name==="chat") setStep(1);
    if(name==="dash") setStep(2, true);
    onScreenActivated(name);
  }

  function publishChart(counts){
    window.dispatchEvent(new CustomEvent("sr-demo-chart", { detail: { counts: counts } }));
  }

  function revealDash(answers){
    var bandIds=["Up more than 50%","Up 20 to 50%","Up less than 20%","About the same","Down"];
    var counts=[39,55,13,16,5];
    var idx=bandIds.indexOf(answers.conv);
    if(idx>=0){
      counts[idx]+=1;
      var total=0; for(var j=0;j<5;j++){ total+=counts[j]; }
      var up=counts[0]+counts[1]+counts[2];
      document.getElementById("t-outcome").textContent=Math.round(up/total*100)+"%";
    }
    publishChart(counts);
    var npsV=parseInt(answers.nps,10);
    if(!isNaN(npsV)){
      var prom=82, pas=30, det=16;
      if(npsV>=9) prom+=1; else if(npsV>=7) pas+=1; else det+=1;
      document.getElementById("t-nps").textContent=String(Math.round((prom-det)/(prom+pas+det)*100));
    }
    document.getElementById("respcount").textContent="129 responses";
    document.getElementById("joinnote").hidden=false;
    showScreen("dash");
    window.scrollTo({top:0, behavior:"smooth"});
  }

  function resetDash(){
    document.getElementById("respcount").textContent="128 responses";
    document.getElementById("joinnote").hidden=true;
    publishChart([39,55,13,16,5]);
    document.getElementById("t-outcome").textContent="78%";
    document.getElementById("t-nps").textContent="52";
  }

  function startDemo(){
    if(!chat){
      chat=new SurveyChat({
        log:document.getElementById("log"),
        input:document.getElementById("inp"),
        sendBtn:document.getElementById("sendBtn"),
        progEl:document.getElementById("prog"),
        script:SCRIPT,
        intro:"Hi. Quick check-in about the work Lean Labs did for you. Most answers are one tap, about 2 minutes.",
        outro:"That is everything, thank you. Watch the results panel, your answers just joined the averages.",
        onComplete:function(a){ revealDash(a); }
      });
      function restart(){
        resetDash();
        if(chat) chat.start();
        showScreen("chat");
        window.scrollTo({top:0, behavior:"smooth"});
      }
      document.getElementById("restartBtn").addEventListener("click",restart);
      document.getElementById("dashRestart").addEventListener("click",restart);
    }
    chat.start();
  }

  document.getElementById("g-go").addEventListener("click",function(){
    showScreen("chat");
    startDemo();
    window.scrollTo({top:0, behavior:"smooth"});
  });

  /* Coach-marks, same shape as reputationrocket.ai/lean-labs/demo/demo.js */
  var STEPS={
    welcome:{
      target:"#g-go",
      count:"Step 1 of 3",
      title:"Welcome",
      body:"Every survey starts here. Click <strong>Begin</strong> to kick off the guided flow — go ahead, we’ll follow along."
    },
    chat:{
      target:"#chatInput",
      count:"Step 2 of 3",
      title:"Quick chat",
      body:"Questions arrive one at a time. Most answers are a single tap. Nothing you type is stored."
    },
    dash:{
      target:"#dashbox",
      count:"Step 3 of 3",
      title:"Your dashboard",
      body:"Your answer just joined the running average. That number is the one that goes on the website."
    }
  };
  var INTRO={
    title:"Welcome to the Survey Rocket demo",
    body:"You’re about to walk through exactly what a customer sees, using a fictional Lean Labs client. We’ll pop in with a quick tip at each step."
  };

  var root=null, spotlightEl=null, popoverEl=null, currentTarget=null;
  var tourActive=false, introPending=false;
  var shownSteps=new Set();
  var repositionRaf=0;

  function ensureRoot(){
    if(root) return;
    root=document.createElement("div");
    root.className="sr-tour-root";
    root.hidden=true;
    spotlightEl=document.createElement("div");
    spotlightEl.className="sr-tour-spotlight";
    popoverEl=document.createElement("div");
    popoverEl.className="sr-tour-popover";
    root.appendChild(spotlightEl);
    root.appendChild(popoverEl);
    document.body.appendChild(root);
    window.addEventListener("resize", scheduleReposition, {passive:true});
    window.addEventListener("scroll", scheduleReposition, {passive:true, capture:true});
  }

  function hideOverlay(){
    if(root) root.hidden=true;
    currentTarget=null;
  }

  function endTour(){
    tourActive=false;
    introPending=false;
    hideOverlay();
  }

  function scheduleReposition(){
    if(!root || root.hidden || !currentTarget) return;
    if(repositionRaf) cancelAnimationFrame(repositionRaf);
    repositionRaf=requestAnimationFrame(function(){ positionTo(currentTarget); });
  }

  function positionTo(target){
    var rect=target.getBoundingClientRect();
    var pad=8;
    var top=Math.max(rect.top-pad, 6);
    var left=Math.max(rect.left-pad, 6);
    var width=Math.min(rect.width+pad*2, window.innerWidth-12);
    var height=rect.height+pad*2;
    spotlightEl.className="sr-tour-spotlight";
    spotlightEl.style.top=top+"px";
    spotlightEl.style.left=left+"px";
    spotlightEl.style.width=width+"px";
    spotlightEl.style.height=height+"px";
    popoverEl.className="sr-tour-popover";
    var popH=popoverEl.offsetHeight||180;
    var popW=popoverEl.offsetWidth||320;
    var spaceBelow=window.innerHeight-rect.bottom;
    var popTop, arrow;
    if(spaceBelow>=popH+18 || spaceBelow>=rect.top){
      popTop=rect.bottom+14;
      arrow="top";
    } else {
      popTop=Math.max(rect.top-popH-14, 8);
      arrow="bottom";
    }
    var popLeft=rect.left;
    if(popLeft+popW>window.innerWidth-8) popLeft=window.innerWidth-popW-8;
    popLeft=Math.max(popLeft, 8);
    popoverEl.style.top=popTop+"px";
    popoverEl.style.left=popLeft+"px";
    popoverEl.setAttribute("data-arrow", arrow);
    var arrowX=Math.min(Math.max(rect.left-popLeft+rect.width/2-6, 14), popW-24);
    popoverEl.style.setProperty("--arrow-x", arrowX+"px");
  }

  function renderPopover(step, opts){
    var isCenter=!!(opts && opts.center);
    var nextLabel=(opts && opts.nextLabel) || "Got it";
    popoverEl.innerHTML=
      (step.count ? '<span class="sr-tour-step-count">'+step.count+"</span>" : "")+
      '<h3 class="sr-tour-title">'+step.title+"</h3>"+
      '<p class="sr-tour-body">'+step.body+"</p>"+
      '<div class="sr-tour-actions">'+
        '<button type="button" class="sr-tour-skip">Skip tour</button>'+
        '<button type="button" class="sr-tour-next">'+nextLabel+"</button>"+
      "</div>";
    popoverEl.querySelector(".sr-tour-skip").addEventListener("click", function(){ endTour(); });
    popoverEl.querySelector(".sr-tour-next").addEventListener("click", function(){
      if(opts && typeof opts.onNext==="function") opts.onNext();
      else hideOverlay();
    });
    if(isCenter){
      popoverEl.classList.add("sr-tour-popover--center");
      popoverEl.removeAttribute("data-arrow");
    } else {
      popoverEl.classList.remove("sr-tour-popover--center");
    }
  }

  function showIntro(){
    ensureRoot();
    root.hidden=false;
    introPending=true;
    currentTarget=null;
    spotlightEl.className="sr-tour-spotlight sr-tour-spotlight--center";
    spotlightEl.removeAttribute("style");
    renderPopover(INTRO, {
      center:true,
      nextLabel:"Start the tour",
      onNext:function(){
        introPending=false;
        if(STEPS[screenState]) showStep(screenState, true);
        else hideOverlay();
      }
    });
  }

  function showStep(state, force){
    var step=STEPS[state];
    if(!step) return;
    if(!force && shownSteps.has(state)) return;
    shownSteps.add(state);
    var target=step.target ? document.querySelector(step.target) : null;
    if(!target){
      requestAnimationFrame(function(){
        var t2=step.target ? document.querySelector(step.target) : null;
        if(!t2) return;
        ensureRoot();
        root.hidden=false;
        currentTarget=t2;
        renderPopover(step, {});
        positionTo(t2);
      });
      return;
    }
    ensureRoot();
    root.hidden=false;
    currentTarget=target;
    renderPopover(step, {});
    positionTo(target);
  }

  function onScreenActivated(state){
    if(!tourActive || introPending) return;
    if(!STEPS[state]) return;
    showStep(state, false);
  }

  document.getElementById("sr-demo-replay").addEventListener("click", function(){
    window.location.reload();
  });

  tourActive=true;
  requestAnimationFrame(function(){ showIntro(); });
})();
