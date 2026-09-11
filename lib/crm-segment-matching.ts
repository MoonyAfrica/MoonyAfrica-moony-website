type LeadLike = Record<string, unknown>;
type SegmentFilters = Record<string, unknown>;

function normalized(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("fr");
}

function list(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizedList(value: unknown) {
  return list(value).map((item) => item.toLocaleLowerCase("fr"));
}

export function leadMatchesSegmentFilters(lead: LeadLike, filtersValue: unknown, tagIds: string[] = []) {
  const filters: SegmentFilters = filtersValue && typeof filtersValue === "object" && !Array.isArray(filtersValue)
    ? filtersValue as SegmentFilters
    : {};

  const query = normalized(filters.query);
  if (query) {
    const haystack = [lead.first_name, lead.last_name, lead.email, lead.company, lead.phone, lead.country, lead.city, lead.assigned_to, lead.source]
      .map(normalized)
      .join(" ");
    if (!haystack.includes(query)) return false;
  }

  const statuses = list(filters.statuses);
  if (statuses.length && !statuses.includes(String(lead.status ?? ""))) return false;

  const countries = normalizedList(filters.countries);
  if (countries.length && !countries.includes(normalized(lead.country))) return false;

  const needs = list(filters.needs);
  if (needs.length && !needs.includes(String(lead.need ?? ""))) return false;

  const assignees = normalizedList(filters.assignees);
  if (assignees.length && !assignees.includes(normalized(lead.assigned_to))) return false;

  const sources = normalizedList(filters.sources);
  if (sources.length && !sources.includes(normalized(lead.source))) return false;

  const minRaw = filters.minValue;
  const maxRaw = filters.maxValue;
  const dealValue = Number(lead.deal_value || 0);
  if (minRaw !== undefined && minRaw !== "" && Number.isFinite(Number(minRaw)) && dealValue < Number(minRaw)) return false;
  if (maxRaw !== undefined && maxRaw !== "" && Number.isFinite(Number(maxRaw)) && dealValue > Number(maxRaw)) return false;

  const requiredTags = list(filters.tagIds);
  if (requiredTags.length && !requiredTags.every((tagId) => tagIds.includes(tagId))) return false;

  return true;
}
