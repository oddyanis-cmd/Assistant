"use client";

/**
 * "Ask Keel" assistant widget — a direct port of keel-landing's scripted,
 * trilingual chat: canned greetings/answers per language (KBOT_DATA) and a
 * keyword-to-intent matcher (INTENTS) that works across all three
 * languages at once. No network calls; entirely client-side.
 */
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { KBOT_DATA, INTENTS } from "@/lib/i18n/kbot-data";
import type { Locale } from "@/lib/i18n/types";

type AnsKey = keyof (typeof KBOT_DATA)["en"]["ans"];

interface ChatMessage {
  id: number;
  text: string;
  who: "bot" | "me";
}

function kb(lang: Locale) {
  return KBOT_DATA[lang] ?? KBOT_DATA.en;
}

function matchIntent(input: string): AnsKey {
  const text = input.toLowerCase();
  for (const intent of INTENTS) {
    for (const kw of intent.kw) {
      if (text.indexOf(kw) >= 0) return intent.k as AnsKey;
    }
  }
  return "default";
}

export function AskKeel() {
  const { lang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const nextId = useRef(0);
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addMessage(text: string, who: ChatMessage["who"]) {
    setMessages((prev) => [...prev, { id: nextId.current++, text, who }]);
  }

  function greet() {
    setMessages([]);
    nextId.current = 0;
    window.setTimeout(() => addMessage(kb(lang).greet, "bot"), 0);
  }

  function reply(key: AnsKey) {
    const bank = kb(lang).ans as Record<string, string>;
    window.setTimeout(() => addMessage(bank[key] ?? bank.default, "bot"), 300);
  }

  // Re-greet in the new language if the panel is already open — mirrors
  // `window.__kbotSetLang` in the source.
  useEffect(() => {
    if (open) greet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages]);

  function togglePanel() {
    // Side effects (greet/focus) live outside the setState call itself —
    // React 19's Strict Mode double-invokes functional state updaters in
    // dev, which would otherwise duplicate the greeting message.
    const nowOpen = !open;
    setOpen(nowOpen);
    if (nowOpen) {
      if (messages.length === 0) greet();
      window.setTimeout(() => inputRef.current?.focus(), 90);
    }
  }

  function send() {
    const value = input.trim();
    if (!value) return;
    setInput("");
    addMessage(value, "me");
    reply(matchIntent(value));
  }

  function sendChip(label: string, intent: AnsKey) {
    addMessage(label, "me");
    reply(intent);
  }

  const data = kb(lang);

  return (
    <>
      <button
        className="kbot-btn"
        type="button"
        aria-expanded={open}
        onClick={togglePanel}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M4 5h16v11H8l-4 4z" strokeLinejoin="round" />
        </svg>
        <span>{t("kbot_open")}</span>
      </button>
      <div className={`kbot-panel${open ? " open" : ""}`} role="dialog" aria-label="Ask Keel">
        <div className="kbot-head">
          <span className="av">◆</span>
          <div>
            <div className="ht">Keel</div>
            <div className="hs">{t("kbot_status")}</div>
          </div>
          <button className="x" type="button" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <div className="kbot-msgs" ref={msgsRef}>
          {messages.map((m) => (
            <div key={m.id} className={`kmsg ${m.who}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="kchips">
          {data.chips.map(([label, intent]) => (
            <button
              key={intent}
              type="button"
              className="kchip"
              onClick={() => sendChip(label, intent as AnsKey)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="kbot-foot">
          <input
            ref={inputRef}
            type="text"
            placeholder={data.ph}
            aria-label="Message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="button" aria-label="Send" onClick={send}>
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
