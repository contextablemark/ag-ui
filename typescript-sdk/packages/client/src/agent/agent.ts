import { defaultApplyEvents } from "@/apply/default";
import { Message, State, RunAgentInput, BaseEvent } from "@ag-ui/core";

import { AgentConfig, RunAgentParameters } from "./types";
import { v4 as uuidv4 } from "uuid";
import { structuredClone_ } from "@/utils";
import { catchError, map, tap } from "rxjs/operators";
import { finalize } from "rxjs/operators";
import { throwError, pipe, Observable } from "rxjs";
import { verifyEvents } from "@/verify";
import { convertToLegacyEvents } from "@/legacy/convert";
import { LegacyRuntimeProtocolEvent } from "@/legacy/types";
import { lastValueFrom, of } from "rxjs";
import { transformChunks } from "@/chunks";
import { AgentStateMutation, RunAgentSubscriber, runSubscribersWithMutation } from "./subscriber";

export abstract class AbstractAgent {
  public agentId?: string;
  public description: string;
  public threadId: string;
  public messages: Message[];
  public state: State;
  public debug: boolean = false;
  public subscribers: RunAgentSubscriber[] = [];

  constructor({
    agentId,
    description,
    threadId,
    initialMessages,
    initialState,
    debug,
  }: AgentConfig = {}) {
    this.agentId = agentId;
    this.description = description ?? "";
    this.threadId = threadId ?? uuidv4();
    this.messages = structuredClone_(initialMessages ?? []);
    this.state = structuredClone_(initialState ?? {});
    this.debug = debug ?? false;
  }

  public subscribe(subscriber: RunAgentSubscriber) {
    this.subscribers.push(subscriber);
    return {
      unsubscribe: () => {
        this.subscribers = this.subscribers.filter((s) => s !== subscriber);
      },
    };
  }

  protected abstract run(input: RunAgentInput): Observable<BaseEvent>;

  public async runAgent(
    parameters?: RunAgentParameters,
    subscriber?: RunAgentSubscriber,
  ): Promise<void> {
    this.agentId = this.agentId ?? uuidv4();
    const input = this.prepareRunAgentInput(parameters);
    const subscribers = [...this.subscribers, subscriber ?? {}];

    this.onInitialize(input, subscribers);

    const pipeline = pipe(
      () => this.run(input),
      transformChunks(this.debug),
      verifyEvents(this.debug),
      (source$) => this.apply(input, source$, subscribers),
      (source$) => this.processApplyEvents(input, source$, subscribers),
      catchError((error) => {
        return this.onError(input, error, subscribers);
      }),
      finalize(() => {
        this.onFinalize(input, subscribers);
      }),
    );

    return lastValueFrom(pipeline(of(null))).then(() => {});
  }

  public abortRun() {}

  protected apply(
    input: RunAgentInput,
    events$: Observable<BaseEvent>,
    subscribers: RunAgentSubscriber[],
  ): Observable<AgentStateMutation> {
    return defaultApplyEvents(input, events$, this, subscribers);
  }

  protected processApplyEvents(
    input: RunAgentInput,
    events$: Observable<AgentStateMutation>,
    subscribers: RunAgentSubscriber[],
  ): Observable<AgentStateMutation> {
    return events$.pipe(
      tap((event) => {
        if (event.messages) {
          this.messages = event.messages;
          subscribers.forEach((subscriber) => {
            subscriber.onMessagesChanged?.({
              messages: this.messages,
              agent: this,
              input,
            });
          });
        }
        if (event.state) {
          this.state = event.state;
          subscribers.forEach((subscriber) => {
            subscriber.onStateChanged?.({
              state: this.state,
              agent: this,
              input,
            });
          });
        }
      }),
    );
  }

  protected prepareRunAgentInput(parameters?: RunAgentParameters): RunAgentInput {
    return {
      threadId: this.threadId,
      runId: parameters?.runId || uuidv4(),
      tools: structuredClone_(parameters?.tools ?? []),
      context: structuredClone_(parameters?.context ?? []),
      forwardedProps: structuredClone_(parameters?.forwardedProps ?? {}),
      state: structuredClone_(this.state),
      messages: structuredClone_(this.messages),
    };
  }

