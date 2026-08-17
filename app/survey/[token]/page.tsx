import SurveyForm from "../../components/SurveyForm";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SurveyForm token={token} />;
}
