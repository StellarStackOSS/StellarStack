/**
 * Per-task command-payload shape. We only persist a loose record in
 * `schedule_tasks.payload`, so this is what the scheduler narrows it to
 * before dispatching.
 */
export type SchedulePowerPayload = {
  action: "start" | "stop" | "restart" | "kill"
}

export type ScheduleCommandPayload = {
  line: string
}

export type ScheduleBackupPayload = {
  name?: string
}
