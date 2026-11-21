// File Manager — V2 foundation skeleton.
// Handles text files in DB and binary files in Supabase Storage.

export interface ProjectFile {
  id: string
  projectId: string
  path: string
  content: string | null
  storagePath: string | null
  mimeType: string | null
  sizeBytes: number | null
  isBinary: boolean
}

export interface FileManager {
  list(projectId: string): Promise<ProjectFile[]>
  read(projectId: string, path: string): Promise<ProjectFile | null>
  write(projectId: string, path: string, content: string): Promise<ProjectFile>
  remove(projectId: string, path: string): Promise<void>
  // binary (storage) helpers
  uploadBinary(projectId: string, path: string, file: Blob): Promise<string> // returns storage path
}

export const fileManager: FileManager = {
  async list() { throw new Error('FileManager.list not implemented (V2 foundation).') },
  async read() { throw new Error('FileManager.read not implemented (V2 foundation).') },
  async write() { throw new Error('FileManager.write not implemented (V2 foundation).') },
  async remove() { throw new Error('FileManager.remove not implemented (V2 foundation).') },
  async uploadBinary() { throw new Error('FileManager.uploadBinary not implemented (V2 foundation).') }
}