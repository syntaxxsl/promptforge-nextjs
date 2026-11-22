-- PromptForge V2 — persist Automation Studio definitions and run history.
-- This migration intentionally follows 20261122_studio_records.sql because
-- it extends that table's collection allow-list. Apply after the base table.
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
