import { useState, useEffect, FormEvent } from 'react';
import * as api from '../api/endpoints';
import type { Comment, CommentEntityType } from '../types';

interface Props {
  entityType:   CommentEntityType;
  entityId:     string;
  compact?:     boolean;
  showPreview?: boolean;
}

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function CommentSection({ entityType, entityId, compact, showPreview }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.getComments(entityType, entityId).then(setComments).catch(() => {});
  }, [entityType, entityId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const comment = await api.addComment(entityType, entityId, text.trim());
      setComments(prev => [...prev, comment]);
      setText('');
    } catch { /* ignore */ }
    setLoading(false);
  };

  if (compact && !expanded) {
    const latest = comments.length > 0 ? comments[comments.length - 1] : null;
    return (
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Add comment'}
        </button>
        {showPreview && latest && (
          <p className="text-xs text-gray-500 truncate max-w-48" title={latest.text}>
            <span className="font-medium text-gray-600">{latest.createdByUser.name}:</span> {latest.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {compact && (
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-gray-500 hover:underline">
          Hide comments
        </button>
      )}

      {comments.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className="text-xs bg-gray-50 rounded px-2 py-1.5">
              <span className="font-medium text-gray-700">{c.createdByUser.name}</span>
              <span className="text-gray-400 ml-1">{timeAgo(c.createdAt)}</span>
              <p className="text-gray-600 mt-0.5">{c.text}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
        />
        <button type="submit" disabled={loading || !text.trim()} className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
          {loading ? '…' : 'Post'}
        </button>
      </form>
    </div>
  );
}
