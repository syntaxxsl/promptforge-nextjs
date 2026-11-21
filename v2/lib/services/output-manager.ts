// Output Manager — V2 foundation skeleton.
// Stores generation outputs (text/image/video/audio/file/code) linked to a generation job.

export type OutputType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'code'

export interface GenerationOutput {
  id: string
  generationId: string
  outputType: OutputType
  content: string | null
  storagePath: string | null
  mimeType: string | null
  sizeBytes: number | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface OutputManager {
  save(output: Omit<GenerationOutput, 'id' | 'createdAt'>): Promise<GenerationOutput>
  list(generationId: string): Promise<GenerationOutput[]>
  get(id: string): Promise<GenerationOutput | null>
}

export const outputManager: OutputManager = {
  async save() { throw new Error('OutputManager.save not implemented (V2 foundation).') },
  async list() { throw new Error('OutputManager.list not implemented (V2 foundation).') },
  async get() { throw new Error('OutputManager.get not implemented (V2 foundation).') }
}