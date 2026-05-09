-- Schedules: replace flat task list with a node + edge graph.
--
-- Each existing `schedule_tasks` row becomes either an `action` node or
-- (when `delay_seconds > 0`) a `wait.delay` node followed by the action
-- node. A `trigger.cron` node is prepended per schedule. Edges chain the
-- nodes in `sort_order`, preserving sequential semantics.

CREATE TABLE "schedule_nodes" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "schedule_id" uuid NOT NULL REFERENCES "schedules"("id") ON DELETE CASCADE,
  "kind"        text NOT NULL CHECK ("kind" IN ('trigger', 'action', 'wait')),
  "subtype"     text NOT NULL,
  "payload"     jsonb,
  "position"    jsonb NOT NULL DEFAULT '{"x":0,"y":0}'::jsonb,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "schedule_nodes_schedule_id_idx" ON "schedule_nodes" ("schedule_id");

CREATE TABLE "schedule_edges" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "schedule_id"  uuid NOT NULL REFERENCES "schedules"("id") ON DELETE CASCADE,
  "from_node_id" uuid NOT NULL REFERENCES "schedule_nodes"("id") ON DELETE CASCADE,
  "to_node_id"   uuid NOT NULL REFERENCES "schedule_nodes"("id") ON DELETE CASCADE,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "schedule_edges_unique_pair" UNIQUE ("from_node_id", "to_node_id")
);

CREATE INDEX "schedule_edges_schedule_id_idx" ON "schedule_edges" ("schedule_id");
CREATE INDEX "schedule_edges_from_node_id_idx" ON "schedule_edges" ("from_node_id");

-- One-shot migration of existing flat tasks → linear node chains.
DO $$
DECLARE
  s_id UUID;
  t RECORD;
  prev_id UUID;
  cur_id UUID;
  y_pos INT;
  power_action TEXT;
BEGIN
  FOR s_id IN SELECT id FROM schedules LOOP
    INSERT INTO schedule_nodes (schedule_id, kind, subtype, payload, position)
      VALUES (s_id, 'trigger', 'cron', '{}'::jsonb,
              jsonb_build_object('x', 0, 'y', 0))
      RETURNING id INTO prev_id;
    y_pos := 120;

    FOR t IN
      SELECT * FROM schedule_tasks
      WHERE schedule_id = s_id
      ORDER BY sort_order ASC
    LOOP
      -- Convert delay_seconds > 0 into a wait.delay node.
      IF t.delay_seconds > 0 THEN
        INSERT INTO schedule_nodes (schedule_id, kind, subtype, payload, position)
          VALUES (s_id, 'wait', 'delay.seconds',
                  jsonb_build_object('seconds', t.delay_seconds),
                  jsonb_build_object('x', 0, 'y', y_pos))
          RETURNING id INTO cur_id;
        INSERT INTO schedule_edges (schedule_id, from_node_id, to_node_id)
          VALUES (s_id, prev_id, cur_id);
        prev_id := cur_id;
        y_pos := y_pos + 120;
      END IF;

      IF t.action = 'power' THEN
        power_action := COALESCE(t.payload->>'action', 'start');
        INSERT INTO schedule_nodes (schedule_id, kind, subtype, payload, position)
          VALUES (s_id, 'action', 'power.' || power_action, '{}'::jsonb,
                  jsonb_build_object('x', 0, 'y', y_pos))
          RETURNING id INTO cur_id;
      ELSIF t.action = 'command' THEN
        INSERT INTO schedule_nodes (schedule_id, kind, subtype, payload, position)
          VALUES (s_id, 'action', 'console.send',
                  jsonb_build_object('line', COALESCE(t.payload->>'line', '')),
                  jsonb_build_object('x', 0, 'y', y_pos))
          RETURNING id INTO cur_id;
      ELSIF t.action = 'backup' THEN
        INSERT INTO schedule_nodes (schedule_id, kind, subtype, payload, position)
          VALUES (s_id, 'action', 'backup.create',
                  jsonb_build_object('name', COALESCE(t.payload->>'name', '')),
                  jsonb_build_object('x', 0, 'y', y_pos))
          RETURNING id INTO cur_id;
      ELSE
        CONTINUE;
      END IF;

      INSERT INTO schedule_edges (schedule_id, from_node_id, to_node_id)
        VALUES (s_id, prev_id, cur_id);
      prev_id := cur_id;
      y_pos := y_pos + 120;
    END LOOP;
  END LOOP;
END $$;

DROP TABLE "schedule_tasks";
