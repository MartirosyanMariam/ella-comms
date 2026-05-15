"""
Mixpanel JQL client — notification trigger evaluation and event tracking.

Architecture
────────────
• All standard trigger events are evaluated via JQL against Mixpanel's event
  stream.  User data (language, country, activity) is resolved from events
  because People profiles are not populated in either project.
• Results are cached per-env for CACHE_TTL seconds to stay within rate limits
  (60 JQL req/hour per project).
• Active env is read from app_env.get_env(); scheduler uses APP_ENV env var,
  HTTP requests use the X-App-Env header (set by middleware).

User identity
─────────────
• Signed-in users carry user_id (Firebase UID) on every event.
• Older events used Title Case: "User ID", "Page Name", "Button Name".
  Both formats are handled transparently.
"""

import base64
import json
import logging
import time
from typing import Any, Optional

import httpx

import app_env

logger = logging.getLogger(__name__)

MIXPANEL_JQL_URL = "https://mixpanel.com/api/2.0/jql"
MIXPANEL_TRACK_URL = "https://api.mixpanel.com/track"

CREDENTIALS: dict[str, dict[str, str]] = {
    "dev":  {"token": "c12e4cf7e0588db4afbb702394fc332a", "secret": "f8f2cbb131da08309c6a4c3efb0f40f6"},
    "prod": {"token": "9d78050f557fd9073570bfbf6558e92b", "secret": "38b111d636153126f245213c5d542adb"},
}

# BCP-47 → human-readable name
LANG_NAMES: dict[str, str] = {
    "cy-GB": "Welsh",       "ja-JP": "Japanese",    "es-US": "Spanish",
    "es-AR": "Spanish",     "uk-UA": "Ukrainian",   "it-IT": "Italian",
    "de-DE": "German",      "ru-RU": "Russian",     "en-US": "English",
    "en-GB": "English",     "fr-FR": "French",      "pt-BR": "Portuguese",
    "zh-CN": "Chinese",     "ko-KR": "Korean",      "ar-SA": "Arabic",
    "hi-IN": "Hindi",       "pl-PL": "Polish",      "nl-NL": "Dutch",
    "sv-SE": "Swedish",     "tr-TR": "Turkish",
}

CACHE_TTL = 300  # seconds

# { env: { cache_key: (monotonic_ts, data) } }
_cache: dict[str, dict[str, tuple[float, Any]]] = {}


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _get(env: str, key: str) -> Optional[Any]:
    e = _cache.get(env, {}).get(key)
    return e[1] if e and (time.monotonic() - e[0]) < CACHE_TTL else None


def _set(env: str, key: str, data: Any):
    _cache.setdefault(env, {})[key] = (time.monotonic(), data)


# ── Auth ──────────────────────────────────────────────────────────────────────

def _auth(env: str) -> str:
    secret = CREDENTIALS.get(env, CREDENTIALS["dev"])["secret"]
    return "Basic " + base64.b64encode(f"{secret}:".encode()).decode()


# ── JQL runner ────────────────────────────────────────────────────────────────

