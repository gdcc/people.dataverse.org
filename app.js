import { MEMBERS_SNAPSHOT, SNAPSHOT_META } from "./data/members.js";

const APP_BASE_PATH = getAppBasePath();
const fieldLabels = {
  joined: "Joined",
  primaryInstallation: "Primary installation",
  workingGroups: "Working groups",
  country: "Country",
  zulipId: "Zulip ID",
  githubLocation: "Location",
  githubCompany: "Organization",
  githubBlog: "Website",
};

const enrichmentMaps = buildEnrichmentMaps(MEMBERS_SNAPSHOT);
const state = {
  members: normalizeMembers(MEMBERS_SNAPSHOT),
  loadedAt: SNAPSHOT_META.generatedAt,
  timelineAutoScrolled: false,
  ...getLocationState(),
};

const elements = {
  overviewPanel: document.querySelector("#overview-panel"),
  filtersPanel: document.querySelector("#filters-panel"),
  resultsPanel: document.querySelector("#results-panel"),
  timelinePanel: document.querySelector("#timeline-panel"),
  memberRouteActions: document.querySelector("#member-route-actions"),
  searchInput: document.querySelector("#search-input"),
  installationFilter: document.querySelector("#installation-filter"),
  countryFilter: document.querySelector("#country-filter"),
  continentFilter: document.querySelector("#continent-filter"),
  resetButton: document.querySelector("#reset-button"),
  profileCount: document.querySelector("#profile-count"),
  installationCount: document.querySelector("#installation-count"),
  countryCount: document.querySelector("#country-count"),
  continentCount: document.querySelector("#continent-count"),
  sourceBadge: document.querySelector("#source-badge"),
  updatedAt: document.querySelector("#updated-at"),
  resultsCopy: document.querySelector("#results-copy"),
  timelineCopy: document.querySelector("#timeline-copy"),
  timelineBars: document.querySelector("#timeline-bars"),
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
  if (elements.continentFilter) {
    elements.continentFilter.addEventListener("change", (event) => {
      state.filters.continent = event.target.value;
      render();
    });
  }

  elements.resetButton.addEventListener("click", () => {
    state.filters = {
      search: "",
      installation: "",
      workingGroup: "",
      country: "",
      continent: "",
    };
    elements.searchInput.value = "";
    if (elements.installationFilter) {
      elements.installationFilter.value = "";
    }
    if (elements.countryFilter) {
      elements.countryFilter.value = "";
    }
    if (elements.continentFilter) {
      elements.continentFilter.value = "";
    }
    render();
  });

  window.addEventListener("popstate", () => {
    const locationState = getLocationState();
    state.route = locationState.route;
    state.filters = locationState.filters;
    render();
  });
}

function render() {
  const isMemberRoute = Boolean(state.route.memberUsername);
  document.body.classList.toggle("member-route", isMemberRoute);
  toggleRouteSections(isMemberRoute);

  const visibleMembers = getVisibleMembers();
  updateDocumentTitle(visibleMembers);
  updateStats(visibleMembers);
  renderTimeline(visibleMembers);
  renderCards(visibleMembers);
  renderMeta(visibleMembers);
  syncFilterInputs();
}

function toggleRouteSections(isMemberRoute) {
  if (elements.overviewPanel) {
    elements.overviewPanel.hidden = isMemberRoute;
  }
  if (elements.filtersPanel) {
    elements.filtersPanel.hidden = isMemberRoute;
  }
  if (elements.resultsPanel) {
    elements.resultsPanel.hidden = isMemberRoute;
  }
  if (elements.timelinePanel) {
    elements.timelinePanel.hidden = isMemberRoute;
  }
  if (elements.memberRouteActions) {
    elements.memberRouteActions.hidden = !isMemberRoute;
  }
}

