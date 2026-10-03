import { TaskDetailManager } from "@/components/tasks/task-detail-manager";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TaskDetailManager taskId={id} />;
}
