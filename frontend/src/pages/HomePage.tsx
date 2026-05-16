import { useState, useRef, useEffect } from 'react';
import type { Message } from '../types';
import HeroSection from '../components/HeroSection';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import ModulesPanel from '../components/modules/ModulesPanel';
import type { ModulesPayload, ModuleKey } from '../components/modules/types';
import {
  postConversations,
  postConversationsMessagesId,
} from '../api/generated/conversations/conversations';
import type {
  ChipAnswerDTO,
  CreatedConversationDTO,
  MessageResponseDTO,
} from '../api/generated/theGoOverAPI.schemas';
import {
  prepareLanguageQuery,
  type ChatLanguage,
} from '../prompt-engineering';
import './HomePage.css';

const EMPTY_CHIP: ChipAnswerDTO = { label: '', slotKey: '', slotValue: '' };

export default function HomePage() {
  const [chatStarted, setChatStarted] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mainLanguage, setMainLanguage] = useState<ChatLanguage | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeModules, setActiveModules] = useState<ModulesPayload | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function callApi(text: string): Promise<{ replyText: string; modules: ModulesPayload }> {
    let content: { modulesToRender: string[]; data: Record<string, unknown> };

    if (!conversationId) {
      const res = (await postConversations({ message: text, chipAnswer: EMPTY_CHIP })) as unknown as CreatedConversationDTO;
      setConversationId(res.conversation.id);
      content = res.initialAnswer.content as typeof content;
    } else {
      const res = (await postConversationsMessagesId(conversationId, {
        message: text,
        chipAnswer: EMPTY_CHIP,
      })) as unknown as MessageResponseDTO;
      content = res.message.content as typeof content;
    }

    const data = content.data as ModulesPayload['data'];
    const replyText = (data.text as { markdown?: string } | undefined)?.markdown ?? '';
    // filter out 'text' — it goes in the chat bubble, not the sidebar
    const sidebarKeys = content.modulesToRender.filter((k) => k !== 'text') as ModuleKey[];
    const modules: ModulesPayload = { modulesToRender: sidebarKeys, data };
    return { replyText, modules };
  }

  async function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!chatStarted) {
      setHeroVisible(false);
      await new Promise((r) => setTimeout(r, 200));
      setChatStarted(true);
    }

    const prepared = await prepareLanguageQuery(text, mainLanguage);
    const activeLanguage = prepared.language;
    const normalisedText = prepared.normalizedText;

    if (!mainLanguage && prepared.confidence >= 0.65) {
      setMainLanguage(prepared.language);
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { replyText, modules } = await callApi(normalisedText);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: replyText },
      ]);
      if (modules.modulesToRender.length > 0) {
        setActiveModules(modules);
      }
      void activeLanguage;
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function submitMessage() {
    submitText(input);
  }

  if (!chatStarted) {
    return (
      <div className="page">
        <div className="card">
          <HeroSection visible={heroVisible} />
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={submitMessage}
            onChipClick={submitText}
            loading={loading}
            showHint={true}
            inputRef={inputRef}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className={`chat-layout${activeModules ? ' chat-layout--wide' : ''}`}>
        <div className="card card--chat">
          <MessageList
            messages={messages}
            loading={loading}
            bottomRef={bottomRef}
            language={mainLanguage}
          />
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={submitMessage}
            onChipClick={submitText}
            loading={loading}
            showHint={false}
            inputRef={inputRef}
          />
        </div>
        {activeModules && <ModulesPanel payload={activeModules} />}
      </div>
    </div>
  );
}
