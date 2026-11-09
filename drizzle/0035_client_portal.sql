CREATE TABLE `portal_entries` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`grant_id` text NOT NULL,
	`kind` text NOT NULL,
	`author` text NOT NULL,
	`actor` text NOT NULL,
	`target` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`stamp` text NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `portal_grants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "portal_entry_kind" CHECK("portal_entries"."kind" IN ('message','document','event','withdraw')),
	CONSTRAINT "portal_entry_author" CHECK("portal_entries"."author" IN ('team','client'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_entries_id_unique` ON `portal_entries` (`id`);--> statement-breakpoint
CREATE INDEX `portal_thread_order` ON `portal_entries` (`grant_id`,`kind`,`seq`);--> statement-breakpoint
CREATE INDEX `portal_share_history` ON `portal_entries` (`grant_id`,`kind`,`target`,`seq`);--> statement-breakpoint
CREATE TABLE `portal_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`case_id` text NOT NULL,
	`email` text NOT NULL,
	`label` text NOT NULL,
	`state` text DEFAULT 'invited' NOT NULL,
	`issuer` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`revoked_by` text,
	FOREIGN KEY (`organization_id`,`case_id`) REFERENCES `dossier_organization_bindings`(`organization_id`,`dossier_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "portal_grant_state" CHECK("portal_grants"."state" IN ('invited','active','revoked'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_current_recipient` ON `portal_grants` (`case_id`,`email`) WHERE "portal_grants"."state" != 'revoked';--> statement-breakpoint
CREATE INDEX `portal_client_cases` ON `portal_grants` (`email`,`state`);--> statement-breakpoint
CREATE TABLE `portal_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`name` text NOT NULL,
	`media` text NOT NULL,
	`size` integer NOT NULL,
	`digest` text NOT NULL,
	`state` text NOT NULL,
	`stamp` text NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `portal_grants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "portal_upload_state" CHECK("portal_uploads"."state" IN ('pending','received')),
	CONSTRAINT "portal_upload_size" CHECK("portal_uploads"."size" BETWEEN 1 AND 5242880)
);--> statement-breakpoint
CREATE INDEX `portal_received` ON `portal_uploads` (`grant_id`,`state`,`stamp`);--> statement-breakpoint
CREATE TRIGGER portal_private_history_update BEFORE UPDATE ON portal_entries BEGIN SELECT RAISE(ABORT,'immutable_portal_history'); END;--> statement-breakpoint
CREATE TRIGGER portal_private_history_delete BEFORE DELETE ON portal_entries BEGIN SELECT RAISE(ABORT,'immutable_portal_history'); END;--> statement-breakpoint
CREATE TRIGGER portal_no_reactivation BEFORE UPDATE ON portal_grants WHEN NOT (OLD.state='invited' AND NEW.state IN ('active','revoked') OR OLD.state='active' AND NEW.state='revoked') OR OLD.id!=NEW.id OR OLD.email!=NEW.email OR OLD.organization_id!=NEW.organization_id OR OLD.case_id!=NEW.case_id OR OLD.label!=NEW.label OR OLD.issuer!=NEW.issuer OR OLD.created_at!=NEW.created_at OR OLD.expires_at!=NEW.expires_at BEGIN SELECT RAISE(ABORT,'invalid_portal_transition'); END;--> statement-breakpoint
CREATE TRIGGER portal_no_grant_delete BEFORE DELETE ON portal_grants BEGIN SELECT RAISE(ABORT,'immutable_portal_grant'); END;--> statement-breakpoint
CREATE TRIGGER portal_upload_receipt BEFORE UPDATE ON portal_uploads WHEN OLD.state!='pending' OR NEW.state!='received' OR OLD.id!=NEW.id OR OLD.grant_id!=NEW.grant_id OR OLD.digest!=NEW.digest OR OLD.size!=NEW.size OR OLD.name!=NEW.name OR OLD.media!=NEW.media OR OLD.stamp!=NEW.stamp BEGIN SELECT RAISE(ABORT,'immutable_portal_upload'); END;--> statement-breakpoint
CREATE TRIGGER portal_case_closed AFTER UPDATE OF status ON dossiers WHEN NEW.status IN ('closed','archived','declined','cancelled') BEGIN UPDATE portal_grants SET state='revoked',revoked_by='case_closed',revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE case_id=NEW.id AND state!='revoked'; END;--> statement-breakpoint
CREATE TRIGGER portal_organization_suspended AFTER UPDATE OF status ON organizations WHEN NEW.status!='active' BEGIN UPDATE portal_grants SET state='revoked',revoked_by='workspace_suspended',revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE organization_id=NEW.id AND state!='revoked'; END;--> statement-breakpoint
CREATE TRIGGER portal_event_review AFTER INSERT ON dossier_practice_revisions
WHEN EXISTS(SELECT 1 FROM portal_grants WHERE case_id=NEW.dossier_id AND state!='revoked')
BEGIN
 INSERT INTO portal_entries(id,grant_id,kind,author,actor,target,title,detail,stamp)
 SELECT lower(hex(randomblob(16))),g.id,'withdraw','team','schedule',e.id,'','',strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM portal_entries e JOIN portal_grants g ON g.id=e.grant_id
 WHERE g.case_id=NEW.dossier_id AND g.state!='revoked' AND e.kind='event'
 AND NOT EXISTS(SELECT 1 FROM portal_entries x WHERE x.grant_id=e.grant_id AND ((x.kind='withdraw' AND x.target=e.id) OR (x.kind='event' AND x.target=e.target AND x.seq>e.seq)))
 AND NOT EXISTS(SELECT 1 FROM json_each(NEW.plan,'$.items') i WHERE i.value->>'$.id'=e.target AND i.value->>'$.kind'='event' AND i.value->>'$.status'='open' AND i.value->>'$.title'=e.title AND json_object('date',i.value->>'$.dueDate','start',i.value->>'$.timing.start.at','end',i.value->>'$.timing.end.at','zone',i.value->>'$.timing.start.timeZone')=e.detail);
END;
