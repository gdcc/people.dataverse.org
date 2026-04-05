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
OUTPUT_PATH = Path("github-zulip.tsv")


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

    community_members = load_community_members(COMMUNITY_MEMBERS_PATH)
    github_field_id = get_github_profile_field_id(bot_email, bot_api_key)
    zulip_users = get_zulip_users(bot_email, bot_api_key)
    matches = collect_matches(community_members, zulip_users, github_field_id)
    write_matches(OUTPUT_PATH, matches)
    report_zulip_id_gaps(community_members, matches)

    print(f"Wrote {len(matches)} rows to {OUTPUT_PATH}")
    return 0


def load_community_members(path: Path) -> dict[str, dict[str, str]]:
    members: dict[str, dict[str, str]] = {}

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            username = (row.get("GitHub Username") or "").strip()
            if username:
                members.setdefault(
                    username.casefold(),
                    {
                        "github": username,
                        "zulip": (row.get("Zulip ID") or "").strip(),
                    },
                )

    return members


def get_github_profile_field_id(bot_email: str, bot_api_key: str) -> int:
    payload = zulip_get(PROFILE_FIELDS_ENDPOINT, bot_email, bot_api_key)
    fields = payload.get("custom_fields", []) if isinstance(payload, dict) else payload

    for field in fields:
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


def collect_matches(
    community_members: dict[str, dict[str, str]],
    zulip_users: list[dict],
    github_field_id: int,
) -> list[tuple[str, int]]:
    field_key = str(github_field_id)
    matches_by_github: dict[str, tuple[str, int]] = {}

    for user in zulip_users:
        if not user.get("is_active", False):
            continue

        profile_data = user.get("profile_data") or {}
        github_value = profile_data.get(field_key, {}).get("value", "")
        github_username = str(github_value).strip()
        if not github_username:
            continue

        community_member = community_members.get(github_username.casefold())
        if not community_member:
            continue

        user_id = user.get("user_id")
        if user_id is None:
            continue

        community_username = community_member["github"]
        matches_by_github[community_username.casefold()] = (community_username, int(user_id))

    return sorted(matches_by_github.values(), key=lambda item: item[0].casefold())


def write_matches(path: Path, matches: list[tuple[str, int]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(["github", "zulip"])
        writer.writerows(matches)


def report_zulip_id_gaps(
    community_members: dict[str, dict[str, str]],
    matches: list[tuple[str, int]],
) -> None:
    missing: list[tuple[str, int]] = []
    mismatched: list[tuple[str, str, int]] = []

    for github_username, zulip_id in matches:
        member = community_members[github_username.casefold()]
        existing_zulip_id = member["zulip"]
        if not existing_zulip_id:
            missing.append((github_username, zulip_id))
        elif existing_zulip_id != str(zulip_id):
            mismatched.append((github_username, existing_zulip_id, zulip_id))

    if missing:
        print("\nMissing Zulip IDs in data/community-members.tsv:")
        for github_username, zulip_id in missing:
            print(f"- {github_username}\t{zulip_id}")

    if mismatched:
        print("\nMismatched Zulip IDs in data/community-members.tsv:")
        for github_username, existing_zulip_id, zulip_id in mismatched:
            print(f"- {github_username}\t{existing_zulip_id}\t{zulip_id}")


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
