'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, Guide } from '@/lib/api';
import Link from 'next/link';

export default function GuidesPage() {
  const router = useRouter();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/');
      return;
    }

    loadGuides();
  }, [router]);

  const loadGuides = async () => {
    try {
      const userData = await apiClient.getMe();
      setIsAdmin(userData.is_admin || false);
      
      const data = await apiClient.listGuides();
      setGuides(data);
    } catch (err) {
      console.error('Error loading guides:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/');
  };

  if (!mounted || loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>My Guides</h1>
        <div>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginRight: '1rem'
            }}
          >
            Logout
          </button>
          {isAdmin && (
            <Link
              href="/admin"
              style={{
                padding: '0.5rem 1rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
                marginRight: '1rem'
              }}
            >
              Admin
            </Link>
          )}
          <Link
            href="/guides/new"
            style={{
              padding: '0.5rem 1rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            New Guide
          </Link>
        </div>
      </div>

      {guides.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <p>No guides yet. Create your first guide!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {guides.map((guide) => (
            <Link
              key={guide.id}
              href={`/guides/${guide.id}`}
              style={{
                padding: '1.5rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                background: 'white',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                transition: 'box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <h2 style={{ marginBottom: '0.5rem' }}>{guide.title}</h2>
              {guide.description && (
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  {guide.description}
                </p>
              )}
              <div style={{ color: '#999', fontSize: '0.8rem' }}>
                {guide.steps?.length || 0} steps • {guide.status}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


