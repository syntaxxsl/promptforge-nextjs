import SharedProjectView from '@/components/studio/SharedProjectView'
export default async function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <SharedProjectView token={token}/> }
