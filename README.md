# Dataverse People

Dataverse People is a community directory that uses the [People/Dataverse Community Contributors/Dataversians](https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/edit?usp=sharing) spreadsheet as a starting point and pulls in additional data from the following sources:

- The GitHub API for information about each member
- https://github.com/IQSS/dataverse-installations (the [JSON](https://iqss.github.io/dataverse-installations/data/data.json) file, specifically)
- https://github.com/IQSS/dataverse-tv (the spreadsheet mentioned in the README)

This is very much a work in progress. Please feel free to join the [discussion](https://dataverse.zulipchat.com/#narrow/channel/375707-community/topic/people.2Edataverse.2Eorg/with/583596564) on Zulip!

## What it does

- Loads a bundled snapshot of the people spreadsheet so the app works immediately.
- Uses cached GitHub API profile data so member cards can show richer profile details without runtime API calls.
- Uses cached DataverseTV talk data to add a watch link for members who appear there.
- Lets you search members and filter by installation, country, and continent.
- Shows GitHub usernames alongside primary installation, country, Zulip ID, and ORCID when available.

## Run it

```bash
./run.sh
```

Then open <http://localhost:8080/people.dataverse.org/>

## Refresh the bundled snapshot

If the cached source files change and you want to update the checked-in snapshot:

```bash
./scripts/download-tsv.sh
./scripts/download-installations-json.sh
./scripts/update-dataversetv.sh
node ./scripts/update-github-users.mjs
node ./scripts/build-data.mjs
```

If you set `GITHUB_TOKEN`, the GitHub profile refresh can fetch many more users before hitting rate limits.

To refresh just one member's cached GitHub profile, pass the username:

```bash
node ./scripts/update-github-users.mjs 4tikhonov
```
