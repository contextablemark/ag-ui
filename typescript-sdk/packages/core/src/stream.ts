import { Observable } from "rxjs";
import { Message, State, RunAgentInput } from "./types";
import { BaseEvent } from "./events";

/**
 * Function type for agent runners that process input and return a stream of results.
 */
export type RunAgent = (input: RunAgentInput) => Observable<BaseEvent>;

/**
 * The transformed state of an agent.
 */
export interface AgentState {
  messages?: Message[];
  state?: State;
}
