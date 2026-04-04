import { MEMBERS_SNAPSHOT, SNAPSHOT_META } from "./data/members.js";

const REMOTE_TSV_URL =
  "https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=0&format=tsv";

const fieldLabels = {
  timezone: "Timezone",
  matrixName: "Matrix",
  primaryInstallation: "Primary installation",
  sweets: "Sweets",
  zulipId: "Zulip ID",
  orcid: "ORCID",
  functionalAreas: "Functional areas",
  shoutOut: "Shout out",
  freenodeNick: "Freenode nick",
};

const state = {
  members: normalizeMembers(MEMBERS_SNAPSHOT),
  source: "snapshot",
  loadedAt: SNAPSHOT_META.generatedAt,
  filters: {
    search: "",
    timezone: "",
    installation: "",
    activeOnly: false,
  },
};

const elements = {
  searchInput: document.querySelector("#search-input"),
  timezoneFilter: document.querySelector("#timezone-filter"),
  installationFilter: document.querySelector("#installation-filter"),
  activeFilter: document.querySelector("#active-filter"),
  resetButton: document.querySelector("#reset-button"),
  refreshButton: document.querySelector("#refresh-button"),
  profileCount: document.querySelector("#profile-count"),
  activeCount: document.querySelector("#active-count"),
  installationCount: document.querySelector("#installation-count"),
  timezoneCount: document.querySelector("#timezone-count"),
  sourceBadge: document.querySelector("#source-badge"),
  updatedAt: document.querySelector("#updated-at"),
  resultsCopy: document.querySelector("#results-copy"),
  cardGrid: document.querySelector("#card-grid"),
  cardTemplate: document.querySelector("#member-card-template"),
};

bindEvents();
populateFilters();
render();

async function refreshFromRemote() {
  const button = elements.refreshButton;
  button.disabled = true;
  button.textContent = "Refreshing…";

  try {
    const response = await fetch(REMOTE_TSV_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const tsv = await response.text();
    const members = normalizeMembers(parseTsv(tsv));
    if (!members.length) {
      throw new Error("No rows returned");
    }

    state.members = members;
    state.source = "live";
    state.loadedAt = new Date().toISOString();
    populateFilters();
    render();
  } catch (error) {
    window.alert(
      "Live refresh failed, so the app kept using the bundled snapshot.\n\n" +
        error.message,
    );
  } finally {
    button.disabled = false;
    button.textContent = "Refresh from source";
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });

  elements.timezoneFilter.addEventListener("change", (event) => {
    state.filters.timezone = event.target.value;
    render();
  });

  elements.installationFilter.addEventListener("change", (event) => {
    state.filters.installation = event.target.value;
    render();
  });

  elements.activeFilter.addEventListener("change", (event) => {
    state.filters.activeOnly = event.target.checked;
    render();
  });

  elements.resetButton.addEventListener("click", () => {
    state.filters = {
      search: "",
      timezone: "",
      installation: "",
      activeOnly: false,
    };
    elements.searchInput.value = "";
    elements.timezoneFilter.value = "";
    elements.installationFilter.value = "";
    elements.activeFilter.checked = false;
    render();
  });

  elements.refreshButton.addEventListener("click", refreshFromRemote);
}

function render() {
  const filteredMembers = filterMembers(state.members, state.filters);
  updateStats(filteredMembers);
  renderCards(filteredMembers);
  renderMeta(filteredMembers);
}

function updateStats(filteredMembers) {
  const allMembers = state.members;
  elements.profileCount.textContent = filteredMembers.length.toString();
  elements.activeCount.textContent = filteredMembers
    .filter((member) => member.active)
    .length.toString();
  elements.installationCount.textContent = uniqueCount(
    filteredMembers.map((member) => member.primaryInstallation),
  ).toString();
  elements.timezoneCount.textContent = uniqueCount(
    filteredMembers.map((member) => member.timezone),
  ).toString();

  elements.sourceBadge.textContent =
    state.source === "live" ? "Live sheet data" : "Bundled snapshot";
  elements.updatedAt.textContent = `Dataset size: ${allMembers.length} members • Updated ${formatDate(
    state.loadedAt,
  )}`;
}

