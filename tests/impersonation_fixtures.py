"""Seed/teardown throwaway users for impersonation integration tests.

This file is intentionally kept out of the production path. It uses the
backend's own passlib context so bcrypt hashes round-trip with the live
backend and inserts directly into Mongo.

Fixtures it creates:
    - imp_test_admin      role=super_admin
    - imp_test_tenant     a tenant with a far-future expiration
    - imp_test_owner      role=tenant_owner in imp_test_tenant
    - imp_test_user       role=user in imp_test_tenant
    - imp_test_user2      role=user in imp_test_tenant (second target)

Usage:
    python3 tests/impersonation_fixtures.py seed
    python3 tests/impersonation_fixtures.py teardown

Password for every throwaway user is 'imp_test_pw'.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Import the backend's passlib context to keep bcrypt hashes consistent.
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(BACKEND_DIR / ".env")

from passlib.context import CryptContext  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TEST_PW = "imp_test_pw"

ADMIN_USERNAME = "imp_test_admin"
OWNER_USERNAME = "imp_test_owner"
USER_USERNAME = "imp_test_user"
USER2_USERNAME = "imp_test_user2"
TENANT_NAME = "imp_test_tenant"


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    now = datetime.now(timezone.utc)
    hashed = pwd_context.hash(TEST_PW)

    # Idempotent: wipe anything from a previous run first.
    await _teardown(db)

    # 1) Super admin (no tenant)
    admin_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": admin_id,
        "username": ADMIN_USERNAME,
        "name": "Imp Test Admin",
        "role": "super_admin",
        "tenant_id": None,
        "theme": "light",
        "profile_image": None,
        "created_at": now.isoformat(),
        "last_login": None,
        "password": hashed,
    })

    # 2) Tenant with far-future expiration
    tenant_id = str(uuid.uuid4())
    await db.tenants.insert_one({
        "id": tenant_id,
        "name": TENANT_NAME,
        "owner_id": "pending",  # patched after owner insert
        "expiration_date": (now + timedelta(days=365)).isoformat(),
        "created_at": now.isoformat(),
        "created_by": admin_id,
    })

    # 3) Tenant owner in that tenant
    owner_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": owner_id,
        "username": OWNER_USERNAME,
        "name": "Imp Test Owner",
        "role": "tenant_owner",
        "tenant_id": tenant_id,
        "theme": "light",
        "profile_image": None,
        "created_at": now.isoformat(),
        "last_login": None,
        "password": hashed,
    })
    await db.tenants.update_one({"id": tenant_id}, {"$set": {"owner_id": owner_id}})

    # 4) Regular user in that tenant
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "username": USER_USERNAME,
        "name": "Imp Test User",
        "role": "user",
        "tenant_id": tenant_id,
        "theme": "light",
        "profile_image": None,
        "created_at": now.isoformat(),
        "last_login": None,
        "password": hashed,
    })

    # 5) Second regular user (for "another target" nesting test)
    user2_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user2_id,
        "username": USER2_USERNAME,
        "name": "Imp Test User 2",
        "role": "user",
        "tenant_id": tenant_id,
        "theme": "light",
        "profile_image": None,
        "created_at": now.isoformat(),
        "last_login": None,
        "password": hashed,
    })

    print(f"Seeded test users (password={TEST_PW!r}):")
    print(f"  {ADMIN_USERNAME:20s} role=super_admin   id={admin_id}")
    print(f"  {OWNER_USERNAME:20s} role=tenant_owner  id={owner_id}  tenant={tenant_id}")
    print(f"  {USER_USERNAME:20s} role=user          id={user_id}")
    print(f"  {USER2_USERNAME:20s} role=user          id={user2_id}")
    client.close()


async def _teardown(db):
    await db.users.delete_many({"username": {"$in": [
        ADMIN_USERNAME, OWNER_USERNAME, USER_USERNAME, USER2_USERNAME,
    ]}})
    await db.tenants.delete_many({"name": TENANT_NAME})
    # Clear any impersonation_events rows the tests produced.
    try:
        await db.impersonation_events.delete_many({
            "admin_username": {"$in": [ADMIN_USERNAME, OWNER_USERNAME]},
        })
    except Exception:
        pass


async def teardown():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await _teardown(db)
    print("Teardown complete.")
    client.close()


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("seed", "teardown"):
        print("usage: impersonation_fixtures.py {seed|teardown}")
        sys.exit(2)
    asyncio.run(seed() if sys.argv[1] == "seed" else teardown())
