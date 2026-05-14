"""
Seeds the rules DB with the 6 pre-built communication plan rules (Draft status).
Run once after migrations: python seed_rules.py
"""

import asyncio
import json
import os
import sys

import asyncpg
from dotenv import load_dotenv

load_dotenv()

RULES = [
    {
        "name": "New user welcome",
        "status": "draft",
        "trigger_type": "standard",
        "trigger_event": "user_signed_up",
        "trigger_query": None,
        "conditions": [],
        "delay_days": 0,
        "channels": [
            {
                "channel": "push",
                "title": "Welcome to Ella, {{user_name}}! 🎉",
                "body": "You're all set to start learning {{language}}. Let's begin your journey!",
                "subject": None,
                "cta_label": "Get started",
                "cta_url": None,
            }
        ],
        "is_repeatable": False,
    },
    {
        "name": "Onboarding incomplete",
        "status": "draft",
        "trigger_type": "standard",
        "trigger_event": "user_signed_up",
        "trigger_query": None,
        "conditions": [],
        "delay_days": 2,
        "channels": [
            {
                "channel": "push",
                "title": "Don't forget to complete your setup",
                "body": "Hey {{user_name}}, you're just a few steps away from your first {{language}} lesson.",
                "subject": None,
                "cta_label": "Finish setup",
                "cta_url": None,
            }
        ],
        "is_repeatable": False,
    },
    {
        "name": "First content added",
        "status": "draft",
        "trigger_type": "standard",
        "trigger_event": "content_added",
        "trigger_query": None,
        "conditions": [],
        "delay_days": 0,
        "channels": [
            {
                "channel": "in_app",
                "title": "Great addition, {{user_name}}!",
                "body": "\"{{content_title}}\" is ready to learn from. Your {{language}} vocabulary is growing!",
                "subject": None,
                "cta_label": "Start learning",
                "cta_url": None,
            }
        ],
        "is_repeatable": False,
    },
    {
        "name": "Activation nudge",
        "status": "draft",
        "trigger_type": "standard",
        "trigger_event": "library_viewed",
        "trigger_query": None,
        "conditions": [],
        "delay_days": 1,
        "channels": [
            {
                "channel": "push",
                "title": "Ready to learn {{language}}?",
                "body": "You browsed your library yesterday, {{user_name}}. Time to take the next step — start your first lesson!",
                "subject": None,
                "cta_label": "Start Learning",
                "cta_url": None,
            }
        ],
        "is_repeatable": False,
    },
    {
        "name": "Win-back — inactive",
        "status": "draft",
        "trigger_type": "standard",
        "trigger_event": "user_inactive",
        "trigger_query": None,
        "conditions": [],
        "delay_days": 5,
        "channels": [
            {
                "channel": "push",
                "title": "We miss you, {{user_name}}",
                "body": "It's been {{days_inactive}} days since your last session. Your {{language}} streak is waiting!",
                "subject": None,
                "cta_label": "Resume learning",
                "cta_url": None,
            },
            {
                "channel": "email",
                "title": "Come back to Ella",
                "body": "Hi {{user_name}},\n\nWe noticed you haven't opened Ella in {{days_inactive}} days. Your {{language}} progress is still here — pick up right where you left off.\n\nSee you soon,\nThe Ella Team",
                "subject": "Your {{language}} lessons are waiting for you",
                "cta_label": "Open Ella",
                "cta_url": None,
            },
        ],
        "is_repeatable": True,
    },
    {
        "name": "New user promo",
        "status": "draft",
        "trigger_type": "standard",
        "trigger_event": "user_signed_up",
        "trigger_query": None,
        "conditions": [],
        "delay_days": 0,
        "channels": [
            {
                "channel": "in_app",
                "title": "Special offer for new learners",
                "body": "Welcome {{user_name}}! Get 50% off your first month of Ella Premium. Offer expires in 48 hours.",
                "subject": None,
                "cta_label": "Claim offer",
                "cta_url": None,
            }
        ],
        "is_repeatable": False,
    },
]


async def seed():
    url = os.environ.get("RULES_DB_URL")
    if not url:
        print("RULES_DB_URL not set", file=sys.stderr)
        sys.exit(1)

    conn = await asyncpg.connect(url)
    try:
        for rule in RULES:
            name = rule["name"]
            status = rule["status"]
            rule_data = {k: v for k, v in rule.items() if k not in ("name", "status")}

            existing = await conn.fetchrow("SELECT id FROM rules WHERE name = $1", name)
            if existing:
                print(f"  skip (exists): {name}")
                continue

            await conn.execute(
                "INSERT INTO rules (name, status, rule_data) VALUES ($1, $2, $3)",
                name,
                status,
                json.dumps(rule_data),
            )
            print(f"  seeded: {name}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
