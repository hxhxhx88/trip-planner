"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Place = {
  name: string;
  address: string | null;
  category: string | null;
};

type Message = { role: "user" | "assistant"; text: string };

type Props = {
  place: Place | null;
};

export function StayDurationChat({ place }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Abort on unmount only — intentionally don't abort on popover close so
  // in-flight responses finish populating state.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendRound = useCallback(
    async (history: Message[], placeForRound: Place) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setStreaming(true);
      setMessages([...history, { role: "assistant", text: "" }]);

      try {
        const res = await fetch("/api/ai/stay-duration-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ place: placeForRound, messages: history }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const msg = await safeErrorMessage(res);
          toast.error(msg);
          setMessages((prev) => {
            const next = prev.slice(0, -1);
            return [...next, { role: "assistant", text: `Error: ${msg}` }];
          });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            const updated: Message = { role: "assistant", text: last.text + chunk };
            return [...prev.slice(0, -1), updated];
          });
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") return;
        console.error("stay-duration-chat failed", err);
        const msg = err instanceof Error ? err.message : "Request failed";
        toast.error(msg);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.text === "") {
            return [...prev.slice(0, -1), { role: "assistant", text: `Error: ${msg}` }];
          }
          return prev;
        });
      } finally {
        if (abortRef.current === ac) {
          setStreaming(false);
          abortRef.current = null;
        }
      }
    },
    [],
  );

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen && messages.length === 0 && place && !streaming) {
        const kickoff = buildKickoffText(place);
        const initial: Message[] = [{ role: "user", text: kickoff }];
        void sendRound(initial, place);
      }
    },
    [messages.length, place, streaming, sendRound],
  );

  const onSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || streaming || !place) return;
    const next: Message[] = [...messages, { role: "user", text: trimmed }];
    setInput("");
    void sendRound(next, place);
  }, [input, streaming, place, messages, sendRound]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={place ? "Ask AI about stay duration" : "Pick a place first"}
            title={place ? "Ask AI about stay duration" : "Pick a place first"}
            disabled={!place}
            onClick={(e) => e.stopPropagation()}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Sparkles className="size-3.5" />
          </button>
        }
      />
      <PopoverContent
        className="flex w-96 flex-col gap-2 p-3"
        align="start"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {place ? (
          <>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3" />
              <span className="truncate">Estimate stay for {place.name}</span>
            </div>
            <MessageList messages={messages} streaming={streaming} />
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={onSend}
              disabled={streaming || !input.trim()}
            />
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function MessageList({
  messages,
  streaming,
}: {
  messages: Message[];
  streaming: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  if (messages.length === 0) {
    return (
      <div className="px-1 py-4 text-center text-xs text-muted-foreground">
        Starting the conversation…
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1"
    >
      {messages.map((m, i) => {
        const isLast = i === messages.length - 1;
        const isStreamingHere =
          streaming && isLast && m.role === "assistant";
        return (
          <div
            key={i}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-md px-2.5 py-1.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              {m.text}
              {isStreamingHere ? (
                <span className="ml-0.5 inline-block size-2 animate-pulse rounded-full bg-foreground/60 align-middle" />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChatInput({
  input,
  setInput,
  onSend,
  disabled,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div className="flex items-end gap-1.5 border-t pt-2">
      <textarea
        ref={ref}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!disabled) onSend();
          }
        }}
        rows={1}
        placeholder="Ask a follow-up…"
        className="block max-h-24 flex-1 resize-none rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
      <Button
        type="button"
        size="sm"
        onClick={onSend}
        disabled={disabled}
        className="h-8 px-2"
      >
        <Send className="size-3.5" />
      </Button>
    </div>
  );
}

function buildKickoffText(place: Place): string {
  const category = place.category ? ` (${place.category})` : "";
  const where = place.address ? ` in ${place.address}` : "";
  return `As a traveler, how long do you recommend spending at ${place.name}${category}${where}?`;
}

async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data === "object" && "error" in data) {
      return String((data as { error: unknown }).error);
    }
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}
