"""
Read-only connection to Ella's PostgreSQL database.
Never write here — enforced at the DB user level and by always opening
a READ ONLY transaction for advanced queries.
"""

import os
from contextlib import asynccontextmanager

import asyncpg

_pool: asyncpg.Pool | None = None


async def get_ella_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=os.environ["ELLA_DB_URL"],
            min_size=1,
            max_size=5,
            command_timeout=30,
        )
    return _pool


async def close_ella_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def ella_readonly_conn():
    pool = await get_ella_pool()
    async with pool.acquire() as conn:
        async with conn.transaction(readonly=True):
            yield conn
