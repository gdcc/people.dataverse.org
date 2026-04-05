import { readFile, writeFile } from "node:fs/promises";

const inputPath = new URL("../data/community-members.tsv", import.meta.url);
const installationsPath = new URL("../data/installations.json", import.meta.url);
const githubUsersPath = new URL("../data/github-users.json", import.meta.url);
const outputPath = new URL("../data/members.js", import.meta.url);

const raw = await readFile(inputPath, "utf8");
const installationsRaw = await readFile(installationsPath, "utf8");
const githubUsersRaw = await readFile(githubUsersPath, "utf8");
const lines = raw.trim().split(/\r?\n/);
const headers = lines[0].split("\t");
const installationData = JSON.parse(installationsRaw);
const githubUsers = JSON.parse(githubUsersRaw);
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

const rows = lines.slice(1).map((line) => {
  const values = line.split("\t");
  const record = headers.reduce((entry, header, index) => {
    entry[header] = values[index] ?? "";
    return entry;
  }, {});
  const installationHost = normalizeHostname(record["Primary installation"]);
  const githubUsername = String(record["GitHub Username"] ?? "").trim();
  const githubProfile = githubUsers[githubUsername]?.profile ?? null;

  record.Country = countryByHostname.get(installationHost) ?? "";
  record.Continent = continentByHostname.get(installationHost) ?? "";
  record["Installation Description"] = descriptionByHostname.get(installationHost) ?? "";
  record["GDCC Member"] = gdccMemberByHostname.get(installationHost) ?? false;
  record["GitHub Profile"] = githubProfile;

  return record;
});

const matchedCountries = rows.filter((row) => row.Country).length;
const matchedContinents = rows.filter((row) => row.Continent).length;
const matchedDescriptions = rows.filter((row) => row["Installation Description"]).length;
const matchedGdccMembers = rows.filter((row) => row["GDCC Member"]).length;
const matchedGitHubProfiles = rows.filter((row) => row["GitHub Profile"]).length;

const moduleSource = `export const SNAPSHOT_META = ${JSON.stringify(
  {
    source:
      "https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=0&format=tsv",
    installationSource:
      "https://iqss.github.io/dataverse-installations/data/data.json",
    githubUserSource: "https://api.github.com/users/{username}",
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    matchedCountryCount: matchedCountries,
    matchedContinentCount: matchedContinents,
    matchedInstallationDescriptionCount: matchedDescriptions,
    matchedGdccMemberCount: matchedGdccMembers,
    matchedGitHubProfileCount: matchedGitHubProfiles,
  },
  null,
  2,
)};

export const MEMBERS_SNAPSHOT = ${JSON.stringify(rows, null, 2)};
`;

await writeFile(outputPath, moduleSource);

console.log(
  `Wrote ${rows.length} rows to ${outputPath.pathname} with ${matchedCountries} country matches, ${matchedContinents} continent matches, ${matchedDescriptions} installation descriptions, ${matchedGdccMembers} GDCC member matches, and ${matchedGitHubProfiles} GitHub profile matches`,
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
