import os
import uvicorn
from fastapi import FastAPI

from .fastapi import add_crewai_endpoint
from .examples.agentic_chat import AgenticChatFlow

app = FastAPI(title="CrewAI Dojo Example Server")

add_crewai_endpoint(
    app=app,
    flow_class=AgenticChatFlow,
    path="/agentic_chat",
)

def main():
    """Run the uvicorn server."""
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "agui_crewai.dojo:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
