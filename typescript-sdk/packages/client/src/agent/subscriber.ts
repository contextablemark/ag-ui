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

// Utility type to allow callbacks to be implemented either synchronously or asynchronously.
export type MaybePromise<T> = T | Promise<T>;

export interface RunAgentSubscriber {
  // Request lifecycle
  onRunInitialized?(
    params: RunAgentSubscriberParams,
  ): MaybePromise<Omit<AgentStateMutation, "stopPropagation"> | undefined>;
  onRunFailed?(
    params: { error: Error } & RunAgentSubscriberParams,
  ): MaybePromise<Omit<AgentStateMutation, "stopPropagation"> | undefined>;
  onRunFinalized?(
    params: RunAgentSubscriberParams,
  ): MaybePromise<Omit<AgentStateMutation, "stopPropagation"> | undefined>;

  // Events
  onEvent?(
    params: { event: BaseEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onRunStartedEvent?(
    params: { event: RunStartedEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;
  onRunFinishedEvent?(
    params: { event: RunFinishedEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;
  onRunErrorEvent?(
    params: { event: RunErrorEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onStepStartedEvent?(
    params: { event: StepStartedEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;
  onStepFinishedEvent?(
    params: { event: StepFinishedEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onTextMessageStartEvent?(
    params: { event: TextMessageStartEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;
  onTextMessageContentEvent?(
    params: {
      event: TextMessageContentEvent;
      textMessageBuffer: string;
    } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;
  onTextMessageEndEvent?(
    params: { event: TextMessageEndEvent; textMessageBuffer: string } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onToolCallStartEvent?(
    params: { event: ToolCallStartEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;
  onToolCallArgsEvent?(
    params: {
      event: ToolCallArgsEvent;
      toolCallBuffer: string;
      toolCallName: string;
    } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;
  onToolCallEndEvent?(
    params: {
      event: ToolCallEndEvent;
      toolCallBuffer: string;
      toolCallName: string;
    } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onToolCallResultEvent?(
    params: { event: ToolCallResultEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onStateSnapshotEvent?(
    params: { event: StateSnapshotEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onStateDeltaEvent?(
    params: { event: StateDeltaEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onMessagesSnapshotEvent?(
    params: { event: MessagesSnapshotEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onRawEvent?(
    params: { event: RawEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  onCustomEvent?(
    params: { event: CustomEvent } & RunAgentSubscriberParams,
  ): MaybePromise<AgentStateMutation | undefined>;

  // State changes
  onMessagesChanged?(params: Omit<RunAgentSubscriberParams, "state">): MaybePromise<void>;
  onStateChanged?(params: Omit<RunAgentSubscriberParams, "messages">): MaybePromise<void>;
}

export async function runSubscribersWithMutation(
  subscribers: RunAgentSubscriber[],
  initialMessages: Message[],
  initialState: State,
  executor: (
    subscriber: RunAgentSubscriber,
    messages: Message[],
    state: State,
  ) => MaybePromise<AgentStateMutation | undefined>,
): Promise<AgentStateMutation> {
  let messages: Message[] = initialMessages;
  let state: State = initialState;

  let stopPropagation: boolean | undefined = undefined;

  for (const subscriber of subscribers) {
    const mutation = await executor(
      subscriber,
      structuredClone_(messages),
      structuredClone_(state),
    );

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
