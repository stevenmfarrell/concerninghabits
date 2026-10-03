import { redirect } from 'next/navigation';

// History now lives on the habit's own page; this keeps old links and bookmarks working
export default async function HistoryRedirect(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/log/${id}`);
}
