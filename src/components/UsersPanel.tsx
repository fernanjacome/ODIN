import { useMemo, useState } from 'react'
import { MdAdminPanelSettings, MdDelete, MdPerson, MdPersonAdd, MdSchedule, MdSearch } from 'react-icons/md'
import { api } from '../api/client'
import type { UserDto } from '../types'

interface Props {
  users: UserDto[]
  currentUsername: string
  onUsersChanged?: () => void
}

function formatDate(iso?: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-EC', { hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function roleColor(role: string) {
  if (role === 'Admin') return { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' }
  if (role === 'Operador') return { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' }
  return { bg: '#f9fafb', fg: '#4b5563', border: '#e5e7eb' }
}

export function UsersPanel({ users, currentUsername, onUsersChanged }: Props) {
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('Visor')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter(u => !needle || u.username.toLowerCase().includes(needle) || u.role.toLowerCase().includes(needle))
      .sort((a, b) => a.username.localeCompare(b.username))
  }, [query, users])

  async function handleCreate() {
    if (!newUsername.trim()) { setError('El nombre de usuario es requerido.'); return }
    if (!newPassword.trim()) { setError('La contraseña es requerida.'); return }
    if (newPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setSaving(true); setError('')
    try {
      await api.createUser({ username: newUsername.trim(), password: newPassword, role: newRole })
      setNewUsername(''); setNewPassword(''); setNewRole('Visor'); setShowForm(false)
      onUsersChanged?.()
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al crear usuario.') }
    finally { setSaving(false) }
  }

  async function handleRoleChange(id: number, role: string) {
    try { await api.updateUser(id, { role }); onUsersChanged?.() }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al actualizar rol.') }
  }

  async function handleDelete(user: UserDto) {
    if (user.username === currentUsername) return
    if (!confirm(`¿Eliminar el usuario "${user.username}"?`)) return
    try { await api.deleteUser(user.id); onUsersChanged?.() }
    catch { setError('Error al eliminar usuario.') }
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden', background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', flexShrink: 0 }}>
        <MdAdminPanelSettings size={15} color="#2563eb" />
        <strong style={{ color: '#374151', fontSize: 12 }}>Usuarios</strong>
        <div style={{ flex: 1 }} />
        <div style={searchStyle}>
          <MdSearch size={13} color="#9ca3af" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar" style={inputStyle} />
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} style={addBtn}>
          <MdPersonAdd size={13} /> {showForm ? 'Cancelar' : 'Nuevo'}
        </button>
        <span style={{ color: '#9ca3af', fontSize: 10 }}>{rows.length}</span>
      </div>

      {error && <div style={{ padding: '5px 10px', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, borderBottom: '1px solid #fecaca' }}>{error}</div>}

      {showForm && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', flexShrink: 0 }}>
          <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Usuario" style={{ ...controlStyle, width: 140 }} />
          <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Contraseña" type="password" style={{ ...controlStyle, width: 140 }} />
          <select value={newRole} onChange={e => setNewRole(e.target.value)} style={controlStyle}>
            <option>Admin</option><option>Operador</option><option>Visor</option>
          </select>
          <button type="button" onClick={handleCreate} disabled={saving} style={saveBtn}>{saving ? 'Creando...' : 'Crear'}</button>
        </div>
      )}

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <tr><th style={th}>Usuario</th><th style={th}>Rol</th><th style={th}>Creado</th><th style={th}>Ultimo acceso</th><th style={{ ...th, width: 50 }} /></tr>
          </thead>
          <tbody>
            {rows.map((user, i) => {
              const isCurrent = user.username === currentUsername
              return (
                <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MdPerson size={14} color={isCurrent ? '#2563eb' : '#9ca3af'} />
                      <strong style={{ color: '#111827' }}>{user.username}</strong>
                      {isCurrent && <span style={{ fontSize: 9, color: '#2563eb', fontWeight: 700 }}>Sesion activa</span>}
                    </div>
                  </td>
                  <td style={td}>
                    <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)} disabled={isCurrent} style={{ ...controlStyle, background: roleColor(user.role).bg, color: roleColor(user.role).fg, border: `1px solid ${roleColor(user.role).border}`, fontWeight: 600, cursor: isCurrent ? 'not-allowed' : 'pointer' }}>
                      <option>Admin</option><option>Operador</option><option>Visor</option>
                    </select>
                  </td>
                  <td style={{ ...td, color: '#6b7280' }}><MdSchedule size={12} color="#d1d5db" /> {formatDate(user.createdAt)}</td>
                  <td style={{ ...td, color: '#6b7280' }}>{formatDate(user.lastLoginAt)}</td>
                  <td style={td}>
                    {!isCurrent && (
                      <button type="button" onClick={() => handleDelete(user)} title="Eliminar usuario" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#dc2626', padding: 2, display: 'flex' }}>
                        <MdDelete size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Sin usuarios</div>}
      </div>
    </div>
  )
}

const searchStyle: React.CSSProperties = { width: 150, height: 26, border: '1px solid #d1d5db', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5, padding: '0 6px', background: '#fff' }
const inputStyle: React.CSSProperties = { width: '100%', border: 0, outline: 0, fontSize: 11, background: 'transparent', color: '#374151' }
const controlStyle: React.CSSProperties = { height: 26, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', color: '#374151', fontSize: 11, fontWeight: 600, padding: '0 6px', outline: 0 }
const th: React.CSSProperties = { padding: '7px 9px', textAlign: 'left', fontWeight: 700, color: '#4b5563', fontSize: 11 }
const td: React.CSSProperties = { padding: '6px 9px', fontSize: 11 }
const addBtn: React.CSSProperties = { height: 26, border: '1px solid #2563eb', borderRadius: 4, background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 600, padding: '0 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }
const saveBtn: React.CSSProperties = { height: 26, border: '1px solid #15803d', borderRadius: 4, background: '#15803d', color: '#fff', fontSize: 11, fontWeight: 600, padding: '0 10px', cursor: 'pointer' }
