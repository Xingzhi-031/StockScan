-- ============ 基础 ============

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE companies (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE locations (
  id            INTEGER PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('WAREHOUSE','ONLINE','DAMAGED','OTHER')),
  external_code TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (company_id, code),
  UNIQUE (company_id, name)
);

CREATE TABLE employees (
  id            INTEGER PRIMARY KEY,
  employee_code TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('OPERATOR','ADMIN')),
  pin_hash      TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  last_used_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- ============ 导入 ============

CREATE TABLE imports (
  id                   INTEGER PRIMARY KEY,
  import_type          TEXT NOT NULL CHECK (import_type IN ('BASELINE','RECONCILE','BARCODE_MAP','BASELINE_RESET')),
  status               TEXT NOT NULL CHECK (status IN ('PREVIEWED','APPLIED','CANCELLED','FAILED')),
  file_name            TEXT NOT NULL,
  file_sha256          TEXT NOT NULL,
  file_format          TEXT NOT NULL CHECK (file_format IN ('XLS','XLSX','HTML','SPREADSHEETML','CSV')),
  source_system        TEXT NOT NULL DEFAULT 'ACCURATE5',
  source_report_name   TEXT,
  company_name         TEXT,
  source_location_name TEXT,
  location_id          INTEGER REFERENCES locations(id),
  report_as_of_date    TEXT,
  report_cutoff_at     TEXT,
  report_printed_at    TEXT,
  row_count            INTEGER NOT NULL DEFAULT 0,
  warnings_json        TEXT NOT NULL DEFAULT '[]',
  imported_by          INTEGER NOT NULL REFERENCES employees(id),
  imported_at          TEXT NOT NULL,
  applied_at           TEXT,
  notes                TEXT
);

-- ============ 商品与条码 ============

CREATE TABLE products (
  id                INTEGER PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id),
  external_code     TEXT,
  name              TEXT NOT NULL,
  name_key          TEXT NOT NULL,
  model_code        TEXT,
  pack_size         INTEGER CHECK (pack_size IS NULL OR pack_size > 0),
  reference_price   INTEGER,
  currency          TEXT NOT NULL DEFAULT 'IDR',
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_import_id INTEGER REFERENCES imports(id),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (company_id, name_key)
);
CREATE UNIQUE INDEX ux_products_external_code
  ON products(company_id, external_code) WHERE external_code IS NOT NULL;
CREATE INDEX ix_products_model_code ON products(model_code);

CREATE TABLE identifiers (
  id              INTEGER PRIMARY KEY,
  product_id      INTEGER NOT NULL REFERENCES products(id),
  code            TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('EAN13','EAN8','UPCA','GTIN14','CODE128','INTERNAL','OTHER')),
  unit_multiplier INTEGER NOT NULL DEFAULT 1 CHECK (unit_multiplier >= 1),
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by      INTEGER REFERENCES employees(id),
  created_at      TEXT NOT NULL,
  deactivated_at  TEXT,
  deactivated_by  INTEGER REFERENCES employees(id)
);
CREATE UNIQUE INDEX ux_identifiers_active_code ON identifiers(code) WHERE is_active = 1;
CREATE INDEX ix_identifiers_product ON identifiers(product_id);

CREATE TABLE barcode_pairing_events (
  id            INTEGER PRIMARY KEY,
  identifier_id INTEGER NOT NULL REFERENCES identifiers(id),
  product_id    INTEGER NOT NULL REFERENCES products(id),
  action        TEXT NOT NULL CHECK (action IN ('LINKED','DEACTIVATED','IMPORTED')),
  operator_id   INTEGER NOT NULL REFERENCES employees(id),
  import_id     INTEGER REFERENCES imports(id),
  created_at    TEXT NOT NULL,
  notes         TEXT
);

-- ============ 库存 ============

CREATE TABLE inventory_balances (
  location_id        INTEGER NOT NULL REFERENCES locations(id),
  product_id         INTEGER NOT NULL REFERENCES products(id),
  baseline_quantity  INTEGER NOT NULL,
  baseline_import_id INTEGER NOT NULL REFERENCES imports(id),
  current_quantity   INTEGER NOT NULL,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (location_id, product_id)
) WITHOUT ROWID;

-- ============ Session ============

