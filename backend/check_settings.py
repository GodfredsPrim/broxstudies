from app.config import settings
import sys
import os

print(f"Current Working Directory: {os.getcwd()}")
print(f"ADMIN_USERNAME: {settings.ADMIN_USERNAME}")
print(f"ADMIN_SECRET: {settings.ADMIN_SECRET}")
print(f"DATABASE_URL: {settings.DATABASE_URL}")
print(f"AUTH_SECRET_KEY: {settings.AUTH_SECRET_KEY}")
