import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { Message } from '../types';
import HeroSection from '../components/HeroSection';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import ModulesPanel from '../components/modules/ModulesPanel';
import Sidebar from '../components/Sidebar';
import type { ModulesPayload, ModuleKey } from '../components/modules/types';
import {
  postConversations,
  postConversationsMessagesId,
  getConversationsId,
} from '../api/generated/conversations/conversations';
import type {
  // ChipAnswerDTO,
  CreatedConversationDTO,
  ConversationWithMessagesDTO,
  MessageResponseDTO,
} from '../api/generated/theGoOverAPI.schemas';
import {
  prepareLanguageQuery,
  type ChatLanguage,
} from '../prompt-engineering';
import './HomePage.css';

// const EMPTY_CHIP: ChipAnswerDTO = { label: '', slotKey: '', slotValue: '' };

type RawContent = { modulesToRender: string[]; data: Record<string, unknown> };

function unwrapContent(content: RawContent): RawContent {
  const rawMarkdown = (content.data.text as { markdown?: string } | undefined)?.markdown ?? '';
  const jsonStart = rawMarkdown.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const embedded = JSON.parse(rawMarkdown.slice(jsonStart)) as { modulesToRender?: string[]; data?: Record<string, unknown> };
      if (embedded && Array.isArray(embedded.modulesToRender)) {
        return {
          modulesToRender: embedded.modulesToRender,
          data: { ...content.data, ...embedded.data },
        };
      }
    } catch {
      // not a JSON block
    }
  }
  return content;
}

export default function HomePage() {
  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>();

  const [chatStarted, setChatStarted] = useState(!!urlConversationId);
  const [heroVisible, setHeroVisible] = useState(!urlConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mainLanguage, setMainLanguage] = useState<ChatLanguage | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(urlConversationId ?? null);
  const [activeModules, setActiveModules] = useState<ModulesPayload | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!urlConversationId) return;

    async function loadHistory() {
      setLoading(true);
      try {
        const res = await getConversationsId(urlConversationId!);
        const { messages: raw } = res as unknown as ConversationWithMessagesDTO;

        setMessages(raw.map((msg) => {
          if (msg.sender === 'user') {
            return { id: msg.id, role: 'user' as const, content: msg.content as unknown as string };
          }
          const { data } = unwrapContent(msg.content as unknown as RawContent);
          return { id: msg.id, role: 'assistant' as const, content: (data.text as { markdown?: string } | undefined)?.markdown ?? '' };
        }));

        const lastAssistant = [...raw].reverse().find((m) => m.sender === 'assistant');
        if (lastAssistant) {
          const { modulesToRender, data } = unwrapContent(lastAssistant.content as unknown as RawContent);
          const sidebarKeys = modulesToRender.filter((k) => k !== 'text') as ModuleKey[];
          if (sidebarKeys.length > 0) {
            setActiveModules({ modulesToRender: sidebarKeys, data: data as ModulesPayload['data'] });
          }
        }
      } catch {
        // leave empty chat on error
      } finally {
        setLoading(false);
      }
    }

    void loadHistory();
  }, [urlConversationId]);

  async function callApi(text: string): Promise<{ replyText: string; modules: ModulesPayload }> {
    let content: { modulesToRender: string[]; data: Record<string, unknown> };

    if (!conversationId) {
      // @ts-expect-error - fix this type mismatch later
      const res = (await postConversations({ message: text, chipAnswer: null })) as unknown as CreatedConversationDTO;
      const newId = res.conversation.id;
      setConversationId(newId);
      window.history.replaceState(null, '', `/c/${newId}`);
      window.dispatchEvent(new CustomEvent('conversation-created'));
      content = res.initialAnswer.content as typeof content;
    } else {
      const res = (await postConversationsMessagesId(conversationId, {
        message: text,
        // @ts-expect-error - fix this type mismatch later
        chipAnswer: null,
      })) as unknown as MessageResponseDTO;
      content = res.message.content as typeof content;
    }

    const { modulesToRender, data } = unwrapContent(content as RawContent);

    const replyText = (data.text as { markdown?: string } | undefined)?.markdown ?? '';
    const sidebarKeys = modulesToRender.filter((k) => k !== 'text') as ModuleKey[];
    const modules: ModulesPayload = { modulesToRender: sidebarKeys, data: data as ModulesPayload['data'] };
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
        <Sidebar />
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
      <Sidebar />
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
