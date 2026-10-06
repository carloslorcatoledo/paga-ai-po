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
  nombre      text not null default 'Evento',
  fecha       date not null default current_date,
  moneda      text not null default 'CLP',
  tip_percent numeric not null default 0,
  codigo      text unique not null default upper(substr(md5(random()::text), 1, 6)), -- código para invitar
  owner       uuid not null references auth.users(id),                                -- quién lo creó
  created_at  timestamptz not null default now()
);
alter table evento alter column nombre set default 'Evento';

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
  color     text,
  orden     integer not null default 0
);

create table if not exists gasto (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references evento(id) on delete cascade,
  descripcion    text,
  monto          bigint not null,                 -- en unidades mínimas (ej. pesos CLP)
  categoria      text not null default 'otros',
  pagado_por     uuid references participante(id),
  aplica_propina boolean not null default true,
  created_at     timestamptz not null default now(),
  orden          integer not null default 0
);

create table if not exists gasto_participante (
  gasto_id        uuid not null references gasto(id) on delete cascade,
  participante_id uuid not null references participante(id) on delete cascade,
  orden           integer not null default 0,
  primary key (gasto_id, participante_id)
);

-- Índices para las llaves foráneas (consultas más rápidas)
create index if not exists idx_part_evento   on participante(evento_id);
create index if not exists idx_gasto_evento  on gasto(evento_id);
create index if not exists idx_gp_part       on gasto_participante(participante_id);
create index if not exists idx_miembro_user  on evento_miembro(user_id);

-- Identificador estable del participante generado por el cliente. El snapshot
-- puede recrear la fila SQL, pero los pagos siguen ligados a esta clave.
alter table participante add column if not exists client_key text;
alter table participante add column if not exists orden integer not null default 0;
update participante set client_key = id::text where client_key is null or client_key = '';
with positions as (
  select id, row_number() over (partition by evento_id order by id)::integer as orden
  from participante where orden = 0
)
update participante p set orden = positions.orden from positions where p.id = positions.id;
alter table participante alter column client_key set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'participante_evento_client_key_key'
      and conrelid = 'public.participante'::regclass
  ) then
    alter table participante add constraint participante_evento_client_key_key unique (evento_id, client_key);
  end if;
end $$;

alter table gasto add column if not exists orden integer not null default 0;
with positions as (
  select id, row_number() over (partition by evento_id order by created_at, id)::integer as orden
  from gasto where orden = 0
)
update gasto g set orden = positions.orden from positions where g.id = positions.id;
alter table gasto_participante add column if not exists orden integer not null default 0;
with positions as (
  select gp.gasto_id, gp.participante_id,
    row_number() over (partition by gp.gasto_id order by p.orden, p.id)::integer as orden
  from gasto_participante gp
  join participante p on p.id = gp.participante_id
  where gp.orden = 0
)
update gasto_participante gp set orden = positions.orden
from positions
where gp.gasto_id = positions.gasto_id and gp.participante_id = positions.participante_id;

alter table evento add column if not exists financial_fingerprint text;

create table if not exists transferencia_pago (
  evento_id uuid not null references evento(id) on delete cascade,
  pagador_key text not null,
  receptor_key text not null,
  monto_deuda bigint not null check (monto_deuda > 0),
  monto_pagado bigint not null default 0 check (monto_pagado >= 0 and monto_pagado <= monto_deuda),
  financial_fingerprint text not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (evento_id, pagador_key, receptor_key),
  check (pagador_key <> receptor_key)
);

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

