"""Simple CLI utilities for DTSYS."""

import argparse
import asyncio
import getpass

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select


async def create_admin(username: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == username))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"User {username} already exists.")
            return
        user = User(username=username, password_hash=hash_password(password), role="admin", is_active=True)
        db.add(user)
        await db.commit()
        print(f"Created admin user {username}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="DTSYS CLI")
    sub = parser.add_subparsers(dest="command")

    create = sub.add_parser("create-admin", help="Create an admin user")
    create.add_argument("--username", default="admin")
    create.add_argument("--password", default=None)

    args = parser.parse_args()
    if args.command == "create-admin":
        password = args.password or getpass.getpass("Password: ")
        asyncio.run(create_admin(args.username, password))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