function renderTimeline(members) {
  if (!elements.timelineBars || !elements.timelineCopy) {
    return;
  }

  elements.timelineBars.innerHTML = "";
  const timeline = buildTimelineRows(members);

  if (!timeline) {
    elements.timelineCopy.textContent = "No timeline data for this selection.";
    return;
  }

  elements.timelineCopy.textContent = `${timeline.rows.length} members • ${formatMonthIndex(
    timeline.startMonthIndex,
  )} to ${formatMonthIndex(timeline.endMonthIndex)}.`;

  const shell = document.createElement("div");
  shell.className = "timeline-shell";

  const names = document.createElement("div");
  names.className = "timeline-names";

  const namesGrid = document.createElement("div");
  namesGrid.className = "timeline-names-grid";

  const scroll = document.createElement("div");
  scroll.className = "timeline-scroll";

  const tracksGrid = document.createElement("div");
  tracksGrid.className = "timeline-tracks-grid";
  tracksGrid.style.setProperty("--timeline-width", `${timeline.widthPx}px`);

  const namesFragment = document.createDocumentFragment();
  const tracksFragment = document.createDocumentFragment();
  for (const row of timeline.rows) {
    const nameRow = document.createElement("div");
    nameRow.className = "timeline-name-row";

    const name = document.createElement("span");
    name.className = "timeline-name";
    name.textContent = row.label;

    nameRow.append(name);
    namesFragment.append(nameRow);

    const trackRow = document.createElement("div");
    trackRow.className = "timeline-track-row";

    const track = document.createElement("span");
    track.className = "timeline-track";

    for (const segment of row.segments) {
      const bar = document.createElement("span");
      bar.className = "timeline-segment";
      bar.style.left = `${segment.leftPercent}%`;
      bar.style.width = `${segment.widthPercent}%`;
      bar.title = `${row.label}: ${segment.startLabel} to ${segment.endLabel}`;
      track.append(bar);
    }

    trackRow.append(track);
    tracksFragment.append(trackRow);
  }

  const axisNameRow = document.createElement("div");
  axisNameRow.className = "timeline-axis-name-row";

  const axisName = document.createElement("span");
  axisName.className = "timeline-axis-name";
  axisName.textContent = "Dates";

  axisNameRow.append(axisName);
  namesFragment.append(axisNameRow);

  const axisTrackRow = document.createElement("div");
  axisTrackRow.className = "timeline-axis-track-row";

  const axisTrack = document.createElement("span");
  axisTrack.className = "timeline-axis-track";

  for (const tick of timeline.ticks) {
    const tickNode = document.createElement("span");
    tickNode.className = "timeline-axis-tick";
    tickNode.style.left = `${tick.leftPercent}%`;

    const label = document.createElement("span");
    label.className = "timeline-axis-label";
    label.textContent = tick.label;
    tickNode.append(label);
    axisTrack.append(tickNode);
  }

  axisTrackRow.append(axisTrack);
  tracksFragment.append(axisTrackRow);

  namesGrid.append(namesFragment);
  tracksGrid.append(tracksFragment);
  names.append(namesGrid);
  scroll.append(tracksGrid);
  shell.append(names, scroll);
  elements.timelineBars.append(shell);

  if (!state.timelineAutoScrolled) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scroller = scroll;
        scroller.scrollLeft = scroller.scrollWidth;
        state.timelineAutoScrolled = scroller.scrollLeft > 0;
      });
    });
  }
}

