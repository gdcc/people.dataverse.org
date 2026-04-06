import { readFile, writeFile } from "node:fs/promises";

const membersPath = new URL("../data/community-members.tsv", import.meta.url);
const cachePath = new URL("../data/github-users.json", import.meta.url);
const githubApiBase = "https://api.github.com/users/";
const token = process.env.GITHUB_TOKEN?.trim();
const requestedUsernames = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);

const rawMembers = await readFile(membersPath, "utf8");
const usernames = getUsernamesToFetch(rawMembers, requestedUsernames);
const cache = await readJsonIfExists(cachePath);

let remaining = Number.POSITIVE_INFINITY;
let resetAt = "";
let fetchedCount = 0;

for (const username of usernames) {
  if (remaining <= 0) {
    console.warn(
      `Stopping early because the GitHub API rate limit was reached. Reset at ${resetAt || "unknown time"}.`,
    );
    break;
  }

  if (
    requestedUsernames.length === 0 &&
    cache[username]?.ok &&
    cache[username]?.profile
  ) {
    continue;
  }

  const response = await fetch(`${githubApiBase}${encodeURIComponent(username)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": "dataverse-community-directory",
    },
  });

  remaining = Number(response.headers.get("x-ratelimit-remaining"));
  resetAt = formatResetTime(response.headers.get("x-ratelimit-reset"));

  if (response.status === 404) {
    cache[username] = {
      ok: false,
      status: 404,
      fetchedAt: new Date().toISOString(),
    };
    fetchedCount += 1;
    continue;
  }

  if (response.status === 403 && remaining <= 0) {
    break;
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${username}: ${response.status}`);
  }

  const profile = await response.json();
  cache[username] = {
    ok: true,
    fetchedAt: new Date().toISOString(),
    profile: pickProfileFields(profile),
  };
  fetchedCount += 1;
}

await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);

console.log(
  `Updated ${cachePath.pathname} with ${fetchedCount} GitHub user record${fetchedCount === 1 ? "" : "s"}.`,
);

function getUsernamesFromTsv(tsv) {
  const [headerLine, ...lines] = tsv.trim().split(/\r?\n/);
  const headers = headerLine.split("\t");
  const usernameIndex = headers.indexOf("GitHub Username");

  return [...new Set(
    lines
      .map((line) => line.split("\t")[usernameIndex]?.trim())
      .filter(Boolean),
  )];
}

function getUsernamesToFetch(tsv, requested) {
  const knownUsernames = getUsernamesFromTsv(tsv);

  if (requested.length === 0) {
    return knownUsernames;
  }

  const knownUsernamesByLowercase = new Map(
    knownUsernames.map((username) => [username.toLowerCase(), username]),
  );
  const resolvedUsernames = [];
  const unknownUsernames = [];

  for (const requestedUsername of requested) {
    const resolvedUsername = knownUsernamesByLowercase.get(requestedUsername.toLowerCase());
    if (!resolvedUsername) {
      unknownUsernames.push(requestedUsername);
      continue;
    }

    if (!resolvedUsernames.includes(resolvedUsername)) {
      resolvedUsernames.push(resolvedUsername);
    }
  }

  if (unknownUsernames.length > 0) {
    throw new Error(
      `Unknown GitHub username${unknownUsernames.length === 1 ? "" : "s"} in ${membersPath.pathname}: ${unknownUsernames.join(", ")}`,
    );
  }

  return resolvedUsernames;
}

async function readJsonIfExists(pathUrl) {
  try {
    return JSON.parse(await readFile(pathUrl, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function pickProfileFields(profile) {
  return {
    login: profile.login ?? "",
    name: profile.name ?? "",
    company: profile.company ?? "",
    location: profile.location ?? "",
    bio: profile.bio ?? "",
    blog: profile.blog ?? "",
    twitterUsername: profile.twitter_username ?? "",
    followers: profile.followers ?? 0,
    following: profile.following ?? 0,
    publicRepos: profile.public_repos ?? 0,
    htmlUrl: profile.html_url ?? "",
    avatarUrl: profile.avatar_url ?? "",
  };
}

function formatResetTime(epochSeconds) {
  const value = Number(epochSeconds);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return new Date(value * 1000).toISOString();
}
