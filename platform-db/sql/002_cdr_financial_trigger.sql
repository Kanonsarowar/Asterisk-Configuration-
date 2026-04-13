-- Optional: fill cost/revenue/profit on CDR insert (exact DID match on destination).
-- Requires Asterisk ODBC to insert into cdr with at least: destination, duration_seconds, disposition.

CREATE OR REPLACE FUNCTION cdr_apply_rates()
RETURNS TRIGGER AS $$
DECLARE
  d TEXT;
  n RECORD;
  dur_min NUMERIC;
BEGIN
  d := regexp_replace(COALESCE(NEW.destination, ''), '[^0-9]', '', 'g');
  dur_min := GREATEST(COALESCE(NEW.duration_seconds, 0), 0) / 60.0;

  SELECT * INTO n FROM numbers WHERE did = d LIMIT 1;
  IF FOUND THEN
    NEW.number_id := n.id;
    NEW.customer_id := n.customer_id;
    IF n.supplier_id IS NOT NULL THEN
      SELECT COALESCE(cost_per_minute, 0) * dur_min INTO NEW.cost
      FROM suppliers WHERE id = n.supplier_id;
    END IF;
    NEW.revenue := COALESCE(n.sell_rate, 0) * dur_min;
    NEW.profit := COALESCE(NEW.revenue, 0) - COALESCE(NEW.cost, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cdr_rates ON cdr;
CREATE TRIGGER trg_cdr_rates
  BEFORE INSERT ON cdr
  FOR EACH ROW
  EXECUTE PROCEDURE cdr_apply_rates();
