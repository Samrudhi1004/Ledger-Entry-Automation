"""
MongoDB connection manager - DEPRECATED.

This file is no longer used after migrating to PostgreSQL-only architecture.
All inspection data now lives in PostgreSQL JSONB fields.

Kept for reference during migration period.
"""

# ─── DEPRECATED: MongoDB functionality moved to PostgreSQL ─────────────────────
#
# from pymongo import MongoClient
# from pymongo.database import Database
# from django.conf import settings
# import logging
#
# logger = logging.getLogger(__name__)
#
# _mongo_client: MongoClient | None = None
# _mongo_db: Database | None = None
#
#
# def get_mongo_client() -> MongoClient:
#     """Return a singleton MongoClient instance."""
#     global _mongo_client
#     if _mongo_client is None:
#         _mongo_client = MongoClient(
#             settings.MONGODB_URI,
#             serverSelectionTimeoutMS=5000,
#             connectTimeoutMS=5000,
#         )
#         from urllib.parse import urlparse
#         _parsed = urlparse(settings.MONGODB_URI)
#         _safe_uri = f"{_parsed.scheme}://{_parsed.hostname}{_parsed.path}"
#         logger.info("MongoDB client initialised: %s", _safe_uri)
#     return _mongo_client
#
#
# def get_mongo_db() -> Database:
#     """Return the application MongoDB database instance."""
#     global _mongo_db
#     if _mongo_db is None:
#         client = get_mongo_client()
#         _mongo_db = client[settings.MONGODB_NAME]
#         logger.info("MongoDB database connected: %s", settings.MONGODB_NAME)
#     return _mongo_db
#
#
# def get_collection(collection_name: str):
#     """Shorthand — get a named collection from the application database."""
#     return get_mongo_db()[collection_name]
#
#
# # ─── MongoDB Collection Names (single source of truth) ─────────────────────
# class Collections:
#     INSPECTION_RECORDS = 'inspection_records'
#     VOICE_LOGS         = 'voice_logs'
#     AUDIT_LOGS         = 'audit_logs'