CREATE TABLE sessions (
  id               INTEGER PRIMARY KEY,
  session_number   INTEGER NOT NULL UNIQUE,
  location_id      INTEGER NOT NULL REFERENCES locations(id),
  operator_id      INTEGER NOT NULL REFERENCES employees(id),
  status           TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  started_at       TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  completed_at     TEXT,
  close_reason     TEXT CHECK (close_reason IN ('FINISHED','OPERATOR_SWITCH','IDLE_TIMEOUT','APP_RESTART')),
  notes            TEXT
);
CREATE UNIQUE INDEX ux_sessions_single_open ON sessions(status) WHERE status = 'OPEN';

-- ============ 导出批次 ============

CREATE TABLE export_batches (
  id                  INTEGER PRIMARY KEY,
  export_type         TEXT NOT NULL CHECK (export_type IN ('TRANSACTIONS','ACCURATE_TEMPLATE')),
  status              TEXT NOT NULL CHECK (status IN ('EXPORTED','SYNCED')),
  file_name           TEXT NOT NULL,
  first_txn_id        INTEGER NOT NULL,
  last_txn_id         INTEGER NOT NULL,
  row_count           INTEGER NOT NULL,
  exported_by         INTEGER NOT NULL REFERENCES employees(id),
  exported_at         TEXT NOT NULL,
  synced_confirmed_by INTEGER REFERENCES employees(id),
  synced_at           TEXT
);

-- ============ 流水（只追加） ============

CREATE TABLE transactions (
  id                      INTEGER PRIMARY KEY,
  client_txn_id           TEXT NOT NULL UNIQUE,
  session_id              INTEGER REFERENCES sessions(id),
  location_id             INTEGER NOT NULL REFERENCES locations(id),
  product_id              INTEGER NOT NULL REFERENCES products(id),
  identifier_id           INTEGER REFERENCES identifiers(id),
  identifier_code         TEXT,
  operation_type          TEXT NOT NULL CHECK (operation_type IN
                            ('STOCK_IN','SALE','RETURN','ADJUSTMENT','REVERSAL','RECONCILIATION_ADJUSTMENT')),
  input_quantity          INTEGER NOT NULL,
  input_uom               TEXT NOT NULL CHECK (input_uom IN ('PCS','CTN','COUNT','SYSTEM')),
  unit_multiplier         INTEGER NOT NULL CHECK (unit_multiplier >= 1),
  quantity_change         INTEGER NOT NULL CHECK (quantity_change <> 0),
  stock_before            INTEGER NOT NULL,
  stock_after             INTEGER NOT NULL,
  operator_id             INTEGER NOT NULL REFERENCES employees(id),
  negative_stock_warning  INTEGER NOT NULL DEFAULT 0 CHECK (negative_stock_warning IN (0,1)),
  warning_acknowledged    INTEGER NOT NULL DEFAULT 0 CHECK (warning_acknowledged IN (0,1)),
  return_disposition      TEXT CHECK (return_disposition IN ('SELLABLE','DAMAGED','QUARANTINE','OTHER')),
  reason_code             TEXT CHECK (reason_code IN ('COUNT_CORRECTION','DAMAGED','DATA_MISMATCH','OTHER')),
  reverses_transaction_id INTEGER UNIQUE REFERENCES transactions(id),
  reconcile_import_id     INTEGER REFERENCES imports(id),
  sync_status             TEXT NOT NULL DEFAULT 'LOCAL' CHECK (sync_status IN ('LOCAL','EXPORTED','SYNCED')),
  export_batch_id         INTEGER REFERENCES export_batches(id),
  synced_at               TEXT,
  absorbed_by_import_id   INTEGER REFERENCES imports(id),
  source                  TEXT NOT NULL CHECK (source IN ('SCAN','MANUAL_CODE','PRODUCT_PANEL','SYSTEM')),
  notes                   TEXT,
  created_at              TEXT NOT NULL,

  CHECK (stock_after = stock_before + quantity_change),
  CHECK (operation_type <> 'ADJUSTMENT' OR reason_code IS NOT NULL),
  CHECK (operation_type <> 'REVERSAL'   OR reverses_transaction_id IS NOT NULL),
  CHECK (operation_type <> 'RETURN'     OR return_disposition IS NOT NULL),
  CHECK (negative_stock_warning = 0 OR warning_acknowledged = 1)
);
CREATE INDEX ix_tx_created          ON transactions(created_at);
CREATE INDEX ix_tx_product_created  ON transactions(product_id, created_at);
CREATE INDEX ix_tx_session          ON transactions(session_id);
CREATE INDEX ix_tx_sync             ON transactions(sync_status);
CREATE INDEX ix_tx_unabsorbed       ON transactions(location_id, product_id) WHERE absorbed_by_import_id IS NULL;

