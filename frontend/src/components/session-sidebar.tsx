"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquarePlus,
  Trash2,
  Pencil,
  Check,
  X,
  PanelLeftClose,
  Menu,
  MessagesSquare,
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
    createSession();
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
    if (e.key === "Enter") handleSaveRename();
    else if (e.key === "Escape") {
      setEditingId(null);
      setEditName("");
    }
  };

  if (!mounted) return null;

  return (
    <>
      {/* Toggle button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className={cn(
            "fixed left-3 top-3 z-30",
            "flex h-9 w-9 items-center justify-center rounded-xl",
            "border transition-all duration-200 shadow-sm hover:shadow-md",
            "hover:scale-105 active:scale-95"
          )}
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--muted-foreground)",
          }}
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(0,0,0,0.25)" }}
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar panel */}
      {!collapsed && (
        <aside
          className={cn(
            "flex flex-col",
            "fixed inset-y-0 left-0 z-40 w-72",
            "lg:relative lg:z-0 lg:w-64",
            "animate-fade-in"
          )}
          style={{
            background: "var(--sidebar-bg)",
            borderRight: "1px solid var(--sidebar-border)",
          }}
        >
          {/* Sidebar Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--sidebar-border)" }}
          >
            <div className="flex items-center gap-2">
              <MessagesSquare className="h-4 w-4" style={{ color: "var(--accent)" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Lịch sử chat
              </h3>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
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
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium",
                "transition-all duration-200 border hover:bg-muted"
              )}
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              <MessageSquarePlus className="h-4 w-4" style={{ color: "var(--accent)" }} />
              Chat mới
            </button>
          </div>

          {/* Divider label */}
          {sessions.length > 0 && (
            <div className="px-4 pb-2 mt-2 border-t pt-4" style={{ borderColor: "var(--sidebar-border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                Gần đây
              </p>
            </div>
          )}

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessagesSquare className="h-8 w-8 mb-3" style={{ color: "var(--border)" }} />
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Chưa có cuộc trò chuyện nào
                </p>
                <p className="text-[11px] mt-1" style={{ color: "var(--border)" }}>
                  Nhấn &quot;Chat mới&quot; để bắt đầu
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelect(session.id)}
                      className={cn(
                        "group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer",
                        "transition-all duration-150 text-sm"
                      )}
                      style={{
                        background: isActive
                          ? "var(--muted)"
                          : "transparent",
                        color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                        fontWeight: isActive ? 500 : 400,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "var(--card)";
                          (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                        }
                      }}
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
                            className="flex-1 rounded-lg px-2 py-1 text-xs outline-none"
                            style={{
                              background: "var(--card)",
                              border: "1px solid var(--accent)",
                              color: "var(--foreground)",
                            }}
                            autoFocus
                          />
                          <button
                            onClick={handleSaveRename}
                            className="shrink-0 transition-opacity hover:opacity-70"
                            style={{ color: "var(--accent)" }}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="shrink-0 transition-opacity hover:opacity-70"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 truncate text-sm">
                            {session.name}
                          </span>
                          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={(e) => handleStartRename(e, session)}
                              className="p-1 rounded-md transition-colors hover:opacity-80"
                              style={{ color: "var(--muted-foreground)" }}
                              aria-label="Rename"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, session.id)}
                              className="p-1 rounded-md transition-colors hover:opacity-80"
                              style={{ color: "var(--muted-foreground)" }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "#ef4444";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                              }}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
