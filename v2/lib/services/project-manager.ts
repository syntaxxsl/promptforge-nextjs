// Project Manager — V2 foundation skeleton.
// TODO: implement against Supabase `projects` / `project_versions` / `project_files`.

export interface Project {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface ProjectManager {
  list(userId: string): Promise<Project[]>
  get(id: string): Promise<Project | null>
  create(userId: string, title: string): Promise<Project>
  update(id: string, patch: Partial<Pick<Project, 'title'>>): Promise<Project>
  softDelete(id: string): Promise<void>
}

export const projectManager: ProjectManager = {
  async list() { throw new Error('ProjectManager.list not implemented (V2 foundation).') },
  async get() { throw new Error('ProjectManager.get not implemented (V2 foundation).') },
  async create() { throw new Error('ProjectManager.create not implemented (V2 foundation).') },
  async update() { throw new Error('ProjectManager.update not implemented (V2 foundation).') },
  async softDelete() { throw new Error('ProjectManager.softDelete not implemented (V2 foundation).') }
}