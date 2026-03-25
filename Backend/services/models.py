import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from services.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    analyses: Mapped[list["Analysis"]] = relationship("Analysis", back_populates="user")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    trust_score: Mapped[int] = mapped_column(Integer, nullable=False)
    bias_rating: Mapped[str] = mapped_column(String(20), nullable=False)
    factual_accuracy: Mapped[str] = mapped_column(String(20), nullable=False)
    headline: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    full_result: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    user: Mapped["User | None"] = relationship("User", back_populates="analyses")
