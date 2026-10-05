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

-- Perfil visible solo para el dueño; la contraseña nunca sale de Supabase Auth.
create table if not exists perfil_usuario (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  correo     text not null,
  updated_at timestamptz not null default now()
);

-- Auditoría de altas, accesos, cierres de sesión y eventos compartidos.
create table if not exists registro_actividad (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nombre     text not null,
  correo     text not null,
  accion     text not null check (accion in ('registro', 'inicio_sesion', 'cierre_sesion', 'unirse_evento')),
  evento_id  uuid references evento(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_actividad_usuario_fecha on registro_actividad(user_id, created_at desc);

-- Crea el perfil y registra las cuentas nuevas desde el trigger confiable de Auth.
create or replace function public.sincronizar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_nombre text;
begin
  v_nombre := left(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), 80);
  if v_nombre is null then
    v_nombre := split_part(coalesce(new.email, 'usuario'), '@', 1);
  end if;

  insert into perfil_usuario (user_id, nombre, correo, updated_at)
  values (new.id, v_nombre, coalesce(new.email, ''), now())
  on conflict (user_id) do update set
    nombre = excluded.nombre,
    correo = excluded.correo,
    updated_at = now();

  if tg_op = 'INSERT' then
    insert into registro_actividad (user_id, nombre, correo, accion)
    values (new.id, v_nombre, coalesce(new.email, ''), 'registro');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile on auth.users;
create trigger on_auth_user_profile
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sincronizar_perfil_usuario();

-- Completa perfiles de cuentas creadas antes de esta migración, sin inventar eventos de registro.
insert into perfil_usuario (user_id, nombre, correo)
select
  id,
  coalesce(nullif(left(btrim(raw_user_meta_data->>'full_name'), 80), ''), split_part(coalesce(email, 'usuario'), '@', 1)),
  coalesce(email, '')
from auth.users
on conflict (user_id) do update set
  correo = excluded.correo,
  nombre = coalesce(nullif(left(btrim((select u.raw_user_meta_data->>'full_name' from auth.users u where u.id = excluded.user_id)), 80), ''), perfil_usuario.nombre),
  updated_at = now();

-- Repara solo el perfil del usuario autenticado; el correo nunca se usa como identidad.
create or replace function public.asegurar_perfil_usuario()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_auth_name text;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'Se requiere una sesión';
  end if;

  select u.email, nullif(left(btrim(u.raw_user_meta_data->>'full_name'), 80), '')
  into v_email, v_auth_name
  from auth.users u
  where u.id = v_user_id;

  if not found then
    raise exception 'No se encontró el usuario autenticado en Auth';
  end if;

  v_name := coalesce(v_auth_name, nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'Usuario');
  insert into public.perfil_usuario (user_id, nombre, correo, updated_at)
  values (v_user_id, v_name, coalesce(v_email, ''), now())
  on conflict (user_id) do update set
    nombre = coalesce(v_auth_name, public.perfil_usuario.nombre, excluded.nombre),
    correo = excluded.correo,
    updated_at = now();
end;
$$;

revoke all on function public.asegurar_perfil_usuario() from public, anon, authenticated;
grant execute on function public.asegurar_perfil_usuario() to authenticated;

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
  insert into registro_actividad (user_id, nombre, correo, accion, evento_id)
  select p.user_id, p.nombre, p.correo, 'unirse_evento', new.id
  from perfil_usuario p where p.user_id = new.owner;
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
  if found then
    insert into registro_actividad (user_id, nombre, correo, accion, evento_id)
    select p.user_id, p.nombre, p.correo, 'unirse_evento', _id
    from perfil_usuario p where p.user_id = auth.uid();
  end if;
  return _id;
end;
$$;

-- La app no escribe directamente en el log; el RPC toma la identidad desde auth.uid().
create or replace function public.registrar_actividad_usuario(_accion text, _evento_id uuid default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Se requiere una sesión';
  end if;
  if _accion not in ('inicio_sesion', 'cierre_sesion', 'unirse_evento') then
    raise exception 'Acción no permitida';
  end if;
  if _evento_id is not null and not exists (
    select 1 from evento_miembro where evento_id = _evento_id and user_id = v_user_id
  ) then
    raise exception 'El usuario no pertenece a este evento';
  end if;

  insert into registro_actividad (user_id, nombre, correo, accion, evento_id)
  select p.user_id, p.nombre, p.correo, _accion, _evento_id
  from perfil_usuario p where p.user_id = v_user_id;
  if not found then
    raise exception 'No se encontró el perfil del usuario';
  end if;
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
alter table perfil_usuario     enable row level security;
alter table registro_actividad enable row level security;

drop policy if exists perfil_select_own on perfil_usuario;
create policy perfil_select_own on perfil_usuario for select using (user_id = auth.uid());
drop policy if exists actividad_select_own on registro_actividad;
create policy actividad_select_own on registro_actividad for select using (user_id = auth.uid());
revoke all on perfil_usuario, registro_actividad from anon, authenticated;
grant select on perfil_usuario, registro_actividad to authenticated;
revoke all on function public.registrar_actividad_usuario(text, uuid) from public;
grant execute on function public.registrar_actividad_usuario(text, uuid) to authenticated;

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
-- 4) GUARDADO ATÓMICO Y CONTROL DE CONCURRENCIA
-- Ejecuta esta migración también en proyectos que ya tenían el esquema anterior.
-- ----------------------------------------------------------------------------

alter table evento add column if not exists version bigint not null default 0;

create or replace function public.guardar_evento_snapshot(
  _evento_id uuid,
  _expected_version bigint,
  _data jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_event evento%rowtype;
  v_part jsonb;
  v_expense jsonb;
  v_participant_map jsonb := '{}'::jsonb;
  v_local_participant_id text;
  v_participant_id uuid;
  v_payer_id uuid;
  v_expense_id uuid;
  v_participant_key text;
begin
  if _evento_id is null then
    insert into evento (nombre, fecha, moneda, tip_percent, owner)
    values (
      coalesce(nullif(_data->>'nombre', ''), 'Salida'),
      coalesce(nullif(_data->>'fecha', '')::date, current_date),
      coalesce(nullif(_data->>'moneda', ''), 'CLP'),
      coalesce(nullif(_data->>'tip_percent', '')::numeric, 0),
      auth.uid()
    ) returning * into v_event;
  else
    select * into v_event from evento where id = _evento_id for update;
    if not found then
      raise exception using errcode = '42501', message = 'EVENT_NOT_FOUND_OR_FORBIDDEN';
    end if;
    if _expected_version is null or v_event.version <> _expected_version then
      raise exception using errcode = '40001', message = 'EVENT_CONFLICT';
    end if;
    update evento set
      nombre = coalesce(nullif(_data->>'nombre', ''), 'Salida'),
      fecha = coalesce(nullif(_data->>'fecha', '')::date, current_date),
      moneda = coalesce(nullif(_data->>'moneda', ''), 'CLP'),
      tip_percent = coalesce(nullif(_data->>'tip_percent', '')::numeric, 0),
      version = evento.version + 1
    where id = _evento_id
    returning * into v_event;

    delete from gasto where evento_id = _evento_id;
    delete from participante where evento_id = _evento_id;
  end if;

  for v_part in
    select value from jsonb_array_elements(coalesce(_data->'participantes', '[]'::jsonb)) as items(value)
  loop
    insert into participante (evento_id, nombre, color)
    values (v_event.id, coalesce(nullif(v_part->>'nombre', ''), 'Participante'), nullif(v_part->>'color', ''))
    returning id into v_participant_id;
    v_local_participant_id := v_part->>'id';
    if v_local_participant_id is not null then
      v_participant_map := v_participant_map || jsonb_build_object(v_local_participant_id, v_participant_id);
    end if;
  end loop;

  for v_expense in
    select value from jsonb_array_elements(coalesce(_data->'gastos', '[]'::jsonb)) as items(value)
  loop
    v_payer_id := nullif(v_participant_map->>(v_expense->>'pagado_por'), '')::uuid;
    insert into gasto (evento_id, descripcion, monto, categoria, pagado_por, aplica_propina)
    values (
      v_event.id,
      nullif(v_expense->>'descripcion', ''),
      coalesce(nullif(v_expense->>'monto', '')::bigint, 0),
      coalesce(nullif(v_expense->>'categoria', ''), 'otros'),
      v_payer_id,
      coalesce(nullif(v_expense->>'aplica_propina', '')::boolean, true)
    ) returning id into v_expense_id;

    for v_participant_key in
      select value from jsonb_array_elements_text(coalesce(v_expense->'participantes', '[]'::jsonb)) as ids(value)
    loop
      v_participant_id := nullif(v_participant_map->>v_participant_key, '')::uuid;
      if v_participant_id is not null then
        insert into gasto_participante (gasto_id, participante_id)
        values (v_expense_id, v_participant_id);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('id', v_event.id, 'codigo', v_event.codigo, 'version', v_event.version);
end;
$$;

revoke all on function public.guardar_evento_snapshot(uuid, bigint, jsonb) from public;
grant execute on function public.guardar_evento_snapshot(uuid, bigint, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) REALTIME (para que los cambios de un amigo aparezcan en vivo)
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
