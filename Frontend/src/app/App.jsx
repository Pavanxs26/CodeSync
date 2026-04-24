import "./App.css";
import { Editor } from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";


const DEFAULT_CODE = {
  javascript: `function greet(name) {
  return "Hello, " + name + "!";
}

console.log(greet("Pavan"));`,
  typescript: `function greet(name: string): string {
  return "Hello, " + name + "!";
}

console.log(greet("Pavan"));`,
  python: `def greet(name):
    return f"Hello, {name}!"

print(greet("Pavan"))`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, Pavan!" << endl;
    return 0;
}`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Pavan!");
    }
}`,
};

function randomRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

function randomColorFromName(name) {
  const colors = [
    "#ff6b6b",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % colors.length;
  }
  return colors[hash];
}

function copyToClipboard(text) {
  return navigator.clipboard.writeText(text);
}

function formatTime(date) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function UserAvatar({ name, color }) {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white shadow-md"
      style={{ backgroundColor: color }}
      title={name}
    >
      {name?.slice(0, 1).toUpperCase() || "U"}
    </div>
  );
}

function App() {
  const editorRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const awarenessListenerRef = useRef(null);
  const initializedRef = useRef(false);

  const params = useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );

  const [username, setUsername] = useState(() => params.get("username") || "");
  const [roomId, setRoomId] = useState(() => params.get("room") || "");
  const [joined, setJoined] = useState(() => {
    const initialUser = params.get("username") || "";
    const initialRoom = params.get("room") || "";
    return Boolean(initialUser && initialRoom);
  });

  const language = "javascript";
  const [users, setUsers] = useState([]);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [output, setOutput] = useState("Run your JavaScript code to see output here.");
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [events, setEvents] = useState([]);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const yText = useMemo(() => ydoc.getText("monaco"), [ydoc]);

  const activeRoomId = roomId || "default-room";

  const inviteLink = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("room", activeRoomId);
    if (username) {
      url.searchParams.set("username", username);
    } else {
      url.searchParams.delete("username");
    }
    return url.toString();
  }, [activeRoomId, username]);

  const addEvent = (message) => {
    setEvents((prev) => [
      { id: crypto.randomUUID(), message, at: new Date() },
      ...prev.slice(0, 7),
    ]);
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;

    if (
      yText.length === 0 &&
      !initializedRef.current &&
      DEFAULT_CODE[language]
    ) {
      initializedRef.current = true;
      yText.insert(0, DEFAULT_CODE[language]);
    }

    if (
      providerRef.current &&
      editorRef.current &&
      !bindingRef.current &&
      editorRef.current.getModel()
    ) {
      bindingRef.current = new MonacoBinding(
        yText,
        editorRef.current.getModel(),
        new Set([editorRef.current]),
        providerRef.current.awareness
      );
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const enteredName = String(formData.get("username") || "").trim();
    const enteredRoom = String(formData.get("room") || "").trim() || randomRoomId();

    if (!enteredName) return;

    setUsername(enteredName);
    setRoomId(enteredRoom);
    setJoined(true);

    const url = new URL(window.location.href);
    url.searchParams.set("username", enteredName);
    url.searchParams.set("room", enteredRoom);
    window.history.replaceState({}, "", url.toString());
  };

  useEffect(() => {
    if (!joined || !username || !activeRoomId) return;

    const provider = new SocketIOProvider(
      "/",
      activeRoomId,
      ydoc,
      {
        autoConnect: true,
      }
    );

    providerRef.current = provider;

    const userColor = randomColorFromName(username);

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values());

      const normalizedUsers = states
        .map((state) => state.user)
        .filter((user) => user && user.username)
        .map((user) => ({
          username: user.username,
          color: user.color || randomColorFromName(user.username),
          language: user.language || "javascript",
        }));

      const uniqueUsers = normalizedUsers.filter(
        (user, index, arr) =>
          arr.findIndex((u) => u.username === user.username) === index
      );

      setUsers(uniqueUsers);
    };

    provider.on("status", (event) => {
      setConnectionState(event.status);
    });

    provider.awareness.setLocalStateField("user", {
      username,
      color: userColor,
      language,
    });

    updateUsers();

    const awarenessHandler = () => {
      updateUsers();
    };

    awarenessListenerRef.current = awarenessHandler;
    provider.awareness.on("change", awarenessHandler);

    if (editorRef.current?.getModel() && !bindingRef.current) {
      bindingRef.current = new MonacoBinding(
        yText,
        editorRef.current.getModel(),
        new Set([editorRef.current]),
        provider.awareness
      );
    }

    addEvent(`${username} joined room ${activeRoomId}`);

    const handleBeforeUnload = () => {
      provider.awareness.setLocalStateField("user", null);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      try {
        provider.awareness.setLocalStateField("user", null);
        if (awarenessListenerRef.current) {
          provider.awareness.off("change", awarenessListenerRef.current);
        }
        bindingRef.current?.destroy?.();
        bindingRef.current = null;
        provider.disconnect();
      } catch (err) {
        console.error("Cleanup error:", err);
      }

      providerRef.current = null;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [joined, username, activeRoomId, ydoc, yText, language]);


  const handleCopyLink = async () => {
    try {
      await copyToClipboard(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleRunCode = async () => {
    const code = editorRef.current?.getValue?.() || "";

    if (!code.trim()) {
      setOutput("Editor is empty.");
      return;
    }

    setIsRunning(true);
    setOutput("Running code...");

    try {
      const response = await fetch("http://localhost:3000/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOutput(data.error || "Execution failed.");
      } else {
        setOutput(data.output || "Code executed successfully. No output.");
      }
    } catch (err) {
      setOutput("Unable to connect to execution server.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleLeaveRoom = () => {
    providerRef.current?.disconnect?.();
    bindingRef.current?.destroy?.();
    providerRef.current = null;
    bindingRef.current = null;

    setJoined(false);
    setUsers([]);
    setEvents([]);
    setOutput("Run your JavaScript code to see output here.");

    const url = new URL(window.location.href);
    url.searchParams.delete("username");
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
  };

  if (!joined) {
    return (
      <main className="min-h-screen bg-[#0a0f1f] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
          <div className="grid w-full items-center gap-10 lg:grid-cols-2">
            <section>
              <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-white/70 backdrop-blur">
                Real-time collaborative code editor
              </div>
              <h1 className="mb-5 text-5xl font-black leading-tight">
                Build, code, and collaborate live with{" "}
                <span className="bg-linear-to-r from-cyan-400 via-blue-500 to-violet-500 bg-clip-text text-transparent">
                  CodeSync
                </span>
              </h1>
              <p className="max-w-xl text-lg leading-8 text-white/70">
                A premium collaborative coding workspace powered by Monaco, Yjs,
                and Socket.IO with live sync, room sharing, user presence, and
                instant JavaScript execution.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm text-white/60">Collaboration</p>
                  <p className="mt-2 text-xl font-bold">Live editing</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm text-white/60">Presence</p>
                  <p className="mt-2 text-xl font-bold">User awareness</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm text-white/60">Execution</p>
                  <p className="mt-2 text-xl font-bold">Run JS instantly</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
              <h2 className="mb-2 text-2xl font-bold">Join workspace</h2>
              <p className="mb-6 text-white/60">
                Enter your name and a room code to start collaborating.
              </p>

              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-white/70">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    required
                    placeholder="Enter your username"
                    defaultValue={username}
                    className="w-full rounded-2xl border border-white/10 bg-[#0f172a] px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/70">
                    Room ID
                  </label>
                  <input
                    type="text"
                    name="room"
                    placeholder="Leave empty to generate one"
                    defaultValue={roomId}
                    className="w-full rounded-2xl border border-white/10 bg-[#0f172a] px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                  />
                </div>

                <button className="w-full rounded-2xl bg-linear-to-r from-cyan-400 to-blue-600 px-4 py-3 font-semibold text-black transition hover:scale-[1.01]">
                  Join Room
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0f1f] p-4 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-400 gap-4">
        <aside className="flex w-[320px] flex-col rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">Workspace</p>
              <h1 className="text-2xl font-bold">CodeSync</h1>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${connectionState === "connected"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
                }`}
            >
              {connectionState}
            </span>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-[#0f172a] p-4">
            <p className="text-xs uppercase tracking-wide text-white/40">
              Room ID
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="truncate font-mono text-sm">{activeRoomId}</p>
              <button
                onClick={handleCopyLink}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
              >
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* <div className="mb-4 rounded-2xl border border-white/10 bg-[#0f172a] p-4">
            <p className="text-xs uppercase tracking-wide text-white/40">
              Language
            </p>
            <p className="mt-2 text-xs text-white/50">
              JavaScript execution is enabled on the backend.
            </p>
          </div> */}
          <div className="mb-4 rounded-2xl border border-white/10 bg-[#0f172a] p-4">
            <p className="text-xs uppercase tracking-wide text-white/40">
              Language
            </p>

            <div className="mt-2 flex items-center justify-between">
              <span className="rounded-lg bg-yellow-500/20 px-3 py-1 text-sm font-semibold text-yellow-400">
                JavaScript
              </span>

              <span className="text-xs text-white/50">
                v1
              </span>
            </div>

            <p className="mt-3 text-xs text-white/50">
  JavaScript execution enabled • Multi-language coming soon
</p>
          </div>

          <div className="mb-4 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Active users</h2>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70">
                {users.length}
              </span>
            </div>

            <ul className="space-y-3 overflow-y-auto">
              {users.map((user) => (
                <li
                  key={user.username}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                >
                  <UserAvatar name={user.username} color={user.color} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.username}</p>
                    <p className="text-xs text-white/50">JavaScript</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Activity</h3>
            </div>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-sm text-white/50">No recent activity.</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="rounded-xl bg-white/5 p-2">
                    <p className="text-sm">{event.message}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {formatTime(event.at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 font-semibold text-red-300 hover:bg-red-500/25"
          >
            Leave Room
          </button>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-2xl backdrop-blur-xl">
            <div>
              <h2 className="text-xl font-bold">Collaborative Editor</h2>
              <p className="text-sm text-white/50">
                Live synchronized editing powered by Yjs + Monaco
              </p>
            </div>

            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className="rounded-2xl bg-linear-to-r from-emerald-400 to-cyan-500 px-5 py-3 font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning ? "Running..." : "Run Code"}
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_360px]">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a] shadow-2xl">
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                defaultValue={DEFAULT_CODE[language]}
                onMount={handleEditorMount}
                options={{
                  fontSize: 15,
                  minimap: { enabled: false },
                  padding: { top: 16 },
                  smoothScrolling: true,
                  wordWrap: "on",
                }}
              />
            </div>

            <div className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
              <div className="border-b border-white/10 px-5 py-4">
                <h3 className="text-lg font-bold">Output</h3>
              </div>

              <pre className="flex-1 overflow-auto whitespace-pre-wrap p-5 text-sm leading-7 text-white/85">
                {output}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;