  protected onInitialize(input: RunAgentInput, subscribers: RunAgentSubscriber[]) {
    const onRunInitializedMutation = runSubscribersWithMutation(
      subscribers,
      this.messages,
      this.state,
      (subscriber, messages, state) =>
        subscriber.onRunInitialized?.({ messages, state, agent: this, input }),
    );
    if (
      onRunInitializedMutation.messages !== undefined ||
      onRunInitializedMutation.state !== undefined
    ) {
      if (onRunInitializedMutation.messages) {
        this.messages = onRunInitializedMutation.messages;
        input.messages = onRunInitializedMutation.messages;
        subscribers.forEach((subscriber) => {
          subscriber.onMessagesChanged?.({
            messages: this.messages,
            agent: this,
            input,
          });
        });
      }
      if (onRunInitializedMutation.state) {
        this.state = onRunInitializedMutation.state;
        input.state = onRunInitializedMutation.state;
        subscribers.forEach((subscriber) => {
          subscriber.onStateChanged?.({
            state: this.state,
            agent: this,
            input,
          });
        });
      }
    }
  }

  protected onError(input: RunAgentInput, error: Error, subscribers: RunAgentSubscriber[]) {
    const onRunFailedMutation = runSubscribersWithMutation(
      subscribers,
      this.messages,
      this.state,
      (subscriber, messages, state) =>
        subscriber.onRunFailed?.({ error, messages, state, agent: this, input }),
    );

    if (onRunFailedMutation.messages !== undefined || onRunFailedMutation.state !== undefined) {
      if (onRunFailedMutation.messages !== undefined) {
        this.messages = onRunFailedMutation.messages;
        subscribers.forEach((subscriber) => {
          subscriber.onMessagesChanged?.({
            messages: this.messages,
            agent: this,
            input,
          });
        });
      }
      if (onRunFailedMutation.state !== undefined) {
        this.state = onRunFailedMutation.state;
        subscribers.forEach((subscriber) => {
          subscriber.onStateChanged?.({
            state: this.state,
            agent: this,
            input,
          });
        });
      }
    }
    if (onRunFailedMutation.stopPropagation !== true) {
      console.error("Agent execution failed:", error);
      return throwError(() => error);
    } else {
      return of(null);
    }
  }

  protected onFinalize(input: RunAgentInput, subscribers: RunAgentSubscriber[]) {
    const onRunFinalizedMutation = runSubscribersWithMutation(
      subscribers,
      this.messages,
      this.state,
      (subscriber, messages, state) =>
        subscriber.onRunFinalized?.({ messages, state, agent: this, input }),
    );

    if (
      onRunFinalizedMutation.messages !== undefined ||
      onRunFinalizedMutation.state !== undefined
    ) {
      if (onRunFinalizedMutation.messages !== undefined) {
        this.messages = onRunFinalizedMutation.messages;
        subscribers.forEach((subscriber) => {
          subscriber.onMessagesChanged?.({
            messages: this.messages,
            agent: this,
            input,
          });
        });
      }
      if (onRunFinalizedMutation.state !== undefined) {
        this.state = onRunFinalizedMutation.state;
        subscribers.forEach((subscriber) => {
          subscriber.onStateChanged?.({
            state: this.state,
            agent: this,
            input,
          });
        });
      }
    }
  }

  public clone() {
    const cloned = Object.create(Object.getPrototypeOf(this));

    for (const key of Object.getOwnPropertyNames(this)) {
      const value = (this as any)[key];
      if (typeof value !== "function") {
        cloned[key] = structuredClone_(value);
      }
    }

    return cloned;
  }

  public legacy_to_be_removed_runAgentBridged(
    config?: RunAgentParameters,
  ): Observable<LegacyRuntimeProtocolEvent> {
    this.agentId = this.agentId ?? uuidv4();
    const input = this.prepareRunAgentInput(config);

    return this.run(input).pipe(
      transformChunks(this.debug),
      verifyEvents(this.debug),
      convertToLegacyEvents(this.threadId, input.runId, this.agentId),
      (events$: Observable<LegacyRuntimeProtocolEvent>) => {
        return events$.pipe(
          map((event) => {
            if (this.debug) {
              console.debug("[LEGACY]:", JSON.stringify(event));
            }
            return event;
          }),
        );
      },
    );
  }
}
