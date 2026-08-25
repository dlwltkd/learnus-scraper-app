from datetime import datetime

from sqlalchemy import MetaData, create_engine, inspect, select

from database import Base, init_db


WEB_AUTH_TABLES = {"web_login_tickets", "web_sessions"}


def test_init_db_adds_web_auth_tables_and_preserves_active_session_data(tmp_path):
    database_path = tmp_path / "legacy.db"
    database_url = f"sqlite:///{database_path}"
    legacy_engine = create_engine(database_url)
    legacy_metadata = MetaData()

    for table in Base.metadata.sorted_tables:
        if table.name not in WEB_AUTH_TABLES:
            table.to_metadata(legacy_metadata)
    legacy_metadata.create_all(legacy_engine)

    issued_at = datetime(2026, 8, 20, 12, 0, 0)
    users = legacy_metadata.tables["users"]
    with legacy_engine.begin() as connection:
        connection.execute(
            users.insert().values(
                username="existing-user",
                hashed_password="legacy-password-hash",
                api_token="existing-native-token",
                token_issued_at=issued_at,
                moodle_password="legacy-plaintext-password",
                moodle_cookies="MoodleSession=existing-session",
            )
        )
    legacy_engine.dispose()

    first_session_factory = init_db(database_url)
    second_session_factory = init_db(database_url)

    migrated_engine = create_engine(database_url)
    inspector = inspect(migrated_engine)
    assert WEB_AUTH_TABLES.issubset(inspector.get_table_names())
    assert {column["name"] for column in inspector.get_columns("web_login_tickets")} >= {
        "user_id",
        "token_hash",
        "expires_at",
        "consumed_at",
    }
    assert {column["name"] for column in inspector.get_columns("web_sessions")} >= {
        "user_id",
        "token_hash",
        "expires_at",
        "revoked_at",
    }

    migrated_users = Base.metadata.tables["users"]
    with migrated_engine.connect() as connection:
        row = connection.execute(
            select(
                migrated_users.c.api_token,
                migrated_users.c.token_issued_at,
                migrated_users.c.hashed_password,
                migrated_users.c.moodle_password,
                migrated_users.c.moodle_cookies,
            ).where(migrated_users.c.username == "existing-user")
        ).one()
    assert row.api_token == "existing-native-token"
    assert row.token_issued_at == issued_at
    assert row.hashed_password is None
    assert row.moodle_password is None
    assert row.moodle_cookies == "MoodleSession=existing-session"

    migrated_engine.dispose()
    first_session_factory.kw["bind"].dispose()
    second_session_factory.kw["bind"].dispose()
