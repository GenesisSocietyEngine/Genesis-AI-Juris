CREATE TABLE dossier_practice_revisions (
  dossier_id text NOT NULL REFERENCES dossiers(id),
  revision integer NOT NULL CHECK (revision > 0),
  actor_ref text NOT NULL,
  operation_key text NOT NULL,
  request_digest text NOT NULL,
  plan text NOT NULL CHECK (json_valid(plan)),
  occurred_at text NOT NULL,
  PRIMARY KEY (dossier_id, revision),
  UNIQUE (dossier_id, actor_ref, operation_key)
);--> statement-breakpoint
CREATE TRIGGER practice_revision_authority BEFORE INSERT ON dossier_practice_revisions BEGIN
  SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM dossier_participants p WHERE p.dossier_id=NEW.dossier_id AND p.actor_id=NEW.actor_ref AND p.status='active' AND p.role IN ('owner','contributor')) THEN RAISE(ABORT,'practice_authority') END);
  SELECT (CASE WHEN NEW.revision != COALESCE((SELECT max(revision) FROM dossier_practice_revisions WHERE dossier_id=NEW.dossier_id),0)+1 THEN RAISE(ABORT,'practice_revision_conflict') END);
  SELECT (CASE WHEN json_extract(NEW.plan,'$.revision') != NEW.revision THEN RAISE(ABORT,'practice_revision_payload') END);
END;--> statement-breakpoint
CREATE TRIGGER practice_revision_immutable_update BEFORE UPDATE ON dossier_practice_revisions BEGIN SELECT RAISE(ABORT,'practice_history_immutable'); END;--> statement-breakpoint
CREATE TRIGGER practice_revision_immutable_delete BEFORE DELETE ON dossier_practice_revisions BEGIN SELECT RAISE(ABORT,'practice_history_immutable'); END;