function buildTimelineRows(members) {
  const rows = [];
  const currentDate = new Date();
  const currentMonthIndex = getMonthIndex({
    year: currentDate.getUTCFullYear(),
    month: currentDate.getUTCMonth() + 1,
  });
  let minMonthIndex = Number.POSITIVE_INFINITY;
  let maxMonthIndex = Number.NEGATIVE_INFINITY;

  for (const member of members) {
    if (!Array.isArray(member.periods) || member.periods.length === 0) {
      continue;
    }

    const segments = [];
    let hasOpenSegment = false;
    let earliestOpenStartMonthIndex = Number.POSITIVE_INFINITY;
    let earliestStartMonthIndex = Number.POSITIVE_INFINITY;
    let latestClosedEndMonthIndex = Number.NEGATIVE_INFINITY;
    for (const period of member.periods) {
      const startParts = parseYearMonth(period.startDate);
      if (!startParts) {
        continue;
      }

      const startMonthIndex = getMonthIndex(startParts);
      earliestStartMonthIndex = Math.min(earliestStartMonthIndex, startMonthIndex);
      const endParts = parseYearMonth(period.endDate);
      const endMonthIndex = Math.max(
        startMonthIndex,
        endParts ? getMonthIndex(endParts) : currentMonthIndex,
      );

      if (!endParts) {
        hasOpenSegment = true;
        earliestOpenStartMonthIndex = Math.min(
          earliestOpenStartMonthIndex,
          startMonthIndex,
        );
      } else {
        latestClosedEndMonthIndex = Math.max(latestClosedEndMonthIndex, endMonthIndex);
      }

      minMonthIndex = Math.min(minMonthIndex, startMonthIndex);
      maxMonthIndex = Math.max(maxMonthIndex, endMonthIndex);
      segments.push({
        startMonthIndex,
        endMonthIndex,
        startLabel: formatMonthIndex(startMonthIndex),
        endLabel: endParts ? formatMonthIndex(endMonthIndex) : "present",
      });
    }

    if (segments.length === 0) {
      continue;
    }

    segments.sort((left, right) => left.startMonthIndex - right.startMonthIndex);
    rows.push({
      label: member.githubUsername,
      segments,
      hasOpenSegment,
      earliestOpenStartMonthIndex,
      earliestStartMonthIndex,
      latestClosedEndMonthIndex,
    });
  }

  if (rows.length === 0) {
    return null;
  }

  const totalMonths = maxMonthIndex - minMonthIndex + 1;
  const monthSpan = Math.max(1, totalMonths - 1);
  const pixelsPerMonth = 7;
  const widthPx = Math.max(totalMonths * pixelsPerMonth, 360);

  rows.sort((left, right) => {
    if (left.hasOpenSegment !== right.hasOpenSegment) {
      return left.hasOpenSegment ? -1 : 1;
    }

    if (left.hasOpenSegment && right.hasOpenSegment) {
      if (left.earliestOpenStartMonthIndex !== right.earliestOpenStartMonthIndex) {
        return left.earliestOpenStartMonthIndex - right.earliestOpenStartMonthIndex;
      }
    } else if (!left.hasOpenSegment && !right.hasOpenSegment) {
      if (left.latestClosedEndMonthIndex !== right.latestClosedEndMonthIndex) {
        return right.latestClosedEndMonthIndex - left.latestClosedEndMonthIndex;
      }
    }

    if (left.earliestStartMonthIndex !== right.earliestStartMonthIndex) {
      return left.earliestStartMonthIndex - right.earliestStartMonthIndex;
    }

    return left.label.localeCompare(right.label);
  });

  for (const row of rows) {
    for (const segment of row.segments) {
      segment.leftPercent = ((segment.startMonthIndex - minMonthIndex) / monthSpan) * 100;
      segment.widthPercent =
        ((segment.endMonthIndex - segment.startMonthIndex + 1) / totalMonths) * 100;
    }
  }

  return {
    rows,
    startMonthIndex: minMonthIndex,
    endMonthIndex: maxMonthIndex,
    widthPx,
    ticks: buildTimelineTicks(minMonthIndex, maxMonthIndex, monthSpan),
  };
}

function buildTimelineTicks(startMonthIndex, endMonthIndex, monthSpan) {
  const tickMonthIndexes = new Set([startMonthIndex, endMonthIndex]);
  const startYear = Math.floor(startMonthIndex / 12);
  const endYear = Math.floor(endMonthIndex / 12);

  for (let year = startYear; year <= endYear; year += 1) {
    const januaryMonthIndex = getMonthIndex({ year, month: 1 });
    if (januaryMonthIndex >= startMonthIndex && januaryMonthIndex <= endMonthIndex) {
      tickMonthIndexes.add(januaryMonthIndex);
    }
  }

  return [...tickMonthIndexes]
    .sort((left, right) => left - right)
    .map((tickMonthIndex) => {
      const isBoundary =
        tickMonthIndex === startMonthIndex || tickMonthIndex === endMonthIndex;
      const year = Math.floor(tickMonthIndex / 12);

      return {
        leftPercent: ((tickMonthIndex - startMonthIndex) / monthSpan) * 100,
        label: isBoundary ? formatMonthIndex(tickMonthIndex) : String(year),
      };
    });
}

