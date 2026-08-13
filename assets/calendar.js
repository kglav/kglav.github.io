(function () {
  "use strict";

  var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  var DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  var PERIODS = ["morning", "daytime", "afternoon", "evening", "bedtime"];
  var PERIOD_LABELS = {
    morning: "Morning",
    daytime: "Daytime",
    afternoon: "Afternoon",
    evening: "Evening",
    bedtime: "Bedtime"
  };
  var FILTERS = [
    { id: "all", label: "All" },
    { id: "angela", label: "Angela" },
    { id: "keith", label: "Keith" },
    { id: "jah", label: "Jah" },
    { id: "work", label: "Work" },
    { id: "childcare", label: "Childcare" },
    { id: "home", label: "Home" },
    { id: "activity", label: "Activities" }
  ];
  var ICONS = {
    nursery: "\uD83C\uDFEB",
    yiayia: "\uD83D\uDC75",
    office: "\uD83C\uDFE2",
    home: "\uD83C\uDFE0",
    pickup: "\uD83E\uDD17",
    kayak: "\uD83D\uDEF6",
    bedtime: "\uD83C\uDF19",
    work: "\uD83D\uDCBC",
    dayoff: "\u2615",
    clean: "\u2728",
    family: "\uD83D\uDC6A",
    calendar: "\uD83D\uDCC5"
  };
  var WEEK_A_ANCHOR = new Date(2026, 7, 3, 12, 0, 0, 0);

  var state = {
    weekStart: startOfWeek(new Date()),
    weekType: "A",
    selectedDay: weekdayIndex(new Date()),
    filter: "all",
    calendarEntries: [],
    calendarLoading: true,
    calendarReady: false,
    calendarError: "",
    repository: null,
    recurringTasks: [],
    recurringReady: false,
    recurringError: "",
    recurringRepository: null,
    editingEntryId: null
  };

  if (state.selectedDay < 0 || state.selectedDay > 4) {
    state.selectedDay = 0;
  }
  state.weekType = weekTypeForDate(state.weekStart);

  var elements = {};

  document.addEventListener("DOMContentLoaded", initialise);

  function initialise() {
    cacheElements();
    bindEvents();
    renderAll();
    connectCalendar();
  }

  function cacheElements() {
    elements.heroDateLabel = document.getElementById("heroDateLabel");
    elements.heroWeekLabel = document.getElementById("heroWeekLabel");
    elements.previousWeekButton = document.getElementById("previousWeekButton");
    elements.currentWeekButton = document.getElementById("currentWeekButton");
    elements.nextWeekButton = document.getElementById("nextWeekButton");
    elements.weekTypeToggle = document.getElementById("weekTypeToggle");
    elements.weekSummary = document.getElementById("weekSummary");
    elements.focusDayHeading = document.getElementById("focusDayHeading");
    elements.focusDateLabel = document.getElementById("focusDateLabel");
    elements.daySelector = document.getElementById("daySelector");
    elements.focusTimeline = document.getElementById("focusTimeline");
    elements.calendarFilters = document.getElementById("calendarFilters");
    elements.weekRangePill = document.getElementById("weekRangePill");
    elements.weekBoard = document.getElementById("weekBoard");
    elements.peopleColumns = document.getElementById("peopleColumns");
    elements.sharedEntryList = document.getElementById("sharedEntryList");
    elements.glanceGrid = document.getElementById("glanceGrid");
    elements.calendarConnection = document.getElementById("calendarConnection");
    elements.calendarConnectionTitle = document.getElementById("calendarConnectionTitle");
    elements.calendarConnectionMessage = document.getElementById("calendarConnectionMessage");
    elements.refreshCalendarButton = document.getElementById("refreshCalendarButton");
    elements.footerSyncLabel = document.getElementById("footerSyncLabel");
    elements.eventModal = document.getElementById("eventModal");
    elements.eventModalTitle = document.getElementById("eventModalTitle");
    elements.eventForm = document.getElementById("eventForm");
    elements.eventRecordId = document.getElementById("eventRecordId");
    elements.eventTitle = document.getElementById("eventTitle");
    elements.eventDate = document.getElementById("eventDate");
    elements.eventTime = document.getElementById("eventTime");
    elements.eventCategory = document.getElementById("eventCategory");
    elements.eventPerson = document.getElementById("eventPerson");
    elements.eventNotes = document.getElementById("eventNotes");
    elements.eventFormMessage = document.getElementById("eventFormMessage");
    elements.saveEventButton = document.getElementById("saveEventButton");
    elements.deleteEventButton = document.getElementById("deleteEventButton");
  }

  function bindEvents() {
    elements.previousWeekButton.addEventListener("click", function () {
      state.weekStart = addDays(state.weekStart, -7);
      state.weekType = weekTypeForDate(state.weekStart);
      renderAll();
    });

    elements.nextWeekButton.addEventListener("click", function () {
      state.weekStart = addDays(state.weekStart, 7);
      state.weekType = weekTypeForDate(state.weekStart);
      renderAll();
    });

    elements.currentWeekButton.addEventListener("click", function () {
      var today = new Date();
      state.weekStart = startOfWeek(today);
      state.weekType = weekTypeForDate(state.weekStart);
      state.selectedDay = weekdayIndex(today);
      if (state.selectedDay < 0 || state.selectedDay > 4) {
        state.selectedDay = 0;
      }
      renderAll();
    });

    elements.weekTypeToggle.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-week-type]");
      if (!button) {
        return;
      }
      state.weekType = button.getAttribute("data-week-type") === "B" ? "B" : "A";
      renderAll();
    });

    elements.daySelector.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-day-index]");
      if (!button) {
        return;
      }
      state.selectedDay = Number(button.getAttribute("data-day-index"));
      renderAll();
    });

    elements.calendarFilters.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-filter]");
      if (!button) {
        return;
      }
      state.filter = button.getAttribute("data-filter") || "all";
      renderAll();
    });

    elements.weekBoard.addEventListener("click", function (event) {
      var addButton = event.target.closest("button[data-add-day]");
      if (addButton) {
        state.selectedDay = Number(addButton.getAttribute("data-add-day"));
        renderAll();
        openEventModal(null, dateForDay(state.selectedDay));
        return;
      }

      var dayButton = event.target.closest("button[data-select-day]");
      if (dayButton) {
        state.selectedDay = Number(dayButton.getAttribute("data-select-day"));
        renderAll();
        return;
      }

      var sharedButton = event.target.closest("button[data-entry-id]");
      if (sharedButton) {
        openEntryById(sharedButton.getAttribute("data-entry-id"));
        return;
      }

      var scheduleButton = event.target.closest("button.schedule-event");
      if (scheduleButton) {
        scheduleButton.classList.toggle("is-expanded");
      }
    });

    elements.sharedEntryList.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-entry-id]");
      if (button) {
        openEntryById(button.getAttribute("data-entry-id"));
      }
    });

    document.querySelectorAll("[data-open-event-modal]").forEach(function (button) {
      button.addEventListener("click", function () {
        openEventModal(null, dateForDay(state.selectedDay));
      });
    });

    document.querySelectorAll("[data-close-event-modal]").forEach(function (button) {
      button.addEventListener("click", closeEventModal);
    });

    elements.eventModal.addEventListener("click", function (event) {
      if (event.target === elements.eventModal) {
        closeEventModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !elements.eventModal.hidden) {
        closeEventModal();
      }
    });

    elements.eventForm.addEventListener("submit", saveEvent);
    elements.deleteEventButton.addEventListener("click", deleteEvent);
    elements.refreshCalendarButton.addEventListener("click", loadCalendarEntries);
  }

  function renderAll() {
    renderHeader();
    renderWeekToggle();
    renderDaySelector();
    renderFilters();
    renderFocus();
    renderWeekBoard();
    renderPeopleColumns();
    renderSharedEntries();
    renderGlance();
    renderConnection();
  }

  function renderHeader() {
    var end = addDays(state.weekStart, 4);
    elements.heroDateLabel.textContent = formatDate(state.weekStart, { day: "numeric", month: "short" }) + " - " + formatDate(end, { day: "numeric", month: "short", year: "numeric" });
    elements.heroWeekLabel.textContent = "Week " + state.weekType;
    elements.weekRangePill.textContent = formatDate(state.weekStart, { day: "numeric", month: "long" }) + " - " + formatDate(end, { day: "numeric", month: "long" });
  }

  function renderWeekToggle() {
    elements.weekTypeToggle.querySelectorAll("button[data-week-type]").forEach(function (button) {
      var active = button.getAttribute("data-week-type") === state.weekType;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    var schedule = getSchedule(state.weekType);
    var total = schedule.reduce(function (sum, day) { return sum + day.events.length; }, 0);
    var specific = state.recurringTasks.filter(function (task) {
      return task.active !== false && String(task.week_pattern || "EVERY").toUpperCase() === state.weekType;
    }).slice(0, 3);
    var items = specific.map(function (task) {
      return DAY_NAMES[Number(task.day_of_week) - 1] + ": " + task.title + (task.owner ? " - " + task.owner : "");
    });
    if (!items.length) {
      items.push("This week uses the shared recurring routine.");
    }
    items.push("Use Routine settings to make blanket changes without editing the site code.");

    elements.weekSummary.innerHTML = "<strong>Week " + escapeHtml(state.weekType) + " routine</strong><ul>" + items.map(function (item) {
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("") + "</ul><p class=\"muted-copy\">" + total + " recurring item" + (total === 1 ? "" : "s") + " this week.</p>";
  }

  function renderDaySelector() {
    elements.daySelector.innerHTML = DAY_SHORT.map(function (name, index) {
      var active = index === state.selectedDay;
      return "<button type=\"button\" data-day-index=\"" + index + "\" class=\"" + (active ? "is-active" : "") + "\" aria-pressed=\"" + (active ? "true" : "false") + "\">" + name + "</button>";
    }).join("");
  }

  function renderFilters() {
    elements.calendarFilters.innerHTML = FILTERS.map(function (filter) {
      var active = state.filter === filter.id;
      return "<button type=\"button\" class=\"filter-chip " + (active ? "is-active" : "") + "\" data-filter=\"" + filter.id + "\" aria-pressed=\"" + (active ? "true" : "false") + "\">" + escapeHtml(filter.label) + "</button>";
    }).join("");
  }

  function renderFocus() {
    var selectedDate = dateForDay(state.selectedDay);
    var selectedYmd = toYmd(selectedDate);
    var schedule = getSchedule(state.weekType)[state.selectedDay].events.slice();
    var sharedEvents = entriesForDate(selectedYmd).map(sharedEntryToEvent);
    var allEvents = schedule.concat(sharedEvents);

    elements.focusDayHeading.textContent = DAY_NAMES[state.selectedDay];
    elements.focusDateLabel.textContent = formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    elements.focusTimeline.innerHTML = PERIODS.map(function (period) {
      var events = allEvents.filter(function (item) {
        return item.period === period;
      });
      if (!events.length) {
        return "<div class=\"focus-item is-empty\"><span>Nothing planned for " + escapeHtml(PERIOD_LABELS[period].toLowerCase()) + "</span></div>";
      }
      var titles = events.map(function (item) { return item.title; }).join(" / ");
      var owners = unique(events.map(function (item) { return item.owner; }).filter(Boolean)).join(", ");
      return "<div class=\"focus-item\"><span class=\"focus-time\">" + escapeHtml(PERIOD_LABELS[period]) + "</span><span class=\"focus-icon\" aria-hidden=\"true\">" + escapeHtml(events[0].icon) + "</span><strong>" + escapeHtml(titles) + "</strong><small>" + escapeHtml(owners || "Shared plan") + "</small></div>";
    }).join("");
  }

  function renderWeekBoard() {
    var schedule = getSchedule(state.weekType);
    var todayYmd = toYmd(new Date());

    elements.weekBoard.innerHTML = schedule.map(function (day, index) {
      var date = dateForDay(index);
      var ymd = toYmd(date);
      var recurring = day.events.slice();
      var shared = entriesForDate(ymd).map(sharedEntryToEvent);
      var allEvents = recurring.concat(shared).filter(matchesFilter);
      var periodsHtml = PERIODS.map(function (period) {
        var periodEvents = allEvents.filter(function (item) {
          return item.period === period;
        });
        if (!periodEvents.length) {
          return "";
        }
        return "<p class=\"day-period\">" + escapeHtml(PERIOD_LABELS[period]) + "</p><div class=\"day-events\">" + periodEvents.map(renderEventCard).join("") + "</div>";
      }).join("");

      if (!periodsHtml) {
        periodsHtml = "<div class=\"no-events-note\">No items match this filter.</div>";
      }

      var classes = ["day-column"];
      if (index === state.selectedDay) {
        classes.push("is-selected");
      }
      if (ymd === todayYmd) {
        classes.push("is-today");
      }

      return "<article class=\"" + classes.join(" ") + "\"><header class=\"day-header\"><button type=\"button\" data-select-day=\"" + index + "\"><strong>" + escapeHtml(day.name) + "</strong><span>" + escapeHtml(formatDate(date, { day: "numeric", month: "short" })) + "</span></button><button class=\"day-add-button\" type=\"button\" data-add-day=\"" + index + "\" aria-label=\"Add entry on " + escapeHtml(day.name) + "\">+</button></header>" + periodsHtml + "</article>";
    }).join("");
  }

  function renderEventCard(item) {
    var sharedClass = item.shared ? " is-shared" : "";
    var categoryClass = " category-" + normaliseCategory(item.category);
    var idAttribute = item.shared && item.entryId !== null ? " data-entry-id=\"" + escapeAttribute(String(item.entryId)) + "\"" : "";
    var editLabel = item.shared ? " Edit" : "";
    return "<button type=\"button\" class=\"schedule-event" + categoryClass + sharedClass + "\"" + idAttribute + "><span class=\"event-topline\"><span class=\"event-icon\" aria-hidden=\"true\">" + escapeHtml(item.icon) + "</span><strong>" + escapeHtml(item.title) + "</strong><span class=\"event-owner\">" + escapeHtml(item.owner || "Shared") + escapeHtml(editLabel) + "</span></span><span class=\"event-detail\">" + escapeHtml(item.detail || "Tap again to close this detail.") + "</span></button>";
  }

  function renderPeopleColumns() {
    var selectedYmd = toYmd(dateForDay(state.selectedDay));
    var events = getSchedule(state.weekType)[state.selectedDay].events.concat(entriesForDate(selectedYmd).map(sharedEntryToEvent));
    var people = [
      { name: "Keith", className: "keith", initials: "K" },
      { name: "Jah", className: "jah", initials: "J" }
    ];

    elements.peopleColumns.innerHTML = people.map(function (person) {
      var tasks = events.filter(function (item) {
        return item.owner && item.owner.toLowerCase() === person.name.toLowerCase();
      });
      var tasksHtml = tasks.length ? tasks.map(function (item) {
        return "<div class=\"person-task\"><span aria-hidden=\"true\">" + escapeHtml(item.icon) + "</span><span>" + escapeHtml(item.title) + "</span></div>";
      }).join("") : "<p class=\"person-empty\">No assigned items for this day.</p>";
      return "<section class=\"person-column " + person.className + "\"><h3><span class=\"person-avatar\">" + person.initials + "</span>" + person.name + "</h3><div class=\"person-task-list\">" + tasksHtml + "</div></section>";
    }).join("");
  }

  function renderSharedEntries() {
    if (state.calendarLoading) {
      elements.sharedEntryList.innerHTML = emptyListHtml("Loading shared entries", "The recurring household routine is already available.");
      return;
    }

    if (state.calendarError) {
      elements.sharedEntryList.innerHTML = emptyListHtml("Shared entries unavailable", state.calendarError);
      return;
    }

    var entries = state.calendarEntries.slice().sort(compareEntries).slice(0, 12);
    if (!entries.length) {
      elements.sharedEntryList.innerHTML = emptyListHtml("No saved entries yet", "Use Add to place one-off plans into the shared Supabase calendar.");
      return;
    }

    elements.sharedEntryList.innerHTML = entries.map(function (entry) {
      var date = parseDateValue(entry.date);
      var dayNumber = date ? String(date.getDate()) : "--";
      var month = date ? formatDate(date, { month: "short" }) : "Date";
      var meta = [entry.time ? formatTime(entry.time) : "All day", entry.person || categoryLabel(entry.category)].filter(Boolean).join(" - ");
      var id = entry.id === null || typeof entry.id === "undefined" ? "" : String(entry.id);
      return "<button type=\"button\" class=\"shared-list-item\" data-entry-id=\"" + escapeAttribute(id) + "\" " + (id ? "" : "disabled") + "><span class=\"shared-date-badge\"><strong>" + escapeHtml(dayNumber) + "</strong><span>" + escapeHtml(month) + "</span></span><span class=\"shared-list-copy\"><strong>" + escapeHtml(entry.title || "Untitled entry") + "</strong><span>" + escapeHtml(meta) + "</span></span><span class=\"shared-edit-cue\">Edit</span></button>";
    }).join("");
  }

  function renderGlance() {
    var schedule = getSchedule(state.weekType);
    var flat = [];
    schedule.forEach(function (day, dayIndex) {
      day.events.forEach(function (item) {
        flat.push({ item: item, day: DAY_SHORT[dayIndex] });
      });
    });

    function linesFor(test) {
      var seen = {};
      return flat.filter(function (row) { return test(row.item); }).map(function (row) {
        var line = row.day + ": " + row.item.title;
        if (seen[line]) { return null; }
        seen[line] = true;
        return line;
      }).filter(Boolean).slice(0, 5);
    }

    var glance = [
      { icon: "\uD83D\uDC68", title: "Keith", items: linesFor(function (item) { return (item.owner || "").toLowerCase() === "keith"; }) },
      { icon: "\uD83D\uDC69", title: "Jah", items: linesFor(function (item) { return (item.owner || "").toLowerCase() === "jah"; }) },
      { icon: "\uD83D\uDC67", title: "Angela", items: linesFor(function (item) { return item.tags.indexOf("angela") !== -1; }) },
      { icon: "\uD83C\uDFE1", title: "Home", items: linesFor(function (item) { return item.category === "home"; }) }
    ];

    elements.glanceGrid.innerHTML = glance.map(function (card) {
      var items = card.items.length ? card.items : ["No recurring items for this week."];
      return "<article class=\"glance-card\"><span class=\"glance-icon\" aria-hidden=\"true\">" + escapeHtml(card.icon) + "</span><h3>" + escapeHtml(card.title) + "</h3><ul>" + items.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul></article>";
    }).join("");
  }

  function renderConnection() {
    var stateName = "loading";
    var title = "Connecting to the shared calendar";
    var message = "The recurring timetable is ready while Supabase connects.";
    var footer = "Recurring schedule available";

    if (state.calendarReady) {
      stateName = "ready";
      title = "Shared calendar connected";
      message = state.calendarEntries.length + " saved entr" + (state.calendarEntries.length === 1 ? "y" : "ies") + " loaded from calendar_entries.";
      if (state.recurringReady) {
        message += " " + state.recurringTasks.filter(function (task) { return task.active !== false; }).length + " recurring tasks loaded.";
      } else if (state.recurringError) {
        message += " Recurring tasks are using the built-in fallback until recurring_tasks is set up.";
      }
      footer = "Last refreshed " + formatDate(new Date(), { hour: "2-digit", minute: "2-digit" });
    } else if (state.calendarError) {
      stateName = "error";
      title = "Shared calendar could not connect";
      message = state.calendarError;
      footer = "Recurring timetable remains available";
    }

    elements.calendarConnection.setAttribute("data-state", stateName);
    elements.calendarConnectionTitle.textContent = title;
    elements.calendarConnectionMessage.textContent = message;
    elements.footerSyncLabel.textContent = footer;
    elements.refreshCalendarButton.disabled = state.calendarLoading;
  }

  function getSchedule(weekType) {
    if (!state.recurringReady) {
      return getDefaultSchedule(weekType);
    }
    var days = DAY_NAMES.map(function (name) { return { name: name, events: [] }; });
    state.recurringTasks.filter(function (task) {
      if (task.active === false) { return false; }
      var pattern = String(task.week_pattern || "EVERY").toUpperCase();
      return pattern === "EVERY" || pattern === weekType;
    }).sort(function (a, b) {
      return Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id || 0) - Number(b.id || 0);
    }).forEach(function (task) {
      var dayIndex = Number(task.day_of_week) - 1;
      if (dayIndex < 0 || dayIndex > 4) { return; }
      var category = normaliseCategory(task.category);
      var tags = Array.isArray(task.tags) ? task.tags.map(function (tag) { return String(tag).toLowerCase(); }) : [];
      var owner = task.owner || "Shared";
      if (owner) { tags.push(String(owner).toLowerCase()); }
      tags.push(category);
      days[dayIndex].events.push(eventItem(
        task.period || periodForTime(task.event_time),
        iconForRoutine(task.icon_key, category),
        task.title || "Recurring task",
        owner,
        category,
        unique(tags),
        task.detail || "Managed from Routine settings."
      ));
    });
    return days;
  }

  function iconForRoutine(iconKey, category) {
    var key = String(iconKey || "").toLowerCase();
    if (key && ICONS[key]) { return ICONS[key]; }
    return iconForCategory(category);
  }

  function getDefaultSchedule(weekType) {
    var tuesdayDropper = weekType === "A" ? "Keith" : "Jah";
    var fridayDropper = weekType === "A" ? "Jah" : "Keith";
    var tuesdayJahWork = weekType === "B" ? "Work from home" : "Work away from home";
    var fridayJahWork = weekType === "A" ? "Work from home" : "Work away from home";

    return [
      {
        name: "Monday",
        events: [
          eventItem("morning", ICONS.nursery, "Nursery drop-off", "Keith", "childcare", ["angela", "keith", "childcare"], "Keith takes Angela to nursery."),
          eventItem("daytime", ICONS.office, "Office", "Keith", "work", ["keith", "work"], "Keith works from the office."),
          eventItem("daytime", ICONS.work, "Work away from home", "Jah", "work", ["jah", "work"], "Jah follows her usual workday."),
          eventItem("afternoon", ICONS.pickup, "Nursery pickup", "Keith", "childcare", ["angela", "keith", "childcare"], "Keith collects Angela from nursery."),
          eventItem("bedtime", ICONS.bedtime, "Angela bedtime", "Keith", "family", ["angela", "keith", "family"], "Keith handles Angela's bedtime routine.")
        ]
      },
      {
        name: "Tuesday",
        events: [
          eventItem("morning", ICONS.nursery, "Nursery drop-off", tuesdayDropper, "childcare", ["angela", tuesdayDropper.toLowerCase(), "childcare"], tuesdayDropper + " takes Angela to nursery in Week " + weekType + "."),
          eventItem("daytime", ICONS.home, "Work from home", "Keith", "work", ["keith", "work", "home"], "Keith works from home."),
          eventItem("daytime", weekType === "B" ? ICONS.home : ICONS.work, tuesdayJahWork, "Jah", "work", ["jah", "work", weekType === "B" ? "home" : "work"], "Jah's WFH day follows her nursery drop-off week."),
          eventItem("afternoon", ICONS.pickup, "Nursery pickup", "Jah", "childcare", ["angela", "jah", "childcare"], "Jah collects Angela from nursery."),
          eventItem("evening", ICONS.kayak, "Kayaking", "Keith", "activity", ["keith", "activity"], "Keith kayaks in the evening."),
          eventItem("bedtime", ICONS.bedtime, "Angela bedtime", "Jah", "family", ["angela", "jah", "family"], "Jah handles Angela's bedtime routine.")
        ]
      },
      {
        name: "Wednesday",
        events: [
          eventItem("morning", ICONS.yiayia, "Yiayia drop-off", "Jah", "childcare", ["angela", "jah", "childcare"], "Jah takes Angela to Yiayia."),
          eventItem("daytime", ICONS.office, "Office", "Keith", "work", ["keith", "work"], "Keith works from the office."),
          eventItem("daytime", ICONS.dayoff, "Day off", "Jah", "home", ["jah", "home"], "Jah has her regular day off."),
          eventItem("afternoon", ICONS.pickup, "Yiayia pickup", "Jah", "childcare", ["angela", "jah", "childcare"], "Jah collects Angela from Yiayia."),
          eventItem("bedtime", ICONS.bedtime, "Angela bedtime", "Keith", "family", ["angela", "keith", "family"], "Keith handles Angela's bedtime routine.")
        ]
      },
      {
        name: "Thursday",
        events: [
          eventItem("morning", ICONS.nursery, "Nursery drop-off", "Keith", "childcare", ["angela", "keith", "childcare"], "Keith takes Angela to nursery."),
          eventItem("daytime", ICONS.home, "Work from home", "Keith", "work", ["keith", "work", "home"], "Keith works from home."),
          eventItem("daytime", ICONS.work, "Work away from home", "Jah", "work", ["jah", "work"], "Jah follows her usual workday."),
          eventItem("afternoon", ICONS.pickup, "Nursery pickup", "Jah", "childcare", ["angela", "jah", "childcare"], "Jah collects Angela from nursery."),
          eventItem("evening", ICONS.kayak, "Kayaking", "Keith", "activity", ["keith", "activity"], "Keith kayaks in the evening."),
          eventItem("bedtime", ICONS.bedtime, "Angela bedtime", "Jah", "family", ["angela", "jah", "family"], "Jah handles Angela's bedtime routine.")
        ]
      },
      {
        name: "Friday",
        events: [
          eventItem("morning", ICONS.nursery, "Nursery drop-off", fridayDropper, "childcare", ["angela", fridayDropper.toLowerCase(), "childcare"], fridayDropper + " takes Angela to nursery in Week " + weekType + "."),
          eventItem("daytime", ICONS.office, "Office", "Keith", "work", ["keith", "work"], "Keith works from the office."),
          eventItem("daytime", weekType === "A" ? ICONS.home : ICONS.work, fridayJahWork, "Jah", "work", ["jah", "work", weekType === "A" ? "home" : "work"], "Jah's WFH day follows her nursery drop-off week."),
          weekType === "A" ? eventItem("daytime", ICONS.clean, "Julie cleans", "Julie", "home", ["home"], "Julie comes while Jah is working from home.") : null,
          eventItem("afternoon", ICONS.pickup, "Nursery pickup", "Jah", "childcare", ["angela", "jah", "childcare"], "Jah collects Angela from nursery."),
          eventItem("bedtime", ICONS.bedtime, "Angela bedtime", "Keith", "family", ["angela", "keith", "family"], "Keith handles Angela's bedtime routine.")
        ].filter(Boolean)
      }
    ];
  }

  function eventItem(period, icon, title, owner, category, tags, detail) {
    return {
      period: period,
      icon: icon,
      title: title,
      owner: owner,
      category: category,
      tags: tags || [],
      detail: detail || "",
      shared: false,
      entryId: null
    };
  }

  function sharedEntryToEvent(entry) {
    var category = normaliseCategory(entry.category);
    var owner = entry.person || "Shared";
    var tags = [category, owner.toLowerCase()];
    if (owner.toLowerCase() === "angela" || category === "childcare" || category === "family") {
      tags.push("angela");
    }
    return {
      period: periodForTime(entry.time),
      icon: iconForCategory(category),
      title: (entry.time ? formatTime(entry.time) + " - " : "") + (entry.title || "Untitled entry"),
      owner: owner,
      category: category,
      tags: tags,
      detail: entry.notes || "Saved in the shared Supabase calendar.",
      shared: true,
      entryId: entry.id
    };
  }

  function matchesFilter(item) {
    if (state.filter === "all") {
      return true;
    }
    return item.category === state.filter || item.tags.indexOf(state.filter) !== -1;
  }

  function periodForTime(timeValue) {
    if (!timeValue) {
      return "daytime";
    }
    var text = String(timeValue);
    var hourMatch = text.match(/(?:T|^)(\d{1,2}):/);
    var hour = hourMatch ? Number(hourMatch[1]) : 12;
    if (hour < 11) {
      return "morning";
    }
    if (hour < 15) {
      return "daytime";
    }
    if (hour < 18) {
      return "afternoon";
    }
    if (hour < 20) {
      return "evening";
    }
    return "bedtime";
  }

  function iconForCategory(category) {
    if (category === "childcare") { return ICONS.nursery; }
    if (category === "work") { return ICONS.work; }
    if (category === "home") { return ICONS.home; }
    if (category === "activity") { return ICONS.kayak; }
    if (category === "family") { return ICONS.family; }
    return ICONS.calendar;
  }

  function normaliseCategory(value) {
    var category = String(value || "other").toLowerCase();
    if (category === "activities") { return "activity"; }
    if (["family", "childcare", "work", "home", "activity", "other"].indexOf(category) !== -1) {
      return category;
    }
    return "other";
  }

  function categoryLabel(value) {
    var category = normaliseCategory(value);
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  function entriesForDate(ymd) {
    return state.calendarEntries.filter(function (entry) {
      return normaliseDateString(entry.date) === ymd;
    }).sort(compareEntries);
  }

  async function connectCalendar() {
    var client = typeof window.getSiteSupabase === "function" ? window.getSiteSupabase() : null;
    if (!client) {
      state.calendarLoading = false;
      state.calendarReady = false;
      state.calendarError = "The Supabase browser library did not load. Check your internet connection and refresh.";
      renderAll();
      return;
    }

    state.repository = new AdaptiveCalendarRepository(client);
    state.recurringRepository = new RecurringTaskRepository(client);
    await Promise.all([loadCalendarEntries(), loadRecurringTasks()]);
  }

  async function loadRecurringTasks() {
    if (!state.recurringRepository) { return; }
    try {
      state.recurringTasks = await state.recurringRepository.list();
      state.recurringReady = true;
      state.recurringError = "";
    } catch (error) {
      state.recurringReady = false;
      state.recurringError = error && error.message ? String(error.message) : "Recurring tasks are unavailable.";
    }
    renderAll();
  }

  function RecurringTaskRepository(client) {
    this.client = client;
    this.tableName = "recurring_tasks";
  }

  RecurringTaskRepository.prototype.list = async function () {
    var result = await this.client.from(this.tableName).select("*").order("day_of_week", { ascending: true }).order("sort_order", { ascending: true });
    if (result.error) { throw result.error; }
    return result.data || [];
  };

  async function loadCalendarEntries() {
    if (!state.repository) {
      return;
    }
    state.calendarLoading = true;
    state.calendarError = "";
    renderConnection();
    renderSharedEntries();

    try {
      var rows = await state.repository.list();
      state.calendarEntries = rows.map(function (row) {
        return state.repository.normalise(row);
      });
      state.calendarReady = true;
      state.calendarError = "";
    } catch (error) {
      state.calendarReady = false;
      state.calendarError = friendlyCalendarError(error);
    } finally {
      state.calendarLoading = false;
      renderAll();
    }
  }

  function openEntryById(id) {
    if (!id) {
      return;
    }
    var entry = state.calendarEntries.find(function (item) {
      return String(item.id) === String(id);
    });
    if (entry) {
      openEventModal(entry);
    }
  }

  function openEventModal(entry, defaultDate) {
    state.editingEntryId = entry && entry.id !== null && typeof entry.id !== "undefined" ? entry.id : null;
    elements.eventForm.reset();
    elements.eventFormMessage.textContent = "";
    elements.eventFormMessage.classList.remove("is-success");
    elements.eventRecordId.value = state.editingEntryId === null ? "" : String(state.editingEntryId);
    elements.eventModalTitle.textContent = entry ? "Edit calendar entry" : "Add calendar entry";
    elements.eventTitle.value = entry ? entry.title || "" : "";
    elements.eventDate.value = entry ? normaliseDateString(entry.date) : toYmd(defaultDate || dateForDay(state.selectedDay));
    elements.eventTime.value = entry ? normaliseTimeInput(entry.time) : "";
    elements.eventCategory.value = entry ? normaliseCategory(entry.category) : "family";
    elements.eventPerson.value = entry && ["Keith", "Jah", "Angela", "Julie", ""].indexOf(entry.person || "") !== -1 ? entry.person || "" : "";
    elements.eventNotes.value = entry ? entry.notes || "" : "";
    elements.deleteEventButton.hidden = !entry || state.editingEntryId === null;
    elements.eventModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(function () {
      elements.eventTitle.focus();
    }, 30);
  }

  function closeEventModal() {
    elements.eventModal.hidden = true;
    document.body.style.overflow = "";
    state.editingEntryId = null;
  }

  async function saveEvent(event) {
    event.preventDefault();
    elements.eventFormMessage.classList.remove("is-success");

    if (!state.repository) {
      setEventFormMessage("Supabase is not connected, so this entry cannot be saved.");
      return;
    }

    var record = {
      title: elements.eventTitle.value.trim(),
      date: elements.eventDate.value,
      time: elements.eventTime.value || null,
      category: elements.eventCategory.value,
      person: elements.eventPerson.value,
      notes: elements.eventNotes.value.trim()
    };

    if (!record.title) {
      setEventFormMessage("Enter a title for the calendar entry.");
      elements.eventTitle.focus();
      return;
    }
    if (!record.date) {
      setEventFormMessage("Choose a date for the calendar entry.");
      elements.eventDate.focus();
      return;
    }

    setEventSaving(true);
    try {
      if (state.editingEntryId !== null) {
        await state.repository.update(state.editingEntryId, record);
      } else {
        await state.repository.create(record);
      }
      setEventFormMessage("Saved to the shared calendar.", true);
      await loadCalendarEntries();
      window.setTimeout(closeEventModal, 250);
    } catch (error) {
      setEventFormMessage(friendlyCalendarWriteError(error));
    } finally {
      setEventSaving(false);
    }
  }

  async function deleteEvent() {
    if (!state.repository || state.editingEntryId === null) {
      return;
    }
    if (!window.confirm("Delete this calendar entry?")) {
      return;
    }

    setEventSaving(true);
    try {
      await state.repository.remove(state.editingEntryId);
      await loadCalendarEntries();
      closeEventModal();
    } catch (error) {
      setEventFormMessage(friendlyCalendarWriteError(error));
    } finally {
      setEventSaving(false);
    }
  }

  function setEventSaving(saving) {
    elements.saveEventButton.disabled = saving;
    elements.deleteEventButton.disabled = saving;
    elements.saveEventButton.textContent = saving ? "Saving..." : "Save entry";
  }

  function setEventFormMessage(message, success) {
    elements.eventFormMessage.textContent = message;
    elements.eventFormMessage.classList.toggle("is-success", Boolean(success));
  }

  function AdaptiveCalendarRepository(client) {
    this.client = client;
    this.tableName = "calendar_entries";
    this.columns = null;
    this.idColumn = "id";
  }

  AdaptiveCalendarRepository.prototype.list = async function () {
    var result = await this.client.from(this.tableName).select("*").limit(1000);
    if (result.error) {
      throw result.error;
    }
    var rows = result.data || [];
    if (rows.length) {
      this.learnColumns(rows[0]);
    }
    return rows;
  };

  AdaptiveCalendarRepository.prototype.learnColumns = function (row) {
    this.columns = new Set(Object.keys(row || {}));
    this.idColumn = firstExisting(this.columns, ["id", "entry_id", "calendar_entry_id", "uuid"]) || "id";
  };

  AdaptiveCalendarRepository.prototype.normalise = function (row) {
    var idKey = firstExistingInObject(row, ["id", "entry_id", "calendar_entry_id", "uuid"]);
    var title = firstValue(row, ["title", "event_title", "name", "summary"]);
    var date = firstValue(row, ["event_date", "entry_date", "date", "calendar_date", "start_date", "starts_at", "start_at"]);
    var time = firstValue(row, ["event_time", "start_time", "time", "starts_at", "start_at"]);
    var notes = firstValue(row, ["notes", "description", "details", "detail"]);
    var category = firstValue(row, ["category", "event_category", "type"]);
    var person = firstValue(row, ["applies_to", "person", "owner", "assigned_to", "member"]);
    if (person && String(person).toLowerCase() === "other" && row.other_name) {
      person = row.other_name;
    }
    return {
      id: idKey ? row[idKey] : null,
      title: title === null || typeof title === "undefined" ? "Untitled entry" : String(title),
      date: date || "",
      time: extractTimeValue(time),
      notes: notes ? String(notes) : "",
      category: normaliseCategory(category),
      person: person ? String(person) : "",
      raw: row
    };
  };

  AdaptiveCalendarRepository.prototype.create = async function (record) {
    if (this.columns && this.columns.size) {
      var payload = this.payloadForColumns(record, this.columns);
      if (this.columns.has("written_by") && !Object.prototype.hasOwnProperty.call(payload, "written_by")) {
        payload.written_by = "Website";
      }
      return this.insertPayload(payload);
    }
    return this.insertUsingProfiles(record);
  };

  AdaptiveCalendarRepository.prototype.update = async function (id, record) {
    if (!this.columns || !this.columns.size) {
      await this.list();
    }
    if (!this.columns || !this.columns.size) {
      throw new Error("The calendar table is empty and its column names could not be detected. Add the first entry after refreshing, or check the table in Supabase.");
    }
    var payload = this.payloadForColumns(record, this.columns);
    if (!Object.keys(payload).length) {
      throw new Error("No compatible writable calendar columns were found.");
    }
    var result = await this.client.from(this.tableName).update(payload).eq(this.idColumn, id).select();
    if (result.error) {
      throw result.error;
    }
    if (result.data && result.data[0]) {
      this.learnColumns(result.data[0]);
    }
    return result.data;
  };

  AdaptiveCalendarRepository.prototype.remove = async function (id) {
    var result = await this.client.from(this.tableName).delete().eq(this.idColumn, id);
    if (result.error) {
      throw result.error;
    }
  };

  AdaptiveCalendarRepository.prototype.insertPayload = async function (payload) {
    var result = await this.client.from(this.tableName).insert(payload).select();
    if (result.error) {
      throw result.error;
    }
    if (result.data && result.data[0]) {
      this.learnColumns(result.data[0]);
    } else {
      this.columns = new Set(Object.keys(payload));
    }
    return result.data;
  };

  AdaptiveCalendarRepository.prototype.insertUsingProfiles = async function (record) {
    var dateTime = combineDateTime(record.date, record.time);
    var profiles = [
      { required: ["title", "event_date", "applies_to"], payload: compactObject({ title: record.title, event_date: record.date, applies_to: record.person || "Everyone", written_by: "Website", event_time: record.time, notes: record.notes }) },
      { required: ["title", "event_date"], payload: compactObject({ title: record.title, event_date: record.date, start_time: record.time, description: record.notes, category: record.category, person: record.person }) },
      { required: ["title", "event_date"], payload: compactObject({ title: record.title, event_date: record.date, event_time: record.time, notes: record.notes, category: record.category, owner: record.person }) },
      { required: ["title", "entry_date"], payload: compactObject({ title: record.title, entry_date: record.date, event_time: record.time, notes: record.notes, category: record.category, person: record.person }) },
      { required: ["title", "entry_date"], payload: compactObject({ title: record.title, entry_date: record.date, time: record.time, description: record.notes, category: record.category, owner: record.person }) },
      { required: ["title", "date"], payload: compactObject({ title: record.title, date: record.date, time: record.time, notes: record.notes, category: record.category, person: record.person }) },
      { required: ["event_title", "event_date"], payload: compactObject({ event_title: record.title, event_date: record.date, start_time: record.time, details: record.notes, type: record.category, owner: record.person }) },
      { required: ["name", "date"], payload: compactObject({ name: record.title, date: record.date, time: record.time, description: record.notes, category: record.category, person: record.person }) },
      { required: ["summary", "start_date"], payload: compactObject({ summary: record.title, start_date: record.date, start_time: record.time, description: record.notes, category: record.category }) },
      { required: ["title", "starts_at"], payload: compactObject({ title: record.title, starts_at: dateTime, description: record.notes, category: record.category, person: record.person }) },
      { required: ["title", "start_at"], payload: compactObject({ title: record.title, start_at: dateTime, notes: record.notes, category: record.category, owner: record.person }) }
    ];
    var lastError = null;

    for (var index = 0; index < profiles.length; index += 1) {
      var profile = profiles[index];
      var payload = Object.assign({}, profile.payload);
      for (var attempt = 0; attempt < 8; attempt += 1) {
        var result = await this.client.from(this.tableName).insert(payload).select();
        if (!result.error) {
          if (result.data && result.data[0]) {
            this.learnColumns(result.data[0]);
          } else {
            this.columns = new Set(Object.keys(payload));
          }
          return result.data;
        }

        lastError = result.error;
        if (isPermissionOrTableError(result.error)) {
          throw result.error;
        }

        var missingColumn = extractMissingColumn(result.error);
        if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
          if (profile.required.indexOf(missingColumn) !== -1) {
            break;
          }
          delete payload[missingColumn];
          continue;
        }
        break;
      }
    }

    throw lastError || new Error("Could not match the existing calendar_entries columns.");
  };

  AdaptiveCalendarRepository.prototype.payloadForColumns = function (record, columns) {
    var payload = {};
    assignFirst(payload, columns, ["title", "event_title", "name", "summary"], record.title);
    assignFirst(payload, columns, ["event_date", "entry_date", "date", "calendar_date", "start_date"], record.date);
    assignFirst(payload, columns, ["event_time", "start_time", "time"], record.time || null);
    assignFirst(payload, columns, ["notes", "description", "details", "detail"], record.notes || null);
    assignFirst(payload, columns, ["category", "event_category", "type"], record.category || "other");
    assignFirst(payload, columns, ["person", "owner", "assigned_to", "member"], record.person || null);

    // Existing household-calendar schema: applies_to is required.
    // Keep it separate from the generic person aliases so a blank UI value
    // still becomes a valid shared-calendar value instead of NULL.
    if (columns.has("applies_to")) {
      payload.applies_to = record.person || "Everyone";
    }
    if (columns.has("other_name") && record.person && ["Keith", "Jah", "Angela", "Julie"].indexOf(record.person) === -1) {
      payload.other_name = record.person;
    }
    // Do not overwrite authorship on edits. For a new row, insertPayload
    // supplies a neutral source label if written_by is a required column.
    if (columns.has("written_by") && record.writtenBy) {
      payload.written_by = record.writtenBy;
    }

    var startsAtKey = firstExisting(columns, ["starts_at", "start_at"]);
    if (startsAtKey) {
      payload[startsAtKey] = combineDateTime(record.date, record.time);
    }

    var updatedAtKey = firstExisting(columns, ["updated_at", "modified_at"]);
    if (updatedAtKey) {
      payload[updatedAtKey] = new Date().toISOString();
    }
    return payload;
  };

  function assignFirst(payload, columns, candidates, value) {
    var key = firstExisting(columns, candidates);
    if (key) {
      payload[key] = value;
    }
  }

  function extractMissingColumn(error) {
    var message = error && error.message ? String(error.message) : "";
    var patterns = [
      /Could not find the '([^']+)' column/i,
      /column [^\.]+\.([a-zA-Z0-9_]+) does not exist/i,
      /column \"([^\"]+)\" of relation [^ ]+ does not exist/i
    ];
    for (var index = 0; index < patterns.length; index += 1) {
      var match = message.match(patterns[index]);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  function isPermissionOrTableError(error) {
    var code = error && error.code ? String(error.code) : "";
    var message = error && error.message ? String(error.message).toLowerCase() : "";
    return code === "42501" || code === "42P01" || code === "PGRST205" || message.indexOf("row-level security") !== -1 || message.indexOf("permission denied") !== -1 || message.indexOf("could not find the table") !== -1;
  }

  function friendlyCalendarError(error) {
    var message = error && error.message ? String(error.message) : "Unknown Supabase error.";
    var lower = message.toLowerCase();
    if (lower.indexOf("could not find the table") !== -1 || lower.indexOf("schema cache") !== -1 && lower.indexOf("calendar_entries") !== -1 || error && (error.code === "42P01" || error.code === "PGRST205")) {
      return "The public.calendar_entries table is not available to the site. The game setup SQL does not alter this table.";
    }
    if (lower.indexOf("row-level security") !== -1 || lower.indexOf("permission denied") !== -1 || error && error.code === "42501") {
      return "Supabase connected, but the anon role cannot read calendar_entries. Check the existing calendar RLS policies.";
    }
    if (lower.indexOf("failed to fetch") !== -1 || lower.indexOf("network") !== -1) {
      return "The browser could not reach Supabase. Check the connection and try Refresh.";
    }
    return message;
  }

  function friendlyCalendarWriteError(error) {
    var message = friendlyCalendarError(error);
    var lower = message.toLowerCase();
    if (lower.indexOf("column") !== -1 || lower.indexOf("not-null") !== -1 || lower.indexOf("null value") !== -1) {
      return "The existing calendar table uses an unrecognised required column. Existing entries can still load; check README.md for the supported column aliases. Details: " + message;
    }
    return message;
  }

  function startOfWeek(date) {
    var result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    var day = result.getDay();
    var offset = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + offset);
    return result;
  }

  function weekdayIndex(date) {
    var day = date.getDay();
    if (day === 0) { return 6; }
    return day - 1;
  }

  function weekTypeForDate(date) {
    var start = startOfWeek(date);
    var millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    var difference = Math.round((start.getTime() - WEEK_A_ANCHOR.getTime()) / millisecondsPerWeek);
    return Math.abs(difference % 2) === 0 ? "A" : "B";
  }

  function addDays(date, amount) {
    var result = new Date(date.getTime());
    result.setDate(result.getDate() + amount);
    return result;
  }

  function dateForDay(index) {
    return addDays(state.weekStart, index);
  }

  function toYmd(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function normaliseDateString(value) {
    if (!value) {
      return "";
    }
    var text = String(value);
    var match = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
    var date = new Date(text);
    return Number.isNaN(date.getTime()) ? "" : toYmd(date);
  }

  function parseDateValue(value) {
    var ymd = normaliseDateString(value);
    if (!ymd) {
      return null;
    }
    var parts = ymd.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function extractTimeValue(value) {
    if (!value) {
      return "";
    }
    var text = String(value);
    var match = text.match(/(?:T|^)(\d{2}:\d{2})(?::\d{2})?/);
    return match ? match[1] : text;
  }

  function normaliseTimeInput(value) {
    var time = extractTimeValue(value);
    var match = String(time).match(/(\d{2}:\d{2})/);
    return match ? match[1] : "";
  }

  function formatTime(value) {
    var time = normaliseTimeInput(value);
    if (!time) {
      return "";
    }
    var parts = time.split(":").map(Number);
    var date = new Date(2000, 0, 1, parts[0], parts[1], 0, 0);
    return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function combineDateTime(date, time) {
    var safeTime = time || "12:00";
    return date + "T" + safeTime + ":00";
  }

  function formatDate(date, options) {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }

  function compareEntries(a, b) {
    var aDate = normaliseDateString(a.date) || "9999-12-31";
    var bDate = normaliseDateString(b.date) || "9999-12-31";
    if (aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }
    return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
  }

  function firstExisting(columns, candidates) {
    for (var index = 0; index < candidates.length; index += 1) {
      if (columns.has(candidates[index])) {
        return candidates[index];
      }
    }
    return null;
  }

  function firstExistingInObject(object, candidates) {
    for (var index = 0; index < candidates.length; index += 1) {
      if (Object.prototype.hasOwnProperty.call(object, candidates[index])) {
        return candidates[index];
      }
    }
    return null;
  }

  function firstValue(object, candidates) {
    for (var index = 0; index < candidates.length; index += 1) {
      var key = candidates[index];
      if (Object.prototype.hasOwnProperty.call(object, key) && object[key] !== null && typeof object[key] !== "undefined") {
        return object[key];
      }
    }
    return null;
  }

  function compactObject(object) {
    var result = {};
    Object.keys(object).forEach(function (key) {
      var value = object[key];
      if (value !== "" && value !== null && typeof value !== "undefined") {
        result[key] = value;
      }
    });
    return result;
  }

  function unique(values) {
    return values.filter(function (value, index, array) {
      return array.indexOf(value) === index;
    });
  }

  function emptyListHtml(title, message) {
    return "<div class=\"empty-list-state\"><strong>" + escapeHtml(title) + "</strong><span>" + escapeHtml(message) + "</span></div>";
  }

  function escapeHtml(value) {
    return String(value === null || typeof value === "undefined" ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
}());
