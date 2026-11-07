CREATE TABLE organization_work_revisions (
  organization_id text NOT NULL REFERENCES organizations(id),
  revision integer NOT NULL CHECK (revision > 0),
  actor_ref text NOT NULL,
  operation_key text NOT NULL,
  request_digest text NOT NULL,
  plan text NOT NULL CHECK (json_valid(plan)),
  occurred_at text NOT NULL,
  PRIMARY KEY (organization_id, revision),
  UNIQUE (organization_id, actor_ref, operation_key)
);--> statement-breakpoint
CREATE TRIGGER firm_work_authority BEFORE INSERT ON organization_work_revisions BEGIN
  SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=NEW.organization_id AND m.actor_id=NEW.actor_ref AND m.status='active' AND m.role IN ('org_owner','org_admin','member') AND o.status='active') THEN RAISE(ABORT,'firm_work_authority') END);
  SELECT (CASE WHEN NEW.revision != COALESCE((SELECT max(revision) FROM organization_work_revisions WHERE organization_id=NEW.organization_id),0)+1 THEN RAISE(ABORT,'firm_work_revision_conflict') END);
  SELECT (CASE WHEN json_extract(NEW.plan,'$.revision') IS NOT NEW.revision THEN RAISE(ABORT,'firm_work_revision_payload') END);
END;--> statement-breakpoint
CREATE TRIGGER firm_work_immutable_update BEFORE UPDATE ON organization_work_revisions BEGIN SELECT RAISE(ABORT,'firm_work_history_immutable'); END;--> statement-breakpoint
CREATE TRIGGER firm_work_immutable_delete BEFORE DELETE ON organization_work_revisions BEGIN SELECT RAISE(ABORT,'firm_work_history_immutable'); END;
