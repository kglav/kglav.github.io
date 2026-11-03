(function () {
  "use strict";
  var CADENCES = {
    daily: { label: "Daily chores", title: "Today's checklist", description: "Recurring tasks to complete each day." },
    weekly: { label: "Weekly chores", title: "This week's checklist", description: "Regular tasks to complete during the week." },
    monthly: { label: "Monthly chores", title: "This month's checklist", description: "Bigger tasks to complete once this month." },
    optional: { label: "Optional chores", title: "Helpful extras", description: "Useful shortcuts that can reduce the weekend workload." },
    one_off: { label: "Setup / one-off", title: "One-off tasks", description: "Projects and setup jobs that stay done once completed." }
  };
  var state = { client: null, tasks: [], completions: [], cadence: "daily", anchor: startOfDay(new Date()), editingId: null, completingId: null };
  var el = {};
  document.addEventListener("DOMContentLoaded", initialise);

  function initialise() {
    cache(); bind();
    state.client = typeof window.getSiteSupabase === "function" ? window.getSiteSupabase() : null;
    if (!state.client) { setConnection("error", "Supabase unavailable", "The Supabase browser client did not load."); return; }
    load();
  }
  function cache() {
    ["choreConnection","choreConnectionTitle","choreConnectionMessage","refreshChoresButton","choreTabs","previousChorePeriod","currentChorePeriod","nextChorePeriod","chorePeriodLabel","choreSectionKicker","choreSectionTitle","choreSectionDescription","choreProgressText","choreProgressBar","choreList","chorePercent","choreSummaryText","chorePeople","addChoreButton","addChoreInline","choreModal","choreModalTitle","choreForm","choreId","choreTitle","choreCadence","choreAssigned","choreDescription","choreTiming","choreTarget","choreCondition","choreFormMessage","deleteChoreButton","saveChoreButton","completeChoreModal","completeChoreTitle","completeChoreName","completionOtherName","completeOtherButton","completeFormMessage"].forEach(function(id){ el[id] = document.getElementById(id); });
  }
  function bind() {
    el.refreshChoresButton.addEventListener("click", load);
    el.choreTabs.addEventListener("click", function(e){ var b=e.target.closest("[data-cadence]"); if(!b)return; state.cadence=b.dataset.cadence; render(); });
    el.previousChorePeriod.addEventListener("click", function(){ movePeriod(-1); });
    el.nextChorePeriod.addEventListener("click", function(){ movePeriod(1); });
    el.currentChorePeriod.addEventListener("click", function(){ state.anchor=startOfDay(new Date()); render(); });
    [el.addChoreButton, el.addChoreInline].forEach(function(b){ b.addEventListener("click", function(){ openTaskModal(null); }); });
    el.choreList.addEventListener("click", function(e){
      var check=e.target.closest("[data-check-chore]"); if(check){ toggleCompletion(check.dataset.checkChore); return; }
      var edit=e.target.closest("[data-edit-chore]"); if(edit){ openTaskById(edit.dataset.editChore); }
    });
    document.querySelectorAll("[data-close-chore]").forEach(function(b){ b.addEventListener("click", closeTaskModal); });
    document.querySelectorAll("[data-close-complete]").forEach(function(b){ b.addEventListener("click", closeCompleteModal); });
    el.choreModal.addEventListener("click", function(e){ if(e.target===el.choreModal)closeTaskModal(); });
    el.completeChoreModal.addEventListener("click", function(e){ if(e.target===el.completeChoreModal)closeCompleteModal(); });
    el.choreForm.addEventListener("submit", saveTask);
    el.deleteChoreButton.addEventListener("click", deleteTask);
    document.querySelectorAll("[data-completed-by]").forEach(function(b){ b.addEventListener("click", function(){ saveCompletion(b.dataset.completedBy); }); });
    el.completeOtherButton.addEventListener("click", function(){ var n=el.completionOtherName.value.trim(); if(!n){el.completeFormMessage.textContent="Enter a name first.";return;} saveCompletion(n); });
    document.addEventListener("keydown", function(e){ if(e.key!=="Escape")return; if(!el.completeChoreModal.hidden)closeCompleteModal(); else if(!el.choreModal.hidden)closeTaskModal(); });
  }
  async function load() {
    setConnection("loading","Connecting to chores","Loading the shared checklist from Supabase."); el.refreshChoresButton.disabled=true;
    var results=await Promise.all([
      state.client.from("chore_tasks").select("*").order("sort_order",{ascending:true}).order("title",{ascending:true}),
      state.client.from("chore_completions").select("*").order("completed_at",{ascending:false})
    ]);
    el.refreshChoresButton.disabled=false;
    if(results[0].error){ state.tasks=[]; state.completions=[]; setConnection("error","Chore tables not ready",friendlyError(results[0].error)); render(); return; }
    if(results[1].error){ state.tasks=results[0].data||[]; state.completions=[]; setConnection("error","Completion history unavailable",friendlyError(results[1].error)); render(); return; }
    state.tasks=results[0].data||[]; state.completions=results[1].data||[];
    setConnection("ready","Chores connected",state.tasks.length+" chore"+(state.tasks.length===1?"":"s")+" loaded from Supabase."); render();
  }
  function render() {
    var info=CADENCES[state.cadence];
    document.querySelectorAll("[data-cadence]").forEach(function(b){ b.classList.toggle("is-active",b.dataset.cadence===state.cadence); });
    el.choreSectionKicker.textContent=info.label; el.choreSectionTitle.textContent=info.title; el.choreSectionDescription.textContent=info.description;
    var oneOff=state.cadence==="one_off";
    el.previousChorePeriod.hidden=oneOff; el.nextChorePeriod.hidden=oneOff; el.currentChorePeriod.hidden=oneOff;
    el.chorePeriodLabel.textContent=periodLabel();
    var tasks=visibleTasks(); var key=periodKey();
    var completed=tasks.filter(function(t){return completionFor(t.id,key);});
    el.choreProgressText.textContent=completed.length+" of "+tasks.length+" done";
    var pct=tasks.length?Math.round(completed.length/tasks.length*100):0; el.choreProgressBar.style.width=pct+"%"; el.chorePercent.textContent=pct+"%";
    el.choreSummaryText.textContent=tasks.length?(completed.length+" of "+tasks.length+" completed"):"No chores in this section";
    el.choreList.innerHTML=tasks.length?tasks.map(function(t){return taskHtml(t,key);}).join(""):'<div class="chore-empty"><strong>No chores here yet.</strong><span>Use “Add to this section” to create one.</span></div>';
    renderPeople(completed,key);
  }
  function visibleTasks(){ return state.tasks.filter(function(t){return t.active!==false && t.cadence===state.cadence;}); }
  function taskHtml(task,key){
    var c=completionFor(task.id,key); var done=!!c; var details=[task.timing,task.target_completion].filter(Boolean).join(" · ");
    return '<article class="chore-row '+(done?'is-complete':'')+'"><button class="chore-check" type="button" data-check-chore="'+escAttr(task.id)+'" aria-label="'+(done?'Undo':'Complete')+' '+escAttr(task.title)+'"><span>'+(done?'✓':'')+'</span></button><div class="chore-row-copy"><strong>'+esc(task.title)+'</strong>'+(task.description?'<p>'+esc(task.description)+'</p>':'')+(task.condition_text?'<small class="chore-condition">'+esc(task.condition_text)+'</small>':'')+'</div><div class="chore-row-meta"><span>'+(task.assigned_to?esc(task.assigned_to):'Shared')+'</span>'+(details?'<small>'+esc(details)+'</small>':'')+'</div><div class="chore-done-by">'+(done?'<span class="person-badge">'+esc(initials(c.completed_by))+'</span><strong>'+esc(c.completed_by)+'</strong><small>'+esc(completedTime(c.completed_at))+'</small>':'<span class="muted-copy">Not done</span>')+'</div><button class="chore-edit-button" type="button" data-edit-chore="'+escAttr(task.id)+'" aria-label="Edit '+escAttr(task.title)+'">Edit</button></article>';
  }
  function renderPeople(completed,key){
    var counts={}; completed.forEach(function(t){var c=completionFor(t.id,key); if(c)counts[c.completed_by]=(counts[c.completed_by]||0)+1;});
    var names=Object.keys(counts); el.chorePeople.innerHTML=names.length?names.map(function(n){return '<div><span class="person-badge">'+esc(initials(n))+'</span><strong>'+esc(n)+'</strong><small>'+counts[n]+' done</small></div>';}).join(""):'<p class="muted-copy">No completions yet.</p>';
  }
  function completionFor(taskId,key){ return state.completions.find(function(c){return String(c.task_id)===String(taskId)&&c.period_key===key;}); }
  function periodKey(){
    if(state.cadence==="one_off")return "once";
    if(state.cadence==="daily")return isoDate(state.anchor);
    if(state.cadence==="weekly"||state.cadence==="optional")return isoDate(startOfWeek(state.anchor));
    return state.anchor.getFullYear()+"-"+String(state.anchor.getMonth()+1).padStart(2,"0");
  }
  function periodLabel(){
    if(state.cadence==="one_off")return "One-off projects";
    if(state.cadence==="daily")return state.anchor.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"short",year:"numeric"});
    if(state.cadence==="weekly"||state.cadence==="optional"){var s=startOfWeek(state.anchor),e=new Date(s);e.setDate(e.getDate()+6);return "Week of "+s.toLocaleDateString("en-GB",{day:"numeric",month:"short"})+" – "+e.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
    return state.anchor.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  }
  function movePeriod(delta){
    if(state.cadence==="daily")state.anchor.setDate(state.anchor.getDate()+delta);
    else if(state.cadence==="weekly"||state.cadence==="optional")state.anchor.setDate(state.anchor.getDate()+delta*7);
    else if(state.cadence==="monthly")state.anchor.setMonth(state.anchor.getMonth()+delta);
    state.anchor=startOfDay(state.anchor); render();
  }
  function toggleCompletion(id){ var c=completionFor(id,periodKey()); if(c){ undoCompletion(c); return; } state.completingId=id; var t=state.tasks.find(function(x){return String(x.id)===String(id);}); el.completeChoreName.textContent=t?t.title:""; el.completionOtherName.value=""; el.completeFormMessage.textContent=""; el.completeChoreModal.hidden=false; document.body.classList.add("modal-open"); }
  async function saveCompletion(name){
    if(!state.completingId)return; el.completeFormMessage.textContent="Saving...";
    var r=await state.client.from("chore_completions").insert({task_id:state.completingId,period_key:periodKey(),completed_by:name,completed_at:new Date().toISOString()}).select();
    if(r.error){el.completeFormMessage.textContent=friendlyError(r.error);return;} closeCompleteModal(); await load();
  }
  async function undoCompletion(c){ if(!window.confirm("Mark this chore as not done for this period?"))return; var r=await state.client.from("chore_completions").delete().eq("id",c.id); if(r.error){setConnection("error","Could not undo chore",friendlyError(r.error));return;} await load(); }
  function closeCompleteModal(){el.completeChoreModal.hidden=true;state.completingId=null;document.body.classList.remove("modal-open");}
  function openTaskById(id){var t=state.tasks.find(function(x){return String(x.id)===String(id);});if(t)openTaskModal(t);}
  function openTaskModal(t){
    state.editingId=t?t.id:null; el.choreForm.reset(); el.choreModalTitle.textContent=t?"Edit chore":"Add chore"; el.choreId.value=t?t.id:""; el.choreTitle.value=t?t.title||"":""; el.choreCadence.value=t?t.cadence:state.cadence; el.choreAssigned.value=t?t.assigned_to||"":""; el.choreDescription.value=t?t.description||"":""; el.choreTiming.value=t?t.timing||"":""; el.choreTarget.value=t?t.target_completion||"":""; el.choreCondition.value=t?t.condition_text||"":""; el.deleteChoreButton.hidden=!t; el.choreFormMessage.textContent=""; el.choreModal.hidden=false; document.body.classList.add("modal-open"); setTimeout(function(){el.choreTitle.focus();},0);
  }
  function closeTaskModal(){el.choreModal.hidden=true;state.editingId=null;document.body.classList.remove("modal-open");}
  async function saveTask(e){
    e.preventDefault(); var title=el.choreTitle.value.trim(); if(!title){el.choreFormMessage.textContent="Give the chore a title.";return;}
    var data={title:title,cadence:el.choreCadence.value,assigned_to:el.choreAssigned.value||null,description:el.choreDescription.value.trim()||null,timing:el.choreTiming.value.trim()||null,target_completion:el.choreTarget.value.trim()||null,condition_text:el.choreCondition.value.trim()||null,active:true,updated_at:new Date().toISOString()};
    el.saveChoreButton.disabled=true; el.choreFormMessage.textContent="Saving..."; var q;
    if(state.editingId)q=state.client.from("chore_tasks").update(data).eq("id",state.editingId); else {data.id="custom_"+Date.now();q=state.client.from("chore_tasks").insert(data);}
    var r=await q.select(); el.saveChoreButton.disabled=false; if(r.error){el.choreFormMessage.textContent=friendlyError(r.error);return;} state.cadence=data.cadence; closeTaskModal(); await load();
  }
  async function deleteTask(){
    if(!state.editingId)return; if(!window.confirm("Delete this chore and its saved completion history?"))return; el.deleteChoreButton.disabled=true; var r=await state.client.from("chore_tasks").delete().eq("id",state.editingId); el.deleteChoreButton.disabled=false; if(r.error){el.choreFormMessage.textContent=friendlyError(r.error);return;} closeTaskModal(); await load();
  }
  function setConnection(s,t,m){el.choreConnection.dataset.state=s;el.choreConnectionTitle.textContent=t;el.choreConnectionMessage.textContent=m;}
  function friendlyError(error){var m=error&&error.message?String(error.message):"Unknown Supabase error.";var l=m.toLowerCase();if(l.indexOf("could not find the table")!==-1||l.indexOf("schema cache")!==-1)return "Run chores-setup.sql in the Supabase SQL Editor, then refresh this page.";if(l.indexOf("row-level security")!==-1||l.indexOf("permission denied")!==-1)return "Supabase connected but the chores tables are not writable. Re-run chores-setup.sql to restore their policies.";return m;}
  function startOfDay(d){var x=new Date(d);x.setHours(0,0,0,0);return x;} function startOfWeek(d){var x=startOfDay(d),day=x.getDay(),diff=day===0?-6:1-day;x.setDate(x.getDate()+diff);return x;} function isoDate(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function completedTime(v){if(!v)return"";var d=new Date(v);return isNaN(d)?"":d.toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});} function initials(n){return String(n||"?").trim().split(/\s+/).map(function(x){return x[0]||"";}).join("").slice(0,2).toUpperCase();}
  function esc(v){return String(v==null?"":v).replace(/[&<>\"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c];});} function escAttr(v){return esc(v).replace(/'/g,"&#39;");}
}());
