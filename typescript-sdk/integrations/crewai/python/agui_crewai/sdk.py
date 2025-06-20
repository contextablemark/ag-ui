"""
This is a placeholder for the copilotkit_stream function.
"""

import asyncio
from typing import List, Any, Optional
from litellm.types.utils import (
  ModelResponse,
  Choices,
  Message as LiteLLMMessage,
  ChatCompletionMessageToolCall,
  Function as LiteLLMFunction
)
from litellm.litellm_core_utils.streaming_handler import CustomStreamWrapper
from crewai.flow.flow import FlowState
from crewai.utilities.events import crewai_event_bus
from pydantic import BaseModel, Field
from ag_ui.core import EventType
from .context import flow_context
from .events import BridgedTextMessageChunkEvent, BridgedToolCallChunkEvent

async def _yield_control():
    """
    Yield control to the event loop.
    """
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    loop.call_soon(future.set_result, None)
    await future

class CopilotKitProperties(BaseModel):
    """CopilotKit properties"""
    actions: List[Any] = Field(default_factory=list)

class CopilotKitState(FlowState):
    """CopilotKit state"""
    messages: List[Any] = Field(default_factory=list)
    copilotkit: CopilotKitProperties = Field(default_factory=CopilotKitProperties)

async def copilotkit_stream(response):
    """
    Stream litellm responses token by token to CopilotKit.

    ```python
    response = await copilotkit_stream(
        completion(
            model="openai/gpt-4o",
            messages=messages,
            tools=tools,
            stream=True # this must be set to True for streaming
        )
    )
    ```
    """
    if isinstance(response, ModelResponse):
        return _copilotkit_stream_response(response)
    if isinstance(response, CustomStreamWrapper):
        return await _copilotkit_stream_custom_stream_wrapper(response)
    raise ValueError("Invalid response type")


async def _copilotkit_stream_custom_stream_wrapper(response: CustomStreamWrapper):
    flow = flow_context.get(None)

    message_id: Optional[str] = None
    tool_call_id: str = ""
    content = ""
    created = 0
    model = ""
    system_fingerprint = ""
    finish_reason=None
    all_tool_calls = []

    async for chunk in response:
        if message_id is None:
            message_id = chunk["id"]

        text_content = chunk["choices"][0]["delta"]["content"] or None

        # Stream text messages
        if text_content is not None:
            # add to the current text message
            content += text_content
            crewai_event_bus.emit(
                flow,
                BridgedTextMessageChunkEvent(
                    type=EventType.TEXT_MESSAGE_CHUNK,
                    message_id=message_id,
                    role="assistant",
                    delta=text_content,
                )
            )
            # yield control to the event loop
            await _yield_control()

        # Stream tool calls
        tool_calls = chunk["choices"][0]["delta"]["tool_calls"] or None
        tool_call_id = tool_calls[0].id if tool_calls is not None else None
        tool_call_arguments = tool_calls[0].function["arguments"] if tool_calls is not None else None
        tool_call_name = tool_calls[0].function["name"] if tool_calls is not None else None

        if tool_call_id is not None:
            all_tool_calls.append(
                {
                    "id": tool_call_id,
                    "name": tool_call_name,
                    "arguments": "",
                }
            )

        if tool_call_arguments is not None:
            # add to the current tool call
            all_tool_calls[-1]["arguments"] += tool_call_arguments
            crewai_event_bus.emit(
                flow,
                BridgedToolCallChunkEvent(
                    type=EventType.TOOL_CALL_CHUNK,
                    tool_call_id=tool_call_id,
                    tool_call_name=tool_call_name,
                    delta=tool_call_arguments,
                )
            )
            # yield control to the event loop
            await _yield_control()

        # Stream finish reason
        finish_reason = chunk["choices"][0]["finish_reason"]
        created = chunk["created"]
        model = chunk["model"]
        system_fingerprint = chunk["system_fingerprint"]

        if finish_reason is not None:
            break

    tool_calls = [
        ChatCompletionMessageToolCall(
            function=LiteLLMFunction(
                arguments=tool_call["arguments"],
                name=tool_call["name"]
            ),
            id=tool_call["id"],
            type="function"
        )
        for tool_call in all_tool_calls
    ]
    return ModelResponse(
        id=message_id,
        created=created,
        model=model,
        object='chat.completion',
        system_fingerprint=system_fingerprint,
        choices=[
            Choices(
                finish_reason=finish_reason,
                index=0,
                message=LiteLLMMessage(
                    content=content,
                    role='assistant',
                    tool_calls=tool_calls if len(tool_calls) > 0 else None,
                    function_call=None
                )
            )
        ]
    )

def _copilotkit_stream_response(response: ModelResponse):
    return response
