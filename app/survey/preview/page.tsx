import SurveyForm from "../../components/SurveyForm";

export const dynamic = "force-dynamic";

export default async function SurveyPreviewPage({ searchParams }: { searchParams: Promise<{ surveyId?: string }> }) {
  const params = await searchParams;
  const surveyId = Number(params.surveyId);
  return <SurveyForm previewSurveyId={Number.isInteger(surveyId) && surveyId > 0 ? surveyId : 0} />;
}
