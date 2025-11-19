'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

export default function NewGuidePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    setLoading(true);
    try {
      // For MVP, we'll create a guide directly
      // In production, this would come from a completed session
      const session = await apiClient.createSession(title);
      
      // For now, just redirect to guides list
      // In full implementation, you'd complete the session first
      router.push('/guides');
    } catch (err) {
      console.error('Error creating guide:', err);
      alert(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Create New Guide</h1>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Guide Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter guide title"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Creating...' : 'Create Guide'}
        </button>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          <strong>Note:</strong> In the full implementation, guides are created automatically when you complete a recording session from the Windows client. This page is for testing purposes.
        </p>
      </div>
    </div>
  );
}


