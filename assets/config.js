(function () {
  "use strict";

  var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  var PERIOD_LABELS = { morning: "Morning", daytime: "Daytime", afternoon: "Afternoon", evening: "Evening", bedtime: "Bedtime" };
  var ICONS = { nursery: "🏫", yiayia: "👵", office: "🏢", home: "🏠", pickup: "🤗", kayak: "🛶", bedtime: "🌙", work: "💼", dayoff: "☕", clean: "✨", family: "👪", calendar: "📅" };
  var state = { client: null, rows: [], filter: "all", editingId: null };
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
    ["routineConnection","routineConnectionTitle","routineConnectionMessage","refreshRoutineButton","routineFilter","routineCountPill","routineList","routineModal","routineModalTitle","routineForm","routineId","routineTitle","routineDay","routineWeek","routinePeriod","routineTime","routineOwner","routineCategory","routineIcon","routineTags","routineDetail","routineActive","routineFormMessage","deleteRoutineButton","saveRoutineButton","addRoutineButton"].forEach(function (id) { el[id] = document.getElementById(id); });
  }

  function bind() {
    el.refreshRoutineButton.addEventListener("click", load);
    el.routineFilter.addEventListener("change", function () { state.filter = el.routineFilter.value; render(); });
    el.addRoutineButton.addEventListener("click", function () { openModal(null); });
    el.routineList.addEventListener("click", function (event) {
      var edit = event.target.closest("[data-edit-routine]");
      if (edit) { openById(edit.getAttribute("data-edit-routine")); return; }
      var toggle = event.target.closest("[data-toggle-routine]");
      if (toggle) { toggleActive(toggle.getAttribute("data-toggle-routine")); }
    });
    document.querySelectorAll("[data-close-routine]").forEach(function (button) { button.addEventListener("click", closeModal); });
    el.routineModal.addEventListener("click", function (event) { if (event.target === el.routineModal) { closeModal(); } });
    el.routineForm.addEventListener("submit", save);
    el.deleteRoutineButton.addEventListener("click", remove);
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && !el.routineModal.hidden) { closeModal(); } });
  }

  async function load() {
    setConnection("loading", "Connecting to recurring tasks", "Loading the shared routine from Supabase.");
    el.refreshRoutineButton.disabled = true;
    var result = await state.client.from("recurring_tasks").select("*").order("day_of_week", { ascending: true }).order("sort_order", { ascending: true });
    el.refreshRoutineButton.disabled = false;
    if (result.error) {
      state.rows = [];
      setConnection("error", "Recurring tasks table not ready", friendlyError(result.error));
      render();
      return;
    }
    state.rows = result.data || [];
    setConnection("ready", "Routine connected", state.rows.length + " recurring task" + (state.rows.length === 1 ? "" : "s") + " loaded from Supabase.");
    render();
  }

  function render() {
    var rows = filteredRows();
    el.routineCountPill.textContent = rows.length + " task" + (rows.length === 1 ? "" : "s");
    el.routineList.innerHTML = DAYS.map(function (day, index) {
      var dayRows = rows.filter(function (row) { return Number(row.day_of_week) === index + 1; });
      var cards = dayRows.length ? dayRows.map(cardHtml).join("") : '<div class="config-empty">No recurring tasks for this day.</div>';
      return '<article class="panel config-day"><header class="config-day-header"><div><p class="section-kicker">Day ' + (index + 1) + '</p><h2>' + esc(day) + '</h2></div><span>' + dayRows.length + '</span></header><div class="config-task-list">' + cards + '</div></article>';
    }).join("");
  }

  function filteredRows() {
    return state.rows.filter(function (row) {
      if (state.filter === "active") { return row.active !== false; }
      if (state.filter === "inactive") { return row.active === false; }
      if (state.filter === "A" || state.filter === "B") { return row.week_pattern === state.filter; }
      return true;
    });
  }

  function cardHtml(row) {
    var icon = ICONS[row.icon_key] || ICONS.calendar;
    var week = row.week_pattern === "A" ? "Week A" : row.week_pattern === "B" ? "Week B" : "Every week";
    var meta = [PERIOD_LABELS[row.period] || row.period, row.event_time ? String(row.event_time).slice(0,5) : "", row.owner || "Shared", week].filter(Boolean).join(" · ");
    return '<div class="config-task ' + (row.active === false ? 'is-inactive' : '') + '"><button class="config-task-main" type="button" data-edit-routine="' + escAttr(row.id) + '"><span class="config-task-icon">' + esc(icon) + '</span><span class="config-task-copy"><strong>' + esc(row.title) + '</strong><span>' + esc(meta) + '</span>' + (row.detail ? '<small>' + esc(row.detail) + '</small>' : '') + '</span><span class="config-edit-cue">Edit</span></button><button class="config-active-toggle" type="button" data-toggle-routine="' + escAttr(row.id) + '" aria-label="' + (row.active === false ? 'Enable' : 'Disable') + ' ' + escAttr(row.title) + '"><span></span>' + (row.active === false ? 'Off' : 'On') + '</button></div>';
  }

  function openById(id) {
    var row = state.rows.find(function (item) { return String(item.id) === String(id); });
    if (row) { openModal(row); }
  }

  function openModal(row) {
    state.editingId = row ? row.id : null;
    el.routineForm.reset();
    el.routineModalTitle.textContent = row ? "Edit recurring task" : "Add recurring task";
    el.routineId.value = row ? row.id : "";
    el.routineTitle.value = row ? row.title || "" : "";
    el.routineDay.value = row ? String(row.day_of_week || 1) : "1";
    el.routineWeek.value = row ? row.week_pattern || "EVERY" : "EVERY";
    el.routinePeriod.value = row ? row.period || "daytime" : "daytime";
    el.routineTime.value = row && row.event_time ? String(row.event_time).slice(0,5) : "";
    el.routineOwner.value = row ? row.owner || "" : "";
    el.routineCategory.value = row ? row.category || "other" : "other";
    el.routineIcon.value = row && ICONS[row.icon_key] ? row.icon_key : "calendar";
    el.routineTags.value = row && Array.isArray(row.tags) ? row.tags.join(", ") : "";
    el.routineDetail.value = row ? row.detail || "" : "";
    el.routineActive.checked = row ? row.active !== false : true;
    el.deleteRoutineButton.hidden = !row;
    el.routineFormMessage.textContent = "";
    el.routineModal.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(function () { el.routineTitle.focus(); }, 0);
  }

  function closeModal() { el.routineModal.hidden = true; document.body.classList.remove("modal-open"); state.editingId = null; }

  function payload() {
    var tags = el.routineTags.value.split(",").map(function (tag) { return tag.trim().toLowerCase(); }).filter(Boolean);
    var owner = el.routineOwner.value.trim();
    if (owner) { tags.push(owner.toLowerCase()); }
    tags.push(el.routineCategory.value);
    return {
      title: el.routineTitle.value.trim(), day_of_week: Number(el.routineDay.value), week_pattern: el.routineWeek.value,
      period: el.routinePeriod.value, event_time: el.routineTime.value || null, owner: owner || null,
      category: el.routineCategory.value, icon_key: el.routineIcon.value, tags: Array.from(new Set(tags)),
      detail: el.routineDetail.value.trim() || null, active: el.routineActive.checked, updated_at: new Date().toISOString()
    };
  }

  async function save(event) {
    event.preventDefault();
    var data = payload();
    if (!data.title) { el.routineFormMessage.textContent = "Give the recurring task a title."; return; }
    setBusy(true); el.routineFormMessage.textContent = "Saving...";
    var query = state.editingId ? state.client.from("recurring_tasks").update(data).eq("id", state.editingId) : state.client.from("recurring_tasks").insert(data);
    var result = await query.select();
    setBusy(false);
    if (result.error) { el.routineFormMessage.textContent = friendlyError(result.error); return; }
    closeModal(); await load();
  }

  async function toggleActive(id) {
    var row = state.rows.find(function (item) { return String(item.id) === String(id); });
    if (!row) { return; }
    var result = await state.client.from("recurring_tasks").update({ active: row.active === false, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (result.error) { setConnection("error", "Could not update task", friendlyError(result.error)); return; }
    await load();
  }

  async function remove() {
    if (!state.editingId) { return; }
    if (!window.confirm("Delete this recurring task? This removes it from every future week.")) { return; }
    setBusy(true); el.routineFormMessage.textContent = "Deleting...";
    var result = await state.client.from("recurring_tasks").delete().eq("id", state.editingId);
    setBusy(false);
    if (result.error) { el.routineFormMessage.textContent = friendlyError(result.error); return; }
    closeModal(); await load();
  }

  function setBusy(busy) { el.saveRoutineButton.disabled = busy; el.deleteRoutineButton.disabled = busy; }
  function setConnection(name, title, message) { el.routineConnection.setAttribute("data-state", name); el.routineConnectionTitle.textContent = title; el.routineConnectionMessage.textContent = message; }
  function friendlyError(error) {
    var message = error && error.message ? String(error.message) : "Unknown Supabase error.";
    var lower = message.toLowerCase();
    if (lower.indexOf("could not find the table") !== -1 || lower.indexOf("schema cache") !== -1) { return "Run recurring-tasks-setup.sql in the Supabase SQL Editor, then refresh this page."; }
    if (lower.indexOf("row-level security") !== -1 || lower.indexOf("permission denied") !== -1) { return "Supabase connected but the site cannot write recurring_tasks. Re-run recurring-tasks-setup.sql to restore its policies."; }
    return message;
  }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>\"]/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]; }); }
  function escAttr(value) { return esc(value).replace(/'/g, "&#39;"); }
}());
