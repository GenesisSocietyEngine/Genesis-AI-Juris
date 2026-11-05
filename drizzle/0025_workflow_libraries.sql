CREATE TABLE organization_workflow_revisions (
  organization_id text NOT NULL REFERENCES organizations(id),
  revision integer NOT NULL CHECK (revision > 0),
  actor_ref text NOT NULL,
  operation_key text NOT NULL,
  request_digest text NOT NULL,
  library text NOT NULL CHECK (json_valid(library)),
  occurred_at text NOT NULL,
  PRIMARY KEY (organization_id, revision),
  UNIQUE (organization_id, actor_ref, operation_key)
);--> statement-breakpoint
CREATE TRIGGER workflow_library_authority BEFORE INSERT ON organization_workflow_revisions BEGIN
  SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=NEW.organization_id AND m.actor_id=NEW.actor_ref AND m.status='active' AND m.role IN ('org_owner','org_admin') AND o.status='active') THEN RAISE(ABORT,'workflow_authority') END);
  SELECT (CASE WHEN NEW.revision != COALESCE((SELECT max(revision) FROM organization_workflow_revisions WHERE organization_id=NEW.organization_id),0)+1 THEN RAISE(ABORT,'workflow_revision_conflict') END);
  SELECT (CASE WHEN json_extract(NEW.library,'$.revision') IS NOT NEW.revision THEN RAISE(ABORT,'workflow_revision_payload') END);
END;--> statement-breakpoint
CREATE TRIGGER workflow_library_immutable_update BEFORE UPDATE ON organization_workflow_revisions BEGIN SELECT RAISE(ABORT,'workflow_history_immutable'); END;--> statement-breakpoint
CREATE TRIGGER workflow_library_immutable_delete BEFORE DELETE ON organization_workflow_revisions BEGIN SELECT RAISE(ABORT,'workflow_history_immutable'); END;
