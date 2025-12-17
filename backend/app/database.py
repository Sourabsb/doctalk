from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def run_migrations():
	inspector = inspect(engine)
	if "chat_messages" not in inspector.get_table_names():
		return

	existing_columns = {col["name"] for col in inspector.get_columns("chat_messages")}
	statements = []
	if "reply_to_message_id" not in existing_columns:
		statements.append("ALTER TABLE chat_messages ADD COLUMN reply_to_message_id INTEGER")
	if "version_index" not in existing_columns:
		statements.append("ALTER TABLE chat_messages ADD COLUMN version_index INTEGER DEFAULT 1")
	if "is_archived" not in existing_columns:
		statements.append("ALTER TABLE chat_messages ADD COLUMN is_archived BOOLEAN DEFAULT 0")
	if "prompt_snapshot" not in existing_columns:
		statements.append("ALTER TABLE chat_messages ADD COLUMN prompt_snapshot TEXT")

	with engine.begin() as conn:
		for stmt in statements:
			conn.execute(text(stmt))
		conn.execute(text("UPDATE chat_messages SET version_index = COALESCE(version_index, 1)"))
		conn.execute(text("UPDATE chat_messages SET is_archived = COALESCE(is_archived, 0)"))
		conn.execute(
			text(
				"""
				UPDATE chat_messages
				SET prompt_snapshot = (
					SELECT content FROM chat_messages AS parent
					WHERE parent.id = chat_messages.reply_to_message_id
				)
				WHERE role = 'assistant'
					AND prompt_snapshot IS NULL
					AND reply_to_message_id IS NOT NULL
				"""
			)
		)