function getMonthIndex(parts) {
  return parts.year * 12 + (parts.month - 1);
}

function formatMonthIndex(monthIndex) {
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return formatInvolvementMonthYear(`${year}-${String(month).padStart(2, "0")}`);
}

function updateDocumentTitle(visibleMembers) {
  if (state.route.memberUsername && visibleMembers.length === 1) {
    const member = visibleMembers[0];
    const titleName = member.name || member.githubUsername;
    document.title = `${titleName} - Dataverse People`;
    return;
  }

  document.title = "Dataverse People";
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
  elements.continentCount.textContent = uniqueCount(
    filteredMembers.map((member) => member.continent),
  ).toString();

  elements.sourceBadge.textContent = "Snapshot";
  elements.updatedAt.textContent = `${allMembers.length} members • Updated ${formatDate(
    state.loadedAt,
  )}`;
}

function renderMeta(filteredMembers) {
  if (state.route.memberUsername) {
    const memberLabel = filteredMembers.length === 1 ? "member" : "members";
    const routeLabel = filteredMembers.length
      ? ` for @${filteredMembers[0].githubUsername}`
      : ` for @${state.route.memberUsername}`;
    elements.resultsCopy.textContent = `${filteredMembers.length} ${memberLabel}${routeLabel}.`;
    return;
  }

  const { installation, workingGroup, country, continent, search } =
    state.filters;
  const installationLabel = installation ? ` at ${installation}` : "";
  const workingGroupLabel = workingGroup
    ? ` in the ${workingGroup} working group`
    : "";
  const countryLabel = country ? ` in ${country}` : "";
  const continentLabel = continent ? ` in ${continent}` : "";
  const searchLabel = search ? ` matching "${search}"` : "";
  const memberLabel = filteredMembers.length === 1 ? "member" : "members";

  elements.resultsCopy.textContent =
    `${filteredMembers.length} ${memberLabel}${installationLabel}${workingGroupLabel}${countryLabel}${continentLabel}${searchLabel}.`.replace(
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
    const avatarLink = node.querySelector(".member-avatar-link");
    const avatar = node.querySelector(".member-avatar");
    const memberName = node.querySelector(".member-name");
    const githubRow = node.querySelector(".member-github-row");
    const displayName = node.querySelector(".member-display-name");
    const displayHandle = node.querySelector(".member-display-handle");
    const zulipLink = node.querySelector(".member-zulip-link");
    const bio = node.querySelector(".member-bio");
    const seeAlso = node.querySelector(".member-see-also");
    const seeAlsoLink = node.querySelector(".member-see-also-link");
    memberName.textContent = member.name || member.githubUsername;
    avatarLink.href = getMemberUrl(member.githubUsername);
    avatarLink.addEventListener("click", (event) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      navigateToMember(member.githubUsername);
    });
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
    githubRow.hidden = false;
    if (member.issue) {
      seeAlso.hidden = false;
      seeAlsoLink.href = member.issue;
      seeAlsoLink.textContent = member.issue;
    } else {
      seeAlso.hidden = true;
    }
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
      "joined",
      "primaryInstallation",
      "workingGroups",
      "githubLocation",
      "githubCompany",
      "githubBlog",
    ];

    for (const key of fields) {
      if (!member[key] || (Array.isArray(member[key]) && member[key].length === 0)) {
        continue;
      }

      const wrapper = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = fieldLabels[key];
      if (key === "primaryInstallation") {
        appendInstallationValue(dd, {
          installation: member.primaryInstallation,
          country: member.country,
          installationDescription: member.installationDescription,
          gdccMember: member.gdccMember,
          coreTrustSeals: member.coreTrustSeals,
        });
      } else if (key === "workingGroups") {
        appendWorkingGroupsValue(dd, member.workingGroups);
      } else {
        appendFieldValue(dd, member[key]);
      }
      wrapper.append(dt, dd);
      meta.append(wrapper);
    }

    if (member.dataverseTv) {
      const links = node.querySelector(".member-links");
      const dataverseTvLink = document.createElement("a");
      dataverseTvLink.href = "https://dataverse.org/dataversetv";
      dataverseTvLink.target = "_blank";
      dataverseTvLink.rel = "noreferrer";
      dataverseTvLink.className = "dataversetv-link";
      dataverseTvLink.setAttribute(
        "aria-label",
        `Open DataverseTV for ${member.githubUsername}`,
      );
      const dataverseTvImage = document.createElement("img");
      dataverseTvImage.src = "./assets/dataversetv.svg";
      dataverseTvImage.alt = "";
      dataverseTvImage.className = "dataversetv-link-image";
      dataverseTvImage.setAttribute("aria-hidden", "true");
      const dataverseTvLabel = document.createElement("span");
      dataverseTvLabel.textContent = "Watch me on DataverseTV";
      dataverseTvLink.append(dataverseTvImage, dataverseTvLabel);
      links.append(dataverseTvLink);
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
  if (elements.continentFilter) {
    fillSelect(
      elements.continentFilter,
      uniqueValues(state.members.map((member) => member.continent)),
      "All continents",
      state.filters.continent,
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

function syncFilterInputs() {
  if (elements.installationFilter) {
    elements.installationFilter.value = state.filters.installation;
  }
  if (elements.countryFilter) {
    elements.countryFilter.value = state.filters.country;
  }
  if (elements.continentFilter) {
    elements.continentFilter.value = state.filters.continent;
  }
}

function filterMembers(members, filters) {
  return [...members]
    .filter(
      (member) =>
        !filters.installation ||
        member.primaryInstallation === filters.installation,
    )
    .filter(
      (member) =>
        !filters.workingGroup ||
        member.workingGroups.includes(filters.workingGroup),
    )
    .filter((member) => !filters.country || member.country === filters.country)
    .filter((member) => !filters.continent || member.continent === filters.continent)
    .filter((member) => matchesSearch(member, filters.search))
    .sort((left, right) => left.githubUsername.localeCompare(right.githubUsername));
}

function getVisibleMembers() {
  if (!state.route.memberUsername) {
    return filterMembers(state.members, state.filters);
  }

  return state.members.filter(
    (member) =>
      member.githubUsername.toLowerCase() ===
      state.route.memberUsername.toLowerCase(),
  );
}

function matchesSearch(member, search) {
  if (!search) {
    return true;
  }

  const searchableValues = {
    githubUsername: member.githubUsername,
    primaryInstallation: member.primaryInstallation,
    workingGroups: Array.isArray(member.workingGroups) ? member.workingGroups.join(" ") : "",
    issue: member.issue,
    country: member.country,
    continent: member.continent,
    installationDescription: member.installationDescription,
    name: member.name,
    bio: member.bio,
    githubLocation: member.githubLocation,
    githubCompany: member.githubCompany,
    githubBlog: member.githubBlog,
  };

  return Object.values(searchableValues)
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

function getMemberUrl(username) {
  return `${APP_BASE_PATH}/${encodeURIComponent(username)}` || `/${encodeURIComponent(username)}`;
}

function navigateToMember(username) {
  const nextUrl = getMemberUrl(username);
  if (window.location.pathname !== nextUrl) {
    window.history.pushState(null, "", nextUrl);
  }
  state.route = { memberUsername: username };
  state.filters = getDefaultFilters();
  render();
}

function navigateHomeWithFilters(nextFilters) {
  state.route = { memberUsername: "" };
  state.filters = {
    ...getDefaultFilters(),
    ...nextFilters,
  };
  window.history.pushState(null, "", getHomeUrl(state.filters));
  render();
}

function getZulipProfileUrl(zulipId) {
  return `https://dataverse.zulipchat.com/#narrow/sender/${encodeURIComponent(zulipId)}`;
}

function getWorkingGroupUrl(name) {
  const slug = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `https://www.gdcc.io/working-groups/${slug}.html`;
}

function appendFieldValue(container, value) {
  const text = String(value ?? "").trim();
  const href = toExternalHref(text);

  if (href) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = text;
    container.textContent = "";
    container.append(anchor);
    return;
  }

  appendLinkedText(container, text);
}

function appendWorkingGroupsValue(container, workingGroups) {
  container.textContent = "";

  workingGroups.forEach((group, index) => {
    if (index > 0) {
      container.append(document.createTextNode(", "));
    }

    const anchor = document.createElement("a");
    anchor.href = getWorkingGroupUrl(group);
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = group;
    container.append(anchor);

    container.append(document.createTextNode(" "));
    appendFilterControl(container, {
      active:
        !state.route.memberUsername && state.filters.workingGroup === group,
      activeLabel: `Currently filtering by working group: ${group}`,
      filterLabel: `Filter by working group: ${group}`,
      onFilter: () => {
        if (state.route.memberUsername) {
          navigateHomeWithFilters({ workingGroup: group });
        } else {
          state.filters.workingGroup = group;
          render();
        }
      },
    });
  });
}

function appendFilterControl(
  container,
  { active, activeLabel, filterLabel, onFilter },
) {
  const filterIcon = document.createElement("img");
  filterIcon.src = "./assets/filter.svg";
  filterIcon.alt = "";
  filterIcon.className = "inline-filter-icon";
  filterIcon.setAttribute("aria-hidden", "true");

  if (active) {
    const activeFilter = document.createElement("span");
    activeFilter.className = "inline-filter-active";
    activeFilter.setAttribute("role", "img");
    activeFilter.setAttribute("aria-label", activeLabel);
    activeFilter.append(filterIcon);
    container.append(activeFilter);
    return;
  }

  const filterButton = document.createElement("button");
  filterButton.type = "button";
  filterButton.className = "inline-filter-button";
  filterButton.setAttribute("aria-label", filterLabel);
  filterButton.addEventListener("click", onFilter);
  filterButton.append(filterIcon);
  container.append(filterButton);
}

function appendInstallationValue(
  container,
  { installation, country, installationDescription, gdccMember, coreTrustSeals },
) {
  const installationText = String(installation ?? "").trim();
  const installationHref = toExternalHref(installationText);
  const installationAlreadyFiltered =
    !state.route.memberUsername && state.filters.installation === installationText;

  if (installationText) {
    if (installationHref) {
      const installationLink = document.createElement("a");
      installationLink.href = installationHref;
      installationLink.target = "_blank";
      installationLink.rel = "noreferrer";
      installationLink.className = "installation-external-link";
      installationLink.textContent = installationText;
      container.append(installationLink);
    } else {
      const installationLabel = document.createElement("span");
      installationLabel.textContent = installationText;
      container.append(installationLabel);
    }

    container.append(document.createTextNode(" "));
    appendFilterControl(container, {
      active: installationAlreadyFiltered,
      activeLabel: `Currently filtering by installation: ${installationText}`,
      filterLabel: `Filter by installation: ${installationText}`,
      onFilter: () => {
        if (state.route.memberUsername) {
          navigateHomeWithFilters({ installation: installationText });
        } else {
          state.filters.installation = installationText;
          render();
        }
      },
    });

    if (installationHref) {
      if (gdccMember) {
        container.append(document.createTextNode(" "));
        const gdccLink = document.createElement("a");
        gdccLink.href = "https://www.gdcc.io/members.html";
        gdccLink.target = "_blank";
        gdccLink.rel = "noreferrer";
        gdccLink.className = "gdcc-inline-link";
        gdccLink.setAttribute(
          "aria-label",
          `${installationText} is a GDCC member. Open GDCC members page`,
        );
        const gdccLogo = document.createElement("img");
        gdccLogo.src = "./assets/gdcc-logo.png";
        gdccLogo.alt = "";
        gdccLogo.className = "gdcc-inline-icon";
        gdccLogo.setAttribute("aria-hidden", "true");
        gdccLink.append(gdccLogo);
        container.append(gdccLink);
      }

      if (Array.isArray(coreTrustSeals)) {
        for (const sealUrl of coreTrustSeals) {
          if (!sealUrl) {
            continue;
          }

          container.append(document.createTextNode(" "));
          const sealLink = document.createElement("a");
          sealLink.href = sealUrl;
          sealLink.target = "_blank";
          sealLink.rel = "noreferrer";
          sealLink.className = "coretrust-inline-link";
          sealLink.setAttribute("aria-label", "Open CoreTrustSeal certificate");
          const sealLogo = document.createElement("img");
          sealLogo.src = "./assets/coretrustseal.jpg";
          sealLogo.alt = "";
          sealLogo.className = "coretrust-inline-icon";
          sealLogo.setAttribute("aria-hidden", "true");
          sealLink.append(sealLogo);
          container.append(sealLink);
        }
      }
    }
  }

  if (installationDescription) {
    container.append(document.createElement("br"));
    container.append(createInstallationDescriptionPreview(installationDescription));
  }

  if (!country) {
    return;
  }

  container.append(document.createElement("br"));
  const countryAlreadyFiltered =
    !state.route.memberUsername && state.filters.country === country;

  if (countryAlreadyFiltered) {
    const countryLabel = document.createElement("span");
    countryLabel.className = "inline-filter-label";
    countryLabel.textContent = `(${country})`;
    container.append(countryLabel);
  } else {
    const countryLink = document.createElement("a");
    countryLink.href = "#";
    countryLink.className = "inline-filter-link";
    countryLink.textContent = `(${country})`;
    countryLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (state.route.memberUsername) {
        navigateHomeWithFilters({ country });
      } else {
        state.filters.country = country;
        render();
      }
    });
    container.append(countryLink);
  }
}

function createInstallationDescriptionPreview(description) {
  const wrapper = document.createElement("span");
  wrapper.className = "installation-description-preview";

  const normalized = String(description ?? "").replace(/\s+/g, " ").trim();
  const preview = truncateDescription(normalized, 58);

  const previewText = document.createElement("span");
  appendLinkedText(previewText, preview);
  wrapper.append(previewText);

  if (preview !== normalized) {
    const expandButton = document.createElement("button");
    expandButton.type = "button";
    expandButton.className = "description-expand-button";
    expandButton.textContent = "...";
    expandButton.setAttribute("aria-label", "Read full installation description");
    expandButton.addEventListener("click", () => {
      const expanded = wrapper.dataset.expanded === "true";
      wrapper.dataset.expanded = expanded ? "false" : "true";
      appendLinkedText(previewText, expanded ? preview : normalized);
      expandButton.textContent = expanded ? "..." : " [collapse description]";
      expandButton.setAttribute(
        "aria-label",
        expanded
          ? "Read full installation description"
          : "Collapse installation description",
      );
    });
    wrapper.append(expandButton);
  }

  return wrapper;
}

function truncateDescription(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 24 ? truncated.slice(0, lastSpace) : truncated).trimEnd();
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

function getAppBasePath() {
  const pathname = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
  return pathname === "/" ? "" : pathname;
}

function getLocationState() {
  const route = getRouteFromLocation();
  const filters = getFiltersFromLocation();

  return { route, filters };
}

function getRouteFromLocation() {
  const pathname = window.location.pathname;
  const relativePath = pathname.startsWith(`${APP_BASE_PATH}/`)
    ? pathname.slice(APP_BASE_PATH.length + 1)
    : pathname.slice(1);
  const [memberUsername = ""] = relativePath.split("/").filter(Boolean);

  return {
    memberUsername: decodeURIComponent(memberUsername || ""),
  };
}

function getFiltersFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get("search") ?? "",
    installation: params.get("installation") ?? "",
    workingGroup: params.get("workingGroup") ?? "",
    country: params.get("country") ?? "",
    continent: params.get("continent") ?? "",
  };
}

