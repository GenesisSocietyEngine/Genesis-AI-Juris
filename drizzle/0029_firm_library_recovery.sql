CREATE TABLE `firm_library_folder_paths` (
	`organization_id` text NOT NULL,
	`path` text NOT NULL,
	`actor_ref` text NOT NULL,
	`operation_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `firm_folder_path` ON `firm_library_folder_paths` (`organization_id`,`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `firm_folder_save` ON `firm_library_folder_paths` (`organization_id`,`actor_ref`,`operation_key`);--> statement-breakpoint
CREATE TABLE `firm_upload_intents` (
	`organization_id` text NOT NULL,
	`actor_ref` text NOT NULL,
	`operation_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`document_id` text NOT NULL,
	`expected_version` integer NOT NULL,
	`title` text NOT NULL,
	`folder` text NOT NULL,
	`filename` text NOT NULL,
	`byte_length` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "firm_intent_state" CHECK("firm_upload_intents"."state" IN ('pending','committed','cancelled'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `firm_intent_operation` ON `firm_upload_intents` (`organization_id`,`actor_ref`,`operation_key`);--> statement-breakpoint
CREATE INDEX `firm_intent_owner_state` ON `firm_upload_intents` (`organization_id`,`actor_ref`,`state`);--> statement-breakpoint
CREATE TRIGGER firm_folder_create BEFORE INSERT ON firm_library_folder_paths BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE o.id=NEW.organization_id AND o.status='active' AND m.actor_id=NEW.actor_ref AND m.status='active' AND m.role IN ('org_owner','org_admin','member')) OR length(NEW.path) NOT BETWEEN 1 AND 200 OR (SELECT count(*) FROM firm_library_folder_paths WHERE organization_id=NEW.organization_id)>=500 THEN RAISE(ABORT,'firm_folder_invalid') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM firm_upload_intents WHERE organization_id=NEW.organization_id AND actor_ref=NEW.actor_ref AND operation_key=NEW.operation_key) OR EXISTS(SELECT 1 FROM firm_document_versions WHERE organization_id=NEW.organization_id AND actor_ref=NEW.actor_ref AND operation_key=NEW.operation_key) THEN RAISE(ABORT,'firm_operation_reused') END);
END;--> statement-breakpoint
CREATE TRIGGER firm_folder_keep_update BEFORE UPDATE ON firm_library_folder_paths BEGIN SELECT RAISE(ABORT,'firm_folder_immutable'); END;--> statement-breakpoint
CREATE TRIGGER firm_folder_keep_delete BEFORE DELETE ON firm_library_folder_paths BEGIN SELECT RAISE(ABORT,'firm_folder_immutable'); END;--> statement-breakpoint
CREATE TRIGGER firm_intent_stage BEFORE INSERT ON firm_upload_intents BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE o.id=NEW.organization_id AND o.status='active' AND m.actor_id=NEW.actor_ref AND m.status='active' AND m.role IN ('org_owner','org_admin','member')) OR NEW.state!='pending' OR NEW.byte_length NOT BETWEEN 1 AND 26214400 OR NEW.expected_version!=COALESCE((SELECT max(version) FROM firm_document_versions WHERE organization_id=NEW.organization_id AND document_id=NEW.document_id),0) THEN RAISE(ABORT,'firm_intent_conflict') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM firm_library_folder_paths WHERE organization_id=NEW.organization_id AND actor_ref=NEW.actor_ref AND operation_key=NEW.operation_key) THEN RAISE(ABORT,'firm_operation_reused') END);
 SELECT (CASE WHEN (SELECT count(*) FROM firm_upload_intents WHERE organization_id=NEW.organization_id AND state!='committed')>=1000 OR NEW.byte_length+COALESCE((SELECT sum(byte_length) FROM firm_upload_intents WHERE organization_id=NEW.organization_id AND state!='committed'),0)>1073741824 THEN RAISE(ABORT,'firm_storage_limit') END);
END;--> statement-breakpoint
CREATE TRIGGER firm_intent_transition BEFORE UPDATE ON firm_upload_intents BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE o.id=NEW.organization_id AND o.status='active' AND m.actor_id=NEW.actor_ref AND m.status='active' AND m.role IN ('org_owner','org_admin','member')) OR NEW.organization_id IS NOT OLD.organization_id OR NEW.actor_ref IS NOT OLD.actor_ref OR NEW.operation_key IS NOT OLD.operation_key OR NEW.request_digest IS NOT OLD.request_digest OR NEW.document_id IS NOT OLD.document_id OR NEW.expected_version IS NOT OLD.expected_version OR NEW.title IS NOT OLD.title OR NEW.folder IS NOT OLD.folder OR NEW.filename IS NOT OLD.filename OR NEW.byte_length IS NOT OLD.byte_length OR NEW.created_at IS NOT OLD.created_at OR OLD.state!='pending' OR NEW.state NOT IN ('committed','cancelled') THEN RAISE(ABORT,'firm_intent_immutable') END);
 SELECT (CASE WHEN (NEW.state='committed')!=EXISTS(SELECT 1 FROM firm_document_versions v WHERE v.organization_id=NEW.organization_id AND v.actor_ref=NEW.actor_ref AND v.operation_key=NEW.operation_key AND v.request_digest=NEW.request_digest AND v.document_id=NEW.document_id AND v.version=NEW.expected_version+1) THEN RAISE(ABORT,'firm_intent_receipt') END);
END;--> statement-breakpoint
CREATE TRIGGER firm_intent_keep BEFORE DELETE ON firm_upload_intents BEGIN SELECT RAISE(ABORT,'firm_intent_immutable'); END;--> statement-breakpoint
CREATE TRIGGER firm_version_pending_guard BEFORE INSERT ON firm_document_versions BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM firm_library_folder_paths WHERE organization_id=NEW.organization_id AND actor_ref=NEW.actor_ref AND operation_key=NEW.operation_key) OR EXISTS(SELECT 1 FROM firm_upload_intents i WHERE i.organization_id=NEW.organization_id AND i.actor_ref=NEW.actor_ref AND i.operation_key=NEW.operation_key AND (i.state!='pending' OR i.request_digest!=NEW.request_digest OR i.document_id!=NEW.document_id OR i.expected_version+1!=NEW.version OR i.title!=NEW.title OR i.folder!=NEW.folder OR i.filename!=NEW.filename OR i.byte_length!=NEW.byte_length)) THEN RAISE(ABORT,'firm_upload_changed') END);
END;--> statement-breakpoint
CREATE TRIGGER firm_version_receipt AFTER INSERT ON firm_document_versions BEGIN
 UPDATE firm_upload_intents SET state='committed' WHERE organization_id=NEW.organization_id AND actor_ref=NEW.actor_ref AND operation_key=NEW.operation_key AND state='pending';
END;