-- Activación única del periodo de prueba. Reejecutar este esquema no reinicia el plazo.
create table if not exists configuracion_trial (
  singleton boolean primary key default true check (singleton),
  activated_at timestamptz not null default now()
);
-- Extensiones de acceso confirmadas manualmente por el administrador desde SQL Editor.
create table if not exists acceso_pagado (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  paid_until timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table configuracion_trial enable row level security;
alter table acceso_pagado enable row level security;
revoke all on configuracion_trial, acceso_pagado from public, anon, authenticated;

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
set search_path = pg_catalog
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

-- Trial de 30 días por cuenta: las cuentas previas reciben 30 días desde la activación.
create or replace function public.puede_escribir_cloud()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_created_at timestamptz;
  v_activated_at timestamptz;
  v_paid_until timestamptz;
begin
  if auth.uid() is null then
    return false;
  end if;

  select u.created_at, c.activated_at, p.paid_until
  into v_created_at, v_activated_at, v_paid_until
  from auth.users u
  cross join public.configuracion_trial c
  left join public.acceso_pagado p on p.user_id = u.id
  where u.id = auth.uid() and c.singleton;

  if not found then
    return false;
  end if;

  return now() < greatest(v_created_at, v_activated_at) + interval '30 days'
    or coalesce(v_paid_until > now(), false);
end;
$$;

create or replace function public.estado_acceso_cloud()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_created_at timestamptz;
  v_activated_at timestamptz;
  v_paid_until timestamptz;
  v_trial_ends_at timestamptz;
  v_status text;
  v_access_until timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión';
  end if;

  select u.created_at, c.activated_at, p.paid_until
  into v_created_at, v_activated_at, v_paid_until
  from auth.users u
  cross join public.configuracion_trial c
  left join public.acceso_pagado p on p.user_id = u.id
  where u.id = auth.uid() and c.singleton;

  if not found then
    raise exception using errcode = '42501', message = 'No se encontró la cuenta';
  end if;

  v_trial_ends_at := greatest(v_created_at, v_activated_at) + interval '30 days';
  v_access_until := greatest(v_trial_ends_at, coalesce(v_paid_until, '-infinity'::timestamptz));
  v_status := case
    when now() < v_trial_ends_at then 'trial'
    when v_paid_until > now() then 'paid'
    else 'expired'
  end;

  return jsonb_build_object(
    'status', v_status,
    'trial_ends_at', v_trial_ends_at,
    'access_until', v_access_until,
    'days_remaining', case when v_status = 'expired' then 0 else greatest(0, ceil(extract(epoch from (v_access_until - now())) / 86400)::integer) end,
    'can_write', v_status <> 'expired'
  );
end;
$$;

revoke all on function public.puede_escribir_cloud() from public, anon;
grant execute on function public.puede_escribir_cloud() to authenticated;
revoke all on function public.estado_acceso_cloud() from public, anon;
grant execute on function public.estado_acceso_cloud() to authenticated;

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
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión';
  end if;
  if not public.puede_escribir_cloud() then
    raise exception using errcode = 'P0001', message = 'CLOUD_TRIAL_EXPIRED';
  end if;
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
revoke all on function public.unirse_a_evento(text) from public, anon;
grant execute on function public.unirse_a_evento(text) to authenticated;

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
alter table transferencia_pago enable row level security;
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
create policy evento_insert on evento for insert with check (owner = auth.uid() and puede_escribir_cloud());
drop policy if exists evento_update on evento;
create policy evento_update on evento for update using (es_miembro(id) and puede_escribir_cloud()) with check (es_miembro(id) and puede_escribir_cloud());
drop policy if exists evento_delete on evento;
create policy evento_delete on evento for delete using (es_dueno(id) and puede_escribir_cloud());

-- evento_miembro (inserciones solo vía trigger / unirse_a_evento, que son SECURITY DEFINER)
drop policy if exists miembro_select on evento_miembro;
create policy miembro_select on evento_miembro for select using (es_miembro(evento_id));
drop policy if exists miembro_delete on evento_miembro;
create policy miembro_delete on evento_miembro for delete using ((user_id = auth.uid() or es_dueno(evento_id)) and puede_escribir_cloud());

-- participante
drop policy if exists part_all on participante;
drop policy if exists part_select on participante;
drop policy if exists part_insert on participante;
drop policy if exists part_update on participante;
drop policy if exists part_delete on participante;
create policy part_select on participante for select using (es_miembro(evento_id));
create policy part_insert on participante for insert with check (es_miembro(evento_id) and puede_escribir_cloud());
create policy part_update on participante for update using (es_miembro(evento_id) and puede_escribir_cloud()) with check (es_miembro(evento_id) and puede_escribir_cloud());
create policy part_delete on participante for delete using (es_miembro(evento_id) and puede_escribir_cloud());

-- gasto
drop policy if exists gasto_all on gasto;
drop policy if exists gasto_select on gasto;
drop policy if exists gasto_insert on gasto;
drop policy if exists gasto_update on gasto;
drop policy if exists gasto_delete on gasto;
create policy gasto_select on gasto for select using (es_miembro(evento_id));
create policy gasto_insert on gasto for insert with check (es_miembro(evento_id) and puede_escribir_cloud());
create policy gasto_update on gasto for update using (es_miembro(evento_id) and puede_escribir_cloud()) with check (es_miembro(evento_id) and puede_escribir_cloud());
create policy gasto_delete on gasto for delete using (es_miembro(evento_id) and puede_escribir_cloud());

-- gasto_participante
drop policy if exists gp_all on gasto_participante;
drop policy if exists gp_select on gasto_participante;
drop policy if exists gp_insert on gasto_participante;
drop policy if exists gp_update on gasto_participante;
drop policy if exists gp_delete on gasto_participante;
create policy gp_select on gasto_participante for select using (es_miembro_gasto(gasto_id));
create policy gp_insert on gasto_participante for insert with check (es_miembro_gasto(gasto_id) and puede_escribir_cloud());
create policy gp_update on gasto_participante for update using (es_miembro_gasto(gasto_id) and puede_escribir_cloud()) with check (es_miembro_gasto(gasto_id) and puede_escribir_cloud());
create policy gp_delete on gasto_participante for delete using (es_miembro_gasto(gasto_id) and puede_escribir_cloud());

-- Todas las mutaciones de eventos pasan por RPCs protegidas, pero la lectura sigue directa.
revoke all on public.evento, public.evento_miembro, public.participante, public.gasto, public.gasto_participante from public, anon, authenticated;
grant select on public.evento, public.evento_miembro, public.participante, public.gasto, public.gasto_participante to authenticated;

-- Los miembros pueden consultar el estado; solo las RPC SECURITY DEFINER lo editan.
drop policy if exists transferencia_pago_select_member on transferencia_pago;
create policy transferencia_pago_select_member on transferencia_pago
  for select using (es_miembro(evento_id));
revoke all on transferencia_pago from anon, authenticated;
grant select on transferencia_pago to authenticated;

-- ----------------------------------------------------------------------------
-- 4) GUARDADO ATÓMICO Y CONTROL DE CONCURRENCIA
-- Ejecuta esta migración también en proyectos que ya tenían el esquema anterior.
-- ----------------------------------------------------------------------------

