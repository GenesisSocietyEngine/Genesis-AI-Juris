CREATE TRIGGER practice_scheduling_no_downgrade BEFORE INSERT ON dossier_practice_revisions BEGIN
  SELECT (CASE WHEN ((SELECT json_extract(plan,'$.schedulingVersion') FROM dossier_practice_revisions WHERE dossier_id=NEW.dossier_id ORDER BY revision DESC LIMIT 1)=1 OR EXISTS(SELECT 1 FROM json_each(NEW.plan,'$.items') WHERE json_type(value,'$.timing')='object' OR json_type(value,'$.reminder')='object' OR json_type(value,'$.series')='object')) AND json_extract(NEW.plan,'$.schedulingVersion') IS NOT 1 THEN RAISE(ABORT,'practice_scheduling_client_upgrade_required') END);
END;
