(function ($) {
  "use strict";

  var state = {
    csrfToken: null,
    adminEmail: null,
    loginEmail: null,
    activeView: "users",
    pages: { users: 1, premiumRequests: 1, connections: 1, deleted: 1, audit: 1 },
    search: "",
    premiumCount: 0,
    premiumLimit: 3
  };

  function api(path, options) {
    var settings = options || {};
    var headers = Object.assign({}, settings.headers || {});

    if (settings.body && !(settings.body instanceof FormData)) {
      headers["content-type"] = "application/json";
    }

    if (settings.method && settings.method !== "GET" && state.csrfToken) {
      headers["x-csrf-token"] = state.csrfToken;
    }

    return fetch(path, {
      method: settings.method || "GET",
      credentials: "same-origin",
      headers: headers,
      body: settings.body
    }).then(function (response) {
      if (response.status === 204) return null;
      return response.json().then(function (payload) {
        if (!response.ok) {
          var error = new Error(payload.message || "Request failed.");
          error.code = payload.code;
          error.status = response.status;
          throw error;
        }
        return payload;
      });
    });
  }

  function showToast(message, isError) {
    var toast = $("#toast");
    toast.text(message).toggleClass("error", Boolean(isError)).removeClass("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { toast.addClass("hidden"); }, 3500);
  }

  function showLogin() {
    state.csrfToken = null;
    state.adminEmail = null;
    $("#dashboardView").addClass("hidden");
    $("#authView").removeClass("hidden");
    $("#otpForm").addClass("hidden");
    $("#loginForm").removeClass("hidden");
    $("#authStatus").text("");
  }

  function showDashboard(session) {
    state.csrfToken = session.csrfToken;
    state.adminEmail = session.email;
    $("#adminIdentity").text(session.email);
    $("#authView").addClass("hidden");
    $("#dashboardView").removeClass("hidden");
    loadOverview().finally(function () { loadView(state.activeView); });
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function formatDay(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric"
    }).format(new Date(value + "T00:00:00Z"));
  }

  function formatMoney(value, currency) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: value >= 100 ? 0 : 2
    }).format(value || 0);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(undefined).format(value || 0);
  }

  function badge(text, tone) {
    return $("<span>").addClass("badge " + (tone || "")).text(text);
  }

  function primaryCell(primary, secondary) {
    var cell = $("<td>").addClass("primary-cell");
    $("<strong>").text(primary || "Unknown").appendTo(cell);
    if (secondary) $("<span>").text(secondary).appendTo(cell);
    return cell;
  }

  function emptyRow(columns, text) {
    return $("<tr>").append($("<td>").attr("colspan", columns).addClass("empty-row").text(text));
  }

  function applyResponsiveTableLabels(body) {
    var labels = body.closest("table").find("thead th").map(function () {
      return $(this).text().trim();
    }).get();
    body.children("tr").each(function () {
      $(this).children("td:not([colspan])").each(function (index) {
        $(this).attr("data-label", labels[index] || "Details");
      });
    });
  }

  function renderPagination(containerId, view, pagination) {
    var container = $(containerId).empty();
    var previous = $("<button>").addClass("secondary-button").attr("type", "button").text("Previous");
    var next = $("<button>").addClass("secondary-button").attr("type", "button").text("Next");
    previous.prop("disabled", pagination.page <= 1);
    next.prop("disabled", pagination.page >= pagination.pages);
    previous.on("click", function () { state.pages[view] -= 1; loadView(view); });
    next.on("click", function () { state.pages[view] += 1; loadView(view); });
    container.append(previous, $("<span>").text("Page " + pagination.page + " of " + pagination.pages), next);
  }

  function handleLoadError(error) {
    if (error.status === 401) {
      showLogin();
      return;
    }
    showToast(error.message, true);
  }

  function loadOverview() {
    return api("/api/admin/overview").then(function (response) {
      var data = response.data;
      state.premiumCount = data.premiumUsers;
      state.premiumLimit = data.premiumLimit;
      $("#metricUsers").text(data.users);
      $("#metricPremium").text(data.premiumUsers + " / " + data.premiumLimit);
      $("#metricPremiumRequests").text(data.pendingPremiumRequests);
      $("#metricRooms").text(data.rooms);
      $("#metricActiveRooms").text(data.activeRooms);
      $("#metricDeleted").text(data.deletedMessages);
    }).catch(handleLoadError);
  }

  function loadUsers() {
    var query = new URLSearchParams({ page: state.pages.users, limit: 25 });
    if (state.search) query.set("search", state.search);
    return api("/api/admin/users?" + query.toString()).then(function (response) {
      var data = response.data;
      var body = $("#usersTable").empty();
      $("#usersCount").text(data.pagination.total + " records");

      if (!data.items.length) body.append(emptyRow(6, "No users found."));
      data.items.forEach(function (user) {
        var row = $("<tr>");
        row.append(primaryCell(
          user.fullName || "No full name",
          "@" + user.username + " | " + user.email
        ));
        row.append($("<td>").text(user.uniqueId));
        row.append($("<td>").text((user.authProviders || []).join(", ")));
        row.append($("<td>").append(badge(user.status, user.status === "active" ? "good" : "warn")));
        row.append($("<td>").text(formatDate(user.createdAt)));
        var action = $("<button>")
          .addClass("premium-button " + (user.isPremium ? "remove" : ""))
          .attr("type", "button")
          .text(user.isPremium ? "Remove" : "Grant")
          .on("click", function () { togglePremium(user, !user.isPremium, action); });
        if (!user.isPremium && state.premiumCount >= state.premiumLimit) {
          action.prop("disabled", true).attr("title", "The three-account premium limit has been reached.");
        }
        row.append($("<td>").append(action));
        body.append(row);
      });
      applyResponsiveTableLabels(body);
      renderPagination("#usersPagination", "users", data.pagination);
    });
  }

  function togglePremium(user, isPremium, button) {
    button.prop("disabled", true);
    api("/api/admin/users/" + encodeURIComponent(user.id) + "/premium", {
      method: "PATCH",
      body: JSON.stringify({ isPremium: isPremium })
    }).then(function () {
      showToast(isPremium ? "Premium access granted." : "Premium access removed.");
      loadOverview().then(loadUsers);
    }).catch(function (error) {
      button.prop("disabled", false);
      handleLoadError(error);
    });
  }

  function decidePremiumRequest(request, decision, button) {
    button.prop("disabled", true);
    api("/api/admin/premium-requests/" + encodeURIComponent(request.id), {
      method: "PATCH",
      body: JSON.stringify({ decision: decision })
    }).then(function () {
      showToast(decision === "approved" ? "Premium request approved." : "Premium request rejected.");
      loadOverview().then(function () {
        loadPremiumRequests();
        loadUsers();
      });
    }).catch(function (error) {
      button.prop("disabled", false);
      handleLoadError(error);
    });
  }

  function loadPremiumRequests() {
    var query = new URLSearchParams({ page: state.pages.premiumRequests, limit: 25 });
    return api("/api/admin/premium-requests?" + query.toString()).then(function (response) {
      var data = response.data;
      var body = $("#premiumRequestsTable").empty();
      $("#premiumRequestsCount").text(data.pagination.total + " records");
      if (!data.items.length) body.append(emptyRow(5, "No premium requests found."));
      data.items.forEach(function (request) {
        var row = $("<tr>");
        row.append(primaryCell(
          request.user.fullName || "No full name",
          "@" + request.user.username + " | " + request.user.email
        ));
        row.append($("<td>").text(request.user.uniqueId));
        row.append($("<td>").append(badge(request.status, request.status === "approved" ? "good" : request.status === "pending" ? "warn" : "danger")));
        row.append($("<td>").text(formatDate(request.requestedAt)));
        var actions = $("<div>").addClass("request-actions");
        if (request.status === "pending") {
          var approveButton = $("<button>")
            .addClass("premium-button")
            .attr("type", "button")
            .text("Approve")
            .on("click", function () { decidePremiumRequest(request, "approved", $(this)); });
          if (state.premiumCount >= state.premiumLimit) {
            approveButton.prop("disabled", true).attr("title", "The three-account premium limit has been reached.");
          }
          approveButton.appendTo(actions);
          $("<button>")
            .addClass("premium-button remove")
            .attr("type", "button")
            .text("Reject")
            .on("click", function () { decidePremiumRequest(request, "rejected", $(this)); })
            .appendTo(actions);
        } else {
          actions.text(formatDate(request.decidedAt));
        }
        row.append($("<td>").append(actions));
        body.append(row);
      });
      applyResponsiveTableLabels(body);
      renderPagination("#premiumRequestsPagination", "premiumRequests", data.pagination);
    });
  }

  function userLabel(user) {
    return user ? user.username + " (" + user.uniqueId + ")" : "Unavailable user";
  }

  function loadConnections() {
    var query = new URLSearchParams({ page: state.pages.connections, limit: 25 });
    return api("/api/admin/connections?" + query.toString()).then(function (response) {
      var data = response.data;
      var body = $("#connectionsTable").empty();
      $("#connectionsCount").text(data.pagination.total + " records");
      if (!data.items.length) body.append(emptyRow(5, "No chat rooms found."));
      data.items.forEach(function (room) {
        var row = $("<tr>");
        row.append(primaryCell(userLabel(room.requester), userLabel(room.recipient)));
        row.append($("<td>").append(badge(room.status, room.status === "accepted" ? "good" : "warn")));
        row.append($("<td>").text((room.requesterCategory || "-") + " / " + (room.recipientCategory || "-")));
        row.append($("<td>").text(formatDate(room.requestedAt)));
        row.append($("<td>").text(formatDate(room.lastMessageAt)));
        body.append(row);
      });
      applyResponsiveTableLabels(body);
      renderPagination("#connectionsPagination", "connections", data.pagination);
    });
  }

  function loadDeleted() {
    var query = new URLSearchParams({ page: state.pages.deleted, limit: 25 });
    return api("/api/admin/deleted-messages?" + query.toString()).then(function (response) {
      var data = response.data;
      var body = $("#deletedTable").empty();
      $("#deletedCount").text(data.pagination.total + " records");
      if (!data.items.length) body.append(emptyRow(6, "No deleted messages found."));
      data.items.forEach(function (message) {
        var row = $("<tr>");
        row.append(primaryCell(userLabel(message.sender), "to " + userLabel(message.recipient)));
        row.append($("<td>").addClass("message-text").text(message.text || "No text"));
        row.append($("<td>").text(message.media.length ? message.media.map(function (asset) { return asset.originalName || asset.mimeType; }).join(", ") : "None"));
        row.append($("<td>").text(formatDate(message.createdAt)));
        row.append($("<td>").text(formatDate(message.deletedAt)));
        row.append($("<td>").append(badge(message.cloudinaryDestroyedAt ? "Complete" : "Pending", message.cloudinaryDestroyedAt ? "good" : "danger")));
        body.append(row);
      });
      applyResponsiveTableLabels(body);
      renderPagination("#deletedPagination", "deleted", data.pagination);
    });
  }

  function loadAudit() {
    var query = new URLSearchParams({ page: state.pages.audit, limit: 25 });
    return api("/api/admin/audit-logs?" + query.toString()).then(function (response) {
      var data = response.data;
      var body = $("#auditTable").empty();
      $("#auditCount").text(data.pagination.total + " records");
      if (!data.items.length) body.append(emptyRow(5, "No admin actions recorded."));
      data.items.forEach(function (log) {
        var row = $("<tr>");
        row.append($("<td>").append(badge(log.action.replace(/_/g, " "), log.action.indexOf("revoked") > -1 ? "warn" : "good")));
        row.append($("<td>").text(userLabel(log.targetUser)));
        row.append($("<td>").text(log.actorEmail));
        row.append($("<td>").text(log.ipAddress || "-"));
        row.append($("<td>").text(formatDate(log.createdAt)));
        body.append(row);
      });
      applyResponsiveTableLabels(body);
      renderPagination("#auditPagination", "audit", data.pagination);
    });
  }

  function renderBars(containerId, items, labelKey) {
    var container = $(containerId).empty();
    var max = Math.max.apply(null, items.map(function (item) { return item.costInr; }).concat([0]));

    if (!items.length) {
      container.append($("<div>").addClass("empty-row").text("No usage data available."));
      return;
    }

    items.forEach(function (item) {
      var amount = item.costInr || 0;
      var height = max > 0 ? Math.max((amount / max) * 100, amount > 0 ? 5 : 0) : 0;
      var bar = $("<div>").addClass("bar-item");
      $("<span>").addClass("bar-value").text(formatMoney(amount, "INR")).appendTo(bar);
      $("<div>").addClass("bar-track")
        .append($("<div>").addClass("bar-fill").css("height", height + "%"))
        .appendTo(bar);
      $("<span>").addClass("bar-label").text(item[labelKey]).appendTo(bar);
      container.append(bar);
    });
  }

  function loadOpenAiUsage() {
    $("#openAiStatus").text("Loading OpenAI usage...");
    return api("/api/admin/openai-usage").then(function (response) {
      var data = response.data;
      var today = data.totals.today;
      var week = data.totals.last7Days;
      var month = data.totals.last30Days;

      $("#openAiBalance").text(data.balance.available ? formatMoney(data.balance.amountInr, "INR") : "Unavailable");
      $("#openAiBalanceNote").text(data.balance.message);
      $("#openAiToday").text(formatMoney(today.costInr, "INR"));
      $("#openAiTodayMeta").text(formatNumber(today.requests) + " requests");
      $("#openAiWeek").text(formatMoney(week.costInr, "INR"));
      $("#openAiWeekMeta").text(formatNumber(week.requests) + " requests");
      $("#openAiMonth").text(formatMoney(month.costInr, "INR"));
      $("#openAiMonthMeta").text(formatNumber(month.requests) + " requests");
      $("#openAiModel").text(data.model);
      $("#openAiRate").text("$1 = ₹" + data.currency.usdToInr);
      $("#openAiStatus").text("Last updated " + formatDate(data.generatedAt));

      renderBars(
        "#openAiDailyChart",
        data.daily.map(function (day) { return Object.assign({}, day, { label: formatDay(day.date) }); }),
        "label"
      );
      renderBars(
        "#openAiWeeklyChart",
        data.weekly.map(function (weekItem) {
          return Object.assign({}, weekItem, { label: formatDay(weekItem.weekStart) });
        }),
        "label"
      );

      var body = $("#openAiUsageTable").empty();
      data.daily.slice().reverse().forEach(function (day) {
        var row = $("<tr>");
        row.append($("<td>").text(day.date));
        row.append($("<td>").text(formatMoney(day.costInr, "INR") + " / $" + day.costUsd.toFixed(4)));
        row.append($("<td>").text(formatNumber(day.requests)));
        row.append($("<td>").text(formatNumber(day.inputTokens)));
        row.append($("<td>").text(formatNumber(day.outputTokens)));
        row.append($("<td>").text(formatNumber(day.cachedInputTokens)));
        body.append(row);
      });
      if (!data.daily.length) body.append(emptyRow(6, "No OpenAI usage found."));
      applyResponsiveTableLabels(body);
    }).catch(function (error) {
      $("#openAiStatus").text("OpenAI usage could not be loaded.");
      $("#openAiUsageTable").empty().append(emptyRow(6, error.message));
      $("#openAiDailyChart").empty().append($("<div>").addClass("empty-row").text(error.message));
      $("#openAiWeeklyChart").empty();
      handleLoadError(error);
    });
  }

  function loadView(view) {
    var loaders = { users: loadUsers, premiumRequests: loadPremiumRequests, connections: loadConnections, deleted: loadDeleted, openai: loadOpenAiUsage, audit: loadAudit };
    return loaders[view]().catch(handleLoadError);
  }

  $(function () {
    $("#loginForm").validate({
      rules: {
        email: { required: true, email: true, maxlength: 254 },
        password: { required: true, minlength: 6, maxlength: 128 }
      },
      messages: {
        email: { required: "Email is required.", email: "Enter a valid email." },
        password: { required: "Password is required." }
      },
      submitHandler: function (form) {
        var button = $(form).find("button[type=submit]").prop("disabled", true);
        var email = $("#adminEmail").val().trim().toLowerCase();
        api("/api/admin/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email, password: $("#adminPassword").val() })
        }).then(function () {
          state.loginEmail = email;
          $("#adminPassword").val("");
          $("#authStatus").text("Verification code sent.");
          $("#loginForm").addClass("hidden");
          $("#otpForm").removeClass("hidden");
          $("#adminOtp").trigger("focus");
        }).catch(function (error) {
          $("#authStatus").text(error.message);
        }).finally(function () { button.prop("disabled", false); });
      }
    });

    $("#otpForm").validate({
      rules: { otp: { required: true, digits: true, minlength: 6, maxlength: 6 } },
      messages: { otp: { required: "Verification code is required.", digits: "Use digits only.", minlength: "Enter all 6 digits.", maxlength: "Enter all 6 digits." } },
      submitHandler: function (form) {
        var button = $(form).find("button[type=submit]").prop("disabled", true);
        api("/api/admin/auth/verify", {
          method: "POST",
          body: JSON.stringify({ email: state.loginEmail, otp: $("#adminOtp").val() })
        }).then(function (response) {
          form.reset();
          showDashboard(response.data);
        }).catch(function (error) {
          $("#authStatus").text(error.message);
        }).finally(function () { button.prop("disabled", false); });
      }
    });

    $("#userSearchForm").validate({
      rules: { search: { maxlength: 100 } },
      submitHandler: function () {
        state.search = $("#userSearch").val().trim();
        state.pages.users = 1;
        loadUsers().catch(handleLoadError);
      }
    });

    $("#backToLogin").on("click", function () {
      state.loginEmail = null;
      $("#otpForm").addClass("hidden");
      $("#loginForm").removeClass("hidden");
      $("#authStatus").text("");
    });

    $(".tab").on("click", function () {
      state.activeView = $(this).data("view");
      $(".tab").removeClass("active");
      $(this).addClass("active");
      $(".view-panel").addClass("hidden");
      $("#" + state.activeView + "View").removeClass("hidden");
      loadView(state.activeView);
    });

    $("#logoutButton").on("click", function () {
      api("/api/admin/auth/logout", { method: "POST" })
        .finally(showLogin);
    });

    $("#refreshOpenAiUsage").on("click", function () {
      loadOpenAiUsage().catch(handleLoadError);
    });

    api("/api/admin/session")
      .then(function (response) { showDashboard(response.data); })
      .catch(showLogin);
  });
})(jQuery);
