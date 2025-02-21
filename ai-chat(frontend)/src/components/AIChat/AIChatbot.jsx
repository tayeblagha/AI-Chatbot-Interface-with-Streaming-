import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import { useRouter } from "next/router";
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import useUserInfo from "../Authentication/UseUserInfo";
import Spinner from "./Spinner";

const AIChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const ws = useRef(null);
  const router = useRouter();
  const { user, userReady } = useUserInfo();
  const token = Cookies.get("token");
  let buffer = "";
  let typingTimeout;

  const inputRef = useRef(null); // Create a ref for the input box

  useEffect(() => {
    if (userReady && !user) {
      router.push("/login");
    } else {
      fetchSessions();
    }
  }, [user, userReady]);

  useEffect(() => {
    if (currentSession !== null && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [currentSession]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (currentSession !== null) {
      localStorage.setItem(`messages_${currentSession}`, JSON.stringify(messages));
    }
  }, [messages, currentSession]);

  const fetchSessions = async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_HOST}/sessions/messages?token=${token}`);
    if (response.ok) {
      const data = await response.json();
      setSessions(data);
    }
  };

  const switchSession = async (sessionNumber) => {
    if (sessionNumber == null) {
      return;
    }

    if (ws.current) {
      ws.current.close();
      setIsConnected(false);
    }

    setMessages([]);
    setCurrentSession(sessionNumber);

    // Load messages from localStorage first
    const savedMessages = localStorage.getItem(`messages_${sessionNumber}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST}/sessions/${sessionNumber}/messages?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    }

    connectWebSocket(sessionNumber);
    inputRef.current.focus();
  };

  const connectWebSocket = (sessionNumber) => {
    ws.current = new WebSocket(`${process.env.NEXT_PUBLIC_WSHOST}/ws/${sessionNumber}?token=${token}`);
    ws.current.onopen = () => setIsConnected(true);

    ws.current.onmessage = (event) => {
      setIsLoading(false);
      buffer += event.data;

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        if (buffer) {
          setMessages((prev) => [...prev, { role: "assistant", content: buffer }]);
          buffer = "";
        }
      }, 500); // Adjust timing as needed
    };

    ws.current.onclose = () => {
      if (buffer) {
        setMessages((prev) => [...prev, { role: "assistant", content: buffer }]);
        buffer = "";
      }
      setIsConnected(false);
    };
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected) return;
    setIsLoading(true);
    ws.current.send(JSON.stringify({ message: inputMessage, user: user?.sub }));
    setMessages((prev) => [...prev, { role: "user", content: inputMessage }]);
    setInputMessage("");
  };


  async function createNewSession() {
    const url = `${process.env.NEXT_PUBLIC_HOST}/create-session?token=${token}`;
  
    try {
      const response = await axios.post(url, {});
      const data = response.data;
      console.log(data);
      const sessionNumber = data.session_number;
      setCurrentSession(sessionNumber);
      setMessages([]);
      connectWebSocket(sessionNumber);
      fetchSessions()
    } catch (error) {
      console.error("Failed to create a new session", error);
    }
  }
  

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-900 text-white p-4">
        <Button onClick={createNewSession}>
          New Chat
          <img src="/plus-dialogue.svg" alt="Description" width={35} height={50} />
        </Button>
        <br />
        <h2 className="text-lg font-semibold">Previous Sessions</h2>
        <ScrollArea className="h-[calc(100vh-100px)] overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.session_number}
              className={`block w-full text-left p-2 rounded-lg ${session.session_number === currentSession ? "bg-gray-700" : "hover:bg-gray-800"}`}
              onClick={() => switchSession(session.session_number)}
            >
              Session {session.session_number}
            </button>
          ))}
        </ScrollArea>
        <Separator className="my-2" />
      </aside>

      <main className="flex-1 bg-gray-100 p-4">
        <h1 className="text-2xl font-bold">AI Chat</h1>
        <div className="mt-4 border p-4 rounded-lg bg-white h-[70vh] overflow-y-auto">
          {messages.map((msg, index) => (
            <div key={index} className="mb-2">
              <strong>{msg.role === "assistant" ? msg.role : user.sub}:</strong> {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className="flex mt-4">
              AI Thinking <Spinner />
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <textarea
            ref={inputRef}  // Apply the ref to the input
            type="text"
            className="border p-2 flex-1 rounded"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button onClick={sendMessage} disabled={!isConnected || isLoading}>
            {isLoading ? "Thinking..." : "Send"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default AIChatbot;