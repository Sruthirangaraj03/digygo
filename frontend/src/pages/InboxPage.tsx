import { useState, useRef, useEffect } from 'react';
import { useCrmStore } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';
import { staff } from '@/data/mockData';
import {
  Search, Send, Paperclip, Smile, Check, CheckCheck, MessageCircle,
  ArrowLeft, StickyNote, Zap, ChevronDown, UserCheck, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';

type FilterTab = 'all' | 'mine' | 'unread' | 'unassigned' | 'resolved';

export default function InboxPage() {
  const { conversations, sendMessage, resolveConversation, reopenConversation, assignConversation, markConversationRead, quickReplies } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [messageText, setMessageText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showList, setShowList] = useState(true); // mobile toggle
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId);

  useEffect(() => {
    if (selectedId) markConversationRead(selectedId);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages.length]);

  const filtered = conversations.filter((c) => {
    if (search && !c.leadName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTab === 'mine') return c.assignedTo === currentUser?.id;
    if (filterTab === 'unread') return c.unreadCount > 0;
    if (filterTab === 'unassigned') return !c.assignedTo;
    if (filterTab === 'resolved') return c.status === 'resolved';
    return true;
  });

  const handleSend = () => {
    if (!messageText.trim() || !selectedId) return;
    sendMessage(selectedId, messageText.trim(), 'agent', isNote);
    setMessageText('');
    setIsNote(false);
    setShowQuickReplies(false);
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setShowList(false); // on mobile, switch to thread view
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

  const assignedStaff = selected ? staff.find((s) => s.id === selected.assignedTo) : null;

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
              const count = key === 'unread' ? conversations.filter((c) => c.unreadCount > 0).length : key === 'unassigned' ? conversations.filter((c) => !c.assignedTo).length : 0;
              return (
                <button key={key} onClick={() => setFilterTab(key)} className={cn('px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1', filterTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-[#f5ede3]')}>
                  {label}
                  {count > 0 && <span className={cn('text-[10px] rounded-full px-1', filterTab === key ? 'bg-white/20' : 'bg-primary/10 text-primary')}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No conversations</div>}
          {filtered.map((conv) => (
            <button key={conv.id} onClick={() => handleSelectConversation(conv.id)} className={cn('w-full text-left px-4 py-3 border-b border-black/5 hover:bg-[#faf8f6] transition-colors flex gap-3', conv.id === selectedId && 'bg-accent/30 border-l-2 border-l-primary')}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {conv.leadName.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">{conv.leadName}</span>
                  <span className="text-[11px] text-[#7a6b5c]">{formatDistanceToNow(new Date(conv.lastMessageTime), { addSuffix: false })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3 text-green-500 shrink-0" />
                  <p className="text-[11px] text-[#7a6b5c] truncate">{conv.lastMessage}</p>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 border-0', conv.status === 'open' && 'bg-green-100 text-green-700', conv.status === 'pending' && 'bg-yellow-100 text-yellow-700', conv.status === 'resolved' && 'bg-muted text-muted-foreground')}>{conv.status}</Badge>
                  {assignedStaff && conv.id === selectedId && <span className="text-[10px] text-muted-foreground">{assignedStaff.name}</span>}
                </div>
              </div>
              {conv.unreadCount > 0 && <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold shrink-0 self-center">{conv.unreadCount}</span>}
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
                  {selected.leadName.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-headline font-bold text-[#1c1410]">{selected.leadName}</h3>
                  <p className="text-[11px] text-[#7a6b5c]">{selected.leadPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={cn('text-xs', selected.status === 'open' && 'bg-green-100 text-green-700', selected.status === 'pending' && 'bg-yellow-100 text-yellow-700', selected.status === 'resolved' && 'bg-muted text-muted-foreground')}>
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
                          <button key={s.id} onClick={() => { assignConversation(selected.id, s.id); toast.success(`Assigned to ${s.name}`); setShowAssign(false); }} className={cn('w-full text-left px-3 py-2 text-sm hover:bg-[#f5ede3] flex items-center gap-2', selected.assignedTo === s.id && 'text-primary font-medium')}>
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">{s.avatar}</div>
                            {s.name.split(' ')[0]}
                            {selected.assignedTo === s.id && <Check className="w-3 h-3 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {selected.status === 'resolved'
                  ? <Button variant="outline" size="sm" onClick={() => { reopenConversation(selected.id); toast.success('Conversation reopened'); }}>Reopen</Button>
                  : <Button variant="outline" size="sm" onClick={() => { resolveConversation(selected.id); toast.success('Conversation resolved'); }}>Resolve</Button>
                }
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages.map((msg, i) => {
                const showDate = i === 0 || formatMsgDate(msg.timestamp) !== formatMsgDate(selected.messages[i - 1].timestamp);
                return (
                  <div key={msg.id}>
                    {showDate && <div className="text-center my-4"><span className="text-[11px] text-[#7a6b5c] bg-muted px-3 py-1 rounded-full">{formatMsgDate(msg.timestamp)}</span></div>}
                    <div className={cn('flex', msg.sender === 'agent' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[70%] p-3 text-sm', msg.isNote ? 'bg-yellow-50 border border-yellow-200 rounded-2xl' : msg.sender === 'customer' ? 'bg-muted rounded-2xl rounded-tl-sm' : 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm')}>
                        {msg.isNote && <p className="text-[10px] font-semibold text-yellow-600 mb-1 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Internal Note</p>}
                        <p className={msg.isNote ? 'text-yellow-800' : ''}>{msg.text}</p>
                        <div className={cn('flex items-center gap-1 mt-1', msg.sender === 'agent' ? 'justify-end' : '')}>
                          <span className={cn('text-xs', msg.isNote ? 'text-yellow-600' : msg.sender === 'customer' ? 'text-muted-foreground' : 'text-primary-foreground/70')}>{format(new Date(msg.timestamp), 'HH:mm')}</span>
                          {msg.sender === 'agent' && !msg.isNote && msg.status === 'read' && <CheckCheck className="w-3 h-3 text-blue-300" />}
                          {msg.sender === 'agent' && !msg.isNote && msg.status === 'delivered' && <CheckCheck className="w-3 h-3 text-primary-foreground/50" />}
                          {msg.sender === 'agent' && !msg.isNote && msg.status === 'sent' && <Check className="w-3 h-3 text-primary-foreground/50" />}
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
                    <button key={qr.id} onClick={() => { setMessageText(qr.content); setShowQuickReplies(false); }} className="w-full text-left p-2 rounded-lg hover:bg-background border border-black/5 text-sm transition-colors">
                      <p className="font-medium text-foreground text-xs">{qr.title}</p>
                      <p className="text-muted-foreground text-xs truncate">{qr.content}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className={cn('border-t border-black/5 p-3', isNote && 'bg-yellow-50')}>
              {isNote && <p className="text-xs font-semibold text-yellow-600 mb-2 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Internal Note — not visible to customer</p>}
              <div className="flex items-end gap-2">
                <div className="flex gap-1">
                  <button onClick={() => setShowQuickReplies(!showQuickReplies)} className={cn('p-2 rounded-lg transition-colors', showQuickReplies ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-[#f5ede3]')} title="Quick replies"><Zap className="w-5 h-5" /></button>
                  <button onClick={() => setIsNote(!isNote)} className={cn('p-2 rounded-lg transition-colors', isNote ? 'bg-yellow-200 text-yellow-700' : 'text-muted-foreground hover:text-foreground hover:bg-[#f5ede3]')} title="Internal note"><StickyNote className="w-5 h-5" /></button>
                  <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-[#f5ede3] rounded-lg transition-colors" title="Attachment"><Paperclip className="w-5 h-5" /></button>
                </div>
                <Input
                  className={cn('flex-1', isNote && 'border-yellow-300 bg-yellow-50 focus-visible:ring-yellow-200')}
                  placeholder={isNote ? 'Write an internal note...' : 'Type a message...'}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
                <Button onClick={handleSend} disabled={!messageText.trim()} className={isNote ? 'bg-yellow-500 hover:bg-yellow-600' : ''}><Send className="w-4 h-4" /></Button>
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
