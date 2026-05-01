import { useState, useRef, useEffect, useCallback } from 'react';
import { useCrmStore } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import {
  Search, Send, Paperclip, Check, CheckCheck, MessageCircle,
  ArrowLeft, StickyNote, Zap, ChevronDown, UserCheck, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';

type FilterTab = 'all' | 'mine' | 'unread' | 'unassigned' | 'resolved';

interface ApiConversation {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  channel: string;
  status: 'open' | 'pending' | 'resolved';
  assigned_to: string | null;
  assigned_name: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface ApiMessage {
  id: string;
  conversation_id: string;
  sender: 'agent' | 'customer';
  body: string;
  is_note: boolean;
  status: string;
  created_at: string;
}

export default function InboxPage() {
  const { staff, quickReplies } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [messageText, setMessageText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showList, setShowList] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const loadConversations = useCallback(() => {
    api.get<ApiConversation[]>('/api/conversations').then(setConversations).catch(() => {});
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Real-time: listen for new messages and conversation updates via Socket.io
  useEffect(() => {
    const socket = getSocket();

    const onNewMessage = (msg: ApiMessage) => {
      if (msg.sender === 'customer') {
        setMessages((prev) =>
          prev[0]?.conversation_id === msg.conversation_id ? [...prev, msg] : prev
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversation_id
              ? { ...c, last_message: msg.body, last_message_at: msg.created_at, unread_count: c.unread_count + 1 }
              : c
          )
        );
      }
    };

    const onConvUpdated = (conv: ApiConversation) => {
      setConversations((prev) =>
        prev.some((c) => c.id === conv.id)
          ? prev.map((c) => c.id === conv.id ? { ...c, ...conv } : c)
          : [conv, ...prev]
      );
    };

    socket.on('message:new', onNewMessage);
    socket.on('conversation:updated', onConvUpdated);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('conversation:updated', onConvUpdated);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    api.get<ApiMessage[]>(`/api/conversations/${selectedId}/messages`)
      .then(setMessages)
      .catch(() => {});
    api.patch(`/api/conversations/${selectedId}/read`, {}).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => c.id === selectedId ? { ...c, unread_count: 0 } : c)
    );
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filtered = conversations.filter((c) => {
    if (search && !c.lead_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTab === 'mine') return c.assigned_to === currentUser?.id;
    if (filterTab === 'unread') return c.unread_count > 0;
    if (filterTab === 'unassigned') return !c.assigned_to;
    if (filterTab === 'resolved') return c.status === 'resolved';
    return true;
  });

  const handleSend = async () => {
    if (!messageText.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const msg = await api.post<ApiMessage>(`/api/conversations/${selectedId}/messages`, {
        body: messageText.trim(),
        is_note: isNote,
      });
      setMessages((prev) => [...prev, msg]);
      if (!isNote) {
        setConversations((prev) =>
          prev.map((c) => c.id === selectedId
            ? { ...c, last_message: messageText.trim(), last_message_at: new Date().toISOString() }
            : c
          )
        );
      }
      setMessageText('');
      setIsNote(false);
      setShowQuickReplies(false);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAssign = async (staffId: string) => {
    if (!selectedId) return;
    try {
      await api.patch(`/api/conversations/${selectedId}/assign`, { assigned_to: staffId });
      const member = staff.find((s) => s.id === staffId);
      setConversations((prev) =>
        prev.map((c) => c.id === selectedId
          ? { ...c, assigned_to: staffId, assigned_name: member?.name ?? null }
          : c
        )
      );
      toast.success(`Assigned to ${member?.name ?? 'staff'}`);
    } catch { toast.error('Failed to assign'); }
    setShowAssign(false);
  };

  const handleStatus = async (status: 'open' | 'resolved') => {
    if (!selectedId) return;
    try {
      await api.patch(`/api/conversations/${selectedId}/status`, { status });
      setConversations((prev) =>
        prev.map((c) => c.id === selectedId ? { ...c, status } : c)
      );
      toast.success(status === 'resolved' ? 'Conversation resolved' : 'Conversation reopened');
    } catch { toast.error('Failed to update status'); }
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setShowList(false);
  };

  const handleBack = () => {
    setShowList(true);
    setSelectedId(null);
  };

  const formatMsgDate = (ts: string) => {
    const d = new Date(ts);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'unread', label: 'Unread' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'resolved', label: 'Resolved' },
  ];

  const assignedStaff = selected ? staff.find((s) => s.id === selected.assigned_to) : null;

  return (
    <div className="animate-fade-in -m-4 md:-m-8 flex" style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* Conversation List */}
      <div className={cn('w-full sm:w-80 border-r border-black/5 flex flex-col bg-card shrink-0', !showList && 'hidden sm:flex')}>
        <div className="p-3 border-b border-black/5 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {tabs.map(({ key, label }) => {
              const count = key === 'unread' ? conversations.filter((c) => c.unread_count > 0).length
                : key === 'unassigned' ? conversations.filter((c) => !c.assigned_to).length : 0;
              return (
                <button key={key} onClick={() => setFilterTab(key)}
                  className={cn('px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1',
                    filterTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-[#f5ede3]')}>
                  {label}
                  {count > 0 && <span className={cn('text-[10px] rounded-full px-1', filterTab === key ? 'bg-white/20' : 'bg-primary/10 text-primary')}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
              <MessageCircle className="w-10 h-10 text-gray-300 mb-1" />
              <p className="text-[13px] font-semibold text-[#1c1410]">No conversations yet</p>
              <p className="text-[12px] text-[#7a6b5c]">Connect WhatsApp in <strong>Settings → WhatsApp Setup</strong> to start receiving messages here.</p>
            </div>
          )}
          {filtered.map((conv) => (
            <button key={conv.id} onClick={() => handleSelectConversation(conv.id)}
              className={cn('w-full text-left px-4 py-3 border-b border-black/5 hover:bg-[#faf8f6] transition-colors flex gap-3',
                conv.id === selectedId && 'bg-accent/30 border-l-2 border-l-primary')}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {conv.lead_name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">{conv.lead_name}</span>
                  <span className="text-[11px] text-[#7a6b5c]">
                    {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false }) : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3 text-green-500 shrink-0" />
                  <p className="text-[11px] text-[#7a6b5c] truncate">{conv.last_message}</p>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 border-0',
                    conv.status === 'open' && 'bg-green-100 text-green-700',
                    conv.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                    conv.status === 'resolved' && 'bg-muted text-muted-foreground')}>
                    {conv.status}
                  </Badge>
                </div>
              </div>
              {conv.unread_count > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold shrink-0 self-center">
                  {conv.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message Thread */}
      <div className={cn('flex-1 flex flex-col', showList && 'hidden sm:flex')}>
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
              <div className="flex items-center gap-3">
                <button onClick={handleBack} className="sm:hidden p-1 hover:bg-[#f5ede3] rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                  {selected.lead_name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-headline font-bold text-[#1c1410]">{selected.lead_name}</h3>
                  <p className="text-[11px] text-[#7a6b5c]">{selected.lead_phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={cn('text-xs',
                  selected.status === 'open' && 'bg-green-100 text-green-700',
                  selected.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                  selected.status === 'resolved' && 'bg-muted text-muted-foreground')}>
                  {selected.status}
                </Badge>

                {/* Assign dropdown */}
                <div className="relative">
                  <Button variant="outline" size="sm" onClick={() => setShowAssign(!showAssign)} className="flex items-center gap-1">
                    <UserCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">{assignedStaff ? assignedStaff.name.split(' ')[0] : 'Assign'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  {showAssign && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAssign(false)} />
                      <div className="absolute right-0 top-10 bg-card border border-black/5 rounded-xl shadow-xl z-50 w-48 py-1">
                        {staff.filter((s) => s.status === 'active').map((s) => (
                          <button key={s.id} onClick={() => handleAssign(s.id)}
                            className={cn('w-full text-left px-3 py-2 text-sm hover:bg-[#f5ede3] flex items-center gap-2',
                              selected.assigned_to === s.id && 'text-primary font-medium')}>
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">{s.avatar}</div>
                            {s.name.split(' ')[0]}
                            {selected.assigned_to === s.id && <Check className="w-3 h-3 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {selected.status === 'resolved'
                  ? <Button variant="outline" size="sm" onClick={() => handleStatus('open')}>Reopen</Button>
                  : <Button variant="outline" size="sm" onClick={() => handleStatus('resolved')}>Resolve</Button>
                }
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => {
                const showDate = i === 0 || formatMsgDate(msg.created_at) !== formatMsgDate(messages[i - 1].created_at);
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="text-center my-4">
                        <span className="text-[11px] text-[#7a6b5c] bg-muted px-3 py-1 rounded-full">{formatMsgDate(msg.created_at)}</span>
                      </div>
                    )}
                    <div className={cn('flex', msg.sender === 'agent' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[70%] p-3 text-sm',
                        msg.is_note ? 'bg-yellow-50 border border-yellow-200 rounded-2xl'
                          : msg.sender === 'customer' ? 'bg-muted rounded-2xl rounded-tl-sm'
                          : 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm')}>
                        {msg.is_note && (
                          <p className="text-[10px] font-semibold text-yellow-600 mb-1 flex items-center gap-1">
                            <StickyNote className="w-3 h-3" /> Internal Note
                          </p>
                        )}
                        <p className={msg.is_note ? 'text-yellow-800' : ''}>{msg.body}</p>
                        <div className={cn('flex items-center gap-1 mt-1', msg.sender === 'agent' ? 'justify-end' : '')}>
                          <span className={cn('text-xs',
                            msg.is_note ? 'text-yellow-600'
                              : msg.sender === 'customer' ? 'text-muted-foreground'
                              : 'text-primary-foreground/70')}>
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </span>
                          {msg.sender === 'agent' && !msg.is_note && msg.status === 'read' && <CheckCheck className="w-3 h-3 text-blue-300" />}
                          {msg.sender === 'agent' && !msg.is_note && msg.status === 'delivered' && <CheckCheck className="w-3 h-3 text-primary-foreground/50" />}
                          {msg.sender === 'agent' && !msg.is_note && msg.status === 'sent' && <Check className="w-3 h-3 text-primary-foreground/50" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            {showQuickReplies && (
              <div className="border-t border-black/5 bg-[#faf8f6] p-3 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c]">Quick Replies</p>
                  <button onClick={() => setShowQuickReplies(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="space-y-1.5">
                  {quickReplies.map((qr) => (
                    <button key={qr.id} onClick={() => { setMessageText(qr.content); setShowQuickReplies(false); }}
                      className="w-full text-left p-2 rounded-lg hover:bg-background border border-black/5 text-sm transition-colors">
                      <p className="font-medium text-foreground text-xs">{qr.title}</p>
                      <p className="text-muted-foreground text-xs truncate">{qr.content}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className={cn('border-t border-black/5 p-3', isNote && 'bg-yellow-50')}>
              {isNote && (
                <p className="text-xs font-semibold text-yellow-600 mb-2 flex items-center gap-1">
                  <StickyNote className="w-3 h-3" /> Internal Note — not visible to customer
                </p>
              )}
              <div className="flex items-end gap-2">
                <div className="flex gap-1">
                  <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className={cn('p-2 rounded-lg transition-colors', showQuickReplies ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-[#f5ede3]')}
                    title="Quick replies"><Zap className="w-5 h-5" /></button>
                  <button onClick={() => setIsNote(!isNote)}
                    className={cn('p-2 rounded-lg transition-colors', isNote ? 'bg-yellow-200 text-yellow-700' : 'text-muted-foreground hover:text-foreground hover:bg-[#f5ede3]')}
                    title="Internal note"><StickyNote className="w-5 h-5" /></button>
                  <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-[#f5ede3] rounded-lg transition-colors" title="Attachment">
                    <Paperclip className="w-5 h-5" />
                  </button>
                </div>
                <Input
                  className={cn('flex-1', isNote && 'border-yellow-300 bg-yellow-50 focus-visible:ring-yellow-200')}
                  placeholder={isNote ? 'Write an internal note...' : 'Type a message...'}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
                <Button onClick={handleSend} disabled={!messageText.trim() || sending}
                  className={isNote ? 'bg-yellow-500 hover:bg-yellow-600' : ''}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
