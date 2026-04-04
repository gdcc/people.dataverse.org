import { readFile, writeFile } from "node:fs/promises";

const inputPath = new URL("../data/community-members.tsv", import.meta.url);
const outputPath = new URL("../data/members.js", import.meta.url);

const raw = await readFile(inputPath, "utf8");
const lines = raw.trim().split(/\r?\n/);
const headers = lines[0].split("\t");

const rows = lines.slice(1).map((line) => {
  const values = line.split("\t");
  return headers.reduce((record, header, index) => {
    record[header] = values[index] ?? "";
    return record;
  }, {});
});

const moduleSource = `export const SNAPSHOT_META = ${JSON.stringify(
  {
    source:
      "https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=0&format=tsv",
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
  },
  null,
  2,
)};

export const MEMBERS_SNAPSHOT = ${JSON.stringify(rows, null, 2)};
`;

await writeFile(outputPath, moduleSource);

console.log(`Wrote ${rows.length} rows to ${outputPath.pathname}`);
