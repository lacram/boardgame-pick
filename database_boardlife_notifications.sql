-- BoardLife 알림 수집/전송 이력 테이블

create table if not exists external_notifications (
    id bigserial primary key,
    provider text not null,
    external_id text null,
    dedupe_hash text not null,
    title text not null,
    body text null,
    source_url text null,
    occurred_at timestamptz null,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    status text not null default 'new',
    sent_count integer not null default 0,
    first_sent_at timestamptz null,
    last_sent_at timestamptz null,
    raw_payload jsonb null
);

alter table external_notifications add column if not exists status text not null default 'new';
alter table external_notifications add column if not exists sent_count integer not null default 0;
alter table external_notifications add column if not exists first_sent_at timestamptz null;
alter table external_notifications add column if not exists last_sent_at timestamptz null;

create unique index if not exists ux_external_notifications_provider_hash
    on external_notifications(provider, dedupe_hash);

create index if not exists ix_external_notifications_provider_seen
    on external_notifications(provider, first_seen_at desc);

create index if not exists ix_external_notifications_status
    on external_notifications(provider, status, last_seen_at desc);

create table if not exists notification_deliveries (
    id bigserial primary key,
    notification_id bigint not null references external_notifications(id) on delete cascade,
    channel text not null,
    status text not null,
    error_message text null,
    delivered_at timestamptz null,
    created_at timestamptz not null default now()
);

create index if not exists ix_notification_deliveries_notification
    on notification_deliveries(notification_id, created_at desc);
