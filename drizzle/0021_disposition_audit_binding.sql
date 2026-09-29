CREATE UNIQUE INDEX `dossier_deadline_dispositions_audit_uidx` ON `dossier_deadline_dispositions` (`dossier_id`,`audit_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_source_anchor_retirements_audit_uidx` ON `dossier_source_anchor_retirements` (`dossier_id`,`audit_event_id`);--> statement-breakpoint
CREATE TRIGGER dossier_proposals_retired_accept_guard BEFORE UPDATE ON dossier_ai_proposals
WHEN NEW.review_state='accepted' AND OLD.review_state<>'accepted' AND EXISTS(
 SELECT 1 FROM dossier_ai_proposal_anchors a JOIN dossier_source_anchor_retirements r
 ON r.dossier_id=a.dossier_id AND r.source_anchor_id=a.source_anchor_id
 WHERE a.dossier_id=NEW.dossier_id AND a.proposal_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'retired citations require a new proposal with reviewed current evidence'); END;
