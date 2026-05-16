import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getConversations } from '../api/generated/conversations/conversations';
import type { ConversationEntity, ConversationListDTO } from '../api/generated/theGoOverAPI.schemas';
import './Sidebar.css';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function ChatBubbleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { conversationId: activeId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationEntity[]>([]);

  async function fetchConversations() {
    try {
      const res = await getConversations() as unknown as ConversationListDTO;
      setConversations(res.items);
    } catch {
      // cookie expired or no auth — leave list empty
    }
  }

  useEffect(() => {
    if (!user) return;
    void fetchConversations();

    window.addEventListener('conversation-created', fetchConversations);
    return () => window.removeEventListener('conversation-created', fetchConversations);
  }, [user]);

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__label">History</span>
        <Link to="/" className="sidebar__new-chat">+ New chat</Link>
      </div>

      {user ? (
        <div className="sidebar__list">
          {conversations.map((item) => (
            <button
              key={item.id}
              className={`sidebar__item${item.id === activeId ? ' sidebar__item--active' : ''}`}
              type="button"
              onClick={() => navigate(`/c/${item.id}`)}
            >
              <span className="sidebar__item-icon"><ChatBubbleIcon /></span>
              <span className="sidebar__item-body">
                <span className="sidebar__item-title">{item.title}</span>
                <span className="sidebar__item-date">{formatDate(item.createdAt)}</span>
              </span>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="sidebar__empty">No conversations yet</p>
          )}
        </div>
      ) : (
        <div className="sidebar__auth-prompt">
          <p className="sidebar__auth-text">
            Sign in to save and revisit your conversation history
          </p>
          <Link to="/signin" className="sidebar__auth-link">Sign in</Link>
        </div>
      )}
    </aside>
  );
}