alter table evento add column if not exists version bigint not null default 0;
alter table evento add column if not exists version bigint not null default 0;

create or replace function public.firma_financiera_evento(_data jsonb)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(jsonb_build_object(
    'moneda', coalesce(nullif(_data->>'moneda', ''), 'CLP'),
    'tip_percent', coalesce(nullif(_data->>'tip_percent', '')::numeric, 0),
    'participantes', coalesce((
      select jsonb_agg(value->>'id' order by ordinal)
      from jsonb_array_elements(coalesce(_data->'participantes', '[]'::jsonb)) with ordinality as participant_item(value, ordinal)
    ), '[]'::jsonb),
    'gastos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'monto', coalesce(nullif(value->>'monto', '')::bigint, 0),
        'pagado_por', value->>'pagado_por',
        'aplica_propina', coalesce(nullif(value->>'aplica_propina', '')::boolean, true),
        'participantes', coalesce(value->'participantes', '[]'::jsonb)
      ) order by ordinal)
      from jsonb_array_elements(coalesce(_data->'gastos', '[]'::jsonb)) with ordinality as expense_item(value, ordinal)
    ), '[]'::jsonb)
  )::text, 'sha256'), 'hex');
$$;

create or replace function public.firma_financiera_evento_db(_evento_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select public.firma_financiera_evento(jsonb_build_object(
    'moneda', e.moneda,
    'tip_percent', e.tip_percent,
    'participantes', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.client_key) order by p.orden, p.id)
      from participante p where p.evento_id = e.id
    ), '[]'::jsonb),
    'gastos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'monto', g.monto,
        'pagado_por', payer.client_key,
        'aplica_propina', g.aplica_propina,
        'participantes', coalesce((
          select jsonb_agg(p.client_key order by gp.orden, p.orden, p.client_key)
          from gasto_participante gp
          join participante p on p.id = gp.participante_id
          where gp.gasto_id = g.id
        ), '[]'::jsonb)
      ) order by g.orden, g.id)
      from gasto g
      left join participante payer on payer.id = g.pagado_por
      where g.evento_id = e.id
    ), '[]'::jsonb)
  ))
  from evento e where e.id = _evento_id;
