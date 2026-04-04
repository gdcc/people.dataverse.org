import { MEMBERS_SNAPSHOT, SNAPSHOT_META } from "./data/members.js";

const fieldLabels = {
  primaryInstallation: "Primary installation",
  country: "Country",
  zulipId: "Zulip ID",
  orcid: "ORCID",
  githubLocation: "Location",
  githubCompany: "Organization",
  githubBlog: "Website",
};

const enrichmentMaps = buildEnrichmentMaps(MEMBERS_SNAPSHOT);
const state = {
  members: normalizeMembers(MEMBERS_SNAPSHOT),
  loadedAt: SNAPSHOT_META.generatedAt,
  filters: {
    search: "",
    installation: "",
    country: "",
  },
};

const elements = {
  searchInput: document.querySelector("#search-input"),
  installationFilter: document.querySelector("#installation-filter"),
  countryFilter: document.querySelector("#country-filter"),
  resetButton: document.querySelector("#reset-button"),
  profileCount: document.querySelector("#profile-count"),
  installationCount: document.querySelector("#installation-count"),
  countryCount: document.querySelector("#country-count"),
  sourceBadge: document.querySelector("#source-badge"),
  updatedAt: document.querySelector("#updated-at"),
  resultsCopy: document.querySelector("#results-copy"),
  cardGrid: document.querySelector("#card-grid"),
  cardTemplate: document.querySelector("#member-card-template"),
};

bindEvents();
populateFilters();
render();

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });

  if (elements.installationFilter) {
    elements.installationFilter.addEventListener("change", (event) => {
      state.filters.installation = event.target.value;
      render();
    });
  }

  if (elements.countryFilter) {
    elements.countryFilter.addEventListener("change", (event) => {
      state.filters.country = event.target.value;
      render();
    });
  }

  elements.resetButton.addEventListener("click", () => {
    state.filters = {
      search: "",
      installation: "",
      country: "",
    };
    elements.searchInput.value = "";
    if (elements.installationFilter) {
      elements.installationFilter.value = "";
    }
    if (elements.countryFilter) {
      elements.countryFilter.value = "";
    }
    render();
  });
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
  elements.countryCount.textContent = uniqueCount(
    filteredMembers.map((member) => member.country),
  ).toString();

  elements.sourceBadge.textContent = "Bundled snapshot";
  elements.updatedAt.textContent = `Dataset size: ${allMembers.length} members • Updated ${formatDate(
    state.loadedAt,
  )}`;
}

function renderMeta(filteredMembers) {
  const { installation, country, search } = state.filters;
  const installationLabel = installation ? ` at ${installation}` : "";
  const countryLabel = country ? ` in ${country}` : "";
  const searchLabel = search ? ` matching "${search}"` : "";

  elements.resultsCopy.textContent =
    `${filteredMembers.length} members${installationLabel}${countryLabel}${searchLabel}.`.replace(
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
    const displayHandle = node.querySelector(".member-display-handle");
    const zulipLink = node.querySelector(".member-zulip-link");
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
    displayHandle.textContent = `@${member.githubUsername}`;
    displayName.href = member.htmlUrl || `https://github.com/${member.githubUsername}`;
    displayName.hidden = false;
    if (member.zulipId) {
      zulipLink.href = getZulipProfileUrl(member.zulipId);
      zulipLink.hidden = false;
    } else {
      zulipLink.hidden = true;
    }
    appendLinkedText(bio, member.bio || "");
    bio.hidden = !member.bio;

    const meta = node.querySelector(".member-meta");
    const fields = [
      "primaryInstallation",
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
      if (key === "primaryInstallation") {
        appendInstallationValue(dd, member.primaryInstallation, member.country);
      } else {
        appendFieldValue(dd, member[key]);
      }
      wrapper.append(dt, dd);
      meta.append(wrapper);
    }
    fragment.append(node);
  }

  elements.cardGrid.append(fragment);
}

function populateFilters() {
  if (elements.installationFilter) {
    fillSelect(
      elements.installationFilter,
      uniqueValues(state.members.map((member) => member.primaryInstallation)),
      "All installations",
      state.filters.installation,
    );
  }
  if (elements.countryFilter) {
    fillSelect(
      elements.countryFilter,
      uniqueValues(state.members.map((member) => member.country)),
      "All countries",
      state.filters.country,
    );
  }
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

function getZulipProfileUrl(zulipId) {
  return `https://dataverse.zulipchat.com/#user/${encodeURIComponent(zulipId)}`;
}

function appendFieldValue(container, value) {
  appendLinkedText(container, String(value ?? "").trim());
}

function appendInstallationValue(container, installation, country) {
  appendLinkedText(container, String(installation ?? "").trim());

  if (!country) {
    return;
  }

  container.append(document.createElement("br"));
  const countryText = document.createElement("span");
  countryText.textContent = `(${country})`;
  container.append(countryText);
}

function appendLinkedText(container, value) {
  container.textContent = "";

  const text = String(value ?? "");
  const pattern =
    /@[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?|[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+|(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s<>"']*)?/gi;

  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchedText = match[0];
    const start = match.index ?? 0;
    const previousChar = start > 0 ? text[start - 1] : "";

    if (matchedText.startsWith("@") && /[\w@]/.test(previousChar)) {
      continue;
    }

    const { linkText, trailingText } = splitTrailingPunctuation(matchedText);

    if (start > lastIndex) {
      appendPlainText(container, text.slice(lastIndex, start));
    }

    const href = toExternalHref(linkText);
    if (href) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = linkText;
      container.append(anchor);
    } else {
      appendPlainText(container, linkText);
    }

    if (trailingText) {
      appendPlainText(container, trailingText);
    }

    lastIndex = start + matchedText.length;
  }

  if (lastIndex < text.length) {
    appendPlainText(container, text.slice(lastIndex));
  }
}

function appendPlainText(container, text) {
  const parts = String(text).split(/\r?\n/);

  parts.forEach((part, index) => {
    if (index > 0) {
      container.append(document.createElement("br"));
    }
    if (part) {
      container.append(document.createTextNode(part));
    }
  });
}

function splitTrailingPunctuation(text) {
  const match = text.match(/^(.*?)([),.;!?]+)?$/);

  return {
    linkText: match?.[1] ?? text,
    trailingText: match?.[2] ?? "",
  };
}

function toExternalHref(value) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (isGitHubMention(trimmed)) {
    return `https://github.com/${trimmed.slice(1)}`;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (looksLikeWebAddress(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }

  return "";
}

function isGitHubMention(value) {
  return /^@[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/i.test(value);
}

function looksLikeWebAddress(value) {
  if (/\s/.test(value)) {
    return false;
  }

  const [host] = value.split(/[/?#]/, 1);
  if (!host) {
    return false;
  }

  // Accept common web-style domains, optionally followed by a path/query/hash.
  return /^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    host,
  );
}

function extractMember(row) {
  return {
    githubUsername: row["GitHub Username"]?.trim() ?? "",
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
