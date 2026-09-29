CREATE TABLE `dossier_organization_bindings` (
	`dossier_id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`created_by_actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_organization_bindings_scope_uidx` ON `dossier_organization_bindings` (`organization_id`,`dossier_id`);--> statement-breakpoint
CREATE TABLE `dossier_organization_commitments` (
	`dossier_id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossier_organization_bindings`(`dossier_id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED
);--> statement-breakpoint
CREATE TABLE `organization_authority_checks` (
	`valid` integer NOT NULL,
	CONSTRAINT "organization_authority_checks_check" CHECK("organization_authority_checks"."valid"=1)
);--> statement-breakpoint
CREATE TABLE `organization_cas_guards` (
	`changed` integer NOT NULL,
	CONSTRAINT "organization_cas_guards_check" CHECK("organization_cas_guards"."changed"=1)
);--> statement-breakpoint
CREATE TABLE `organization_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`token_digest` text NOT NULL,
	`recipient_actor_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by_actor_id` text NOT NULL,
	`inviter_revision` integer NOT NULL,
	`organization_revision` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "organization_invitations_role_check" CHECK("organization_invitations"."role" in ('org_admin','member','auditor')),
	CONSTRAINT "organization_invitations_status_check" CHECK("organization_invitations"."status" in ('pending','accepted','revoked'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_invitations_digest_uidx` ON `organization_invitations` (`token_digest`);--> statement-breakpoint
