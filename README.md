# Dataverse People

A lightweight browser app for exploring the community TSV at:

`https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=0&format=tsv`

## What it does

- Loads a bundled snapshot of the sheet so the app works immediately.
- Uses cached GitHub API profile data so member cards can show richer profile details without runtime API calls.
- Lets you search members and filter by installation, country, and continent.
- Shows GitHub usernames alongside primary installation, country, Zulip ID, and ORCID when available.

## Run it

```bash
./run.sh
```

Then open [http://localhost:8080](http://localhost:8080).

## Refresh the bundled snapshot

If the cached source files change and you want to update the checked-in snapshot:

```bash
./scripts/download-tsv.sh
./scripts/download-installations-json.sh
node ./scripts/update-github-users.mjs
node ./scripts/build-data.mjs
```

If you set `GITHUB_TOKEN`, the GitHub profile refresh can fetch many more users before hitting rate limits.
