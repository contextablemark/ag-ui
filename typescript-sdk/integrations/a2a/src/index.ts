import {
  AbstractAgent,
  AgentConfig,
  BaseEvent,
  EventType,
  RunAgentInput,
  RunErrorEvent,
} from "@ag-ui/client";
import { A2AClient } from "@a2a-js/sdk";
import { Observable } from "rxjs";
import { LanguageModel } from "ai";
import { router } from "./router";

export interface A2AAgentConfig extends AgentConfig {
  agentUrls: string[];
  instructions?: string;
  model: LanguageModel;
}

export class A2AClientAgent extends AbstractAgent {
  agentClients: A2AClient[];
  instructions?: string;
  model: LanguageModel;

  constructor(config: A2AAgentConfig) {
    super(config);
    this.instructions = config.instructions;
    this.agentClients = config.agentUrls.map((url) => new A2AClient(url));
    this.model = config.model;
  }

  protected run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((observer) => {
      const run = async () => {
        try {
          observer.next({
            type: EventType.RUN_STARTED,
            threadId: input.threadId,
            runId: input.runId,
          } as any);

          await router({
            agentClients: this.agentClients,
            additionalInstructions: this.instructions,
            input,
            model: this.model,
          });

          observer.next({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId: input.runId,
          } as any);

          observer.complete();
        } catch (error) {
          observer.next({
            type: EventType.RUN_ERROR,
            threadId: input.threadId,
            runId: input.runId,
            message: error instanceof Error ? error.message : "Unknown error",
          } as RunErrorEvent);

          observer.error(error);
        }
      };

      run();
    });
  }
}