CREATE TABLE `organization_lifecycle_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`command` text NOT NULL,
	`requested_by_actor_id` text NOT NULL,
	`requester_revision` integer NOT NULL,
	`organization_revision` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_by_actor_id` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "organization_lifecycle_command_check" CHECK("organization_lifecycle_requests"."command" in ('suspend','resume','close'))
);--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`organization_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`actor_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`actor_id`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "organization_memberships_role_check" CHECK("organization_memberships"."role" in ('org_owner','org_admin','member','auditor')),
	CONSTRAINT "organization_memberships_status_check" CHECK("organization_memberships"."status" in ('active','suspended','removed')),
	CONSTRAINT "organization_memberships_revision_check" CHECK("organization_memberships"."revision" >= 1)
);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_memberships_user_uidx` ON `organization_memberships` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_memberships_actor_uidx` ON `organization_memberships` (`organization_id`,`actor_id`);--> statement-breakpoint
CREATE TABLE `organization_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`organization_revision` integer NOT NULL,
	`membership_revision` integer NOT NULL,
	`previous_digest` text,
	`digest` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_security_events_sequence_uidx` ON `organization_security_events` (`organization_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'team' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by_actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "organizations_status_check" CHECK("organizations"."status" in ('provisioning','active','suspended','closed')),
	CONSTRAINT "organizations_kind_check" CHECK("organizations"."kind" in ('personal','team')),
	CONSTRAINT "organizations_revision_check" CHECK("organizations"."revision" >= 1)
);--> statement-breakpoint
-- Bind the existing explicit owner/participant graph. Never use a company label
-- or email domain as authority, and never rewrite a sealed dossier or receipt.
INSERT INTO organizations (id, name, kind, status, revision, created_by_actor_id, created_at)
SELECT 'org_personal_' || actor_id, 'Personal workspace', 'personal', 'active', 1, actor_id, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users;--> statement-breakpoint
INSERT INTO organization_memberships (organization_id, user_id, actor_id, role, status, revision, created_at)
SELECT 'org_personal_' || actor_id, id, actor_id, 'org_owner', 'active', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users;--> statement-breakpoint
INSERT OR IGNORE INTO organization_memberships (organization_id, user_id, actor_id, role, status, revision, created_at)
SELECT 'org_personal_' || d.owner_actor_id, p.user_id, p.actor_id, 'member', 'active', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM dossier_participants p JOIN dossiers d ON d.id=p.dossier_id WHERE p.status='active';--> statement-breakpoint
INSERT INTO dossier_organization_bindings (dossier_id, organization_id, created_by_actor_id, created_at)
SELECT id, 'org_personal_' || owner_actor_id, owner_actor_id, created_at FROM dossiers;--> statement-breakpoint
INSERT INTO dossier_organization_commitments SELECT id FROM dossiers;--> statement-breakpoint
CREATE TRIGGER p1_dossier_binding_required BEFORE INSERT ON dossiers BEGIN
 SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM dossier_organization_bindings b
 JOIN organizations o ON o.id=b.organization_id AND o.status='active'
 JOIN organization_memberships m ON m.organization_id=o.id AND m.actor_id=NEW.owner_actor_id AND m.user_id=NEW.owner_user_id
 WHERE b.dossier_id=NEW.id AND b.created_by_actor_id=NEW.owner_actor_id AND m.status='active' AND m.role<>'auditor')
 THEN RAISE(ABORT,'organization authority required') END);
END;--> statement-breakpoint
CREATE TRIGGER p1_dossier_binding_commitment AFTER INSERT ON dossiers BEGIN
 INSERT INTO dossier_organization_commitments VALUES (NEW.id);
END;--> statement-breakpoint
CREATE TRIGGER p1_binding_update_guard BEFORE UPDATE ON dossier_organization_bindings BEGIN
 SELECT RAISE(ABORT,'dossier organization is immutable');
END;--> statement-breakpoint
CREATE TRIGGER p1_binding_delete_guard BEFORE DELETE ON dossier_organization_bindings BEGIN
 SELECT RAISE(ABORT,'dossier organization is immutable');
END;--> statement-breakpoint
CREATE TRIGGER p1_participant_membership_guard BEFORE INSERT ON dossier_participants BEGIN
 SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM dossier_organization_bindings b
 JOIN organization_memberships m ON m.organization_id=b.organization_id AND m.actor_id=NEW.actor_id AND m.user_id=NEW.user_id
 WHERE b.dossier_id=NEW.dossier_id AND m.status='active') THEN RAISE(ABORT,'active organization membership required') END);
END;--> statement-breakpoint
CREATE TRIGGER p1_audit_membership_guard BEFORE INSERT ON dossier_audit_events BEGIN
 SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM dossier_organization_bindings b
 JOIN organizations o ON o.id=b.organization_id AND o.status='active'
 JOIN organization_memberships m ON m.organization_id=o.id AND m.actor_id=NEW.actor_ref AND m.user_id=NEW.actor_user_id
 WHERE b.dossier_id=NEW.dossier_id AND m.status='active') THEN RAISE(ABORT,'organization authority changed') END);
END;--> statement-breakpoint
CREATE TRIGGER p1_membership_identity_guard BEFORE UPDATE ON organization_memberships
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.user_id IS NOT OLD.user_id OR NEW.actor_id IS NOT OLD.actor_id
 OR NEW.revision<>OLD.revision+1 OR OLD.status='removed' OR OLD.role='org_owner'
BEGIN SELECT RAISE(ABORT,'membership identity, owner and revision are protected'); END;--> statement-breakpoint
CREATE TRIGGER p1_membership_delete_guard BEFORE DELETE ON organization_memberships BEGIN
 SELECT RAISE(ABORT,'revoke membership instead of deleting it'); END;--> statement-breakpoint
CREATE TRIGGER p1_organization_identity_guard BEFORE UPDATE ON organizations
WHEN NEW.id IS NOT OLD.id OR NEW.kind IS NOT OLD.kind OR NEW.created_by_actor_id IS NOT OLD.created_by_actor_id
 OR NEW.created_at IS NOT OLD.created_at OR NEW.revision<>OLD.revision+1 OR OLD.status='closed'
BEGIN SELECT RAISE(ABORT,'organization identity and revision are protected'); END;--> statement-breakpoint
CREATE TRIGGER p1_organization_delete_guard BEFORE DELETE ON organizations BEGIN
 SELECT RAISE(ABORT,'close organization instead of deleting it'); END;--> statement-breakpoint
CREATE TRIGGER p1_invitation_guard BEFORE UPDATE ON organization_invitations
WHEN OLD.status<>'pending' OR NEW.status NOT IN ('accepted','revoked') OR NEW.id IS NOT OLD.id
 OR NEW.organization_id IS NOT OLD.organization_id OR NEW.token_digest IS NOT OLD.token_digest
 OR NEW.recipient_actor_id IS NOT OLD.recipient_actor_id OR NEW.role IS NOT OLD.role
 OR NEW.invited_by_actor_id IS NOT OLD.invited_by_actor_id OR NEW.inviter_revision IS NOT OLD.inviter_revision
 OR NEW.organization_revision IS NOT OLD.organization_revision OR NEW.expires_at IS NOT OLD.expires_at OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT,'invitation is immutable and single use'); END;--> statement-breakpoint
CREATE TRIGGER p1_invitation_accept_authority BEFORE UPDATE OF status ON organization_invitations
WHEN NEW.status='accepted' BEGIN
 SELECT (CASE WHEN NEW.expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now') OR NOT EXISTS (
 SELECT 1 FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.status='active' AND o.revision=NEW.organization_revision
 AND m.actor_id=NEW.invited_by_actor_id AND m.role='org_owner' AND m.status='active' AND m.revision=NEW.inviter_revision)
 THEN RAISE(ABORT,'invitation authority changed') END);
END;--> statement-breakpoint
CREATE TRIGGER p1_lifecycle_request_guard BEFORE INSERT ON organization_lifecycle_requests BEGIN
 SELECT (CASE WHEN NEW.status<>'pending' OR NEW.approved_by_actor_id IS NOT NULL OR NOT EXISTS (
 SELECT 1 FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.kind='team' AND o.revision=NEW.organization_revision
 AND ((o.status='active' AND NEW.command IN ('suspend','close')) OR (o.status='suspended' AND NEW.command IN ('resume','close')))
 AND m.actor_id=NEW.requested_by_actor_id AND m.role='org_owner' AND m.status='active' AND m.revision=NEW.requester_revision)
 THEN RAISE(ABORT,'lifecycle request authority changed') END);
END;--> statement-breakpoint
CREATE TRIGGER p1_lifecycle_approval_guard BEFORE UPDATE ON organization_lifecycle_requests BEGIN
 SELECT (CASE WHEN OLD.status<>'pending' OR NEW.status<>'approved' OR NEW.approved_by_actor_id IS NULL
 OR NEW.approved_by_actor_id=OLD.requested_by_actor_id OR NEW.id IS NOT OLD.id OR NEW.organization_id IS NOT OLD.organization_id
 OR NEW.command IS NOT OLD.command OR NEW.requested_by_actor_id IS NOT OLD.requested_by_actor_id
 OR NEW.requester_revision IS NOT OLD.requester_revision OR NEW.organization_revision IS NOT OLD.organization_revision
 OR NEW.expires_at IS NOT OLD.expires_at OR NEW.created_at IS NOT OLD.created_at
 OR NEW.expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now') OR NOT EXISTS (
 SELECT 1 FROM organizations o JOIN organization_memberships requester ON requester.organization_id=o.id
 JOIN organization_memberships approver ON approver.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.revision=NEW.organization_revision AND o.status IN ('active','suspended')
 AND requester.actor_id=NEW.requested_by_actor_id AND requester.role='org_owner' AND requester.status='active' AND requester.revision=NEW.requester_revision
 AND approver.actor_id=NEW.approved_by_actor_id AND approver.status='active' AND approver.role IN ('org_owner','org_admin'))
 THEN RAISE(ABORT,'independent current lifecycle approval required') END);
END;--> statement-breakpoint
CREATE TRIGGER p1_lifecycle_delete_guard BEFORE DELETE ON organization_lifecycle_requests BEGIN
 SELECT RAISE(ABORT,'lifecycle requests are retained'); END;--> statement-breakpoint
CREATE TRIGGER p1_organization_transition_guard BEFORE UPDATE OF status ON organizations BEGIN
 SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM organization_lifecycle_requests r
 WHERE r.organization_id=OLD.id AND r.organization_revision=OLD.revision AND r.status='approved'
 AND r.approved_by_actor_id<>r.requested_by_actor_id AND
 ((OLD.status='active' AND NEW.status='suspended' AND r.command='suspend')
 OR (OLD.status='suspended' AND NEW.status='active' AND r.command='resume')
 OR (OLD.status IN ('active','suspended') AND NEW.status='closed' AND r.command='close')))
 THEN RAISE(ABORT,'approved lifecycle transition required') END);
END;--> statement-breakpoint
CREATE TRIGGER p1_security_event_guard BEFORE INSERT ON organization_security_events BEGIN
 SELECT (CASE WHEN NEW.sequence <> COALESCE((SELECT max(sequence) FROM organization_security_events WHERE organization_id=NEW.organization_id),0)+1
 OR NEW.previous_digest IS NOT (SELECT digest FROM organization_security_events WHERE organization_id=NEW.organization_id ORDER BY sequence DESC LIMIT 1)
 THEN RAISE(ABORT,'security receipt chain conflict') END);
 SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
 WHERE o.id=NEW.organization_id AND o.revision=NEW.organization_revision AND o.status IN ('active','suspended')
 AND m.actor_id=NEW.actor_id AND m.status='active' AND m.revision=NEW.membership_revision)
 THEN RAISE(ABORT,'security receipt authority changed') END);
END;--> statement-breakpoint
CREATE TRIGGER p1_security_event_update_guard BEFORE UPDATE ON organization_security_events BEGIN
 SELECT RAISE(ABORT,'security receipts are append only'); END;--> statement-breakpoint
CREATE TRIGGER p1_security_event_delete_guard BEFORE DELETE ON organization_security_events BEGIN
 SELECT RAISE(ABORT,'security receipts are append only'); END;