$$;

update evento e
set financial_fingerprint = public.firma_financiera_evento_db(e.id)
where e.financial_fingerprint is null;

create or replace function public.guardar_evento_snapshot(
  _evento_id uuid,
  _expected_version bigint,
  _data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event evento%rowtype;
  v_part jsonb;
  v_expense jsonb;
  v_participant_row record;
  v_expense_row record;
  v_split_row record;
  v_participant_map jsonb := '{}'::jsonb;
  v_local_participant_id text;
  v_participant_id uuid;
  v_payer_id uuid;
  v_expense_id uuid;
  v_participant_key text;
  v_position integer;
  v_financial_fingerprint text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión';
  end if;
  if not public.puede_escribir_cloud() then
    raise exception using errcode = 'P0001', message = 'CLOUD_TRIAL_EXPIRED';
  end if;
  if _evento_id is not null and not es_miembro(_evento_id) then
    raise exception using errcode = '42501', message = 'EVENT_NOT_FOUND_OR_FORBIDDEN';
  end if;
  v_financial_fingerprint := public.firma_financiera_evento(_data);
  if _evento_id is null then
    insert into evento (nombre, fecha, moneda, tip_percent, owner, financial_fingerprint)
    values (
      coalesce(nullif(_data->>'nombre', ''), 'Evento'),
      coalesce(nullif(_data->>'fecha', '')::date, current_date),
      coalesce(nullif(_data->>'moneda', ''), 'CLP'),
      coalesce(nullif(_data->>'tip_percent', '')::numeric, 0),
      auth.uid(),
      v_financial_fingerprint
    ) returning * into v_event;
  else
    select * into v_event from evento where id = _evento_id for update;
    if not found then
      raise exception using errcode = '42501', message = 'EVENT_NOT_FOUND_OR_FORBIDDEN';
    end if;
    if _expected_version is null or v_event.version <> _expected_version then
      raise exception using errcode = '40001', message = 'EVENT_CONFLICT';
    end if;
    if v_event.financial_fingerprint is distinct from v_financial_fingerprint then
      delete from transferencia_pago where evento_id = _evento_id;
    end if;
    update evento set
      nombre = coalesce(nullif(_data->>'nombre', ''), 'Evento'),
      fecha = coalesce(nullif(_data->>'fecha', '')::date, current_date),
      moneda = coalesce(nullif(_data->>'moneda', ''), 'CLP'),
      tip_percent = coalesce(nullif(_data->>'tip_percent', '')::numeric, 0),
      financial_fingerprint = v_financial_fingerprint,
      version = evento.version + 1
    where id = _evento_id
    returning * into v_event;

    delete from gasto where evento_id = _evento_id;
    delete from participante where evento_id = _evento_id;
  end if;

  for v_participant_row in
    select value, ordinal from jsonb_array_elements(coalesce(_data->'participantes', '[]'::jsonb)) with ordinality as items(value, ordinal)
  loop
    v_part := v_participant_row.value;
    v_position := v_participant_row.ordinal;
    v_local_participant_id := coalesce(nullif(v_part->>'id', ''), nullif(v_part->>'client_key', ''));
    if v_local_participant_id is null then
      raise exception 'Falta la clave estable del participante';
    end if;
    insert into participante (evento_id, client_key, nombre, color, orden)
    values (v_event.id, v_local_participant_id, coalesce(nullif(v_part->>'nombre', ''), 'Participante'), nullif(v_part->>'color', ''), v_position)
    returning id into v_participant_id;
    v_participant_map := v_participant_map || jsonb_build_object(v_local_participant_id, v_participant_id);
  end loop;

  for v_expense_row in
    select value, ordinal from jsonb_array_elements(coalesce(_data->'gastos', '[]'::jsonb)) with ordinality as items(value, ordinal)
  loop
    v_expense := v_expense_row.value;
    v_position := v_expense_row.ordinal;
    v_payer_id := nullif(v_participant_map->>(v_expense->>'pagado_por'), '')::uuid;
    insert into gasto (evento_id, descripcion, monto, categoria, pagado_por, aplica_propina, orden)
    values (
      v_event.id,
      nullif(v_expense->>'descripcion', ''),
      coalesce(nullif(v_expense->>'monto', '')::bigint, 0),
      coalesce(nullif(v_expense->>'categoria', ''), 'otros'),
      v_payer_id,
      coalesce(nullif(v_expense->>'aplica_propina', '')::boolean, true),
      v_position
    ) returning id into v_expense_id;

    for v_split_row in
      select value, ordinal from jsonb_array_elements_text(coalesce(v_expense->'participantes', '[]'::jsonb)) with ordinality as ids(value, ordinal)
    loop
      v_participant_key := v_split_row.value;
      v_participant_id := nullif(v_participant_map->>v_participant_key, '')::uuid;
      if v_participant_id is not null then
        insert into gasto_participante (gasto_id, participante_id, orden)
        values (v_expense_id, v_participant_id, v_split_row.ordinal);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('id', v_event.id, 'codigo', v_event.codigo, 'version', v_event.version, 'owner', v_event.owner, 'financial_fingerprint', v_financial_fingerprint);
end;
$$;

revoke all on function public.guardar_evento_snapshot(uuid, bigint, jsonb) from public;
grant execute on function public.guardar_evento_snapshot(uuid, bigint, jsonb) to authenticated;

create or replace function public.obtener_pagos_transferencia(_evento_id uuid)
returns table (
  pagador_key text,
  receptor_key text,
  monto_deuda bigint,
  monto_pagado bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fingerprint text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión';
  end if;

  select e.financial_fingerprint into v_fingerprint
  from evento e
  where e.id = _evento_id and es_miembro(e.id);
  if not found then
    raise exception using errcode = '42501', message = 'EVENT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  return query
  select p.pagador_key, p.receptor_key, p.monto_deuda, p.monto_pagado, p.updated_at
  from transferencia_pago p
  where p.evento_id = _evento_id and p.financial_fingerprint = v_fingerprint;
end;
$$;

revoke all on function public.obtener_pagos_transferencia(uuid) from public, anon;
grant execute on function public.obtener_pagos_transferencia(uuid) to authenticated;

create or replace function public.actualizar_pago_transferencia(
  _evento_id uuid,
  _pagador_key text,
  _receptor_key text,
  _monto_deuda bigint,
  _monto_pagado bigint,
  _financial_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_fingerprint text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión';
  end if;
  if not public.puede_escribir_cloud() then
    raise exception using errcode = 'P0001', message = 'CLOUD_TRIAL_EXPIRED';
  end if;

  select e.owner, e.financial_fingerprint into v_owner, v_fingerprint
  from evento e where e.id = _evento_id for update;
  if not found or v_owner <> auth.uid() then
    raise exception using errcode = '42501', message = 'Solo el creador puede actualizar los pagos';
  end if;
  if v_fingerprint is null then
    raise exception using errcode = '40001', message = 'PAYMENT_FINGERPRINT_MISSING';
  elsif v_fingerprint <> _financial_fingerprint then
    raise exception using errcode = '40001', message = 'PAYMENT_EVENT_CHANGED';
  end if;
  if _pagador_key is null or _receptor_key is null or _pagador_key = _receptor_key
    or _monto_deuda is null or _monto_deuda <= 0
    or _monto_pagado is null or _monto_pagado < 0 or _monto_pagado > _monto_deuda then
    raise exception using errcode = '22023', message = 'PAYMENT_AMOUNT_INVALID';
  end if;
  if not exists (select 1 from participante where evento_id = _evento_id and client_key = _pagador_key)
    or not exists (select 1 from participante where evento_id = _evento_id and client_key = _receptor_key) then
    raise exception using errcode = '22023', message = 'PAYMENT_PARTICIPANT_INVALID';
  end if;

  if _monto_pagado = 0 then
    delete from transferencia_pago
    where evento_id = _evento_id and pagador_key = _pagador_key and receptor_key = _receptor_key;
  else
    insert into transferencia_pago (
      evento_id, pagador_key, receptor_key, monto_deuda, monto_pagado, financial_fingerprint, updated_by, updated_at
    ) values (
      _evento_id, _pagador_key, _receptor_key, _monto_deuda, _monto_pagado, v_fingerprint, auth.uid(), now()
    )
    on conflict (evento_id, pagador_key, receptor_key) do update set
      monto_deuda = excluded.monto_deuda,
      monto_pagado = excluded.monto_pagado,
      financial_fingerprint = excluded.financial_fingerprint,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object('pagador_key', _pagador_key, 'receptor_key', _receptor_key, 'monto_deuda', _monto_deuda, 'monto_pagado', _monto_pagado);
end;
$$;

revoke all on function public.actualizar_pago_transferencia(uuid, text, text, bigint, bigint, text) from public, anon;
grant execute on function public.actualizar_pago_transferencia(uuid, text, text, bigint, bigint, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) REALTIME (para que los cambios de un amigo aparezcan en vivo)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['evento','participante','gasto','gasto_participante','evento_miembro','transferencia_pago'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; -- ya estaba agregada, ignorar
    end;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6) ESTADISTICAS ADMINISTRATIVAS (solo agregados; sin acceso global a tablas)
-- ----------------------------------------------------------------------------

create or replace function public.admin_estadisticas()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_email text;
  v_email_confirmed_at timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Acceso administrativo denegado';
  end if;

  select lower(btrim(u.email)), u.email_confirmed_at
  into v_email, v_email_confirmed_at
  from auth.users u
  where u.id = auth.uid();

  if not found or v_email is distinct from 'lorcarlos@gmail.com' or v_email_confirmed_at is null then
    raise exception using errcode = '42501', message = 'Acceso administrativo denegado';
  end if;

  with days as (
    select (current_date - series.day_offset)::date as day
    from generate_series(29, 0, -1) as series(day_offset)
  ), registrations as (
    select (a.created_at at time zone 'UTC')::date as day, count(*) as total
    from public.registro_actividad a
    where a.accion = 'registro'
      and a.created_at >= (current_date - 29)::timestamp at time zone 'UTC'
      and a.created_at < (current_date + 1)::timestamp at time zone 'UTC'
    group by 1
  ), event_creations as (
    select (e.created_at at time zone 'UTC')::date as day, count(*) as total
    from public.evento e
    where e.created_at >= (current_date - 29)::timestamp at time zone 'UTC'
      and e.created_at < (current_date + 1)::timestamp at time zone 'UTC'
    group by 1
  ), recorded_activity as (
    select (a.created_at at time zone 'UTC')::date as day, count(distinct a.user_id) as total
    from public.registro_actividad a
    where a.created_at >= (current_date - 29)::timestamp at time zone 'UTC'
      and a.created_at < (current_date + 1)::timestamp at time zone 'UTC'
    group by 1
  ), amount_totals as (
    select e.moneda as currency, sum(g.monto) as amount
    from public.gasto g
    join public.evento e on e.id = g.evento_id
    group by e.moneda
  )
  select jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'accounts', (select count(*) from auth.users),
      'events', (select count(*) from public.evento),
      'participants', (select count(*) from public.participante),
      'expenses', (select count(*) from public.gasto),
      'amounts_by_currency', coalesce((
        select jsonb_agg(jsonb_build_object('currency', a.currency, 'amount', a.amount) order by a.currency)
        from amount_totals a
      ), '[]'::jsonb)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'registrations', coalesce(r.total, 0),
        'events', coalesce(e.total, 0),
        'active_accounts', coalesce(a.total, 0)
      ) order by d.day)
      from days d
      left join registrations r on r.day = d.day
      left join event_creations e on e.day = d.day
      left join recorded_activity a on a.day = d.day
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_estadisticas() from public, anon;
grant execute on function public.admin_estadisticas() to authenticated;

insert into public.configuracion_trial (singleton) values (true) on conflict (singleton) do nothing;

-- ✅ Listo. Las tablas aparecen en Table Editor y la seguridad ya está activa.
