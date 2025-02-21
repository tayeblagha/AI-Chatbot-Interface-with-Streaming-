import React, { useState, useEffect, useRef } from "react";
import styles from "./aichat.module.css";
import UserInfo from "../Authentication/UserInfo";
import { useRouter } from "next/router";
import useUserInfo from "../Authentication/UseUserInfo";


function AIChatbot() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const ws = useRef(null);
  const router = useRouter();

  const { user, userReady } = useUserInfo(); // ✅ Fetch user info properly

  // Redirect if user is not available after checking is complete
  useEffect(() => {
    if (userReady && !user) {
      router.push("/login");
    }
  }, [user, userReady, router]);

  // Close WebSocket when unmounting
  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    if (!conversationId) {
      alert("Please enter a conversation ID");
      return;
    }

    ws.current = new WebSocket(
      `${process.env.NEXT_PUBLIC_WSHOST}/ws/${conversationId}`
    );

    ws.current.onopen = () => {
      setIsConnected(true);
      setMessages((prev) => [
        ...prev,
        { role: "system", content: "Connected to conversation " + conversationId },
      ]);
    };

    ws.current.onmessage = (event) => {
      setIsLoading(false);
      const chunk = event.data;
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: lastMessage.content + chunk },
          ];
        }
        return [...prev, { role: "assistant", content: chunk }];
      });
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "error", content: "Connection error: " + error.message },
      ]);
    };

    ws.current.onclose = (event) => {
      setIsConnected(false);
      if (event.code === 4000) {
        setMessages((prev) => [
          ...prev,
          { role: "system", content: "Conversation closed by server" },
        ]);
      }
    };
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected) return;

    const message = { role: "user", content: inputMessage.trim() };
    setMessages((prev) => [...prev, message]);
    setIsLoading(true);

    try {
      ws.current.send(JSON.stringify({ message: message.content }));
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { role: "error", content: "Error sending message: " + error.message },
      ]);
      setIsLoading(false);
    }

    setInputMessage("");
  };

  const closeConversation = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_HOST}/conversations/${conversationId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to close conversation");

      if (ws.current) {
        ws.current.close();
      }

      setMessages([]);
      setConversationId("");
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: "Error closing conversation: " + error.message },
      ]);
    }
  };

  const Spinner = () => <div className="spinner" />;

  // Ensure the user is loaded before rendering
  if (!userReady) return <p>Loading...</p>;

  return (
    <div className={styles}>
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="chat-container">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">AI Chat</h1>
          <h1>Welcome {user ? user.sub : "Guest"}</h1>

          <div className="connection-controls">
            <input
              type="text"
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
              placeholder="Enter Conversation ID"
              disabled={isConnected}
              className="flex-1"
            />
            <button
              onClick={isConnected ? () => ws.current?.close() : connectWebSocket}
              className={isConnected ? "disconnect" : "connect"}
            >
              {isConnected ? "Disconnect" : "Connect"}
            </button>
            <button onClick={closeConversation} disabled={!isConnected} className="close-btn">
              Close Conversation
            </button>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <span className="role">{message.role}:</span>
                <span className="content">{message.content}</span>
              </div>
            ))}
            {isLoading && <Spinner />}
          </div>

          <div className="chat-input-container">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your message..."
              disabled={!isConnected}
              rows={3}
            />
            <button onClick={sendMessage} disabled={!isConnected} className="self-end">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatbot;
