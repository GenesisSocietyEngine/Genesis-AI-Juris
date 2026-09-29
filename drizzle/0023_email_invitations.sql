-- Additive INV01. Retain legacy actor-bound invitations and all existing records.
CREATE TABLE email_invitations (
 id text PRIMARY KEY NOT NULL, organization_id text NOT NULL REFERENCES organizations(id),
 recipient_email text NOT NULL, token_digest text NOT NULL, origin text NOT NULL,
 role text NOT NULL CHECK(role IN ('member','org_admin','auditor')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','superseded')),
 invited_by_actor_id text NOT NULL, inviter_revision integer NOT NULL, organization_revision integer NOT NULL,
 expires_at text NOT NULL, created_at text NOT NULL,
 delivery text NOT NULL DEFAULT 'unknown' CHECK(delivery IN ('unknown','not_configured','provider_accepted','failed')),
 accepted_by_user_id integer REFERENCES users(id), accepted_by_actor_id text, accepted_at text,
 CONSTRAINT email_invitations_acceptance_check CHECK((status='accepted' AND accepted_by_user_id IS NOT NULL AND accepted_by_actor_id IS NOT NULL AND accepted_at IS NOT NULL)
 OR (status<>'accepted' AND accepted_by_user_id IS NULL AND accepted_by_actor_id IS NULL AND accepted_at IS NULL))
);--> statement-breakpoint
CREATE UNIQUE INDEX email_invitations_digest_uidx ON email_invitations(token_digest);--> statement-breakpoint
CREATE UNIQUE INDEX email_invitations_pending_uidx ON email_invitations(organization_id,recipient_email) WHERE status='pending';--> statement-breakpoint
CREATE TABLE invitation_mailbox_proofs (
 id text PRIMARY KEY NOT NULL, invitation_id text NOT NULL REFERENCES email_invitations(id),
 user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, actor_id text NOT NULL, email text NOT NULL,
 token_digest text NOT NULL, expires_at text NOT NULL, used_at text
);--> statement-breakpoint
CREATE UNIQUE INDEX invitation_mailbox_digest_uidx ON invitation_mailbox_proofs(token_digest);--> statement-breakpoint
CREATE UNIQUE INDEX invitation_mailbox_account_uidx ON invitation_mailbox_proofs(invitation_id,user_id);--> statement-breakpoint
CREATE TRIGGER email_invitation_insert_authority BEFORE INSERT ON email_invitations BEGIN
 SELECT (CASE WHEN NEW.status<>'pending' OR NOT EXISTS (
 SELECT 1 FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.status='active' AND o.revision=NEW.organization_revision
 AND m.actor_id=NEW.invited_by_actor_id AND m.status='active' AND m.role='org_owner' AND m.revision=NEW.inviter_revision)
 THEN RAISE(ABORT,'invitation authority changed') END);
END;--> statement-breakpoint
CREATE TRIGGER email_invitation_identity_guard BEFORE UPDATE ON email_invitations
 WHEN NEW.id IS NOT OLD.id OR NEW.organization_id IS NOT OLD.organization_id OR NEW.recipient_email IS NOT OLD.recipient_email
 OR NEW.token_digest IS NOT OLD.token_digest OR NEW.origin IS NOT OLD.origin OR NEW.role IS NOT OLD.role
 OR NEW.invited_by_actor_id IS NOT OLD.invited_by_actor_id OR NEW.inviter_revision IS NOT OLD.inviter_revision
 OR NEW.organization_revision IS NOT OLD.organization_revision OR NEW.expires_at IS NOT OLD.expires_at OR NEW.created_at IS NOT OLD.created_at
 OR (NEW.status<>OLD.status AND (OLD.status<>'pending' OR NEW.status NOT IN ('accepted','revoked','superseded')))
 OR (OLD.status='accepted' AND (NEW.accepted_by_actor_id IS NOT OLD.accepted_by_actor_id OR NEW.accepted_by_user_id IS NOT OLD.accepted_by_user_id OR NEW.accepted_at IS NOT OLD.accepted_at))
 BEGIN SELECT RAISE(ABORT,'invitation identity is immutable'); END;--> statement-breakpoint
CREATE TRIGGER email_invitation_accept_guard BEFORE UPDATE OF status ON email_invitations WHEN NEW.status='accepted' BEGIN
 SELECT (CASE WHEN NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR NOT EXISTS (
 SELECT 1 FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.status='active' AND o.revision=NEW.organization_revision
 AND m.actor_id=NEW.invited_by_actor_id AND m.status='active' AND m.role='org_owner' AND m.revision=NEW.inviter_revision)
 OR NOT EXISTS (SELECT 1 FROM invitation_mailbox_proofs p JOIN users u ON u.id=p.user_id AND u.actor_id=p.actor_id AND u.email=p.email
 WHERE p.invitation_id=NEW.id AND p.user_id=NEW.accepted_by_user_id AND p.actor_id=NEW.accepted_by_actor_id
 AND p.email=NEW.recipient_email AND p.used_at=NEW.accepted_at AND p.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 THEN RAISE(ABORT,'current authority and mailbox proof required') END);
END;--> statement-breakpoint
CREATE TRIGGER email_invitation_delete_guard BEFORE DELETE ON email_invitations BEGIN
 SELECT RAISE(ABORT,'invitation history is retained'); END;