function getDefaultFilters() {
  return {
    search: "",
    installation: "",
    workingGroup: "",
    country: "",
    continent: "",
  };
}

function getHomeUrl(filters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return `${APP_BASE_PATH || ""}/${query ? `?${query}` : ""}`.replace(/\/\?/, "/?");
}

function extractMember(row) {
  const periods = parsePeriods(row.Periods);
  const joined = formatInvolvementMonthYear(getEarliestStartDate(periods));

  return {
    githubUsername: row["GitHub Username"]?.trim() ?? "",
    joined,
    periods,
    primaryInstallation: row["Primary installation"]?.trim() ?? "",
    workingGroups: parseWorkingGroups(row["Working Groups"]),
    issue: row.Issue?.trim() ?? "",
    country: row.Country?.trim() ?? "",
    continent: row.Continent?.trim() ?? "",
    installationDescription: row["Installation Description"]?.trim() ?? "",
    gdccMember: Boolean(row["GDCC Member"]),
    coreTrustSeals: Array.isArray(row.CoreTrustSeals) ? row.CoreTrustSeals : [],
    dataverseTv: Boolean(row.DataverseTV),
    zulipId: row["Zulip ID"]?.trim() ?? "",
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

function parseWorkingGroups(value) {
  return String(value ?? "")
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);
}

function parsePeriods(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((period) => ({
      startDate: String(period?.["Start Date"] ?? "").trim(),
      endDate: String(period?.["End Date"] ?? "").trim(),
    }))
    .filter((period) => period.startDate || period.endDate);
}

function getEarliestStartDate(periods) {
  const startDates = periods
    .map((period) => period.startDate)
    .filter((dateValue) => /^\d{4}-\d{2}(?:-\d{2})?$/.test(dateValue));

  if (startDates.length === 0) {
    return "";
  }

  return startDates.sort((left, right) => left.localeCompare(right))[0];
}

function formatInvolvementMonthYear(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return "";
  }

  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function parseYearMonth(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function applyEnrichment(member) {
  const githubProfile = enrichmentMaps.githubByUsername.get(member.githubUsername) ?? {};
  const country =
    member.country ||
    enrichmentMaps.countryByInstallation.get(member.primaryInstallation) ||
    "";
  const continent =
    member.continent ||
    enrichmentMaps.continentByInstallation.get(member.primaryInstallation) ||
    "";
  const installationDescription =
    member.installationDescription ||
    enrichmentMaps.descriptionByInstallation.get(member.primaryInstallation) ||
    "";
  const gdccMember =
    member.gdccMember ||
    enrichmentMaps.gdccMemberByInstallation.get(member.primaryInstallation) ||
    false;
  const coreTrustSeals =
    member.coreTrustSeals.length > 0
      ? member.coreTrustSeals
      : (enrichmentMaps.coreTrustSealsByInstallation.get(member.primaryInstallation) ?? []);

  return {
    ...member,
    country,
    continent,
    installationDescription,
    gdccMember,
    coreTrustSeals,
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
  const continentByInstallation = new Map();
  const descriptionByInstallation = new Map();
  const gdccMemberByInstallation = new Map();
  const coreTrustSealsByInstallation = new Map();
  const githubByUsername = new Map();

  for (const row of rows) {
    const member = extractMember(row);
    if (member.primaryInstallation && member.country) {
      countryByInstallation.set(member.primaryInstallation, member.country);
    }
    if (member.primaryInstallation && member.continent) {
      continentByInstallation.set(member.primaryInstallation, member.continent);
    }
    if (member.primaryInstallation && member.installationDescription) {
      descriptionByInstallation.set(
        member.primaryInstallation,
        member.installationDescription,
      );
    }
    if (member.primaryInstallation && member.gdccMember) {
      gdccMemberByInstallation.set(member.primaryInstallation, true);
    }
    if (member.primaryInstallation && member.coreTrustSeals.length > 0) {
      coreTrustSealsByInstallation.set(
        member.primaryInstallation,
        member.coreTrustSeals,
      );
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
    continentByInstallation,
    descriptionByInstallation,
    gdccMemberByInstallation,
    coreTrustSealsByInstallation,
    githubByUsername,
  };
}
