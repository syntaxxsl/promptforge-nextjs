'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('approval_status', 'pending')
    
    if (data) setUsers(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAction = async (userId: string, status: 'approved' | 'rejected') => {
    await supabase.from('users').update({ approval_status: status }).eq('id', userId)
    fetchUsers()
  }

  if (loading) return <div className="p-8 text-white">Yükleniyor...</div>

  return (
    <div className="p-8 bg-[#05070d] min-h-screen text-white">
      <h1 className="text-2xl text-[#25f4ee] mb-6">Admin Paneli - Onay Bekleyenler</h1>
      
      <div className="bg-[#0b111c] border border-[#1e3550] rounded-lg p-4">
        {users.length === 0 ? (
          <p className="text-gray-500">Bekleyen kullanıcı yok.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1e3550]">
                <th className="p-3">E-posta</th>
                <th className="p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[#1e3550]">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => handleAction(u.id, 'approved')} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Onayla</button>
                    <button onClick={() => handleAction(u.id, 'rejected')} className="px-3 py-1 bg-red-600 text-white rounded text-xs">Reddet</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