async def _jql(script: str, env: str) -> Any:
    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0)) as client:
        resp = await client.post(
            MIXPANEL_JQL_URL,
            headers={
                "Authorization": _auth(env),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"script": script},
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Mixpanel JQL {resp.status_code}: {resp.text[:400]}")
    return resp.json()


# ── Shared JQL script building blocks ────────────────────────────────────────

# Both old ("User ID") and new ("user_id") property names are normalised.
_UID_EXPR = 'e.properties.user_id || e.properties["User ID"]'

_BASE_ACTIVITY_JQL = """\
function main() {
  var to = new Date().toISOString().split("T")[0];
  return Events({from_date: "2023-01-01", to_date: to})
    .filter(function(e) { return !!(%s); })
    .groupBy(
      [function(e) { return %s; }],
      function(acc, items) {
        if (!acc) acc = {first_seen:null, last_seen:null, n:0, country:null, platform:null};
        for (var i=0;i<items.length;i++) {
          var e=items[i];
          if (acc.first_seen===null||e.time<acc.first_seen) acc.first_seen=e.time;
          if (acc.last_seen===null||e.time>acc.last_seen)  acc.last_seen=e.time;
          acc.n++;
          if (!acc.country  && e.properties.mp_country_code) acc.country=e.properties.mp_country_code;
          if (!acc.platform && e.properties.$os)             acc.platform=e.properties.$os;
        }
        return acc;
      }
    )
    .map(function(r) {
      return {user_id:r.key[0], first_seen:r.value.first_seen,
              last_seen:r.value.last_seen, n:r.value.n,
              country:r.value.country, platform:r.value.platform};
    });
}
""" % (_UID_EXPR, _UID_EXPR)

_LANGUAGE_JQL = """\
function main() {
  var to = new Date().toISOString().split("T")[0];
  return Events({from_date:"2023-01-01", to_date:to,
                 event_selectors:[{event:"open_content"}]})
    .filter(function(e) { return !!(%s); })
    .groupBy(
      [function(e) { return %s; }],
      function(acc, items) {
        if (!acc) acc={lang:null, t:0};
        for (var i=0;i<items.length;i++) {
          var e=items[i];
          if (e.time > acc.t) {
            var cs = e.properties.content_settings;
            if (cs && cs.show_and_play_first) { acc.lang=cs.show_and_play_first; acc.t=e.time; }
          }
        }
        return acc;
      }
    )
    .filter(function(r) { return r.value.lang !== null; })
    .map(function(r) { return {user_id:r.key[0], lang:r.value.lang}; });
}
""" % (_UID_EXPR, _UID_EXPR)

_CONTENT_COUNT_JQL = """\
function main() {
  var to = new Date().toISOString().split("T")[0];
  return Events({from_date:"2023-01-01", to_date:to,
                 event_selectors:[{event:"open_content"}]})
    .filter(function(e) { return !!(%s) && !!e.properties.content_id; })
    .groupBy(
      [function(e) { return %s; }],
      function(acc, items) {
        if (!acc) acc={};
        for (var i=0;i<items.length;i++) {
          var cid=items[i].properties.content_id;
          if (cid) acc[cid]=true;
        }
        return acc;
      }
    )
    .map(function(r) { return {user_id:r.key[0], count:Object.keys(r.value).length}; });
}
""" % (_UID_EXPR, _UID_EXPR)

_ONBOARDING_JQL = """\
function main() {
  var to = new Date().toISOString().split("T")[0];
  return Events({from_date:"2023-01-01", to_date:to,
    event_selectors:[{event:"onboarding_completed"},{event:"onboarding_congratulations_continued"}]})
    .filter(function(e) { return !!(%s); })
    .groupBy(
      [function(e) { return %s; }],
      function(acc) { return true; }
    )
    .map(function(r) { return {user_id:r.key[0]}; });
}
""" % (_UID_EXPR, _UID_EXPR)


def _page_view_jql(page_name: str) -> str:
    return """\
function main() {
  var to = new Date().toISOString().split("T")[0];
  return Events({from_date:"2023-01-01", to_date:to, event_selectors:[{event:"page_view"}]})
    .filter(function(e) {
      var uid=%s;
      var pg=e.properties.page_name||e.properties["Page Name"]||"";
      return !!uid && pg==="%s";
    })
    .groupBy([function(e){return %s;}], function(acc){return true;})
    .map(function(r){return {user_id:r.key[0]};});
}
""" % (_UID_EXPR, page_name, _UID_EXPR)


def _button_click_jql(names: list[str]) -> str:
    names_js = json.dumps(names)
    return """\
function main() {
  var to = new Date().toISOString().split("T")[0];
  var names=%s;
  return Events({from_date:"2023-01-01", to_date:to, event_selectors:[{event:"button_click"}]})
    .filter(function(e) {
      var uid=%s;
      var btn=e.properties.button_name||e.properties["Button Name"]||"";
      return !!uid && names.indexOf(btn)>=0;
    })
    .groupBy([function(e){return %s;}], function(acc){return true;})
    .map(function(r){return {user_id:r.key[0]};});
}
""" % (names_js, _UID_EXPR, _UID_EXPR)


# ── Cached data loaders ───────────────────────────────────────────────────────

async def _activity(env: str) -> dict[str, dict]:
    cached = _get(env, "activity")
    if cached is not None:
        return cached
    logger.info("Mixpanel[%s]: fetching user activity", env)
    rows = await _jql(_BASE_ACTIVITY_JQL, env)  # raises on error — let caller handle
    data = {r["user_id"]: r for r in rows if r.get("user_id")}
    _set(env, "activity", data)
    return data


async def _languages(env: str) -> dict[str, str]:
    cached = _get(env, "languages")
    if cached is not None:
        return cached
    logger.info("Mixpanel[%s]: fetching user languages", env)
    rows = await _jql(_LANGUAGE_JQL, env)
    data = {r["user_id"]: r["lang"] for r in rows if r.get("user_id")}
    _set(env, "languages", data)
    return data


async def _content_counts(env: str) -> dict[str, int]:
    cached = _get(env, "content_counts")
    if cached is not None:
        return cached
    logger.info("Mixpanel[%s]: fetching content counts", env)
    rows = await _jql(_CONTENT_COUNT_JQL, env)
    data = {r["user_id"]: r["count"] for r in rows if r.get("user_id")}
    _set(env, "content_counts", data)
    return data


async def _onboarded(env: str) -> set[str]:
    cached = _get(env, "onboarding")
    if cached is not None:
        return cached
    rows = await _jql(_ONBOARDING_JQL, env)
    data = {r["user_id"] for r in rows if r.get("user_id")}
    _set(env, "onboarding", data)
    return data


async def _page_view_users(env: str, page_name: str, cache_key: str) -> list[str]:
    cached = _get(env, cache_key)
    if cached is not None:
        return cached
    rows = await _jql(_page_view_jql(page_name), env)
    data = [r["user_id"] for r in rows if r.get("user_id")]
    _set(env, cache_key, data)
    return data


async def _button_users(env: str, button_names: list[str], cache_key: str) -> list[str]:
    cached = _get(env, cache_key)
    if cached is not None:
        return cached
    rows = await _jql(_button_click_jql(button_names), env)
    data = [r["user_id"] for r in rows if r.get("user_id")]
    _set(env, cache_key, data)
    return data


# ── Public API ────────────────────────────────────────────────────────────────

async def get_trigger_users(trigger_event: str, env: str, inactivity_days: int = 5) -> list[str]:
    """Return Firebase user_ids matching the given trigger event."""
    act = await _activity(env)

    if trigger_event in ("user_signed_up", "first_session_started"):
        return list(act.keys())

    if trigger_event == "onboarding_completed":
        return list(await _onboarded(env))

    if trigger_event == "library_viewed":
        return await _page_view_users(env, "Library", "pv:Library")

    if trigger_event == "add_content_viewed":
        return await _page_view_users(env, "Add Content", "pv:Add Content")

    if trigger_event == "content_added":
        return await _button_users(
            env, ["Send to Ella", "Add my content", "Add new content"], "btn:add_content"
        )

    if trigger_event == "start_learning_clicked":
        return await _button_users(
            env, ["Start Learning", "Start my journey", "Let's start", "On we go"], "btn:start_learning"
        )

    if trigger_event == "user_inactive":
        cutoff = time.time() - (inactivity_days * 86400)
        return [
            uid for uid, d in act.items()
            if d.get("last_seen") and d["last_seen"] < cutoff
        ]

    logger.warning("Unknown trigger event: %s", trigger_event)
    return []


async def run_jql_trigger(script: str, env: str) -> list[str]:
    """Execute a custom JQL script; must return [{user_id: ...}, ...]."""
    rows = await _jql(script, env)
    return [r["user_id"] for r in rows if isinstance(r, dict) and r.get("user_id")]


async def get_user_profile(user_id: str, env: str) -> dict:
    """Resolve template variables for a user from Mixpanel data."""
    try:
        act = await _activity(env)
    except Exception:
        act = {}
    try:
        langs = await _languages(env)
    except Exception:
        langs = {}
    try:
        counts = await _content_counts(env)
    except Exception:
        counts = {}

    d = act.get(user_id, {})
    lang_code = langs.get(user_id, "")
    lang_name = LANG_NAMES.get(lang_code, lang_code)

    last_seen = d.get("last_seen")
    days_inactive = int((time.time() - last_seen) / 86400) if last_seen else 0

    first_seen = d.get("first_seen")
    days_since_signup = int((time.time() - first_seen) / 86400) if first_seen else 0

    return {
        "user_name": "",               # not available in Mixpanel
        "language": lang_name,
        "foreign_lang_code": lang_code,
        "native_language": "",
        "days_inactive": str(days_inactive),
        "days_since_signup": str(days_since_signup),
        "content_count": str(counts.get(user_id, 0)),
        "country": d.get("country") or "",
        "platform": d.get("platform") or "",
        "content_title": None,
    }


async def get_condition_value(user_id: str, field: str, env: str) -> Optional[str]:
    """Get a single user property value for condition checking."""
    try:
        act = await _activity(env)
    except Exception:
        act = {}
    try:
        langs = await _languages(env)
    except Exception:
        langs = {}
    try:
        counts = await _content_counts(env)
    except Exception:
        counts = {}

    d = act.get(user_id, {})

    if field in ("target_language", "foreign_language"):
        code = langs.get(user_id, "")
        return LANG_NAMES.get(code, code)

    if field == "native_language":
        return ""  # not reliably available

    if field == "country":
        return d.get("country") or ""

    if field in ("app_version", "platform"):
        return d.get("platform") or ""

    if field == "days_inactive":
        ls = d.get("last_seen")
        return str(int((time.time() - ls) / 86400)) if ls else "999"

    if field == "content_count":
        return str(counts.get(user_id, 0))

    if field == "days_since_signup":
        fs = d.get("first_seen")
        return str(int((time.time() - fs) / 86400)) if fs else "0"

    return None


async def track_notification(
    user_id: str, rule_name: str, rule_id: str, channel: str, env: str
):
    """Fire a notification_sent event back to Mixpanel."""
    token = CREDENTIALS.get(env, CREDENTIALS["dev"])["token"]
    payload = [{
        "event": "notification_sent",
        "properties": {
            "token": token,
            "distinct_id": user_id,
            "user_id": user_id,
            "rule_name": rule_name,
            "rule_id": rule_id,
            "channel": channel,
            "source": "ella-comms-engine",
        },
    }]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                MIXPANEL_TRACK_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        logger.debug("Tracked notification_sent → Mixpanel[%s] user=%s", env, user_id)
    except Exception as exc:
        logger.warning("Mixpanel tracking failed: %s", exc)
