import SessionView from '@/components/SessionView';

export default function SessionPage({ params }: { params: { id: string } }) {
  return <SessionView sessionId={params.id} />;
}
