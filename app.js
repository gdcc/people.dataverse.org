import { MEMBERS_SNAPSHOT, SNAPSHOT_META } from "./data/members.js";

const REMOTE_TSV_URL =
  "https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=0&format=tsv";

const fieldLabels = {
  timezone: "Timezone",
  primaryInstallation: "Primary installation",
  country: "Country",
  zulipId: "Zulip ID",
  orcid: "ORCID",
  githubLocation: "GitHub location",
  githubCompany: "GitHub company",
  githubBlog: "Website",
};

const enrichmentMaps = buildEnrichmentMaps(MEMBERS_SNAPSHOT);
const state = {
  members: normalizeMembers(MEMBERS_SNAPSHOT),
  source: "snapshot",
  loadedAt: SNAPSHOT_META.generatedAt,
  filters: {
    search: "",
    timezone: "",
    installation: "",
    country: "",
  },
};

const elements = {
  searchInput: document.querySelector("#search-input"),
  timezoneFilter: document.querySelector("#timezone-filter"),
  installationFilter: document.querySelector("#installation-filter"),
  countryFilter: document.querySelector("#country-filter"),
  resetButton: document.querySelector("#reset-button"),
  refreshButton: document.querySelector("#refresh-button"),
  profileCount: document.querySelector("#profile-count"),
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

  elements.countryFilter.addEventListener("change", (event) => {
    state.filters.country = event.target.value;
    render();
  });

  elements.resetButton.addEventListener("click", () => {
    state.filters = {
      search: "",
      timezone: "",
      installation: "",
      country: "",
    };
    elements.searchInput.value = "";
    elements.timezoneFilter.value = "";
    elements.installationFilter.value = "";
    elements.countryFilter.value = "";
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
  const { timezone, installation, country, search } = state.filters;
  const timezoneLabel = timezone ? ` in ${timezone}` : "";
  const installationLabel = installation ? ` at ${installation}` : "";
  const countryLabel = country ? ` in ${country}` : "";
  const searchLabel = search ? ` matching "${search}"` : "";

  elements.resultsCopy.textContent =
    `${filteredMembers.length} members${timezoneLabel}${installationLabel}${countryLabel}${searchLabel}.`.replace(
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
    const avatar = node.querySelector(".member-avatar");
    const memberName = node.querySelector(".member-name");
    const displayName = node.querySelector(".member-display-name");
    const bio = node.querySelector(".member-bio");
    memberName.textContent = member.name || member.githubUsername;
    avatar.src = member.avatarUrl || getGitHubAvatarUrl(member.githubUsername);
    avatar.alt = `${member.githubUsername} avatar`;
    avatar.addEventListener(
      "error",
      () => {
        avatar.classList.add("is-missing");
        avatar.alt = "";
      },
      { once: true },
    );
    displayName.textContent = member.name ? `@${member.githubUsername}` : "";
    displayName.hidden = !member.name;
    bio.textContent = member.bio || "";
    bio.hidden = !member.bio;

    const meta = node.querySelector(".member-meta");
    const fields = [
      "timezone",
      "primaryInstallation",
      "country",
      "zulipId",
      "orcid",
      "githubLocation",
      "githubCompany",
      "githubBlog",
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
      [member.htmlUrl || `https://github.com/${member.githubUsername}`, "GitHub profile"],
    ];

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
  fillSelect(
    elements.countryFilter,
    uniqueValues(state.members.map((member) => member.country)),
    "All countries",
    state.filters.country,
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
    .filter((member) => !filters.timezone || member.timezone === filters.timezone)
    .filter(
      (member) =>
        !filters.installation ||
        member.primaryInstallation === filters.installation,
    )
    .filter((member) => !filters.country || member.country === filters.country)
    .filter((member) => matchesSearch(member, filters.search))
    .sort((left, right) => left.githubUsername.localeCompare(right.githubUsername));
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
    .map((row) => applyEnrichment(extractMember(row)))
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

function formatDate(value) {
  if (!value) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getGitHubAvatarUrl(username) {
  return `https://github.com/${encodeURIComponent(username)}.png`;
}

function extractMember(row) {
  return {
    githubUsername: row["GitHub Username"]?.trim() ?? "",
    timezone: row.Timezone?.trim() ?? "",
    primaryInstallation: row["Primary installation"]?.trim() ?? "",
    country: row.Country?.trim() ?? "",
    zulipId: row["Zulip ID"]?.trim() ?? "",
    orcid: row.ORCID?.trim() ?? "",
    name: row["GitHub Profile"]?.name?.trim?.() ?? row["GitHub Profile"]?.name ?? "",
    bio: row["GitHub Profile"]?.bio?.trim?.() ?? row["GitHub Profile"]?.bio ?? "",
    githubLocation:
      row["GitHub Profile"]?.location?.trim?.() ??
      row["GitHub Profile"]?.location ??
      "",
    githubCompany:
      row["GitHub Profile"]?.company?.trim?.() ??
      row["GitHub Profile"]?.company ??
      "",
    githubBlog:
      row["GitHub Profile"]?.blog?.trim?.() ?? row["GitHub Profile"]?.blog ?? "",
    htmlUrl:
      row["GitHub Profile"]?.htmlUrl?.trim?.() ??
      row["GitHub Profile"]?.htmlUrl ??
      "",
    avatarUrl:
      row["GitHub Profile"]?.avatarUrl?.trim?.() ??
      row["GitHub Profile"]?.avatarUrl ??
      "",
  };
}

function applyEnrichment(member) {
  const githubProfile = enrichmentMaps.githubByUsername.get(member.githubUsername) ?? {};
  const country =
    member.country ||
    enrichmentMaps.countryByInstallation.get(member.primaryInstallation) ||
    "";

  return {
    ...member,
    country,
    name: member.name || githubProfile.name || "",
    bio: member.bio || githubProfile.bio || "",
    githubLocation: member.githubLocation || githubProfile.githubLocation || "",
    githubCompany: member.githubCompany || githubProfile.githubCompany || "",
    githubBlog: member.githubBlog || githubProfile.githubBlog || "",
    htmlUrl: member.htmlUrl || githubProfile.htmlUrl || "",
    avatarUrl: member.avatarUrl || githubProfile.avatarUrl || "",
  };
}

function buildEnrichmentMaps(rows) {
  const countryByInstallation = new Map();
  const githubByUsername = new Map();

  for (const row of rows) {
    const member = extractMember(row);
    if (member.primaryInstallation && member.country) {
      countryByInstallation.set(member.primaryInstallation, member.country);
    }

    if (
      member.githubUsername &&
      (member.name ||
        member.bio ||
        member.githubLocation ||
        member.githubCompany ||
        member.githubBlog ||
        member.htmlUrl ||
        member.avatarUrl)
    ) {
      githubByUsername.set(member.githubUsername, {
        name: member.name,
        bio: member.bio,
        githubLocation: member.githubLocation,
        githubCompany: member.githubCompany,
        githubBlog: member.githubBlog,
        htmlUrl: member.htmlUrl,
        avatarUrl: member.avatarUrl,
      });
    }
  }

  return {
    countryByInstallation,
    githubByUsername,
  };
}
