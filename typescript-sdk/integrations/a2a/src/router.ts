import { A2AClient, AgentCard, SendMessageResponse, SendMessageSuccessResponse } from "@a2a-js/sdk";
import { Message, RunAgentInput } from "@ag-ui/client";
import { CoreMessage, LanguageModel, streamText } from "ai";
import { tool, generateText } from "ai";
import { z } from "zod";

const createSystemPrompt = (agentCards: AgentCard[], additionalInstructions?: string) => `
**Role:** You are an expert Routing Delegator. Your primary function is to accurately delegate user inquiries to the appropriate specialized remote agents.

${additionalInstructions ? `**Additional Instructions:**\n${additionalInstructions}` : ""}

**Core Directives:**

* **Task Delegation:** Utilize the \`send_message\` function to assign actionable tasks to remote agents.
* **Contextual Awareness for Remote Agents:** If a remote agent repeatedly requests user confirmation, assume it lacks access to the full conversation history. In such cases, enrich the task description with all necessary contextual information relevant to that specific agent.
* **Autonomous Agent Engagement:** Never seek user permission before engaging with remote agents. If multiple agents are required to fulfill a request, connect with them directly without requesting user preference or confirmation.
* **Transparent Communication:** Always present the complete and detailed response from the remote agent to the user.
* **User Confirmation Relay:** If a remote agent asks for confirmation, and the user has not already provided it, relay this confirmation request to the user.
* **Focused Information Sharing:** Provide remote agents with only relevant contextual information. Avoid extraneous details.
* **No Redundant Confirmations:** Do not ask remote agents for confirmation of information or actions.
* **Tool Reliance:** Strictly rely on available tools to address user requests. Do not generate responses based on assumptions. If information is insufficient, request clarification from the user.
* **Prioritize Recent Interaction:** Focus primarily on the most recent parts of the conversation when processing requests.
* **Active Agent Prioritization:** If an active agent is already engaged, route subsequent related requests to that agent using the appropriate task update tool.

**Agent Roster:**

* Available Agents: 
${JSON.stringify(agentCards.map((agent) => ({ name: agent.name, description: agent.description })))}
`;

interface RouterParams {
  agentClients: A2AClient[];
  additionalInstructions?: string;
  input: RunAgentInput;
  model: LanguageModel;
}

export async function router({ agentClients, additionalInstructions, input, model }: RouterParams) {
  const agentCards = await Promise.all(agentClients.map((client) => client.getAgentCard()));

  const agents = Object.fromEntries(
    agentCards.map((card, index) => [card.name, { client: agentClients[index], card }]),
  );

  const systemPrompt = createSystemPrompt(agentCards, additionalInstructions);
  const messages = convertMessagesToVercelAISDKMessages(input.messages);
  if (messages.length && messages[0].role === "system") {
    // remove the first message if it is a system message
    messages.shift();
  }

  messages.unshift({
    role: "system",
    content: systemPrompt,
  });

  const sendMessageTool = tool({
    description:
      "Sends a task to the agent named `agentName`, including the full conversation context and goal.",
    parameters: z.object({
      agentName: z.string().describe("The name of the agent to send the task to."),
      task: z
        .string()
        .describe(
          "The comprehensive conversation-context summary and goal " +
            "to be achieved regarding the user inquiry.",
        ),
    }),
    async execute({ agentName, task }) {
      if (!Object.keys(agents).includes(agentName)) {
        return `Agent "${agentName}" not found.`;
      }
      const { client } = agents[agentName];
      const sendResponse: SendMessageResponse = await client.sendMessage({
        message: {
          kind: "message",
          messageId: Date.now().toString(),
          role: "agent",
          parts: [{ text: task, kind: "text" }],
        },
      });

      if ("error" in sendResponse) {
        console.error(sendResponse.error);
        return `Error sending message to agent "${agentName}": ${sendResponse.error.message}`;
      }
      const result = (sendResponse as SendMessageSuccessResponse).result;

      return "The agent responded: " + JSON.stringify(result);
    },
  });

  const { textStream } = streamText({
    model,
    messages,
    tools: {
      sendMessage: sendMessageTool,
    },
    maxSteps: 10,
  });

  for await (const chunk of textStream) {
    console.log(chunk);
  }
}

export function convertMessagesToVercelAISDKMessages(messages: Message[]): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const message of messages) {
    if (message.role === "assistant") {
      const parts: any[] = message.content ? [{ type: "text", text: message.content }] : [];
      for (const toolCall of message.toolCalls ?? []) {
        parts.push({
          type: "tool-call",
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments),
        });
      }
      result.push({
        role: "assistant",
        content: parts,
      });
    } else if (message.role === "user") {
      result.push({
        role: "user",
        content: message.content || "",
      });
    } else if (message.role === "tool") {
      let toolName = "unknown";
      for (const msg of messages) {
        if (msg.role === "assistant") {
          for (const toolCall of msg.toolCalls ?? []) {
            if (toolCall.id === message.toolCallId) {
              toolName = toolCall.function.name;
              break;
            }
          }
        }
      }
      result.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: message.toolCallId,
            toolName: toolName,
            result: message.content,
          },
        ],
      });
    }
  }

  return result;
}
