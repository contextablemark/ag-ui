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
  a2aMessages: { name: string; message: string }[];
}

const Chat = () => {
  const [background, setBackground] = useState<string>("--copilot-kit-background-color");
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const { state } = useCoAgent({ name: "a2a_chat" });
  console.log(state);

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
        <div className="bg-muted rounded-lg p-4 w-full max-w-md ml-0 mb-4 text-left">
          <div className="space-y-2">
            {state.a2aMessages.map((message, idx) => {
              return (
                <div key={idx} className="text-xs text-muted-foreground flex flex-col items-start">
                  <span className="font-medium text-[10px] text-muted-foreground/70 mb-0.5">
                    {message.name}
                  </span>
                  <span className="break-words">{message.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
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
