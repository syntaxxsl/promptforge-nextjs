import { redirect } from 'next/navigation'
import Icon from '@/components/Icon'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function ProfilePage(){
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user)redirect('/login')
 const email=data.user.email||'E-posta bilgisi yok'
 const created=data.user.created_at?new Date(data.user.created_at).toLocaleDateString('tr-TR',{year:'numeric',month:'long',day:'numeric'}):'Bilinmiyor'
 return <main className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-7"><header><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[.18em] text-accent"><Icon name="user" className="h-4 w-4"/> Hesap</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Profilim</h1><p className="mt-1 text-sm text-muted">Hesap bilgilerini görüntüle.</p></header><section className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Icon name="user" className="h-7 w-7"/></div><div><h2 className="text-base font-semibold text-fg">PromptForge hesabı</h2><p className="mt-1 text-sm text-muted">{email}</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-4"><p className="text-xs text-muted">E-posta adresi</p><p className="mt-2 break-all text-sm text-fg">{email}</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs text-muted">Hesap oluşturulma tarihi</p><p className="mt-2 text-sm text-fg">{created}</p></div></div></section><p className="text-xs text-muted">Bu sürüm profil bilgilerini görüntüler. E-posta değiştirme ve profil fotoğrafı ayarları henüz ekli değil.</p></main>
}