function renderMeta(filteredMembers) {
  const { timezone, installation, activeOnly, search } = state.filters;
  const activeLabel = activeOnly ? " active" : "";
  const timezoneLabel = timezone ? ` in ${timezone}` : "";
  const installationLabel = installation ? ` at ${installation}` : "";
  const searchLabel = search ? ` matching "${search}"` : "";

  elements.resultsCopy.textContent =
    `${filteredMembers.length} members${activeLabel}${timezoneLabel}${installationLabel}${searchLabel}.`.replace(
      /\s+\./,
      ".",
    );
}

function renderCards(members) {
  elements.cardGrid.innerHTML = "";

  if (!members.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      "No members matched those filters. Try widening the search or clearing one of the selectors.";
    elements.cardGrid.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const member of members) {
    const node = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".member-name").textContent = member.githubUsername;

    const status = node.querySelector(".status-pill");
    status.textContent = member.active ? "Active" : "Listed";
    status.className = `status-pill ${member.active ? "is-active" : "is-inactive"}`;

    const meta = node.querySelector(".member-meta");
    const fields = [
      "timezone",
      "matrixName",
      "primaryInstallation",
      "functionalAreas",
      "sweets",
      "zulipId",
      "orcid",
      "shoutOut",
      "freenodeNick",
    ];

    for (const key of fields) {
      if (!member[key]) {
        continue;
      }

      const wrapper = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = fieldLabels[key];
      dd.textContent = member[key];
      wrapper.append(dt, dd);
      meta.append(wrapper);
    }

    const links = node.querySelector(".member-links");
    const linkSpecs = [
      [
        `https://github.com/${member.githubUsername}`,
        "GitHub profile",
      ],
      [member.examplePullRequest, "Example PR"],
      [member.url, "Project URL"],
    ].filter(([href]) => Boolean(href));

    for (const [href, label] of linkSpecs) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = label;
      links.append(anchor);
    }

    fragment.append(node);
  }

  elements.cardGrid.append(fragment);
}

function populateFilters() {
  fillSelect(
    elements.timezoneFilter,
    uniqueValues(state.members.map((member) => member.timezone)),
    "All timezones",
    state.filters.timezone,
  );
  fillSelect(
    elements.installationFilter,
    uniqueValues(state.members.map((member) => member.primaryInstallation)),
    "All installations",
    state.filters.installation,
  );
}

function fillSelect(element, values, defaultLabel, selectedValue) {
  element.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  element.append(defaultOption);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    element.append(option);
  }

  element.value = selectedValue;
}

function filterMembers(members, filters) {
  return [...members]
    .filter((member) => !filters.activeOnly || member.active)
    .filter((member) => !filters.timezone || member.timezone === filters.timezone)
    .filter(
      (member) =>
        !filters.installation ||
        member.primaryInstallation === filters.installation,
    )
    .filter((member) => matchesSearch(member, filters.search))
    .sort((left, right) => {
      if (left.active !== right.active) {
        return Number(right.active) - Number(left.active);
      }

      return left.githubUsername.localeCompare(right.githubUsername);
    });
}

function matchesSearch(member, search) {
  if (!search) {
    return true;
  }

  return Object.values(member)
    .join(" ")
    .toLowerCase()
    .includes(search);
}

function normalizeMembers(rows) {
  return rows
    .map((row) => ({
      githubUsername: row["GitHub Username"]?.trim() ?? "",
      timezone: row.Timezone?.trim() ?? "",
      matrixName: row["Matrix name"]?.trim() ?? "",
      primaryInstallation: row["Primary installation"]?.trim() ?? "",
      sweets: row.Sweets?.trim() ?? "",
      zulipId: row["Zulip ID"]?.trim() ?? "",
      active: isTruthy(row.Active),
      orcid: row.ORCID?.trim() ?? "",
      functionalAreas: row["Functional Areas"]?.trim() ?? "",
      examplePullRequest: row["Example pull request"]?.trim() ?? "",
      shoutOut: row["Shout out"]?.trim() ?? "",
      url: row.URL?.trim() ?? "",
      freenodeNick: row["freenode nick"]?.trim() ?? "",
    }))
    .filter((member) => member.githubUsername);
}

function parseTsv(tsv) {
  const [headerLine, ...lines] = tsv.trim().split(/\r?\n/);
  const headers = headerLine.split("\t");

  return lines.map((line) => {
    const values = line.split("\t");
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function uniqueCount(values) {
  return uniqueValues(values).length;
}

function isTruthy(value) {
  return ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
}

function formatDate(value) {
  if (!value) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
