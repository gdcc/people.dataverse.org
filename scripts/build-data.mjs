import { readFile, writeFile } from "node:fs/promises";

const inputPath = new URL("../data/community-members.tsv", import.meta.url);
const involvementPath = new URL("../data/project-involvement.tsv", import.meta.url);
const installationsPath = new URL("../data/installations.json", import.meta.url);
const githubUsersPath = new URL("../data/github-users.json", import.meta.url);
const dataverseTvPath = new URL("../data/dataversetv.tsv", import.meta.url);
const outputPath = new URL("../data/members.js", import.meta.url);
const sourceFields = [
  "GitHub Username",
  "Primary installation",
  "Zulip ID",
  "Working Groups",
  "Issue",
];

const raw = await readFile(inputPath, "utf8");
const involvementRaw = await readFile(involvementPath, "utf8");
const installationsRaw = await readFile(installationsPath, "utf8");
const githubUsersRaw = await readFile(githubUsersPath, "utf8");
const dataverseTvRaw = await readFile(dataverseTvPath, "utf8");
const lines = raw.trim().split(/\r?\n/);
const headers = lines[0].split("\t");
const installationData = JSON.parse(installationsRaw);
const githubUsers = JSON.parse(githubUsersRaw);
const githubProfilesByUsername = new Map(
  Object.entries(githubUsers).map(([username, value]) => [
    username.toLowerCase(),
    value?.profile ?? null,
  ]),
);
const dataverseTvUsernames = getDataverseTvUsernames(dataverseTvRaw);
const involvementByUsername = getInvolvementByUsername(involvementRaw);
const countryByHostname = new Map(
  (installationData.installations ?? [])
    .map((installation) => [
      normalizeHostname(installation.hostname),
      installation.country ?? "",
    ])
    .filter(([hostname]) => Boolean(hostname)),
);
const continentByHostname = new Map(
  (installationData.installations ?? [])
    .map((installation) => [
      normalizeHostname(installation.hostname),
      installation.continent ?? "",
    ])
    .filter(([hostname]) => Boolean(hostname)),
);
const descriptionByHostname = new Map(
  (installationData.installations ?? [])
    .map((installation) => [
      normalizeHostname(installation.hostname),
      installation.description ?? "",
    ])
    .filter(([hostname]) => Boolean(hostname)),
);
const gdccMemberByHostname = new Map(
  (installationData.installations ?? [])
    .map((installation) => [
      normalizeHostname(installation.hostname),
      Boolean(installation.gdcc_member),
    ])
    .filter(([hostname]) => Boolean(hostname)),
);
const coreTrustSealsByHostname = new Map(
  (installationData.installations ?? [])
    .map((installation) => [
      normalizeHostname(installation.hostname),
      Array.isArray(installation.core_trust_seals)
        ? installation.core_trust_seals.filter(Boolean)
        : [],
    ])
    .filter(([hostname]) => Boolean(hostname)),
);

const rows = lines.slice(1).map((line) => {
  const values = line.split("\t");
  const record = sourceFields.reduce((entry, header) => {
    const index = headers.indexOf(header);
    entry[header] = index >= 0 ? (values[index] ?? "") : "";
    return entry;
  }, {});
  return createSnapshotRecord(record);
});

const usernamesInRows = new Set(
  rows.map((row) => String(row["GitHub Username"] ?? "").trim().toLowerCase()).filter(Boolean),
);

for (const username of involvementByUsername.keys()) {
  if (usernamesInRows.has(username)) {
    continue;
  }

  rows.push(
    createSnapshotRecord({
      "GitHub Username": username,
      "Primary installation": "",
      "Zulip ID": "",
      "Working Groups": "",
      Issue: "",
    }),
  );
}

const matchedCountries = rows.filter((row) => row.Country).length;
const matchedContinents = rows.filter((row) => row.Continent).length;
const matchedDescriptions = rows.filter((row) => row["Installation Description"]).length;
const matchedGdccMembers = rows.filter((row) => row["GDCC Member"]).length;
const matchedCoreTrustSeals = rows.filter(
  (row) => Array.isArray(row["CoreTrustSeals"]) && row["CoreTrustSeals"].length > 0,
).length;
const matchedDataverseTv = rows.filter((row) => row["DataverseTV"] === true).length;
const matchedGitHubProfiles = rows.filter((row) => row["GitHub Profile"]).length;
const matchedInvolvementPeriods = rows.reduce(
  (count, row) => count + (Array.isArray(row.Periods) ? row.Periods.length : 0),
  0,
);

