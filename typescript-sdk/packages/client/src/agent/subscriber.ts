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
} from "@ag-ui/core";
import { AbstractAgent } from "./agent";

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

export interface RunAgentSubscriber {
  // Lifecycle
  onInitializeRun(params: RunAgentSubscriberParams): AgentStateMutation | undefined;
  onError(params: { error: Error } & RunAgentSubscriberParams): AgentStateMutation | undefined;
  onFinalizeRun(params: RunAgentSubscriberParams): AgentStateMutation | undefined;

  // Events
  onEvent(params: { event: BaseEvent } & RunAgentSubscriberParams): AgentStateMutation | undefined;

  onRunStartedEvent(
    params: { event: RunStartedEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onRunFinishedEvent(
    params: { event: RunFinishedEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onRunErrorEvent(
    params: { event: RunErrorEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onStepStartedEvent(
    params: { event: StepStartedEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onStepFinishedEvent(
    params: { event: StepFinishedEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onTextMessageStartEvent(
    params: { event: TextMessageStartEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onTextMessageContentEvent(
    params: {
      event: TextMessageContentEvent;
      textMessageBuffer: string;
    } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onTextMessageEndEvent(
    params: { event: TextMessageEndEvent; textMessageBuffer: string } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onToolCallStartEvent(
    params: { event: ToolCallStartEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onToolCallArgsEvent(
    params: {
      event: ToolCallArgsEvent;
      toolCallBuffer: string;
      toolCallName: string;
    } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;
  onToolCallEndEvent(
    params: {
      event: ToolCallEndEvent;
      toolCallBuffer: string;
      toolCallName: string;
    } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onToolCallResultEvent(
    params: { event: ToolCallResultEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onStateSnapshotEvent(
    params: { event: StateSnapshotEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onStateDeltaEvent(
    params: { event: StateDeltaEvent; previousState: State } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onMessagesSnapshotEvent(
    params: { event: MessagesSnapshotEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onRawEvent(
    params: { event: RawEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  onCustomEvent(
    params: { event: CustomEvent } & RunAgentSubscriberParams,
  ): AgentStateMutation | undefined;

  // State changes
  onMessagesChanged(params: { messages: Message[] } & RunAgentSubscriberParams): void;
  onStateChanged(params: { state: State } & RunAgentSubscriberParams): void;
}
