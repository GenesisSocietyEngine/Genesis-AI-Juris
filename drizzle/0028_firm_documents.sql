CREATE TABLE firm_document_versions (
 organization_id text NOT NULL REFERENCES organizations(id), document_id text NOT NULL, version integer NOT NULL CHECK(version>0),
 title text NOT NULL, folder text NOT NULL, filename text NOT NULL, media_type text NOT NULL,
 byte_length integer NOT NULL CHECK(byte_length>0), content_sha256 text NOT NULL, object_key text NOT NULL,
 actor_ref text NOT NULL, operation_key text NOT NULL, request_digest text NOT NULL, occurred_at text NOT NULL,
 PRIMARY KEY(organization_id,document_id,version), UNIQUE(organization_id,actor_ref,operation_key)
);--> statement-breakpoint
CREATE TRIGGER firm_document_authority BEFORE INSERT ON firm_document_versions BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=NEW.organization_id AND m.actor_id=NEW.actor_ref AND m.status='active' AND m.role IN ('org_owner','org_admin','member') AND o.status='active') THEN RAISE(ABORT,'firm_document_authority') END);
 SELECT (CASE WHEN NEW.version != COALESCE((SELECT max(version) FROM firm_document_versions WHERE organization_id=NEW.organization_id AND document_id=NEW.document_id),0)+1 THEN RAISE(ABORT,'firm_document_version_conflict') END);
END;--> statement-breakpoint
CREATE TRIGGER firm_document_immutable_update BEFORE UPDATE ON firm_document_versions BEGIN SELECT RAISE(ABORT,'firm_document_history_immutable'); END;--> statement-breakpoint
CREATE TRIGGER firm_document_immutable_delete BEFORE DELETE ON firm_document_versions BEGIN SELECT RAISE(ABORT,'firm_document_history_immutable'); END;
