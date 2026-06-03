from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings
from app.models.base import Base

engine = create_async_engine(
    settings.database_url,
    echo=settings.app_env == "dev",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

# Session factory for code that needs its own session outside the request scope
# (e.g. background tasks, SSE/streaming generators that outlive the request).
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
