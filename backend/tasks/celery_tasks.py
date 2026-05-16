import asyncio
from services.serp_collector import collect_serp_for_keyword
from db.postgres import AsyncSessionLocal

class MockTask:
    def apply_async(self, args, task_id):
        # Fire and forget mock
        async def run():
            async with AsyncSessionLocal() as db:
                await collect_serp_for_keyword(args[0], args[1], db)
        asyncio.create_task(run())
        return self

class MockResult:
    def __init__(self, status="SUCCESS"):
        self.status = status
        self.result = None

class MockCeleryApp:
    def AsyncResult(self, job_id):
        return MockResult()

celery_app = MockCeleryApp()
collect_serp_task = MockTask()
