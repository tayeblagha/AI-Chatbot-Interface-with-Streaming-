import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import { useRouter } from "next/router";
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import useUserInfo from "../Authentication/UseUserInfo";
import Spinner from "./Spinner";
import UserInfo from "../Authentication/UserInfo";

const AIChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const ws = useRef(null);
  const router = useRouter();
  const { user, userReady } = useUserInfo();
  const token = Cookies.get("token");
  let buffer = "";
  let typingTimeout;
  const inputRef = useRef(null);

  // Reset state on user change
  useEffect(() => {
    if (userReady && !user) {
      router.push("/login");
    } else if (user) {
      // Clear all user-related state
      setMessages([]);
      setSessions([]);
      setCurrentSession(null);
      setSessionsLoaded(false);
      
      // Close existing WebSocket connection
      if (ws.current) {
        ws.current.close();
        setIsConnected(false);
      }
      
      // Fetch fresh sessions for new user
      fetchSessions();
    }
  }, [user, userReady]);

  useEffect(() => {
    if (currentSession !== null && user?.sub && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentSession, user]);

  // User-specific localStorage persistence
  useEffect(() => {
    if (currentSession !== null && user?.sub) {
      localStorage.setItem(`messages_${user.sub}_${currentSession}`, JSON.stringify(messages));
    }
  }, [messages, currentSession, user?.sub]);

  const fetchSessions = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_HOST}/sessions/messages?token=${token}`
      );
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
        setSessionsLoaded(true);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  };

  const switchSession = async (sessionNumber) => {
    if (!sessionNumber || !user?.sub) return;

    // Update URL with current session
    router.replace({
      pathname: router.pathname,
      query: { current_session: sessionNumber }
    }, undefined, { shallow: true });

    // Close existing WebSocket connection
    if (ws.current) {
      ws.current.close();
      setIsConnected(false);
    }

    setCurrentSession(sessionNumber);
    
    // Load messages from user-specific cache or API
    const cachedMessages = localStorage.getItem(`messages_${user.sub}_${sessionNumber}`);
    if (cachedMessages) {
      setMessages(JSON.parse(cachedMessages));
    } else {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_HOST}/sessions/${sessionNumber}/messages?token=${token}`
        );
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error("Error loading session messages:", error);
      }
    }

    connectWebSocket(sessionNumber);
    inputRef.current?.focus();
  };

  const connectWebSocket = (sessionNumber) => {
    ws.current = new WebSocket(
      `${process.env.NEXT_PUBLIC_WSHOST}/ws/${sessionNumber}?token=${token}`
    );

    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => handleWebSocketClose();
    ws.current.onmessage = (event) => handleWebSocketMessage(event.data);
  };

  const handleWebSocketMessage = (data) => {
    setIsLoading(false);
    buffer += data;

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (buffer) {
        setMessages((prev) => [...prev, { role: "assistant", content: buffer }]);
        buffer = "";
      }
    }, 2000);
  };

  const handleWebSocketClose = () => {
    if (buffer) {
      setMessages((prev) => [...prev, { role: "assistant", content: buffer }]);
      buffer = "";
    }
    setIsConnected(false);
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected || !user?.sub) return;
    
    setIsLoading(true);
    ws.current.send(JSON.stringify({ 
      message: inputMessage, 
      user: user.sub,
      session_id: currentSession
    }));
    
    setMessages((prev) => [...prev, { role: "user", content: inputMessage }]);
    setInputMessage("");
    fetchSessions();
  };

  const createNewSession = async () => {
    try {
      // Clear previous user's cached messages
      if (user?.sub) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`messages_${user.sub}_`)) {
            localStorage.removeItem(key);
          }
        });
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_HOST}/create-session?token=${token}`
      );
      const newSession = response.data.session_number;
      await switchSession(newSession);
      fetchSessions();
    } catch (error) {
      console.error("Error creating new session:", error);
    }
  };

  useEffect(() => {
    if (!router.isReady || !sessionsLoaded || currentSession !== null || !user?.sub) return;

    const urlSession = Number(router.query.current_session);
    const validSession = sessions.find(s => s.session_number === urlSession);

    if (validSession) {
      switchSession(urlSession);
    } else if (sessions.length > 0) {
      switchSession(sessions[0].session_number);
    } else {
      createNewSession();
    }
  }, [router.isReady, sessionsLoaded, sessions, router.query.current_session, user]);

  return (
    <div className="flex min-h-screen mt-12">
      <aside className="w-64 bg-gray-900 text-white p-4">
        <Button 
          className="w-full mt-2 py-4 bg-blue-600 hover:bg-blue-700"
          onClick={createNewSession}
        >
          New Chat
          <img 
            src="/plus-dialogue.svg" 
            alt="New Chat" 
            className="ml-2"
            width={24}
            height={24}
          />
        </Button>
        
        <Separator className="my-4 bg-gray-700" />
        
        <h2 className="text-lg font-semibold mb-2">Chat History</h2>
        
        <ScrollArea className="h-[calc(100vh-180px)]">
          {sessions.map((session) => (
            <button
              key={session.session_number}
              onClick={() => switchSession(session.session_number)}
              className={`w-full p-3 text-left rounded-lg mb-1 transition-colors
                ${session.session_number === currentSession 
                  ? "bg-gray-700 text-white" 
                  : "hover:bg-gray-800 text-gray-300"}`}
            >
              {!session.title? "New Chat": session.title } <small>(Session {session.session_number})</small>
            </button>
          ))}
        </ScrollArea>
      </aside>

      <main className="flex-1 flex flex-col p-4 bg-gray-100">
        <div className="flex-1 bg-white rounded-lg shadow-lg p-4 flex flex-col">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            {currentSession ? `Session ${currentSession}` : "New Chat"}
          </h1>
          
          <ScrollArea className="flex-1 mb-4 border rounded-lg p-4 bg-gray-50">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-3 p-3 rounded-lg max-w-[80%] ${
                  msg.role === "user" 
                    ? "ml-auto bg-blue-100 border-blue-200" 
                    : "bg-gray-100 border-gray-200"
                }`}
              >
                <strong className="block text-sm font-medium mb-1">
                  {msg.role === "user" ? user?.sub : "Assistant"}:
                </strong>
                <div className="text-gray-800 whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center text-gray-500 mt-4">
                <Spinner className="mr-2" />
                Generating response...
              </div>
            )}
          </ScrollArea>

          <div className="border-t pt-4">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type your message here..."
                className="w-full p-3 pr-16 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
              <Button
                onClick={sendMessage}
                disabled={!isConnected || isLoading}
                className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? "Sending..." : "Send"}
              </Button>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {isConnected 
                ? "Connected to chat server" 
                : "Connecting to server..."}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIChatbot;