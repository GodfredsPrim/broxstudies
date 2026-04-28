import unittest
from types import SimpleNamespace
from datetime import datetime, timezone

from app.services.auth_service import AuthService

class AccessCodeNormalizationTest(unittest.TestCase):
    def test_verify_access_code_accepts_hyphens_and_spaces(self):
        service = AuthService.__new__(AuthService)

        expected_code = "AB12CD"
        user_row = {
            "id": 1,
            "full_name": "Test User",
            "email": "test@example.com",
            "password_hash": "",
            "salt": "",
            "provider": "email",
            "provider_subject": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login_at": datetime.now(timezone.utc).isoformat(),
            "subscription_status": "inactive",
            "subscription_expires_at": None,
            "is_admin": False,
            "session_id": None,
            "track": None,
        }

        class DummyConn:
            def __enter__(self):
                return self
            def __exit__(self, exc_type, exc, tb):
                return False

        def fake_execute(conn, query, params=()):
            if query.startswith("SELECT * FROM access_codes"):
                return SimpleNamespace(fetchone=lambda: {
                    "code": expected_code,
                    "duration_months": 3,
                    "used_at": None,
                })
            if query.startswith("SELECT * FROM users WHERE id"):
                return SimpleNamespace(fetchone=lambda: user_row)
            if "UPDATE access_codes" in query:
                return SimpleNamespace()
            if "UPDATE users" in query:
                # Simulate user subscription activation
                user_row["subscription_status"] = "active"
                user_row["subscription_expires_at"] = datetime.now(timezone.utc).isoformat()
                user_row["track"] = params[1] if len(params) > 1 else user_row.get("track")
                return SimpleNamespace()
            return SimpleNamespace()

        service._connect = lambda: DummyConn()
        service._execute = fake_execute

        updated_user = service.verify_access_code(1, "AB-12 CD", track="shs")
        self.assertEqual(updated_user.subscription_status, "active")
        self.assertEqual(updated_user.track, "shs")
        self.assertTrue(updated_user.subscription_expires_at is not None)

if __name__ == "__main__":
    unittest.main()
