"use client";

import { useState, useEffect } from "react";

type Comment = {
  id: number;
  user_id: number;
  entity_id: number;
  kpi_id: number | null;
  year: number;
  month: number | null;
  content: string;
  created_at: string;
  author_name: string;
  entity_name: string;
  kpi_name: string | null;
};

type CommentsPanelProps = {
  entityId: number;
  entityName: string;
  year: number;
  kpiId?: number;
  kpiName?: string;
};

export function CommentsPanel({ entityId, entityName, year, kpiId, kpiName }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadComments = async () => {
    try {
      let url = `/api/comments?entityId=${entityId}&year=${year}`;
      if (kpiId) url += `&kpiId=${kpiId}`;
      const res = await fetch(url);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      console.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      loadComments();
    }
  }, [entityId, year, kpiId, expanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          kpiId,
          year,
          content: newComment.trim(),
        }),
      });

      if (res.ok) {
        setNewComment("");
        loadComments();
      }
    } catch {
      console.error("Failed to submit comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Kommentar wirklich löschen?")) return;

    try {
      await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
      loadComments();
    } catch {
      console.error("Failed to delete comment");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
      >
        <svg className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        Kommentare ({comments.length})
        <span className="text-xs text-slate-400">für {entityName} {year}</span>
      </button>

      {expanded && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          {/* New Comment Form */}
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Kommentar hinzufügen..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {submitting ? "..." : "Senden"}
              </button>
            </div>
          </form>

          {/* Comments List */}
          {loading ? (
            <div className="py-4 text-center text-sm text-slate-500">Laden...</div>
          ) : comments.length === 0 ? (
            <div className="py-4 text-center text-sm text-slate-500">Keine Kommentare vorhanden</div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{comment.author_name}</span>
                        <span>•</span>
                        <span>{formatDate(comment.created_at)}</span>
                        {comment.kpi_name && (
                          <>
                            <span>•</span>
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 dark:bg-slate-600">{comment.kpi_name}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{comment.content}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-slate-400 hover:text-rose-500 transition"
                      title="Löschen"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
