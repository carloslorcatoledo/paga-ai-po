-- ============================================================================
--  Paga aí po!  —  Esquema para Supabase (PostgreSQL)
--  Pega TODO esto en:  Supabase → SQL Editor → New query → Run.
--  Es seguro ejecutarlo más de una vez (usa IF NOT EXISTS / OR REPLACE).
--
--  Modelo (el del plan): evento → participantes → gastos → gasto_participante
--  + evento_miembro, que es lo que permite COMPARTIR un evento entre cuentas.
--
--  Seguridad: RLS (Row Level Security). Cada tabla solo deja ver/editar filas
--  de eventos donde eres miembro. La anon key del cliente es pública a propósito;
--  quien manda es la RLS que definimos aquí abajo.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1) TABLAS
-- ----------------------------------------------------------------------------

create table if not exists evento (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null default 'Salida',
  fecha       date not null default current_date,
  moneda      text not null default 'CLP',
  tip_percent numeric not null default 0,
  codigo      text unique not null default upper(substr(md5(random()::text), 1, 6)), -- código para invitar
  owner       uuid not null references auth.users(id),                                -- quién lo creó
  created_at  timestamptz not null default now()
);

-- Miembros de un evento (quién tiene acceso). El dueño se agrega solo (trigger).
create table if not exists evento_miembro (
  evento_id uuid not null references evento(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  rol       text not null default 'editor' check (rol in ('owner', 'editor')),
  primary key (evento_id, user_id)
);

create table if not exists participante (
  id        uuid primary key default gen_random_uuid(),
  evento_id uuid not null references evento(id) on delete cascade,
  nombre    text not null,
  color     text
);

create table if not exists gasto (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references evento(id) on delete cascade,
  descripcion    text,
  monto          bigint not null,                 -- en unidades mínimas (ej. pesos CLP)
  categoria      text not null default 'otros',
  pagado_por     uuid references participante(id),
  aplica_propina boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists gasto_participante (
  gasto_id        uuid not null references gasto(id) on delete cascade,
  participante_id uuid not null references participante(id) on delete cascade,
  primary key (gasto_id, participante_id)
);

-- Índices para las llaves foráneas (consultas más rápidas)
create index if not exists idx_part_evento   on participante(evento_id);
create index if not exists idx_gasto_evento  on gasto(evento_id);
create index if not exists idx_gp_part       on gasto_participante(participante_id);
create index if not exists idx_miembro_user  on evento_miembro(user_id);

-- ----------------------------------------------------------------------------
-- 2) FUNCIONES DE APOYO (SECURITY DEFINER = evitan recursión en las políticas)
-- ----------------------------------------------------------------------------

-- ¿El usuario actual es miembro de este evento?
create or replace function public.es_miembro(_evento uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from evento_miembro
    where evento_id = _evento and user_id = auth.uid()
  );
$$;

-- ¿Es el dueño del evento?
create or replace function public.es_dueno(_evento uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from evento where id = _evento and owner = auth.uid()
  );
$$;

-- ¿Es miembro del evento al que pertenece este gasto? (para gasto_participante)
create or replace function public.es_miembro_gasto(_gasto uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from gasto g
    join evento_miembro m on m.evento_id = g.evento_id
    where g.id = _gasto and m.user_id = auth.uid()
  );
$$;

-- Al crear un evento, agrega automáticamente al creador como miembro 'owner'.
create or replace function public.agregar_owner_como_miembro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into evento_miembro (evento_id, user_id, rol)
  values (new.id, new.owner, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_owner_miembro on evento;
create trigger trg_owner_miembro
  after insert on evento
  for each row execute function public.agregar_owner_como_miembro();

-- Unirse a un evento con su código (lo llama un amigo desde la app).
create or replace function public.unirse_a_evento(_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  select id into _id from evento where codigo = upper(_codigo);
  if _id is null then
    raise exception 'Código inválido';
  end if;
  insert into evento_miembro (evento_id, user_id, rol)
  values (_id, auth.uid(), 'editor')
  on conflict do nothing;
  return _id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) ACTIVAR RLS Y DEFINIR POLÍTICAS
-- ----------------------------------------------------------------------------

alter table evento             enable row level security;
alter table evento_miembro     enable row level security;
alter table participante       enable row level security;
alter table gasto              enable row level security;
alter table gasto_participante enable row level security;

-- evento
drop policy if exists evento_select on evento;
create policy evento_select on evento for select using (es_miembro(id));
drop policy if exists evento_insert on evento;
create policy evento_insert on evento for insert with check (owner = auth.uid());
drop policy if exists evento_update on evento;
create policy evento_update on evento for update using (es_miembro(id)) with check (es_miembro(id));
drop policy if exists evento_delete on evento;
create policy evento_delete on evento for delete using (es_dueno(id));

-- evento_miembro (inserciones solo vía trigger / unirse_a_evento, que son SECURITY DEFINER)
drop policy if exists miembro_select on evento_miembro;
create policy miembro_select on evento_miembro for select using (es_miembro(evento_id));
drop policy if exists miembro_delete on evento_miembro;
create policy miembro_delete on evento_miembro for delete using (user_id = auth.uid() or es_dueno(evento_id));

-- participante
drop policy if exists part_all on participante;
create policy part_all on participante for all using (es_miembro(evento_id)) with check (es_miembro(evento_id));

-- gasto
drop policy if exists gasto_all on gasto;
create policy gasto_all on gasto for all using (es_miembro(evento_id)) with check (es_miembro(evento_id));

-- gasto_participante
drop policy if exists gp_all on gasto_participante;
create policy gp_all on gasto_participante for all using (es_miembro_gasto(gasto_id)) with check (es_miembro_gasto(gasto_id));

-- ----------------------------------------------------------------------------
-- 4) REALTIME (para que los cambios de un amigo aparezcan en vivo)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['evento','participante','gasto','gasto_participante','evento_miembro'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; -- ya estaba agregada, ignorar
    end;
  end loop;
end $$;

-- ✅ Listo. Las tablas aparecen en Table Editor y la seguridad ya está activa.
