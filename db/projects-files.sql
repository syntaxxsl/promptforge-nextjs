-- Çok dosyalı proje desteği.
--
-- Mevcut projeler bozulmaz: yeni alan boş kalırsa uygulama eskisi gibi
-- html_code / css_code / js_code sütunlarını kullanır.
--
-- Supabase > SQL Editor bölümüne yapıştırıp "Run" demek yeterli.

alter table public.projects
  add column if not exists files jsonb default null;

comment on column public.projects.files is
  'Çok dosyalı proje içeriği: [{"path":"index.html","content":"..."}, ...]. Boşsa eski üç sütun geçerlidir.';
