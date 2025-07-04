import {
  BaseEvent,
  Message,
  RunAgentInput,
  RunErrorEvent,
  RunFinishedEvent,
  RunStartedEvent,
  State,
  StateDeltaEvent,
  StateSnapshotEvent,
  StepFinishedEvent,
  StepStartedEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  TextMessageStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
  ToolCallStartEvent,
  MessagesSnapshotEvent,
  RawEvent,
  CustomEvent,
} from "@ag-ui/core";
import { AbstractAgent } from "./agent";
import { structuredClone_ } from "@/utils";

export interface AgentStateMutation {
  messages?: Message[];
  state?: State;
  stopPropagation?: boolean;
}

export interface RunAgentSubscriberParams {
  messages: Message[];
  state: State;
  agent: AbstractAgent;
  input: RunAgentInput;
}

// TODO make shit async
export interface RunAgentSubscriber {
  // Request lifecycle
  onRunInitialized?(
    params: RunAgentSubscriberParams,
  ): Omit<AgentStateMutation, "stopPropagation"> | undefined;
  onRunFailed?(
    params: { error: Error } & RunAgentSubscriberParams,
  ): Omit<AgentStateMutation, "stopPropagation"> | undefined;
  onRunFinalized?(
    params: RunAgentSubscriberParams,
  ): Omit<AgentStateMutation, "stopPropagation"> | undefined;

  // Events
  onEvent?(params: { event: BaseEvent } & RunAgentSubscriberParams): AgentStateMutation | undefined;

  onRunStartedEvent?(
    params: { event: RunStartedEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onRunFinishedEvent?(
    params: { event: RunFinishedEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onRunErrorEvent?(
    params: { event: RunErrorEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onStepStartedEvent?(
    params: { event: StepStartedEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onStepFinishedEvent?(
    params: { event: StepFinishedEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onTextMessageStartEvent?(
    params: { event: TextMessageStartEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onTextMessageContentEvent?(
    params: {
      event: TextMessageContentEvent;
      textMessageBuffer: string;
    } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onTextMessageEndEvent?(
    params: { event: TextMessageEndEvent; textMessageBuffer: string } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onToolCallStartEvent?(
    params: { event: ToolCallStartEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onToolCallArgsEvent?(
    params: {
      event: ToolCallArgsEvent;
      toolCallBuffer: string;
      toolCallName: string;
    } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onToolCallEndEvent?(
    params: {
      event: ToolCallEndEvent;
      toolCallBuffer: string;
      toolCallName: string;
    } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onToolCallResultEvent?(
    params: { event: ToolCallResultEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onStateSnapshotEvent?(
    params: { event: StateSnapshotEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onStateDeltaEvent?(
    params: { event: StateDeltaEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onMessagesSnapshotEvent?(
    params: { event: MessagesSnapshotEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onRawEvent?(
    params: { event: RawEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onCustomEvent?(
    params: { event: CustomEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  // State changes
  onMessagesChanged?(params: Omit<RunAgentSubscriberParams, "state">): void;
  onStateChanged?(params: Omit<RunAgentSubscriberParams, "messages">): void;
}

export function runSubscribersWithMutation(
  subscribers: RunAgentSubscriber[],
  initialMessages: Message[],
  initialState: State,
  executor: (
    subscriber: RunAgentSubscriber,
    messages: Message[],
    state: State,
  ) => AgentStateMutation | undefined,
): AgentStateMutation {
  let messages: Message[] = initialMessages;
  let state: State = initialState;

  let stopPropagation = undefined;

  for (const subscriber of subscribers) {
    const mutation = executor(subscriber, structuredClone_(messages), structuredClone_(state));

    if (mutation === undefined) {
      // Nothing returned – keep going
      continue;
    }

    // Merge messages/state so next subscriber sees latest view
    if (mutation.messages !== undefined) {
      messages = mutation.messages;
    }

    if (mutation.state !== undefined) {
      state = mutation.state;
    }

    stopPropagation = mutation.stopPropagation;

    if (stopPropagation === true) {
      break;
    }
  }

  return {
    ...(JSON.stringify(messages) !== JSON.stringify(initialMessages) ? { messages } : {}),
    ...(JSON.stringify(state) !== JSON.stringify(initialState) ? { state } : {}),
    ...(stopPropagation !== undefined ? { stopPropagation } : {}),
  };
}
