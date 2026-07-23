import { describe, expect, test } from "vitest";
import {
  CONTACTABILITY_REASONS,
  CONTACTABILITY_RULE_NAMES,
  DEFAULT_CONTACTABILITY_RULES,
  DEFAULT_SURVEY_AUDIENCE_FILTERS,
  type TContactabilityContext,
  type TResolvedContactabilityConfig,
} from "@formbricks/types/contactability";
import { ContactabilityEngine, createDefaultContactabilityEngine } from "./index";
import { CooldownRule } from "./rules/cooldown-rule";
import { FatigueScoreRule } from "./rules/fatigue-score-rule";
import type { SegmentEvaluator } from "./types";

const baseRules = (): TResolvedContactabilityConfig => ({
  ...DEFAULT_CONTACTABILITY_RULES,
  cooldown: { enabled: false, period: 7, unit: "days" },
  frequencyLimits: {
    enabled: false,
    perDay: null,
    perWeek: null,
    perMonth: null,
    perYear: null,
  },
  fatigueScore: { enabled: false, maxScore: 80 },
  includedSegments: { ...DEFAULT_SURVEY_AUDIENCE_FILTERS.includedSegments },
  excludedSegments: { ...DEFAULT_SURVEY_AUDIENCE_FILTERS.excludedSegments },
  priority: 0,
});

const createContext = (overrides: Partial<TContactabilityContext> = {}): TContactabilityContext => ({
  survey: { id: "survey_1", priority: 0 },
  contact: { id: "contact_1", fatigueScore: 0 },
  attributes: {},
  invitationHistory: [],
  now: new Date("2026-07-20T12:00:00.000Z"),
  rules: baseRules(),
  ...overrides,
});

const alwaysMatch: SegmentEvaluator = async () => true;
const neverMatch: SegmentEvaluator = async () => false;

describe("ContactabilityEngine", () => {
  test("allows when no rules are enabled", async () => {
    const engine = createDefaultContactabilityEngine(neverMatch);
    const result = await engine.evaluate(createContext());
    expect(result).toEqual({ allowed: true, reason: null, matchedRules: [] });
  });

  test("blocks on cooldown when a recent invitation exists", async () => {
    const engine = createDefaultContactabilityEngine(neverMatch);
    const result = await engine.evaluate(
      createContext({
        invitationHistory: [{ surveyId: "survey_2", sentAt: new Date("2026-07-18T12:00:00.000Z") }],
        rules: {
          ...baseRules(),
          cooldown: { enabled: true, period: 7, unit: "days" },
        },
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(CONTACTABILITY_REASONS.COOLDOWN);
    expect(result.matchedRules).toContain(CONTACTABILITY_RULE_NAMES.COOLDOWN);
  });

  test("allows when cooldown window has elapsed", async () => {
    const engine = createDefaultContactabilityEngine(neverMatch);
    const result = await engine.evaluate(
      createContext({
        invitationHistory: [{ surveyId: "survey_2", sentAt: new Date("2026-07-01T12:00:00.000Z") }],
        rules: {
          ...baseRules(),
          cooldown: { enabled: true, period: 7, unit: "days" },
        },
      })
    );
    expect(result.allowed).toBe(true);
    expect(result.matchedRules).toContain(CONTACTABILITY_RULE_NAMES.COOLDOWN);
  });

  test("blocks when monthly frequency is exceeded", async () => {
    const engine = createDefaultContactabilityEngine(neverMatch);
    const history = [
      { surveyId: "s1", sentAt: new Date("2026-07-10T12:00:00.000Z") },
      { surveyId: "s2", sentAt: new Date("2026-07-12T12:00:00.000Z") },
    ];
    const result = await engine.evaluate(
      createContext({
        invitationHistory: history,
        rules: {
          ...baseRules(),
          frequencyLimits: {
            enabled: true,
            perDay: null,
            perWeek: null,
            perMonth: 2,
            perYear: null,
          },
        },
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(CONTACTABILITY_REASONS.FREQUENCY_MONTH);
  });

  test("blocks when contact does not match included segments", async () => {
    const engine = createDefaultContactabilityEngine(neverMatch);
    const result = await engine.evaluate(
      createContext({
        rules: {
          ...baseRules(),
          includedSegments: {
            enabled: true,
            filters: [
              {
                id: "filter_1",
                connector: null,
                resource: {
                  id: "attr_1",
                  root: { type: "attribute", contactAttributeKey: "vip" },
                  qualifier: { operator: "equals" },
                  value: "true",
                },
              },
            ],
          },
        },
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(CONTACTABILITY_REASONS.INCLUDED_SEGMENT);
  });

  test("blocks when contact matches excluded segments", async () => {
    const engine = createDefaultContactabilityEngine(alwaysMatch);
    const result = await engine.evaluate(
      createContext({
        rules: {
          ...baseRules(),
          excludedSegments: {
            enabled: true,
            filters: [
              {
                id: "filter_1",
                connector: null,
                resource: {
                  id: "attr_1",
                  root: { type: "attribute", contactAttributeKey: "vip" },
                  qualifier: { operator: "equals" },
                  value: "true",
                },
              },
            ],
          },
        },
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(CONTACTABILITY_REASONS.EXCLUDED_SEGMENT);
  });

  test("blocks when a competing survey has higher priority", async () => {
    const engine = createDefaultContactabilityEngine(neverMatch);
    const result = await engine.evaluate(
      createContext({
        survey: { id: "survey_1", priority: 1 },
        competingSurveys: [
          { surveyId: "survey_1", priority: 1 },
          { surveyId: "survey_2", priority: 5 },
        ],
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(CONTACTABILITY_REASONS.PRIORITY);
  });

  test("blocks when fatigue score exceeds the configured limit", async () => {
    const engine = createDefaultContactabilityEngine(neverMatch);
    const result = await engine.evaluate(
      createContext({
        contact: { id: "contact_1", fatigueScore: 90 },
        rules: {
          ...baseRules(),
          fatigueScore: { enabled: true, maxScore: 80 },
        },
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(CONTACTABILITY_REASONS.FATIGUE);
  });

  test("supports injectable rule order", async () => {
    const engine = new ContactabilityEngine([new FatigueScoreRule(), new CooldownRule()]);
    expect(engine.getRuleOrder()).toEqual([
      CONTACTABILITY_RULE_NAMES.FATIGUE,
      CONTACTABILITY_RULE_NAMES.COOLDOWN,
    ]);
  });

  test("returns matched rules on allow when included segments match", async () => {
    const engine = createDefaultContactabilityEngine(alwaysMatch);
    const result = await engine.evaluate(
      createContext({
        rules: {
          ...baseRules(),
          includedSegments: {
            enabled: true,
            filters: [
              {
                id: "filter_1",
                connector: null,
                resource: {
                  id: "attr_1",
                  root: { type: "attribute", contactAttributeKey: "vip" },
                  qualifier: { operator: "equals" },
                  value: "true",
                },
              },
            ],
          },
          priority: 10,
        },
        competingSurveys: [{ surveyId: "survey_1", priority: 10 }],
        survey: { id: "survey_1", priority: 10 },
      })
    );
    expect(result.allowed).toBe(true);
    expect(result.matchedRules).toContain(CONTACTABILITY_RULE_NAMES.INCLUDED_SEGMENT);
    expect(result.matchedRules).toContain(CONTACTABILITY_RULE_NAMES.PRIORITY);
  });
});
