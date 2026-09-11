alter table public.control_center_automation_rules
  drop constraint if exists control_center_automation_rules_trigger_type_check;

alter table public.control_center_automation_rules
  add constraint control_center_automation_rules_trigger_type_check
  check (trigger_type in (
    'new_lead',
    'urgent_ticket',
    'appointment_reminder',
    'stale_lead',
    'lead_tag_added',
    'segment_match'
  ));

comment on column public.control_center_automation_rules.conditions is
  'Automation conditions. CRM rules may target tag_ids and segment_ids created by CRM V2.';
