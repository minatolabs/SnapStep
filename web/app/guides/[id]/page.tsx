'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { apiClient, Guide } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function GuideEditorPage() {
  const router = useRouter();
  const params = useParams();
  const guideId = parseInt(params.id as string);

  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      LinkExtension.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Start typing...',
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Content will be saved via debounce
    },
  });

  const debouncedContent = useDebounce(editor?.getJSON(), 2000);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/');
      return;
    }

    loadGuide();
  }, [guideId, router]);

  useEffect(() => {
    if (debouncedContent && guide) {
      saveGuide();
    }
  }, [debouncedContent]);

  useEffect(() => {
    if (guide && editor) {
      editor.commands.setContent(guide.content || {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [],
          },
        ],
      });
    }
  }, [guide, editor]);

  const loadGuide = async () => {
    try {
      const data = await apiClient.getGuide(guideId);
      setGuide(data);
    } catch (err) {
      console.error('Error loading guide:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveGuide = async () => {
    if (!editor || !guide) return;

    setSaving(true);
    try {
      const content = editor.getJSON();
      const updated = await apiClient.updateGuide(guideId, {
        content,
        title: guide.title,
      });
      setGuide(updated);
    } catch (err) {
      console.error('Error saving guide:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTitleChange = async (newTitle: string) => {
    if (!guide) return;

    try {
      const updated = await apiClient.updateGuide(guideId, { title: newTitle });
      setGuide(updated);
    } catch (err) {
      console.error('Error updating title:', err);
    }
  };

  const handleExport = async () => {
    try {
      const exportJob = await apiClient.requestExport(guideId);
      alert(`Export started! Job ID: ${exportJob.job_id}. Check status later.`);
    } catch (err) {
      console.error('Error requesting export:', err);
      alert(getErrorMessage(err));
    }
  };

  if (!mounted || loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!guide) {
    return <div style={{ padding: '2rem' }}>Guide not found</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar with steps */}
      <div style={{
        width: '300px',
        borderRight: '1px solid #ddd',
        overflowY: 'auto',
        background: '#f9f9f9'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
          <Link
            href="/guides"
            style={{ color: '#0070f3', textDecoration: 'underline' }}
          >
            ← Back to Guides
          </Link>
        </div>

        <div style={{ padding: '1rem' }}>
          <input
            type="text"
            value={guide.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              marginBottom: '1rem'
            }}
          />

          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={handleExport}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Export PDF
            </button>
          </div>

          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            {saving ? 'Saving...' : 'Saved'}
          </div>

          <h3 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
            Steps ({guide.steps.length})
          </h3>
        </div>

        <div>
          {guide.steps.map((step, idx) => (
            <div
              key={step.id}
              onClick={() => setSelectedStep(step.id)}
              style={{
                padding: '1rem',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                background: selectedStep === step.id ? '#e3f2fd' : 'white',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                Step {step.index + 1}: {step.title || 'Untitled'}
              </div>
              {step.screenshot_url && (
                <img
                  src={step.screenshot_url}
                  alt={`Step ${step.index + 1}`}
                  style={{
                    width: '100%',
                    marginTop: '0.5rem',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #ddd',
          background: 'white',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #ddd',
              background: editor?.isActive('bold') ? '#e3f2fd' : 'white',
              borderRadius: '4px'
            }}
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #ddd',
              background: editor?.isActive('italic') ? '#e3f2fd' : 'white',
              borderRadius: '4px'
            }}
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #ddd',
              background: editor?.isActive('heading', { level: 1 }) ? '#e3f2fd' : 'white',
              borderRadius: '4px'
            }}
          >
            H1
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #ddd',
              background: editor?.isActive('heading', { level: 2 }) ? '#e3f2fd' : 'white',
              borderRadius: '4px'
            }}
          >
            H2
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #ddd',
              background: editor?.isActive('bulletList') ? '#e3f2fd' : 'white',
              borderRadius: '4px'
            }}
          >
            •
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #ddd',
              background: editor?.isActive('orderedList') ? '#e3f2fd' : 'white',
              borderRadius: '4px'
            }}
          >
            1.
          </button>
        </div>

        <div style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto',
          background: 'white'
        }}>
          <EditorContent editor={editor} />
        </div>
      </div>

      <style jsx global>{`
        .ProseMirror {
          outline: none;
          min-height: 500px;
        }
        .ProseMirror p {
          margin: 0.5rem 0;
        }
        .ProseMirror h1 {
          font-size: 2rem;
          font-weight: bold;
          margin: 1rem 0;
        }
        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0.75rem 0;
        }
        .ProseMirror ul, .ProseMirror ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          margin: 1rem 0;
        }
        .ProseMirror a {
          color: #0070f3;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

