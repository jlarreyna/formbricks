import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  TResponseAnalysis,
  TResponseAnalysisCustomerEffort,
  TResponseAnalysisSeverity,
} from "@formbricks/types/response-analysis";
import { CHART_SENTIMENT_COLORS } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { ResponseBadges } from "@/modules/ui/components/response-badges";

interface ResponseAnalysisSectionProps {
  analysis?: TResponseAnalysis | null;
}

// Explicit switch (rather than a templated translation key) so the i18n key scanner can
// statically discover each `ai_analysis_level_*` key used here.
const getLevelLabel = (level: TResponseAnalysisSeverity | TResponseAnalysisCustomerEffort, t: TFunction) => {
  switch (level) {
    case "low":
      return t("workspace.surveys.responses.ai_analysis_level_low");
    case "medium":
      return t("workspace.surveys.responses.ai_analysis_level_medium");
    case "high":
      return t("workspace.surveys.responses.ai_analysis_level_high");
  }
};

/**
 * Displays the unattended AI analysis of a survey response (sentiment, severity, categories,
 * recommended routing, etc). Renders nothing until the background job that produces the
 * analysis (see processResponseAnalysisJob) has completed for this response.
 */
export const ResponseAnalysisSection = ({ analysis }: ResponseAnalysisSectionProps) => {
  const { t } = useTranslation();

  if (!analysis) return null;

  const levelLabel = (level: TResponseAnalysisSeverity | TResponseAnalysisCustomerEffort): string =>
    getLevelLabel(level, t);

  return (
    <div
      data-testid="response-analysis-section"
      className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-600">{t("workspace.surveys.responses.ai_analysis")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-white"
          style={{ backgroundColor: CHART_SENTIMENT_COLORS[analysis.sentiment] }}>
          {t(`workspace.analysis.charts.sentiment_value_${analysis.sentiment}`)}
        </span>
        <ResponseBadges items={[{ value: analysis.emotion }]} showId={false} />
        <ResponseBadges
          items={[
            {
              value: `${t("workspace.surveys.responses.ai_analysis_severity")}: ${levelLabel(analysis.severity)}`,
            },
          ]}
          showId={false}
        />
        <ResponseBadges
          items={[
            {
              value: `${t("workspace.surveys.responses.ai_analysis_customer_effort")}: ${levelLabel(analysis.customerEffort)}`,
            },
          ]}
          showId={false}
        />
        <ResponseBadges
          items={[
            {
              value: `${t("workspace.surveys.responses.ai_analysis_confidence")}: ${Math.round(analysis.confidence * 100)}%`,
            },
          ]}
          showId={false}
        />
        {analysis.requiresFollowup && (
          <ResponseBadges
            items={[{ value: t("workspace.surveys.responses.ai_analysis_requires_followup") }]}
            showId={false}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {t("workspace.surveys.responses.ai_analysis_recommended_department")}
          </p>
          <p className="text-sm text-slate-700">{analysis.recommendedDepartment}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">
            {t("workspace.surveys.responses.ai_analysis_recommended_priority")}
          </p>
          <p className="text-sm text-slate-700">{analysis.recommendedPriority}</p>
        </div>
      </div>

      {analysis.categories.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500">
            {t("workspace.surveys.responses.ai_analysis_categories")}
          </p>
          <ResponseBadges
            items={analysis.categories.map((category) => ({ value: category }))}
            showId={false}
          />
        </div>
      )}

      {analysis.topics.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500">
            {t("workspace.surveys.responses.ai_analysis_topics")}
          </p>
          <ResponseBadges items={analysis.topics.map((topic) => ({ value: topic }))} showId={false} />
        </div>
      )}

      {analysis.keywords.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500">
            {t("workspace.surveys.responses.ai_analysis_keywords")}
          </p>
          <ResponseBadges items={analysis.keywords.map((keyword) => ({ value: keyword }))} showId={false} />
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-500">
          {t("workspace.surveys.responses.ai_analysis_summary")}
        </p>
        <p className="text-sm text-slate-700">{analysis.summary}</p>
      </div>
    </div>
  );
};
