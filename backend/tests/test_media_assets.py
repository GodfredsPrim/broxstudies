import sqlite3
import tempfile
import unittest
from pathlib import Path

from app.services.auth_service import AuthService


class MediaAssetPersistenceTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.service = AuthService.__new__(AuthService)
        self.service.is_postgres = False
        self.service.db_path = Path(self.temp_dir.name) / "media.db"

        connection = sqlite3.connect(self.service.db_path)
        try:
            connection.execute(
                """
                CREATE TABLE media_assets (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    data BLOB NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.commit()
        finally:
            connection.close()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_asset_survives_a_new_service_instance(self):
        asset_id = "0123456789abcdef0123456789abcdef"
        payload = b"\x89PNG\r\n\x1a\npersistent-image"

        url = self.service.store_media_asset(
            asset_id,
            "lesson.png",
            "image/png",
            payload,
        )

        restarted_service = AuthService.__new__(AuthService)
        restarted_service.is_postgres = False
        restarted_service.db_path = self.service.db_path
        asset = restarted_service.get_media_asset(asset_id)

        self.assertEqual(url, f"/api/media/{asset_id}")
        self.assertEqual(asset["filename"], "lesson.png")
        self.assertEqual(asset["content_type"], "image/png")
        self.assertEqual(asset["data"], payload)


if __name__ == "__main__":
    unittest.main()
