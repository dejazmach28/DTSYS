#!/usr/bin/env python3
"""
Seed the database with initial data.
Run with: python scripts/db_seed.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

async def main():
    from server.app.db.session import AsyncSessionLocal, engine, Base
    from server.app.models import User
    from server.app.core.security import hash_password
    from sqlalchemy import select

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if result.scalar_one_or_none():
            print("Admin user already exists")
            return

        password = os.environ.get("ADMIN_PASSWORD", "changeme")
        user = User(
            username="admin",
            password_hash=hash_password(password),
            role="admin",
        )
        db.add(user)
        await db.commit()
        print(f"Created admin user (password: {password})")

if __name__ == "__main__":
    asyncio.run(main())