CREATE TRIGGER trg_tx_no_delete BEFORE DELETE ON transactions
BEGIN
  SELECT RAISE(ABORT, 'transactions are append-only');
END;

CREATE TRIGGER trg_tx_immutable BEFORE UPDATE OF
  client_txn_id, session_id, location_id, product_id, identifier_id, identifier_code,
  operation_type, input_quantity, input_uom, unit_multiplier, quantity_change,
  stock_before, stock_after, operator_id, negative_stock_warning, warning_acknowledged,
  return_disposition, reason_code, reverses_transaction_id, reconcile_import_id,
  source, notes, created_at
ON transactions
BEGIN
  SELECT RAISE(ABORT, 'transactions are immutable');
END;

-- ============ 导入明细与对账 ============

CREATE TABLE import_rows (
  id            INTEGER PRIMARY KEY,
  import_id     INTEGER NOT NULL REFERENCES imports(id),
  row_number    INTEGER NOT NULL,
  raw_name      TEXT NOT NULL,
  name_key      TEXT NOT NULL,
  external_code TEXT,
  pack_size     INTEGER,
  quantity      INTEGER,
  koli          REAL,
  price         INTEGER,
  product_id    INTEGER REFERENCES products(id),
  match_status  TEXT NOT NULL CHECK (match_status IN ('MATCHED','NEW','AMBIGUOUS','INVALID')),
  issues_json   TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX ix_import_rows_import ON import_rows(import_id);

CREATE TABLE reconciliation_lines (
  id                INTEGER PRIMARY KEY,
  import_id         INTEGER NOT NULL REFERENCES imports(id),
  product_id        INTEGER REFERENCES products(id),
  import_row_id     INTEGER REFERENCES import_rows(id),
  line_type         TEXT NOT NULL CHECK (line_type IN ('MATCHED','DIFFERENT','ONLY_STOCKSCAN','ONLY_ACCURATE')),
  prev_baseline     INTEGER,
  synced_delta      INTEGER NOT NULL DEFAULT 0,
  unsynced_delta    INTEGER NOT NULL DEFAULT 0,
  expected          INTEGER,
  snapshot_quantity INTEGER,
  difference        INTEGER,
  decision          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (decision IN ('PENDING','USE_ACCURATE','KEEP_STOCKSCAN','SKIP','AUTO')),
  decided_by        INTEGER REFERENCES employees(id),
  decided_at        TEXT
);
CREATE INDEX ix_recon_import ON reconciliation_lines(import_id);

-- ============ 异常 ============

CREATE TABLE exceptions (
  id              INTEGER PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN (
                    'UNKNOWN_BARCODE','NEGATIVE_STOCK','IMPORT_DATE_WARNING','RECONCILIATION_MISMATCH',
                    'DUPLICATE_BARCODE','PACK_SIZE_MISSING','BACKUP_FAILED','SECONDARY_BACKUP_STALE')),
  severity        TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR')),
  status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  dedup_key       TEXT,
  transaction_id  INTEGER REFERENCES transactions(id),
  product_id      INTEGER REFERENCES products(id),
  identifier_code TEXT,
  import_id       INTEGER REFERENCES imports(id),
  occurrences     INTEGER NOT NULL DEFAULT 1,
  details_json    TEXT NOT NULL DEFAULT '{}',
  first_seen_at   TEXT NOT NULL,
  last_seen_at    TEXT NOT NULL,
  resolved_at     TEXT,
  resolved_by     INTEGER REFERENCES employees(id),
  resolution_note TEXT
);
CREATE UNIQUE INDEX ux_exceptions_open_dedup ON exceptions(dedup_key) WHERE status = 'OPEN' AND dedup_key IS NOT NULL;
CREATE INDEX ix_exceptions_status ON exceptions(status);
