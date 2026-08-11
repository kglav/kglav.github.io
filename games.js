(function () {
  "use strict";

  var DEFAULT_PLATFORMS = ["Switch", "PS5", "PS4"];
  var STATUSES = ["Backlog", "Playing", "Completed", "Paused"];
  var state = {
    games: [],
    platforms: DEFAULT_PLATFORMS.slice(),
    search: "",
    platformFilter: "all",
    statusFilter: "all",
    sort: "newest",
    selectedFormPlatform: "Switch",
    loading: true,
    ready: false,
    error: "",
    repository: null,
    editingGameId: null
  };

  var elements = {};

  document.addEventListener("DOMContentLoaded", initialise);

  function initialise() {
    cacheElements();
    bindEvents();
    renderAll();
    connectGameLibrary();
  }

  function cacheElements() {
    elements.totalGamesStat = document.getElementById("totalGamesStat");
    elements.averageScoreStat = document.getElementById("averageScoreStat");
    elements.completedGamesStat = document.getElementById("completedGamesStat");
    elements.backlogGamesStat = document.getElementById("backlogGamesStat");
    elements.gameConnection = document.getElementById("gameConnection");
    elements.gameConnectionTitle = document.getElementById("gameConnectionTitle");
    elements.gameConnectionMessage = document.getElementById("gameConnectionMessage");
    elements.refreshGamesButton = document.getElementById("refreshGamesButton");
    elements.gameSearchInput = document.getElementById("gameSearchInput");
    elements.gameSortSelect = document.getElementById("gameSortSelect");
    elements.platformFilterChips = document.getElementById("platformFilterChips");
    elements.statusFilterChips = document.getElementById("statusFilterChips");
    elements.gameResultCount = document.getElementById("gameResultCount");
    elements.gameResultHeading = document.getElementById("gameResultHeading");
    elements.gameGrid = document.getElementById("gameGrid");
    elements.gameEmptyState = document.getElementById("gameEmptyState");
    elements.gameEmptyTitle = document.getElementById("gameEmptyTitle");
    elements.gameEmptyMessage = document.getElementById("gameEmptyMessage");
    elements.openGameModalButton = document.getElementById("openGameModalButton");
    elements.secondaryAddGameButton = document.getElementById("secondaryAddGameButton");
    elements.emptyAddGameButton = document.getElementById("emptyAddGameButton");
    elements.gameModal = document.getElementById("gameModal");
    elements.gameModalTitle = document.getElementById("gameModalTitle");
    elements.gameForm = document.getElementById("gameForm");
    elements.gameRecordId = document.getElementById("gameRecordId");
    elements.gameName = document.getElementById("gameName");
    elements.formPlatformChips = document.getElementById("formPlatformChips");
    elements.platformComposer = document.getElementById("platformComposer");
    elements.newPlatformName = document.getElementById("newPlatformName");
    elements.savePlatformButton = document.getElementById("savePlatformButton");
    elements.cancelPlatformButton = document.getElementById("cancelPlatformButton");
    elements.addPlatformButton = document.getElementById("addPlatformButton");
    elements.myScore = document.getElementById("myScore");
    elements.myScoreValue = document.getElementById("myScoreValue");
    elements.metacriticScore = document.getElementById("metacriticScore");
    elements.gameStatus = document.getElementById("gameStatus");
    elements.gameCoverUrl = document.getElementById("gameCoverUrl");
    elements.gameNotes = document.getElementById("gameNotes");
    elements.gameFormMessage = document.getElementById("gameFormMessage");
    elements.saveGameButton = document.getElementById("saveGameButton");
    elements.deleteGameButton = document.getElementById("deleteGameButton");
  }

  function bindEvents() {
    [elements.openGameModalButton, elements.secondaryAddGameButton, elements.emptyAddGameButton].forEach(function (button) {
      button.addEventListener("click", function () {
        if (state.ready) {
          openGameModal();
        }
      });
    });

    document.querySelectorAll("[data-close-game-modal]").forEach(function (button) {
      button.addEventListener("click", closeGameModal);
    });

    elements.gameModal.addEventListener("click", function (event) {
      if (event.target === elements.gameModal) {
        closeGameModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !elements.gameModal.hidden) {
        closeGameModal();
      }
    });

    elements.gameSearchInput.addEventListener("input", function () {
      state.search = elements.gameSearchInput.value.trim().toLowerCase();
      renderResults();
    });

    elements.gameSortSelect.addEventListener("change", function () {
      state.sort = elements.gameSortSelect.value;
      renderResults();
    });

    elements.platformFilterChips.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-platform-filter]");
      if (!button) {
        return;
      }
      state.platformFilter = button.getAttribute("data-platform-filter") || "all";
      renderFilters();
      renderResults();
    });

    elements.statusFilterChips.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-status-filter]");
      if (!button) {
        return;
      }
      state.statusFilter = button.getAttribute("data-status-filter") || "all";
      renderFilters();
      renderResults();
    });

    elements.gameGrid.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-game-id]");
      if (!button) {
        return;
      }
      var id = button.getAttribute("data-game-id");
      var game = state.games.find(function (item) { return String(item.id) === String(id); });
      if (game) {
        openGameModal(game);
      }
    });

    elements.formPlatformChips.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-form-platform]");
      if (!button) {
        return;
      }
      state.selectedFormPlatform = button.getAttribute("data-form-platform") || state.platforms[0];
      renderFormPlatforms();
    });

    elements.addPlatformButton.addEventListener("click", function () {
      elements.platformComposer.hidden = false;
      elements.addPlatformButton.hidden = true;
      elements.newPlatformName.value = "";
      elements.newPlatformName.focus();
    });

    elements.cancelPlatformButton.addEventListener("click", closePlatformComposer);
    elements.savePlatformButton.addEventListener("click", savePlatform);
    elements.newPlatformName.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        savePlatform();
      }
    });

    elements.myScore.addEventListener("input", function () {
      elements.myScoreValue.textContent = elements.myScore.value;
    });

    elements.gameForm.addEventListener("submit", saveGame);
    elements.deleteGameButton.addEventListener("click", deleteGame);
    elements.refreshGamesButton.addEventListener("click", loadLibrary);
  }

  async function connectGameLibrary() {
    var client = typeof window.getSiteSupabase === "function" ? window.getSiteSupabase() : null;
    if (!client) {
      state.loading = false;
      state.ready = false;
      state.error = "The Supabase browser library did not load. Check the internet connection and refresh.";
      renderAll();
      return;
    }

    state.repository = new GameRepository(client);
    await loadLibrary();
  }

  async function loadLibrary() {
    if (!state.repository) {
      return;
    }

    state.loading = true;
    state.error = "";
    renderConnection();
    renderResults();

    try {
      var results = await Promise.all([
        state.repository.listGames(),
        state.repository.listPlatforms()
      ]);
      state.games = results[0] || [];
      state.platforms = mergePlatforms(results[1]);
      if (state.platformFilter !== "all" && state.platforms.indexOf(state.platformFilter) === -1) {
        state.platformFilter = "all";
      }
      if (state.platforms.indexOf(state.selectedFormPlatform) === -1) {
        state.selectedFormPlatform = state.platforms[0] || "Switch";
      }
      state.ready = true;
      state.error = "";
    } catch (error) {
      state.games = [];
      state.platforms = DEFAULT_PLATFORMS.slice();
      state.ready = false;
      state.error = friendlyGameError(error);
    } finally {
      state.loading = false;
      renderAll();
    }
  }

  function renderAll() {
    renderStats();
    renderFilters();
    renderResults();
    renderConnection();
    renderFormPlatforms();
  }

  function renderStats() {
    var scores = state.games.map(function (game) { return Number(game.my_score); }).filter(function (score) { return Number.isFinite(score); });
    var average = scores.length ? scores.reduce(function (sum, score) { return sum + score; }, 0) / scores.length : null;
    elements.totalGamesStat.textContent = String(state.games.length);
    elements.averageScoreStat.textContent = average === null ? "-" : average.toFixed(1);
    elements.completedGamesStat.textContent = String(state.games.filter(function (game) { return game.status === "Completed"; }).length);
    elements.backlogGamesStat.textContent = String(state.games.filter(function (game) { return game.status === "Backlog"; }).length);
  }

  function renderFilters() {
    var platforms = ["all"].concat(state.platforms);
    elements.platformFilterChips.innerHTML = platforms.map(function (platform) {
      var label = platform === "all" ? "All" : platform;
      var active = state.platformFilter === platform;
      return "<button type=\"button\" class=\"game-filter-chip " + (active ? "is-active" : "") + "\" data-platform-filter=\"" + escapeAttribute(platform) + "\" aria-pressed=\"" + (active ? "true" : "false") + "\">" + escapeHtml(label) + "</button>";
    }).join("");

    var statuses = ["all"].concat(STATUSES);
    elements.statusFilterChips.innerHTML = statuses.map(function (status) {
      var label = status === "all" ? "All" : status;
      var active = state.statusFilter === status;
      return "<button type=\"button\" class=\"game-filter-chip " + (active ? "is-active" : "") + "\" data-status-filter=\"" + escapeAttribute(status) + "\" aria-pressed=\"" + (active ? "true" : "false") + "\">" + escapeHtml(label) + "</button>";
    }).join("");
  }

  function renderResults() {
    var games = getVisibleGames();
    var countLabel = games.length + " game" + (games.length === 1 ? "" : "s");
    elements.gameResultCount.textContent = countLabel;
    elements.gameResultHeading.textContent = resultHeading();

    if (state.loading) {
      elements.gameGrid.innerHTML = "";
      showEmptyState("Loading your catalogue", "The game library is connecting to Supabase.", false);
      return;
    }

    if (!state.ready) {
      elements.gameGrid.innerHTML = "";
      showEmptyState("Game tables are not ready", state.error || "Run game-library-setup.sql in the Supabase SQL Editor.", false);
      return;
    }

    if (!games.length) {
      elements.gameGrid.innerHTML = "";
      if (!state.games.length) {
        showEmptyState("No games here yet", "Add your first game to start the catalogue.", true);
      } else {
        showEmptyState("No matching games", "Try another search, platform or status filter.", true);
      }
      return;
    }

    elements.gameEmptyState.hidden = true;
    elements.gameGrid.hidden = false;
    elements.gameGrid.innerHTML = games.map(renderGameCard).join("");
    elements.gameGrid.querySelectorAll("[data-cover-url]").forEach(function (cover) {
      var url = cover.getAttribute("data-cover-url");
      if (url) {
        cover.style.backgroundImage = "url(\"" + url.replace(/\"/g, "%22") + "\")";
      }
    });
  }

  function renderGameCard(game) {
    var safeCover = safeImageUrl(game.cover_url);
    var coverAttribute = safeCover ? " data-cover-url=\"" + escapeAttribute(safeCover) + "\"" : "";
    var generatedCover = safeCover ? "" : "<span class=\"generated-cover-mark\"><span><strong>" + escapeHtml(shortCoverTitle(game.name)) + "</strong><span>" + escapeHtml(game.platform || "Game") + "</span></span></span>";
    var metacritic = game.metacritic_score === null || typeof game.metacritic_score === "undefined" ? "Not scored" : "<span class=\"metacritic-pill\"><span class=\"metacritic-mark\">M</span>" + escapeHtml(String(game.metacritic_score)) + "</span>";
    return "<article class=\"game-card\"><button type=\"button\" class=\"game-cover-button\" data-game-id=\"" + escapeAttribute(String(game.id)) + "\" aria-label=\"Edit " + escapeAttribute(game.name) + "\"><div class=\"game-cover\"" + coverAttribute + ">" + generatedCover + "<span class=\"game-score-badge\">" + escapeHtml(String(game.my_score)) + "/10</span></div><div class=\"game-card-body\"><div class=\"game-card-kicker\"><span>" + escapeHtml(game.platform || "Unknown") + "</span><span class=\"game-status-dot\" data-status=\"" + escapeAttribute(game.status || "Backlog") + "\">" + escapeHtml(game.status || "Backlog") + "</span></div><h3>" + escapeHtml(game.name) + "</h3><div class=\"game-card-meta\"><span>My score " + escapeHtml(String(game.my_score)) + "</span><span>" + metacritic + "</span></div></div></button></article>";
  }

  function showEmptyState(title, message, showButton) {
    elements.gameGrid.hidden = true;
    elements.gameEmptyState.hidden = false;
    elements.gameEmptyTitle.textContent = title;
    elements.gameEmptyMessage.textContent = message;
    elements.emptyAddGameButton.hidden = !showButton;
    elements.emptyAddGameButton.disabled = !state.ready;
  }

  function renderConnection() {
    var connectionState = "loading";
    var title = "Connecting to the game library";
    var message = "Checking the Supabase game tables.";

    if (state.ready) {
      connectionState = "ready";
      title = "Game library connected";
      message = state.games.length + " game" + (state.games.length === 1 ? "" : "s") + " loaded from Supabase.";
    } else if (state.error) {
      connectionState = "error";
      title = "Game library needs attention";
      message = state.error;
    }

    elements.gameConnection.setAttribute("data-state", connectionState);
    elements.gameConnectionTitle.textContent = title;
    elements.gameConnectionMessage.textContent = message;
    elements.refreshGamesButton.disabled = state.loading;
    [elements.openGameModalButton, elements.secondaryAddGameButton, elements.emptyAddGameButton].forEach(function (button) {
      button.disabled = !state.ready || state.loading;
    });
  }

  function getVisibleGames() {
    var games = state.games.filter(function (game) {
      var matchesSearch = !state.search || String(game.name || "").toLowerCase().indexOf(state.search) !== -1 || String(game.platform || "").toLowerCase().indexOf(state.search) !== -1 || String(game.notes || "").toLowerCase().indexOf(state.search) !== -1;
      var matchesPlatform = state.platformFilter === "all" || game.platform === state.platformFilter;
      var matchesStatus = state.statusFilter === "all" || game.status === state.statusFilter;
      return matchesSearch && matchesPlatform && matchesStatus;
    });

    return games.sort(function (a, b) {
      if (state.sort === "name") {
        return String(a.name).localeCompare(String(b.name));
      }
      if (state.sort === "score-high") {
        return Number(b.my_score || 0) - Number(a.my_score || 0) || String(a.name).localeCompare(String(b.name));
      }
      if (state.sort === "metacritic-high") {
        return Number(b.metacritic_score === null ? -1 : b.metacritic_score) - Number(a.metacritic_score === null ? -1 : a.metacritic_score) || String(a.name).localeCompare(String(b.name));
      }
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
  }

  function resultHeading() {
    var parts = [];
    if (state.platformFilter !== "all") {
      parts.push(state.platformFilter);
    }
    if (state.statusFilter !== "all") {
      parts.push(state.statusFilter);
    }
    if (state.search) {
      parts.push("Search results");
    }
    return parts.length ? parts.join(" - ") : "All games";
  }

  function openGameModal(game) {
    state.editingGameId = game ? game.id : null;
    elements.gameForm.reset();
    elements.gameFormMessage.textContent = "";
    elements.gameFormMessage.classList.remove("is-success");
    elements.gameModalTitle.textContent = game ? "Edit game" : "Add game";
    elements.gameRecordId.value = game ? String(game.id) : "";
    elements.gameName.value = game ? game.name || "" : "";
    state.selectedFormPlatform = game && game.platform ? game.platform : state.platforms[0] || "Switch";
    elements.myScore.value = game ? String(game.my_score || 7) : "7";
    elements.myScoreValue.textContent = elements.myScore.value;
    elements.metacriticScore.value = game && game.metacritic_score !== null && typeof game.metacritic_score !== "undefined" ? String(game.metacritic_score) : "";
    elements.gameStatus.value = game && STATUSES.indexOf(game.status) !== -1 ? game.status : "Backlog";
    elements.gameCoverUrl.value = game ? game.cover_url || "" : "";
    elements.gameNotes.value = game ? game.notes || "" : "";
    elements.deleteGameButton.hidden = !game;
    closePlatformComposer();
    renderFormPlatforms();
    elements.gameModal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(function () { elements.gameName.focus(); }, 30);
  }

  function closeGameModal() {
    elements.gameModal.hidden = true;
    document.body.style.overflow = "";
    state.editingGameId = null;
    closePlatformComposer();
  }

  function renderFormPlatforms() {
    elements.formPlatformChips.innerHTML = state.platforms.map(function (platform) {
      var active = platform === state.selectedFormPlatform;
      return "<button type=\"button\" class=\"form-platform-chip " + (active ? "is-active" : "") + "\" data-form-platform=\"" + escapeAttribute(platform) + "\" aria-pressed=\"" + (active ? "true" : "false") + "\">" + escapeHtml(platform) + "</button>";
    }).join("");
  }

  function closePlatformComposer() {
    elements.platformComposer.hidden = true;
    elements.addPlatformButton.hidden = false;
    elements.newPlatformName.value = "";
  }

  async function savePlatform() {
    var name = elements.newPlatformName.value.trim().replace(/\s+/g, " ");
    if (!name) {
      setGameFormMessage("Enter a name for the new platform.");
      elements.newPlatformName.focus();
      return;
    }

    var existing = state.platforms.find(function (platform) {
      return platform.toLowerCase() === name.toLowerCase();
    });
    if (existing) {
      state.selectedFormPlatform = existing;
      renderFormPlatforms();
      closePlatformComposer();
      return;
    }

    if (!state.repository || !state.ready) {
      setGameFormMessage("The game library is not connected, so the platform cannot be saved.");
      return;
    }

    elements.savePlatformButton.disabled = true;
    elements.savePlatformButton.textContent = "Saving...";
    try {
      await state.repository.createPlatform(name, (state.platforms.length + 1) * 10);
      var platforms = await state.repository.listPlatforms();
      state.platforms = mergePlatforms(platforms);
      state.selectedFormPlatform = name;
      renderFilters();
      renderFormPlatforms();
      closePlatformComposer();
      setGameFormMessage("Platform saved.", true);
    } catch (error) {
      setGameFormMessage(friendlyGameError(error));
    } finally {
      elements.savePlatformButton.disabled = false;
      elements.savePlatformButton.textContent = "Save platform";
    }
  }

  async function saveGame(event) {
    event.preventDefault();
    elements.gameFormMessage.classList.remove("is-success");

    if (!state.repository || !state.ready) {
      setGameFormMessage("The game tables are not connected.");
      return;
    }

    var name = elements.gameName.value.trim();
    var myScore = Number(elements.myScore.value);
    var metacriticText = elements.metacriticScore.value.trim();
    var metacritic = metacriticText === "" ? null : Number(metacriticText);
    var coverUrl = elements.gameCoverUrl.value.trim();

    if (!name) {
      setGameFormMessage("Enter the game name.");
      elements.gameName.focus();
      return;
    }
    if (!Number.isInteger(myScore) || myScore < 1 || myScore > 10) {
      setGameFormMessage("My score must be a whole number from 1 to 10.");
      return;
    }
    if (metacritic !== null && (!Number.isInteger(metacritic) || metacritic < 0 || metacritic > 100)) {
      setGameFormMessage("Metacritic score must be a whole number from 0 to 100.");
      elements.metacriticScore.focus();
      return;
    }
    if (!state.selectedFormPlatform) {
      setGameFormMessage("Choose a platform.");
      return;
    }
    if (coverUrl && !safeImageUrl(coverUrl)) {
      setGameFormMessage("Cover image must be a valid HTTP or HTTPS URL.");
      elements.gameCoverUrl.focus();
      return;
    }

    var payload = {
      name: name,
      my_score: myScore,
      metacritic_score: metacritic,
      platform: state.selectedFormPlatform,
      status: elements.gameStatus.value,
      cover_url: coverUrl || null,
      notes: elements.gameNotes.value.trim() || null,
      updated_at: new Date().toISOString()
    };

    setGameSaving(true);
    try {
      if (state.editingGameId) {
        await state.repository.updateGame(state.editingGameId, payload);
      } else {
        await state.repository.createGame(payload);
      }
      setGameFormMessage("Saved to the game catalogue.", true);
      await loadLibrary();
      window.setTimeout(closeGameModal, 250);
    } catch (error) {
      setGameFormMessage(friendlyGameError(error));
    } finally {
      setGameSaving(false);
    }
  }

  async function deleteGame() {
    if (!state.repository || !state.editingGameId) {
      return;
    }
    if (!window.confirm("Delete this game from the catalogue?")) {
      return;
    }

    setGameSaving(true);
    try {
      await state.repository.deleteGame(state.editingGameId);
      await loadLibrary();
      closeGameModal();
    } catch (error) {
      setGameFormMessage(friendlyGameError(error));
    } finally {
      setGameSaving(false);
    }
  }

  function setGameSaving(saving) {
    elements.saveGameButton.disabled = saving;
    elements.deleteGameButton.disabled = saving;
    elements.saveGameButton.textContent = saving ? "Saving..." : "Save game";
  }

  function setGameFormMessage(message, success) {
    elements.gameFormMessage.textContent = message;
    elements.gameFormMessage.classList.toggle("is-success", Boolean(success));
  }

  function GameRepository(client) {
    this.client = client;
  }

  GameRepository.prototype.listGames = async function () {
    var result = await this.client.from("games").select("*").order("created_at", { ascending: false });
    if (result.error) {
      throw result.error;
    }
    return result.data || [];
  };

  GameRepository.prototype.listPlatforms = async function () {
    var result = await this.client.from("game_platforms").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (result.error) {
      throw result.error;
    }
    return (result.data || []).map(function (row) { return row.name; }).filter(Boolean);
  };

  GameRepository.prototype.createGame = async function (payload) {
    var result = await this.client.from("games").insert(payload).select();
    if (result.error) {
      throw result.error;
    }
    return result.data;
  };

  GameRepository.prototype.updateGame = async function (id, payload) {
    var result = await this.client.from("games").update(payload).eq("id", id).select();
    if (result.error) {
      throw result.error;
    }
    return result.data;
  };

  GameRepository.prototype.deleteGame = async function (id) {
    var result = await this.client.from("games").delete().eq("id", id);
    if (result.error) {
      throw result.error;
    }
  };

  GameRepository.prototype.createPlatform = async function (name, sortOrder) {
    var result = await this.client.from("game_platforms").insert({
      name: name,
      sort_order: sortOrder
    }).select();
    if (result.error) {
      throw result.error;
    }
    return result.data;
  };

  function friendlyGameError(error) {
    var message = error && error.message ? String(error.message) : "Unknown Supabase error.";
    var lower = message.toLowerCase();
    var code = error && error.code ? String(error.code) : "";

    if (code === "42P01" || code === "PGRST205" || lower.indexOf("could not find the table") !== -1 || lower.indexOf("schema cache") !== -1 && (lower.indexOf("games") !== -1 || lower.indexOf("game_platforms") !== -1)) {
      return "Run game-library-setup.sql in the Supabase SQL Editor. It creates only games and game_platforms and does not change calendar_entries.";
    }
    if (code === "42501" || lower.indexOf("row-level security") !== -1 || lower.indexOf("permission denied") !== -1) {
      return "The game tables exist, but their anonymous RLS policies are not allowing this page to read or write them. Re-run game-library-setup.sql.";
    }
    if (code === "23505" || lower.indexOf("duplicate key") !== -1) {
      return "That platform already exists.";
    }
    if (lower.indexOf("failed to fetch") !== -1 || lower.indexOf("network") !== -1) {
      return "The browser could not reach Supabase. Check the connection and try Refresh.";
    }
    return message;
  }

  function mergePlatforms(platforms) {
    var merged = [];
    DEFAULT_PLATFORMS.concat(platforms || []).forEach(function (platform) {
      var name = String(platform || "").trim();
      if (!name) {
        return;
      }
      var exists = merged.some(function (item) { return item.toLowerCase() === name.toLowerCase(); });
      if (!exists) {
        merged.push(name);
      }
    });
    return merged;
  }

  function safeImageUrl(value) {
    if (!value) {
      return "";
    }
    try {
      var url = new URL(String(value));
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }
      return url.href;
    } catch (error) {
      return "";
    }
  }

  function shortCoverTitle(name) {
    var words = String(name || "Game").split(/\s+/).filter(Boolean);
    if (words.length <= 4) {
      return words.join(" ");
    }
    return words.slice(0, 4).join(" ") + "...";
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