const moduleSource = `export const SNAPSHOT_META = ${JSON.stringify(
  {
    source:
      "https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=0&format=tsv",
    installationSource:
      "https://iqss.github.io/dataverse-installations/data/data.json",
    involvementSource:
      "https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=50565170&format=tsv",
    githubUserSource: "https://api.github.com/users/{username}",
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    matchedCountryCount: matchedCountries,
    matchedContinentCount: matchedContinents,
    matchedInstallationDescriptionCount: matchedDescriptions,
    matchedGdccMemberCount: matchedGdccMembers,
    matchedCoreTrustSealCount: matchedCoreTrustSeals,
    matchedDataverseTvCount: matchedDataverseTv,
    matchedGitHubProfileCount: matchedGitHubProfiles,
    matchedInvolvementPeriodCount: matchedInvolvementPeriods,
  },
  null,
  2,
)};

export const MEMBERS_SNAPSHOT = ${JSON.stringify(rows, null, 2)};
`;

await writeFile(outputPath, moduleSource);

console.log(
  `Wrote ${rows.length} rows to ${outputPath.pathname} with ${matchedCountries} country matches, ${matchedContinents} continent matches, ${matchedDescriptions} installation descriptions, ${matchedGdccMembers} GDCC member matches, ${matchedCoreTrustSeals} CoreTrustSeal matches, ${matchedDataverseTv} DataverseTV matches, ${matchedGitHubProfiles} GitHub profile matches, and ${matchedInvolvementPeriods} involvement periods`,
);

function normalizeHostname(value) {
  const rawValue = String(value ?? "").trim().toLowerCase();
  if (!rawValue) {
    return "";
  }

  const candidate = rawValue.includes("://") ? rawValue : `https://${rawValue}`;

  try {
    return new URL(candidate).hostname.replace(/\.$/, "");
  } catch {
    return rawValue.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  }
}

function getDataverseTvUsernames(tsv) {
  const [headerLine, ...rows] = tsv.trim().split(/\r?\n/);
  const headers = headerLine.split("\t");
  const indexByHeader = Object.fromEntries(headers.map((header, index) => [header, index]));
  const usernames = new Set();

  for (const row of rows) {
    const columns = row.split("\t");
    const username = (columns[indexByHeader["GitHub username"]] ?? "").trim().toLowerCase();
    if (!username) {
      continue;
    }
    usernames.add(username);
  }

  return usernames;
}

function getInvolvementByUsername(tsv) {
  const [headerLine, ...rows] = tsv.trim().split(/\r?\n/);
  const headers = headerLine.split("\t");
  const indexByHeader = Object.fromEntries(headers.map((header, index) => [header, index]));
  const involvementByUsername = new Map();

  for (const row of rows) {
    const columns = row.split("\t");
    const username = (columns[indexByHeader["GitHub Username"]] ?? "").trim().toLowerCase();
    if (!username) {
      continue;
    }

    const period = {
      "Start Date": (columns[indexByHeader["Start Date"]] ?? "").trim(),
      "End Date": (columns[indexByHeader["End Date"]] ?? "").trim(),
    };

    const existing = involvementByUsername.get(username) ?? [];
    existing.push(period);
    involvementByUsername.set(username, existing);
  }

  return involvementByUsername;
}

function createSnapshotRecord(record) {
  const installationHost = normalizeHostname(record["Primary installation"]);
  const githubUsername = String(record["GitHub Username"] ?? "").trim();
  const githubProfile =
    githubUsers[githubUsername]?.profile ??
    githubProfilesByUsername.get(githubUsername.toLowerCase()) ??
    null;

  return {
    ...record,
    Country: countryByHostname.get(installationHost) ?? "",
    Continent: continentByHostname.get(installationHost) ?? "",
    "Installation Description": descriptionByHostname.get(installationHost) ?? "",
    "GDCC Member": gdccMemberByHostname.get(installationHost) ?? false,
    CoreTrustSeals: coreTrustSealsByHostname.get(installationHost) ?? [],
    DataverseTV: dataverseTvUsernames.has(githubUsername.toLowerCase()),
    "GitHub Profile": githubProfile,
    Periods: involvementByUsername.get(githubUsername.toLowerCase()) ?? [],
  };
}
