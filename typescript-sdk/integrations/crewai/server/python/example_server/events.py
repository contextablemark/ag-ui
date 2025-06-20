"""
This file is used to bridge the events from the crewai event bus to the ag-ui event bus.
"""

from crewai.utilities.events.base_events import BaseEvent
from ag_ui.core.events import ToolCallChunkEvent, TextMessageChunkEvent

class BridgedToolCallChunkEvent(BaseEvent, ToolCallChunkEvent):
    """Bridged tool call chunk event"""


class BridgedTextMessageChunkEvent(BaseEvent, TextMessageChunkEvent):
    """Bridged text message chunk event"""
