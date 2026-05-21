"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquarePlus,
  Trash2,
  Pencil,
  Check,
  X,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/session-store";
import {
  loadSessions,
  createSession,
  deleteSession,
  renameSession,
  saveActiveSessionId,
} from "@/lib/session-store";

interface SessionSidebarProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionSidebar({
  activeSessionId,
  onSelectSession,
  onNewSession,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    if (mounted) {
      setSessions(loadSessions());
    }
  }, [activeSessionId, mounted]);

  const handleNewChat = () => {
    const session = createSession();
    setSessions(loadSessions());
    onNewSession();
  };

  const handleSelect = (id: string) => {
    saveActiveSessionId(id);
    onSelectSession(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const nextId = deleteSession(id);
    setSessions(loadSessions());
    if (nextId) {
      onSelectSession(nextId);
    } else {
      onNewSession();
    }
  };

  const handleStartRename = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditName(session.name);
  };

  const handleSaveRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingId && editName.trim()) {
      renameSession(editingId, editName.trim());
      setSessions(loadSessions());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditName("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditName("");
    }
  };

  if (!mounted) return null;

  return (
    <>
      {/* Toggle button — always visible when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className={cn(
            "fixed left-3 top-4 z-30",
            "flex h-8 w-8 items-center justify-center rounded-lg",
            "bg-card border border-border",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors shadow-sm"
          )}
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar panel — only rendered when not collapsed */}
      {!collapsed && (
        <aside
          className={cn(
            "flex flex-col border-r border-border bg-card",
            "fixed inset-y-0 left-0 z-40 w-72",
            "lg:relative lg:z-0 lg:w-72",
            "animate-fade-in"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Chats</h3>
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* New Chat button */}
          <div className="p-3 shrink-0">
            <button
              onClick={handleNewChat}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm",
                "border border-border hover:bg-muted transition-colors",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquarePlus className="h-4 w-4" />
              New chat
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {sessions.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No conversations yet
              </p>
            ) : (
              <div className="space-y-0.5">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelect(session.id)}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer",
                      "transition-colors text-sm",
                      session.id === activeSessionId
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {editingId === session.id ? (
                      <div
                        className="flex flex-1 items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={handleRenameKeyDown}
                          className="flex-1 bg-card border border-border rounded px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-accent"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveRename}
                          className="shrink-0 text-accent hover:opacity-80"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={handleCancelRename}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-xs">
                          {session.name}
                        </span>
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => handleStartRename(e, session)}
                            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Rename"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, session.id)}
                            className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
