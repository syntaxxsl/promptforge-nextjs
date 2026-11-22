-- PromptForge V2 — persist Automation Studio definitions and run history.
-- Apply to the dedicated V2 Supabase database after studio_records exists.
begin;

alter table public.studio_records
  drop constraint if exists studio_records_collection_check;

alter table public.studio_records
  add constraint studio_records_collection_check
  check (collection in (
    'code-workspaces',
    'projects',
    'project-files',
    'project-outputs',
    'project-file-versions',
    'agents',
    'agent-runs',
    'automations',
    'automation-runs',
    'image-jobs',
    'video-jobs',
    'studio-outputs',
    'memories',
    'canvas-boards'
  ));

commit;
