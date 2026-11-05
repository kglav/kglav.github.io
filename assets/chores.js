(function () {
  "use strict";

  var CADENCES = {
    daily: { label: "Daily chores", title: "Today's checklist", description: "Recurring tasks to complete each day." },
    weekly: { label: "Weekly chores", title: "This week's checklist", description: "Regular tasks to complete during the week." },
    monthly: { label: "Monthly chores", title: "This month's checklist", description: "Bigger tasks to complete once this month." },
    optional: { label: "Optional chores", title: "Helpful extras", description: "Useful shortcuts that can reduce the weekend workload." },
    one_off: { label: "Setup / one-off", title: "One-off tasks", description: "Projects and setup jobs that stay done once completed." }
  };

  var state = {
    client: null,
    tasks: [],
    completions: [],
    assignments: [],
    cadence: "daily",
    anchor: startOfDay(new Date()),
    editingId: null,
    completingId: null,
    assigningId: null
  };

  var el = {};
  document.addEventListener("DOMContentLoaded", initialise);

  function initialise() {
    cache();
    bind();
    state.client = typeof window.getSiteSupabase === "function" ? window.getSiteSupabase() : null;
    if (!state.client) {
      setConnection("error", "Supabase unavailable", "The Supabase browser client did not load.");
      return;
    }
    load();
  }

  function cache() {
    [
      "choreConnection","choreConnectionTitle","choreConnectionMessage","refreshChoresButton","choreTabs",
      "previousChorePeriod","currentChorePeriod","nextChorePeriod","chorePeriodLabel","choreSectionKicker",
      "choreSectionTitle","choreSectionDescription","choreProgressText","choreProgressBar","choreList",
      "chorePercent","choreSummaryText","chorePeople","addChoreButton","addChoreInline","choreModal",
      "choreModalTitle","choreForm","choreId","choreTitle","choreCadence","choreAssigned","choreAssignedOther",
      "choreDescription","choreTiming","choreTarget","choreCondition","choreFormMessage","deleteChoreButton",
      "saveChoreButton","completeChoreModal","completeChoreTitle","completeChoreName","completionOtherName",
      "completeOtherButton","completeNotNeededButton","completeFormMessage","assignChoreModal","assignChoreTitle",
      "assignChoreName","assignPeriodLabel","assignmentOtherName","assignOtherButton","assignmentFormMessage",
      "clearAssignmentButton"
    ].forEach(function (id) { el[id] = document.getElementById(id); });
  }

  function bind() {
    el.refreshChoresButton.addEventListener("click", load);
    el.choreTabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cadence]");
      if (!b) return;
      state.cadence = b.dataset.cadence;
      render();
    });
    document.querySelectorAll("[data-cadence-jump]").forEach(function (b) {
      b.addEventListener("click", function () { state.cadence = b.dataset.cadenceJump; render(); });
    });
    el.previousChorePeriod.addEventListener("click", function () { movePeriod(-1); });
    el.nextChorePeriod.addEventListener("click", function () { movePeriod(1); });
    el.currentChorePeriod.addEventListener("click", function () { state.anchor = startOfDay(new Date()); render(); });
    [el.addChoreButton, el.addChoreInline].forEach(function (b) {
      b.addEventListener("click", function () { openTaskModal(null); });
    });

    el.choreList.addEventListener("click", function (e) {
      var check = e.target.closest("[data-check-chore]");
      if (check) { toggleCompletion(check.dataset.checkChore); return; }
      var assign = e.target.closest("[data-assign-chore]");
      if (assign) { openAssignmentModal(assign.dataset.assignChore); return; }
      var edit = e.target.closest("[data-edit-chore]");
      if (edit) openTaskById(edit.dataset.editChore);
    });

    document.querySelectorAll("[data-close-chore]").forEach(function (b) { b.addEventListener("click", closeTaskModal); });
    document.querySelectorAll("[data-close-complete]").forEach(function (b) { b.addEventListener("click", closeCompleteModal); });
    document.querySelectorAll("[data-close-assign]").forEach(function (b) { b.addEventListener("click", closeAssignmentModal); });

    el.choreModal.addEventListener("click", function (e) { if (e.target === el.choreModal) closeTaskModal(); });
    el.completeChoreModal.addEventListener("click", function (e) { if (e.target === el.completeChoreModal) closeCompleteModal(); });
    el.assignChoreModal.addEventListener("click", function (e) { if (e.target === el.assignChoreModal) closeAssignmentModal(); });

    el.choreForm.addEventListener("submit", saveTask);
    el.deleteChoreButton.addEventListener("click", deleteTask);
    el.choreAssigned.addEventListener("change", syncOngoingOwnerOther);

    document.querySelectorAll("[data-completed-by]").forEach(function (b) {
      b.addEventListener("click", function () { saveCompletion("done", b.dataset.completedBy); });
    });
    el.completeOtherButton.addEventListener("click", function () {
      var n = el.completionOtherName.value.trim();
      if (!n) { el.completeFormMessage.textContent = "Enter a name first."; return; }
      saveCompletion("done", n);
    });
    el.completeNotNeededButton.addEventListener("click", function () { saveCompletion("not_needed", null); });

    document.querySelectorAll("[data-assigned-to]").forEach(function (b) {
      b.addEventListener("click", function () { savePeriodAssignment(b.dataset.assignedTo); });
    });
    el.assignOtherButton.addEventListener("click", function () {
      var n = el.assignmentOtherName.value.trim();
      if (!n) { el.assignmentFormMessage.textContent = "Enter a name first."; return; }
      savePeriodAssignment(n);
    });
    el.clearAssignmentButton.addEventListener("click", clearPeriodAssignment);

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!el.assignChoreModal.hidden) closeAssignmentModal();
      else if (!el.completeChoreModal.hidden) closeCompleteModal();
      else if (!el.choreModal.hidden) closeTaskModal();
    });
  }

  async function load() {
    setConnection("loading", "Connecting to chores", "Loading the shared checklist from Supabase.");
    el.refreshChoresButton.disabled = true;
    var results = await Promise.all([
      state.client.from("chore_tasks").select("*").order("sort_order", { ascending: true }).order("title", { ascending: true }),
      state.client.from("chore_completions").select("*").order("completed_at", { ascending: false }),
      state.client.from("chore_assignments").select("*").order("assigned_at", { ascending: false })
    ]);
    el.refreshChoresButton.disabled = false;

    if (results[0].error) {
      state.tasks = []; state.completions = []; state.assignments = [];
      setConnection("error", "Chore tables not ready", friendlyError(results[0].error)); render(); return;
    }
    if (results[1].error) {
      state.tasks = results[0].data || []; state.completions = []; state.assignments = [];
      setConnection("error", "Completion history unavailable", friendlyError(results[1].error)); render(); return;
    }
    if (results[2].error) {
      state.tasks = results[0].data || []; state.completions = results[1].data || []; state.assignments = [];
      setConnection("error", "Assignment planning needs an update", "Run chores-assignment-upgrade.sql in Supabase, then refresh this page."); render(); return;
    }

    state.tasks = results[0].data || [];
    state.completions = results[1].data || [];
    state.assignments = results[2].data || [];
    setConnection("ready", "Chores connected", state.tasks.length + " chore" + (state.tasks.length === 1 ? "" : "s") + " loaded from Supabase.");
    render();
  }

  function render() {
    var info = CADENCES[state.cadence];
    document.querySelectorAll("[data-cadence]").forEach(function (b) { b.classList.toggle("is-active", b.dataset.cadence === state.cadence); });
    el.choreSectionKicker.textContent = info.label;
    el.choreSectionTitle.textContent = info.title;
    el.choreSectionDescription.textContent = info.description;

    var oneOff = state.cadence === "one_off";
    el.previousChorePeriod.hidden = oneOff;
    el.nextChorePeriod.hidden = oneOff;
    el.currentChorePeriod.hidden = oneOff;
    el.chorePeriodLabel.textContent = periodLabel();

    var tasks = visibleTasks();
    var key = periodKey();
    var resolved = tasks.filter(function (t) { return completionFor(t.id, key); });
    el.choreProgressText.textContent = resolved.length + " of " + tasks.length + " resolved";
    var pct = tasks.length ? Math.round(resolved.length / tasks.length * 100) : 0;
    el.choreProgressBar.style.width = pct + "%";
    el.choreList.innerHTML = tasks.length ? tasks.map(function (t) { return taskHtml(t, key); }).join("") : '<div class="chore-empty"><strong>No chores here yet.</strong><span>Use “Add to this section” to create one.</span></div>';
    renderOverallSummary();
    renderGlance();
  }

  function visibleTasks() { return tasksFor(state.cadence); }
  function tasksFor(cadence) { return state.tasks.filter(function (t) { return t.active !== false && t.cadence === cadence; }); }

  function taskHtml(task, key) {
    var c = completionFor(task.id, key);
    var assignment = assignmentFor(task.id, key);
    var resolved = !!c;
    var statusClass = resolved ? (isNotNeeded(c) ? " is-not-needed" : " is-complete") : "";
    var details = [task.timing, task.target_completion].filter(Boolean).join(" · ");
    var owner = task.assigned_to || "Shared";
    var periodOwner = assignment ? assignment.assigned_to : "";
    var completionHtml;

    if (!c) {
      completionHtml = '<button class="chore-status-button" type="button" data-check-chore="' + escAttr(task.id) + '"><span class="status-dot"></span><span>Mark as…</span></button>';
    } else if (isNotNeeded(c)) {
      completionHtml = '<button class="chore-status-button is-not-needed" type="button" data-check-chore="' + escAttr(task.id) + '"><span class="status-icon">⊘</span><span><strong>Not needed</strong><small>Tap to undo</small></span></button>';
    } else {
      completionHtml = '<button class="chore-status-button is-done" type="button" data-check-chore="' + escAttr(task.id) + '"><span class="person-badge">' + esc(initials(c.completed_by)) + '</span><span><strong>Done by ' + esc(c.completed_by) + '</strong><small>' + esc(completedTime(c.completed_at)) + '</small></span></button>';
    }

    return '' +
      '<article class="chore-row' + statusClass + '">' +
        '<button class="chore-check" type="button" data-check-chore="' + escAttr(task.id) + '" aria-label="' + (resolved ? 'Change status for ' : 'Complete ') + escAttr(task.title) + '"><span>' + (resolved ? (isNotNeeded(c) ? '–' : '✓') : '') + '</span></button>' +
        '<div class="chore-row-copy"><strong>' + esc(task.title) + '</strong>' +
          (task.description ? '<p>' + esc(task.description) + '</p>' : '') +
          (task.condition_text ? '<small class="chore-condition">' + esc(task.condition_text) + '</small>' : '') +
          (details ? '<small class="chore-timing-inline">' + esc(details) + '</small>' : '') +
        '</div>' +
        '<div class="chore-owner-cell"><small>Ongoing</small><span class="owner-chip' + (owner === 'Shared' ? ' is-shared' : '') + '"><span>' + esc(initials(owner)) + '</span>' + esc(owner) + '</span></div>' +
        '<button class="chore-assignment-button' + (periodOwner ? ' has-override' : '') + '" type="button" data-assign-chore="' + escAttr(task.id) + '"><small>This ' + esc(periodNoun()) + '</small><strong>' + (periodOwner ? esc(periodOwner) : 'No override') + '</strong><span>' + (periodOwner ? 'Change' : 'Assign') + '</span></button>' +
        '<div class="chore-completion-cell">' + completionHtml + '</div>' +
        '<button class="chore-edit-button" type="button" data-edit-chore="' + escAttr(task.id) + '" aria-label="Edit ' + escAttr(task.title) + '">Edit</button>' +
      '</article>';
  }

  function renderOverallSummary() {
    var active = state.tasks.filter(function (t) { return t.active !== false; });
    var current = [];
    active.forEach(function (t) {
      var c = completionFor(t.id, periodKeyFor(t.cadence));
      if (c) current.push(c);
    });
    var pct = active.length ? Math.round(current.length / active.length * 100) : 0;
    el.chorePercent.textContent = pct + "%";
    el.choreSummaryText.textContent = active.length ? (current.length + " of " + active.length + " active chores resolved") : "No active chores";

    var owners = {};
    active.forEach(function (t) {
      var owner = t.assigned_to || "Shared";
      owners[owner] = (owners[owner] || 0) + 1;
    });
    var names = Object.keys(owners).sort(function (a, b) {
      if (a === "Shared") return 1;
      if (b === "Shared") return -1;
      return a.localeCompare(b);
    });
    el.chorePeople.innerHTML = names.length ? names.map(function (n) {
      return '<div><span class="person-badge">' + esc(initials(n)) + '</span><strong>' + esc(n) + '</strong><small>' + owners[n] + ' ongoing</small></div>';
    }).join("") : '<p class="muted-copy">No ongoing owners set.</p>';
  }

  function renderGlance() {
    var ids = { weekly: "weeklyGlanceCount", monthly: "monthlyGlanceCount", optional: "optionalGlanceCount", one_off: "oneOffGlanceCount" };
    Object.keys(ids).forEach(function (cadence) {
      var tasks = tasksFor(cadence), key = periodKeyFor(cadence), resolved = tasks.filter(function (t) { return completionFor(t.id, key); }).length;
      var node = document.getElementById(ids[cadence]);
      if (node) node.textContent = resolved + " of " + tasks.length + " resolved";
    });
    document.querySelectorAll("[data-cadence-jump]").forEach(function (b) { b.classList.toggle("is-active", b.dataset.cadenceJump === state.cadence); });
  }

  function completionFor(taskId, key) {
    return state.completions.find(function (c) { return String(c.task_id) === String(taskId) && c.period_key === key; });
  }
  function assignmentFor(taskId, key) {
    return state.assignments.find(function (a) { return String(a.task_id) === String(taskId) && a.period_key === key; });
  }
  function isNotNeeded(c) { return c && c.completion_status === "not_needed"; }

  function periodKey() { return periodKeyFor(state.cadence); }
  function periodKeyFor(cadence) {
    if (cadence === "one_off") return "once";
    if (cadence === "daily") return isoDate(state.anchor);
    if (cadence === "weekly" || cadence === "optional") return isoDate(startOfWeek(state.anchor));
    return state.anchor.getFullYear() + "-" + String(state.anchor.getMonth() + 1).padStart(2, "0");
  }
  function periodNoun() {
    if (state.cadence === "daily") return "day";
    if (state.cadence === "weekly" || state.cadence === "optional") return "week";
    if (state.cadence === "monthly") return "month";
    return "task";
  }
  function periodLabel() {
    if (state.cadence === "one_off") return "One-off projects";
    if (state.cadence === "daily") return state.anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
    if (state.cadence === "weekly" || state.cadence === "optional") {
      var s = startOfWeek(state.anchor), e = new Date(s); e.setDate(e.getDate() + 6);
      return "Week of " + s.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " – " + e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    return state.anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  function movePeriod(delta) {
    if (state.cadence === "daily") state.anchor.setDate(state.anchor.getDate() + delta);
    else if (state.cadence === "weekly" || state.cadence === "optional") state.anchor.setDate(state.anchor.getDate() + delta * 7);
    else if (state.cadence === "monthly") state.anchor.setMonth(state.anchor.getMonth() + delta);
    state.anchor = startOfDay(state.anchor);
    render();
  }

  function toggleCompletion(id) {
    var c = completionFor(id, periodKey());
    if (c) { undoCompletion(c); return; }
    state.completingId = id;
    var t = state.tasks.find(function (x) { return String(x.id) === String(id); });
    var a = assignmentFor(id, periodKey());
    var suggested = a ? a.assigned_to : (t && t.assigned_to ? t.assigned_to : "");
    el.completeChoreName.textContent = t ? t.title : "";
    el.completionOtherName.value = suggested && suggested !== "Keith" && suggested !== "Jah" && suggested !== "Shared" ? suggested : "";
    el.completeFormMessage.textContent = suggested && suggested !== "Shared" ? ("Assigned to " + suggested + " for this " + periodNoun() + ".") : "";
    el.completeChoreModal.hidden = false;
    document.body.classList.add("modal-open");
  }

  async function saveCompletion(status, name) {
    if (!state.completingId) return;
    el.completeFormMessage.textContent = "Saving...";
    var data = {
      task_id: state.completingId,
      period_key: periodKey(),
      completion_status: status,
      completed_by: status === "not_needed" ? null : name,
      completed_at: new Date().toISOString()
    };
    var r = await state.client.from("chore_completions").insert(data).select();
    if (r.error) { el.completeFormMessage.textContent = friendlyError(r.error); return; }
    closeCompleteModal();
    await load();
  }

  async function undoCompletion(c) {
    var label = isNotNeeded(c) ? "Mark this chore as needed again for this period?" : "Mark this chore as not done for this period?";
    if (!window.confirm(label)) return;
    var r = await state.client.from("chore_completions").delete().eq("id", c.id);
    if (r.error) { setConnection("error", "Could not undo chore", friendlyError(r.error)); return; }
    await load();
  }
  function closeCompleteModal() {
    el.completeChoreModal.hidden = true;
    state.completingId = null;
    document.body.classList.remove("modal-open");
  }

  function openAssignmentModal(id) {
    state.assigningId = id;
    var t = state.tasks.find(function (x) { return String(x.id) === String(id); });
    var a = assignmentFor(id, periodKey());
    el.assignChoreName.textContent = t ? t.title : "";
    el.assignPeriodLabel.textContent = periodLabel();
    el.assignmentOtherName.value = a && a.assigned_to !== "Keith" && a.assigned_to !== "Jah" && a.assigned_to !== "Shared" ? a.assigned_to : "";
    el.assignmentFormMessage.textContent = a ? ("Currently assigned to " + a.assigned_to + " for this " + periodNoun() + ".") : "No one-off assignment set. Ongoing ownership will apply.";
    el.clearAssignmentButton.hidden = !a;
    el.assignChoreModal.hidden = false;
    document.body.classList.add("modal-open");
  }

  async function savePeriodAssignment(name) {
    if (!state.assigningId) return;
    el.assignmentFormMessage.textContent = "Saving...";
    var data = { task_id: state.assigningId, period_key: periodKey(), assigned_to: name, assigned_at: new Date().toISOString() };
    var r = await state.client.from("chore_assignments").upsert(data, { onConflict: "task_id,period_key" }).select();
    if (r.error) { el.assignmentFormMessage.textContent = friendlyError(r.error); return; }
    closeAssignmentModal();
    await load();
  }

  async function clearPeriodAssignment() {
    if (!state.assigningId) return;
    el.assignmentFormMessage.textContent = "Removing assignment...";
    var r = await state.client.from("chore_assignments").delete().eq("task_id", state.assigningId).eq("period_key", periodKey());
    if (r.error) { el.assignmentFormMessage.textContent = friendlyError(r.error); return; }
    closeAssignmentModal();
    await load();
  }
  function closeAssignmentModal() {
    el.assignChoreModal.hidden = true;
    state.assigningId = null;
    document.body.classList.remove("modal-open");
  }

  function openTaskById(id) {
    var t = state.tasks.find(function (x) { return String(x.id) === String(id); });
    if (t) openTaskModal(t);
  }
  function openTaskModal(t) {
    state.editingId = t ? t.id : null;
    el.choreForm.reset();
    el.choreModalTitle.textContent = t ? "Edit chore" : "Add chore";
    el.choreId.value = t ? t.id : "";
    el.choreTitle.value = t ? t.title || "" : "";
    el.choreCadence.value = t ? t.cadence : state.cadence;
    var owner = t ? (t.assigned_to || "") : "";
    if (owner === "" || owner === "Keith" || owner === "Jah") {
      el.choreAssigned.value = owner;
      el.choreAssignedOther.value = "";
    } else {
      el.choreAssigned.value = "__other__";
      el.choreAssignedOther.value = owner;
    }
    syncOngoingOwnerOther();
    el.choreDescription.value = t ? t.description || "" : "";
    el.choreTiming.value = t ? t.timing || "" : "";
    el.choreTarget.value = t ? t.target_completion || "" : "";
    el.choreCondition.value = t ? t.condition_text || "" : "";
    el.deleteChoreButton.hidden = !t;
    el.choreFormMessage.textContent = "";
    el.choreModal.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(function () { el.choreTitle.focus(); }, 0);
  }
  function syncOngoingOwnerOther() {
    var other = el.choreAssigned.value === "__other__";
    el.choreAssignedOther.hidden = !other;
    el.choreAssignedOther.required = other;
  }
  function closeTaskModal() {
    el.choreModal.hidden = true;
    state.editingId = null;
    document.body.classList.remove("modal-open");
  }
  async function saveTask(e) {
    e.preventDefault();
    var title = el.choreTitle.value.trim();
    if (!title) { el.choreFormMessage.textContent = "Give the chore a title."; return; }
    var owner = el.choreAssigned.value;
    if (owner === "__other__") {
      owner = el.choreAssignedOther.value.trim();
      if (!owner) { el.choreFormMessage.textContent = "Enter the ongoing owner's name."; return; }
    }
    var data = {
      title: title,
      cadence: el.choreCadence.value,
      assigned_to: owner || null,
      description: el.choreDescription.value.trim() || null,
      timing: el.choreTiming.value.trim() || null,
      target_completion: el.choreTarget.value.trim() || null,
      condition_text: el.choreCondition.value.trim() || null,
      active: true,
      updated_at: new Date().toISOString()
    };
    el.saveChoreButton.disabled = true;
    el.choreFormMessage.textContent = "Saving...";
    var q;
    if (state.editingId) q = state.client.from("chore_tasks").update(data).eq("id", state.editingId);
    else { data.id = "custom_" + Date.now(); q = state.client.from("chore_tasks").insert(data); }
    var r = await q.select();
    el.saveChoreButton.disabled = false;
    if (r.error) { el.choreFormMessage.textContent = friendlyError(r.error); return; }
    state.cadence = data.cadence;
    closeTaskModal();
    await load();
  }

  async function deleteTask() {
    if (!state.editingId) return;
    if (!window.confirm("Delete this chore and its saved completion/assignment history?")) return;
    el.deleteChoreButton.disabled = true;
    var r = await state.client.from("chore_tasks").delete().eq("id", state.editingId);
    el.deleteChoreButton.disabled = false;
    if (r.error) { el.choreFormMessage.textContent = friendlyError(r.error); return; }
    closeTaskModal();
    await load();
  }

  function setConnection(s, t, m) {
    el.choreConnection.dataset.state = s;
    el.choreConnectionTitle.textContent = t;
    el.choreConnectionMessage.textContent = m;
  }
  function friendlyError(error) {
    var m = error && error.message ? String(error.message) : "Unknown Supabase error.";
    var l = m.toLowerCase();
    if (l.indexOf("chore_assignments") !== -1 || l.indexOf("completion_status") !== -1 || l.indexOf("completed_by") !== -1) return "Run chores-assignment-upgrade.sql in the Supabase SQL Editor, then refresh this page.";
    if (l.indexOf("could not find the table") !== -1 || l.indexOf("schema cache") !== -1) return "Run the chores SQL setup/upgrade in the Supabase SQL Editor, then refresh this page.";
    if (l.indexOf("row-level security") !== -1 || l.indexOf("permission denied") !== -1) return "Supabase connected but the chores tables are not writable. Re-run chores-assignment-upgrade.sql to restore their policies.";
    return m;
  }

  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function startOfWeek(d) { var x = startOfDay(d), day = x.getDay(), diff = day === 0 ? -6 : 1 - day; x.setDate(x.getDate() + diff); return x; }
  function isoDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function completedTime(v) { if (!v) return ""; var d = new Date(v); return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  function initials(n) { if (n === "Shared") return "S"; return String(n || "?").trim().split(/\s+/).map(function (x) { return x[0] || ""; }).join("").slice(0, 2).toUpperCase(); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>\"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function escAttr(v) { return esc(v).replace(/'/g, "&#39;"); }
}());
