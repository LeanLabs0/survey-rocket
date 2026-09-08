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

  function revealDash(answers){
    setStepsDone();
    document.getElementById("stageChat").style.display="none";
    document.getElementById("stageDash").style.display="";
    window.scrollTo({top:0, behavior:"smooth"});
    document.getElementById("dashbody").style.display="block";
    document.getElementById("respcount").textContent="129 responses";
    var bandIds=["Up more than 50%","Up 20 to 50%","Up less than 20%","About the same","Down"];
    var counts=[39,55,13,16,5];
    var idx=bandIds.indexOf(answers.conv);
    if(idx>=0){
      counts[idx]+=1;
      var maxC=Math.max.apply(null,counts);
      for(var i=0;i<5;i++){
        var row=document.getElementById("b"+i);
        row.textContent=String(counts[i]);
        row.parentElement.querySelector(".fill").style.width=Math.max(4,Math.round(counts[i]/maxC*100))+"%";
      }
      var total=0; for(var j=0;j<5;j++){ total+=counts[j]; }
      var up=counts[0]+counts[1]+counts[2];
      document.getElementById("t-outcome").textContent=Math.round(up/total*100)+"%";
    }
    var npsV=parseInt(answers.nps,10);
    if(!isNaN(npsV)){
      var prom=82, pas=30, det=16;
      if(npsV>=9) prom+=1; else if(npsV>=7) pas+=1; else det+=1;
      document.getElementById("t-nps").textContent=String(Math.round((prom-det)/(prom+pas+det)*100));
    }
    document.getElementById("joinnote").style.display="block";
  }

  function resetDash(){
    document.getElementById("respcount").textContent="128 responses";
    document.getElementById("joinnote").style.display="none";
    var base=[39,55,13,16,5], maxC=55;
    for(var i=0;i<5;i++){
      var row=document.getElementById("b"+i);
      row.textContent=String(base[i]);
      row.parentElement.querySelector(".fill").style.width=Math.max(4,Math.round(base[i]/maxC*100))+"%";
    }
    document.getElementById("t-outcome").textContent="78%";
    document.getElementById("t-nps").textContent="52";
  }

  var STEPS=[{name:"Welcome"},{name:"Quick Chat"},{name:"Your Dashboard"}];
  var stepAt=0, stepDone=false;

  function renderSteps(){
    var host=document.getElementById("steps"), html="";
    var reach=stepAt+(stepDone?1:0);
    for(var i=0;i<STEPS.length;i++){
      var cls = i<reach ? "step done" : (i===stepAt ? "step on" : "step");
      var pill = i<reach ? "Done" : (i===stepAt ? "In progress" : "Pending");
      var mark = i<reach ? "&#10003;" : String(i+1);
      html += '<div class="'+cls+'"><div class="body">'
            +   '<span class="dot">'+mark+'</span>'
            +   '<span class="idx">Step '+(i+1)+'</span>'
            +   '<span class="nm">'+STEPS[i].name+'</span>'
            +   '<span class="pill">'+pill+'</span>'
            + '</div>'
            + (i<STEPS.length-1 ? '<span class="line"></span>' : '')
            + '</div>';
    }
    host.innerHTML=html;
  }
  function setStep(i){ if(i!==stepAt){ stepAt=i; renderSteps(); } }
  function setStepsDone(){ if(!stepDone){ stepDone=true; renderSteps(); } }
  function syncStep(){
    if(!chat) return setStep(0);
    var t=(document.getElementById("prog").textContent||"").toLowerCase();
    if(t.indexOf("done")===0) return setStep(2);
    if(t.indexOf("wrapping")===0 || t.indexOf("question")===0) return setStep(1);
    setStep(chat.done ? 2 : 1);
  }
  new MutationObserver(syncStep).observe(
    document.getElementById("prog"), {childList:true, characterData:true, subtree:true}
  );

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
        onAnswer:syncStep,
        onComplete:function(a){ syncStep(); revealDash(a); }
      });
      function restart(){
        stepDone=false;
        resetDash();
        document.getElementById("stageDash").style.display="none";
        document.getElementById("stageChat").style.display="";
        chat.start();
        syncStep();
      }
      document.getElementById("restartBtn").addEventListener("click",restart);
      document.getElementById("dashRestart").addEventListener("click",restart);
    }
    chat.start();
  }

  renderSteps();
  document.getElementById("beginBtn").addEventListener("click",function(){
    document.getElementById("welcome").style.display="none";
    document.getElementById("stageChat").style.display="";
    document.getElementById("stageDash").style.display="none";
    setStep(1);
    startDemo();
  });
})();
