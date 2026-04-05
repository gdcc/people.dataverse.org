#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


REALM_URL = "https://dataverse.zulipchat.com"
USERS_ENDPOINT = "/api/v1/users"
PROFILE_FIELDS_ENDPOINT = "/api/v1/realm/profile_fields"
COMMUNITY_MEMBERS_PATH = Path("data/community-members.tsv")
OUTPUT_PATH = Path("on-zulip.tsv")


def main() -> int:
    bot_email = os.environ.get("BOT_EMAIL_ADDRESS", "").strip()
    bot_api_key = os.environ.get("BOT_API_KEY", "").strip()

    if not bot_email or not bot_api_key:
        print(
            "BOT_EMAIL_ADDRESS and BOT_API_KEY must be set in the environment.",
            file=sys.stderr,
        )
        return 1

    if not COMMUNITY_MEMBERS_PATH.exists():
        print(f"Missing input file: {COMMUNITY_MEMBERS_PATH}", file=sys.stderr)
        return 1

    community_usernames = load_community_usernames(COMMUNITY_MEMBERS_PATH)
    github_field_id = get_github_profile_field_id(bot_email, bot_api_key)
    zulip_users = get_zulip_users(bot_email, bot_api_key)
    rows = collect_rows(community_usernames, zulip_users, github_field_id)
    write_rows(OUTPUT_PATH, rows)

    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH}")
    return 0


def load_community_usernames(path: Path) -> set[str]:
    usernames: set[str] = set()

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            username = normalize_github_username(row.get("GitHub Username") or "")
            if username:
                usernames.add(username)

    return usernames


def get_github_profile_field_id(bot_email: str, bot_api_key: str) -> int:
    payload = zulip_get(PROFILE_FIELDS_ENDPOINT, bot_email, bot_api_key)

    for field in payload.get("custom_fields", []):
        name = str(field.get("name", "")).strip().casefold()
        if name == "github username":
            return int(field["id"])

    raise RuntimeError("Could not find Zulip custom profile field named 'GitHub username'.")


def get_zulip_users(bot_email: str, bot_api_key: str) -> list[dict]:
    return zulip_get(
        USERS_ENDPOINT,
        bot_email,
        bot_api_key,
        {"include_custom_profile_fields": "true"},
    )["members"]


def collect_rows(
    community_usernames: set[str],
    zulip_users: list[dict],
    github_field_id: int,
) -> list[tuple[str, int, str]]:
    field_key = str(github_field_id)
    rows_by_github: dict[str, tuple[str, int, str]] = {}

    for user in zulip_users:
        if not user.get("is_active", False):
            continue

        profile_data = user.get("profile_data") or {}
        github_value = profile_data.get(field_key, {}).get("value", "")
        normalized_username = normalize_github_username(github_value)
        if not normalized_username or normalized_username in community_usernames:
            continue

        rows_by_github[normalized_username] = (
            f"https://github.com/{normalized_username}",
            int(user["user_id"]),
            str(user.get("full_name", "")).strip(),
        )

    return [rows_by_github[key] for key in sorted(rows_by_github)]


def write_rows(path: Path, rows: list[tuple[str, int, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(["github", "zulip", "name"])
        writer.writerows(rows)


def normalize_github_username(value: str) -> str:
    username = str(value or "").strip()
    lowered = username.casefold()

    if lowered.startswith("https://github.com/"):
        username = username[len("https://github.com/") :]
    elif lowered.startswith("http://github.com/"):
        username = username[len("http://github.com/") :]

    return username.strip().strip("/").casefold()


def zulip_get(
    endpoint: str,
    bot_email: str,
    bot_api_key: str,
    params: dict[str, str] | None = None,
):
    import base64

    query = f"?{urlencode(params)}" if params else ""
    url = f"{REALM_URL}{endpoint}{query}"
    token = base64.b64encode(f"{bot_email}:{bot_api_key}".encode("utf-8")).decode("ascii")
    request = Request(
        url,
        headers={
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urlopen(request) as response:
            payload = json.load(response)
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Zulip API request failed with {error.code}: {details}") from error
    except URLError as error:
        raise RuntimeError(f"Zulip API request failed: {error.reason}") from error

    if isinstance(payload, dict) and payload.get("result") == "error":
        raise RuntimeError(payload.get("msg") or "Zulip API request returned an error.")

    return payload


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
