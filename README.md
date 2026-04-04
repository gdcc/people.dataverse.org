# Dataverse Community Directory

A lightweight browser app for exploring the community TSV at:

`https://docs.google.com/spreadsheets/d/1o9DD-MQ0WkrYaEFTD5rF_NtyL8aUISgURsAXSL7Budk/export?gid=0&format=tsv`

## What it does

- Loads a bundled snapshot of the sheet so the app works immediately.
- Supports live refresh from the Google Sheets TSV export.
- Lets you search members and filter by timezone, installation, and country.
- Shows GitHub usernames alongside timezone, primary installation, country, Zulip ID, and ORCID when available.

## Run it

Because the app uses ES modules, serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Refresh the bundled snapshot

If the cached source files change and you want to update the checked-in snapshot:

```bash
./scripts/download-tsv.sh
./scripts/download-installations-json.sh
node ./scripts/build-data.mjs
```
