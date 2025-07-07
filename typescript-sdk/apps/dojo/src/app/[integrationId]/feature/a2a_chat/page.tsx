"use client";
import React, { useState } from "react";
import "@copilotkit/react-ui/styles.css";
import "./style.css";
import {
  CopilotKit,
  useCoAgent,
  useCoAgentStateRender,
  useCopilotAction,
  useCopilotChat,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";

interface A2AChatProps {
  params: Promise<{
    integrationId: string;
  }>;
}

const A2AChat: React.FC<A2AChatProps> = ({ params }) => {
  const { integrationId } = React.use(params);

  return (
    <CopilotKit
      runtimeUrl={`/api/copilotkit/${integrationId}`}
      showDevConsole={false}
      // agent lock to the relevant agent
      agent="a2a_chat"
    >
      <Chat />
    </CopilotKit>
  );
};

interface A2AChatState {
  a2aMessages: { name: string; to: string; message: string }[];
}

const Chat = () => {
  const [background, setBackground] = useState<string>("--copilot-kit-background-color");
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const { state } = useCoAgent({ name: "a2a_chat" });

  React.useEffect(() => {
    if (state?.a2aMessages) {
      setLastMessageCount(state.a2aMessages.length);
    }
  }, [state?.a2aMessages?.length]);

  useCopilotAction({
    name: "change_background",
    description:
      "Change the background color of the chat. Can be anything that the CSS background attribute accepts. Regular colors, linear of radial gradients etc.",
    parameters: [
      {
        name: "background",
        type: "string",
        description: "The background. Prefer gradients.",
      },
    ],
    handler: ({ background }) => {
      setBackground(background);
    },
  });

  useCoAgentStateRender<A2AChatState>({
    name: "a2a_chat",
    render: ({ state }) => {
      if (!state.a2aMessages || state.a2aMessages.length === 0) {
        return null;
      }
      return (
        <div className="w-full max-w-2xl ml-0 mb-4 text-left">
          <div className="space-y-2">
            {state.a2aMessages.map((message, idx) => {
              return (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-[160px]">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                          message.name === "Agent"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {message.name}
                      </span>
                      <span className="text-muted-foreground text-[11px]">→</span>
                      <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-white border border-gray-300 text-muted-foreground">
                        {message.to}
                      </span>
                    </div>
                    <span className="break-words text-[11px] flex-1">{message.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
  });

  useCopilotAction({
    name: "pickTable",
    description: "Lets the use pick a table from available tables.",
    parameters: [
      {
        name: "tables",
        type: "object[]",
        description: "The tables to pick from.",
        properties: {
          name: {
            type: "string",
            description: "The table name.",
          },
          seats: {
            type: "object[]",
            description: "The seats in the table.",
            properties: {
              seatNumber: {
                type: "number",
                description: "The seat number.",
              },
              status: {
                type: "string",
                description: "The status of the seat.",
                enum: ["available", "occupied"],
              },
              name: {
                type: "string",
                description: "The name of the person seated at the table.",
                optional: true,
              },
            },
          },
        },
      },
    ],
    handler: ({ tables }) => {
      console.log(tables);
    },
  });

  return (
    <div className="flex justify-center items-center h-full w-full" style={{ background }}>
      <div className="w-8/10 h-8/10 rounded-lg">
        <CopilotChat
          className="h-full rounded-2xl"
          labels={{ initial: "Hi, I'm an agent. Want to chat?" }}
        />
      </div>
    </div>
  );
};

export default A2AChat;
