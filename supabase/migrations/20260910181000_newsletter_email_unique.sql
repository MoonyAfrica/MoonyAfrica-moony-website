drop index if exists public.newsletter_subscribers_email_idx;

update public.newsletter_subscribers
set email = lower(trim(email));

delete from public.newsletter_subscribers a
using public.newsletter_subscribers b
where a.id > b.id and a.email = b.email;

create unique index if not exists newsletter_subscribers_email_idx
  on public.newsletter_subscribers (email);

comment on index public.newsletter_subscribers_email_idx is 'Newsletter e-mails are normalized to lowercase before insert, allowing safe upsert on email.';
