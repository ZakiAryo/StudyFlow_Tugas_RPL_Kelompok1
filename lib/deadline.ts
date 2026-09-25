import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";

export type DeadlineState = "due_today" | "due_tomorrow" | "due_this_week" | "overdue" | "upcoming";

export function getDeadlineState(deadline: string, completed = false): DeadlineState {
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(deadline));

  if (!completed && isBefore(dueDate, today)) {
    return "overdue";
  }

  if (isSameDay(dueDate, today)) {
    return "due_today";
  }

  if (isSameDay(dueDate, addDays(today, 1))) {
    return "due_tomorrow";
  }

  if (isAfter(dueDate, today) && !isAfter(dueDate, endOfWeek(today, { weekStartsOn: 1 }))) {
    return "due_this_week";
  }

  return "upcoming";
}

export function getDeadlineLabel(deadline: string, completed = false) {
  const state = getDeadlineState(deadline, completed);
  const dueDate = parseISO(deadline);

  if (state === "overdue") {
    const days = Math.abs(differenceInCalendarDays(dueDate, new Date()));
    return days === 1 ? "Overdue 1 hari" : `Overdue ${days} hari`;
  }

  const labels: Record<DeadlineState, string> = {
    due_today: "Due Today",
    due_tomorrow: "Due Tomorrow",
    due_this_week: "Due This Week",
    overdue: "Overdue",
    upcoming: format(dueDate, "dd MMM yyyy"),
  };

  return labels[state];
}
