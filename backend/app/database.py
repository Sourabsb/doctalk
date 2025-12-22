from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def run_migrations():
	inspector = inspect(engine)
	tables = inspector.get_table_names()
	
	# Migrate chat_messages table
	if "chat_messages" in tables:
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
		if "source_chunks_json" not in existing_columns:
			statements.append("ALTER TABLE chat_messages ADD COLUMN source_chunks_json TEXT")

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
	
	# Migrate documents table
	if "documents" in tables:
		existing_doc_columns = {col["name"] for col in inspector.get_columns("documents")}
		doc_statements = []
		if "content" not in existing_doc_columns:
			doc_statements.append("ALTER TABLE documents ADD COLUMN content TEXT")
		if "doc_type" not in existing_doc_columns:
			doc_statements.append("ALTER TABLE documents ADD COLUMN doc_type VARCHAR DEFAULT 'file'")
		if "is_active" not in existing_doc_columns:
			doc_statements.append("ALTER TABLE documents ADD COLUMN is_active BOOLEAN DEFAULT 1")
		
		with engine.begin() as conn:
			for stmt in doc_statements:
				conn.execute(text(stmt))

	# Migrate conversations table
	if "conversations" in tables:
		existing_convo_columns = {col["name"] for col in inspector.get_columns("conversations")}
		convo_statements = []
		if "llm_mode" not in existing_convo_columns:
			convo_statements.append("ALTER TABLE conversations ADD COLUMN llm_mode VARCHAR DEFAULT 'api'")

		with engine.begin() as conn:
			for stmt in convo_statements:
				conn.execute(text(stmt))
			if "llm_mode" not in existing_convo_columns:
				conn.execute(text("UPDATE conversations SET llm_mode = 'api' WHERE llm_mode IS NULL"))

	# Backfill: fix broken chaining where follow-up user messages were saved without reply_to_message_id.
	# This is conservative: it only touches non-edited, version_index=1 user messages.
	if "chat_messages" in tables:
		try:
			from .models.db_models import Conversation, ChatMessage
			session = SessionLocal()
			try:
				conversations = session.query(Conversation.id).all()
				for (conv_id,) in conversations:
					msgs = (
						session.query(ChatMessage)
						.filter(ChatMessage.conversation_id == conv_id)
						.order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
						.all()
					)
					last_assistant_id = None
					for msg in msgs:
						if msg.role == "assistant":
							last_assistant_id = msg.id
							continue
						if msg.role != "user":
							continue
						# Only fix follow-ups: after at least one assistant exists
						if last_assistant_id is None:
							continue
						# Skip anything that is likely an edit/version
						if getattr(msg, "is_edited", 0):
							continue
						if getattr(msg, "version_index", 1) != 1:
							continue
						# If it already has a parent, do nothing
						if msg.reply_to_message_id is not None:
							continue
						# If it's clearly a root (edit_group_id==id and it's the very first user), do nothing.
						# Otherwise, attach to the most recent assistant.
						msg.reply_to_message_id = last_assistant_id
					session.commit()
			finally:
				session.close()
		except Exception:
			# Never block app startup on backfill.
			pass
