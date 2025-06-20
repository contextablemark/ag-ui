"""
This is a placeholder for the copilotkit_stream function.
"""


from litellm.types.utils import (
  ModelResponse,
  Choices,
  Message as LiteLLMMessage,
  ChatCompletionMessageToolCall,
  Function as LiteLLMFunction
)
from litellm.litellm_core_utils.streaming_handler import CustomStreamWrapper
from crewai.flow.flow import FlowState
from typing import List, Any
from pydantic import Field

class CopilotKitState(FlowState):
    """CopilotKit state"""
    messages: List[Any] = Field(default_factory=list)

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
    message_id: str = ""
    tool_call_id: str = ""
    content = ""
    created = 0
    model = ""
    system_fingerprint = ""
    finish_reason=None
    mode = None
    all_tool_calls = []

    for chunk in response:
        if message_id is None:
            message_id = chunk["id"]

        tool_calls = chunk["choices"][0]["delta"]["tool_calls"]
        finish_reason = chunk["choices"][0]["finish_reason"]
        created = chunk["created"]
        model = chunk["model"]
        system_fingerprint = chunk["system_fingerprint"]

        print(chunk)

        if mode == "text" and (tool_calls is not None or finish_reason is not None):
            # end the current text message
            pass
            # await queue_put(
            #     text_message_end(
            #         message_id=message_id
            #     )
            # )

        elif mode == "tool" and (tool_calls is None or finish_reason is not None):
            # end the current tool call
            pass
            # await queue_put(
            #     action_execution_end(
            #         action_execution_id=tool_call_id
            #     )
            # )

        if finish_reason is not None:
            break

        if mode != "text" and tool_calls is None:
            # start a new text message
            pass
            # await queue_put(
            #     text_message_start(
            #         message_id=message_id,
            #         parent_message_id=None
            #     )
            # )
        elif mode != "tool" and tool_calls is not None and tool_calls[0].id is not None:
            # start a new tool call
            tool_call_id = tool_calls[0].id

            # await queue_put(
            #     action_execution_start(
            #         action_execution_id=tool_call_id,
            #         action_name=tool_calls[0].function["name"],
            #         parent_message_id=message_id
            #     )
            # )

            all_tool_calls.append(
                {
                    "id": tool_call_id,
                    "name": tool_calls[0].function["name"],
                    "arguments": "",
                }
            )

        mode = "tool" if tool_calls is not None else "text"

        if mode == "text":
            text_content = chunk["choices"][0]["delta"]["content"]
            if text_content is not None:
                content += text_content
                # await queue_put(
                #     text_message_content(
                #         message_id=message_id,
                #         content=text_content
                #     )
                # )

        elif mode == "tool":
            tool_arguments = tool_calls[0].function["arguments"]
            if tool_arguments is not None:
                # await queue_put(
                #     action_execution_args(
                #         action_execution_id=tool_call_id,
                #         args=tool_arguments
                #     )
                # )

                all_tool_calls[-1]["arguments"] += tool_arguments

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
