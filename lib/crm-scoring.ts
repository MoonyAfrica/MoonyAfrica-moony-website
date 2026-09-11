export type CrmScoringSettings = {
  stagePoints: Record<string, number>;
  hotThreshold: number;
  warmThreshold: number;
  highValueThreshold: number;
  staleAfterDays: number;
  tagBonusEnabled: boolean;
};

export type CrmScoreResult = {
  score: number;
  temperature: "hot" | "warm" | "cold";
  priority: "urgent" | "high" | "normal" | "low";
  signals: string[];
};

export const DEFAULT_CRM_SCORING_SETTINGS: CrmScoringSettings = {
  stagePoints: {
    new: 8,
    to_contact: 12,
    contacted: 25,
    appointment: 40,
    proposal: 50,
    negotiation: 60,
    won: 100,
    lost: 0,
  },
  hotThreshold: 70,
  warmThreshold: 40,
  highValueThreshold: 10000,
  staleAfterDays: 14,
  tagBonusEnabled: true,
};

function numberBetween(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function normalizeCrmScoringSettings(value: unknown): CrmScoringSettings {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const stageSource = source.stage_points && typeof source.stage_points === "object" && !Array.isArray(source.stage_points)
    ? source.stage_points as Record<string, unknown>
    : source.stagePoints && typeof source.stagePoints === "object" && !Array.isArray(source.stagePoints)
      ? source.stagePoints as Record<string, unknown>
      : {};
  const stagePoints = Object.fromEntries(Object.entries(DEFAULT_CRM_SCORING_SETTINGS.stagePoints).map(([stage, fallback]) => [stage, numberBetween(stageSource[stage], 0, 100, fallback)]));
  const hotThreshold = Math.round(numberBetween(source.hot_threshold ?? source.hotThreshold, 1, 100, DEFAULT_CRM_SCORING_SETTINGS.hotThreshold));
  const warmThreshold = Math.min(hotThreshold - 1, Math.round(numberBetween(source.warm_threshold ?? source.warmThreshold, 0, 99, DEFAULT_CRM_SCORING_SETTINGS.warmThreshold)));
  return {
    stagePoints,
    hotThreshold,
    warmThreshold,
    highValueThreshold: numberBetween(source.high_value_threshold ?? source.highValueThreshold, 0, 1_000_000_000, DEFAULT_CRM_SCORING_SETTINGS.highValueThreshold),
    staleAfterDays: Math.round(numberBetween(source.stale_after_days ?? source.staleAfterDays, 1, 90, DEFAULT_CRM_SCORING_SETTINGS.staleAfterDays)),
    tagBonusEnabled: typeof (source.tag_bonus_enabled ?? source.tagBonusEnabled) === "boolean"
      ? Boolean(source.tag_bonus_enabled ?? source.tagBonusEnabled)
      : DEFAULT_CRM_SCORING_SETTINGS.tagBonusEnabled,
  };
}

function ageDays(value: unknown, now: number) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 86400000)) : Number.POSITIVE_INFINITY;
}

export function scoreCrmLead(
  lead: Record<string, unknown>,
  options: { settings?: CrmScoringSettings; tagCount?: number; overdueTasks?: number; now?: number } = {},
): CrmScoreResult {
  const settings = options.settings ?? DEFAULT_CRM_SCORING_SETTINGS;
  const status = String(lead.status ?? "new");
  if (status === "won") return { score: 100, temperature: "hot", priority: "urgent", signals: ["Opportunité signée"] };
  if (status === "lost") return { score: 0, temperature: "cold", priority: "low", signals: ["Opportunité perdue"] };

  const signals: string[] = [];
  let score = numberBetween(settings.stagePoints[status], 0, 70, 0);
  if (score > 0) signals.push(`Étape commerciale : +${score}`);

  const dealValue = Math.max(0, Number(lead.deal_value ?? 0) || 0);
  if (dealValue > 0) {
    const ratio = settings.highValueThreshold > 0 ? dealValue / settings.highValueThreshold : 1;
    const valuePoints = ratio >= 1 ? 20 : ratio >= 0.5 ? 12 : 5;
    score += valuePoints;
    signals.push(`Valeur opportunité : +${valuePoints}`);
  }

  const now = options.now ?? Date.now();
  const lastContactDays = ageDays(lead.last_contacted_at, now);
  const createdDays = ageDays(lead.created_at, now);
  if (Number.isFinite(lastContactDays)) {
    const freshness = lastContactDays <= 3 ? 10 : lastContactDays <= 7 ? 8 : lastContactDays <= 14 ? 5 : lastContactDays <= 30 ? 2 : 0;
    if (freshness) { score += freshness; signals.push(`Contact récent : +${freshness}`); }
    if (lastContactDays >= settings.staleAfterDays) { score -= 8; signals.push(`Sans contact depuis ${lastContactDays} j : -8`); }
  } else if (createdDays <= 2) {
    score += 4;
    signals.push("Lead entrant récent : +4");
  }

  let completeness = 0;
  if (lead.company) completeness += 3;
  if (lead.phone) completeness += 2;
  if (lead.country) completeness += 1;
  if (lead.assigned_to) completeness += 3;
  if (lead.need && String(lead.need) !== "autre") completeness += 1;
  if (completeness) { score += completeness; signals.push(`Dossier renseigné : +${completeness}`); }

  const tagCount = Math.max(0, Number(options.tagCount ?? 0));
  if (settings.tagBonusEnabled && tagCount > 0) {
    const tagPoints = tagCount >= 2 ? 8 : 5;
    score += tagPoints;
    signals.push(`Ciblage CRM : +${tagPoints}`);
  }

  const overdueTasks = Math.max(0, Number(options.overdueTasks ?? 0));
  if (overdueTasks > 0) {
    const penalty = Math.min(15, overdueTasks * 5);
    score -= penalty;
    signals.push(`${overdueTasks} relance(s) en retard : -${penalty}`);
  }

  score = Math.round(Math.max(0, Math.min(100, score)));
  const temperature = score >= settings.hotThreshold ? "hot" : score >= settings.warmThreshold ? "warm" : "cold";
  const priority = score >= 85 ? "urgent" : temperature === "hot" ? "high" : temperature === "warm" ? "normal" : "low";
  return { score, temperature, priority, signals };
}
