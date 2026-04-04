import { readFile, writeFile } from "node:fs/promises";

const inputPath = new URL("../data/community-members.tsv", import.meta.url);
const installationsPath = new URL("../data/installations.json", import.meta.url);
const outputPath = new URL("../data/members.js", import.meta.url);

const raw = await readFile(inputPath, "utf8");
const installationsRaw = await readFile(installationsPath, "utf8");
const lines = raw.trim().split(/\r?\n/);
const headers = lines[0].split("\t");
const installationData = JSON.parse(installationsRaw);
const countryByHostname = new Map(
  (installationData.installations ?? [])
    .map((installation) => [
      normalizeHostname(installation.hostname),
      installation.country ?? "",
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

  record.Country = countryByHostname.get(installationHost) ?? "";

  return record;
});

const matchedCountries = rows.filter((row) => row.Country).length;

const moduleSource = `export const SNAPSHOT_META = ${JSON.stringify(
  {
    source:
      "https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=0&format=tsv",
    installationSource:
      "https://iqss.github.io/dataverse-installations/data/data.json",
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    matchedCountryCount: matchedCountries,
  },
  null,
  2,
)};

export const MEMBERS_SNAPSHOT = ${JSON.stringify(rows, null, 2)};
`;

await writeFile(outputPath, moduleSource);

console.log(
  `Wrote ${rows.length} rows to ${outputPath.pathname} with ${matchedCountries} country matches`,
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
