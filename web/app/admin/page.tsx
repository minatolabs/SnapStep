'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import Link from 'next/link';

interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
  tenant_id: number;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string>('');

  // Create form state
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createIsAdmin, setCreateIsAdmin] = useState(false);

  // Edit form state
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/');
      return;
    }

    loadUsers();
  }, [router]);

  const loadUsers = async () => {
    try {
      const data = await apiClient.getMe();
      if (!data.is_admin) {
        router.push('/guides');
        return;
      }
      
      const usersData = await apiClient.listAllUsers();
      setUsers(usersData);
    } catch (err: any) {
      console.error('Error loading users:', err);
      if (err.response?.status === 403) {
        router.push('/guides');
      }
      const errorMsg = getErrorMessage(err);
      setError(typeof errorMsg === 'string' ? errorMsg : String(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createEmail || !createPassword) {
      setError('Email and password are required');
      return;
    }

    try {
      await apiClient.createUser({
        email: createEmail,
        password: createPassword,
        full_name: createFullName || undefined,
        is_admin: createIsAdmin
      });
      setShowCreateModal(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateFullName('');
      setCreateIsAdmin(false);
      setError('');
      loadUsers();
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setError(typeof errorMsg === 'string' ? errorMsg : String(errorMsg));
    }
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditEmail(user.email);
    setEditPassword('');
    setEditFullName(user.full_name || '');
    setEditIsActive(user.is_active);
    setEditIsAdmin(user.is_admin);
    setShowEditModal(true);
    setError('');
  };

  const handleUpdate = async () => {
    if (!editingUser) return;

    try {
      await apiClient.updateUser(editingUser.id, {
        email: editEmail,
        password: editPassword || undefined,
        full_name: editFullName || undefined,
        is_active: editIsActive,
        is_admin: editIsAdmin
      });
      setShowEditModal(false);
      setEditingUser(null);
      setError('');
      loadUsers();
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setError(typeof errorMsg === 'string' ? errorMsg : String(errorMsg));
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await apiClient.deleteUser(userId);
      loadUsers();
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setError(typeof errorMsg === 'string' ? errorMsg : String(errorMsg));
    }
  };

  if (!mounted || loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Admin - User Management</h1>
        <div>
          <Link
            href="/guides"
            style={{
              padding: '0.5rem 1rem',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              textDecoration: 'none',
              color: 'inherit',
              marginRight: '1rem'
            }}
          >
            Back to Guides
          </Link>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setError('');
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create User
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem',
          background: '#fee',
          color: '#c33',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '1rem', textAlign: 'left' }}>ID</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Full Name</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Admin</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '1rem' }}>{user.id}</td>
                <td style={{ padding: '1rem' }}>{user.email}</td>
                <td style={{ padding: '1rem' }}>{user.full_name || '-'}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    background: user.is_active ? '#d4edda' : '#f8d7da',
                    color: user.is_active ? '#155724' : '#721c24',
                    fontSize: '0.875rem'
                  }}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {user.is_admin ? (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      background: '#cfe2ff',
                      color: '#084298',
                      fontSize: '0.875rem'
                    }}>
                      Admin
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  <button
                    onClick={() => handleEdit(user)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '0.5rem'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Create User</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email *</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password *</label>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Full Name</label>
              <input
                type="text"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={createIsAdmin}
                  onChange={(e) => setCreateIsAdmin(e.target.checked)}
                />
                Admin User
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit User</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email *</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password (leave blank to keep current)</label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Full Name</label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                />
                Active
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={editIsAdmin}
                  onChange={(e) => setEditIsAdmin(e.target.checked)}
                />
                Admin User
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                  setError('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

