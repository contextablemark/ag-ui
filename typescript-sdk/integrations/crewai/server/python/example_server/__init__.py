"""
Example server for the AG-UI protocol.
"""

import os
import uuid
import uvicorn
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from ag_ui.core import (
    RunAgentInput,
    EventType,
    RunStartedEvent,
    RunFinishedEvent,
    TextMessageStartEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
)
from ag_ui.encoder import EventEncoder
from crewai.utilities.events import crewai_event_bus, FlowStartedEvent, FlowFinishedEvent
from .example import AgenticChatFlow

app = FastAPI(title="AG-UI Endpoint")

@app.post("/")
async def agentic_chat_endpoint(input_data: RunAgentInput, request: Request):
    """Agentic chat endpoint"""
    # Get the accept header from the request
    accept_header = request.headers.get("accept")

    # Create an event encoder to properly format SSE events
    encoder = EventEncoder(accept=accept_header)

    async def event_generator():
        queue = asyncio.Queue()
        flow = AgenticChatFlow()
        try:
            with crewai_event_bus.scoped_handlers():

                @crewai_event_bus.on(FlowStartedEvent)
                def _(source, event):
                    queue.put_nowait(
                        RunStartedEvent(
                            type=EventType.RUN_STARTED,
                            thread_id=input_data.thread_id,
                            run_id=input_data.run_id
                        ),
                    )

                @crewai_event_bus.on(FlowFinishedEvent)
                def _(source, event):
                    # Send run finished event
                    queue.put_nowait(
                        RunFinishedEvent(
                            type=EventType.RUN_FINISHED,
                            thread_id=input_data.thread_id,
                            run_id=input_data.run_id
                        ),
                    )
                    queue.put_nowait(None)

                asyncio.create_task(flow.kickoff_async())

                while True:
                    item = await queue.get()
                    if item is None:
                        break
                    yield encoder.encode(item)

        except Exception as e:
            print(e)

        # Send run started event

        # message_id = str(uuid.uuid4())

        # yield encoder.encode(
        #     TextMessageStartEvent(
        #         type=EventType.TEXT_MESSAGE_START,
        #         message_id=message_id,
        #         role="assistant"
        #     )
        # )

        # yield encoder.encode(
        #     TextMessageContentEvent(
        #         type=EventType.TEXT_MESSAGE_CONTENT,
        #         message_id=message_id,
        #         delta="Hello world!"
        #     )
        # )

        # yield encoder.encode(
        #     TextMessageEndEvent(
        #         type=EventType.TEXT_MESSAGE_END,
        #         message_id=message_id
        #     )
        # )

       

    return StreamingResponse(
        event_generator(),
        media_type=encoder.get_content_type()
    )

def main():
    """Run the uvicorn server."""
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "example_server:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
