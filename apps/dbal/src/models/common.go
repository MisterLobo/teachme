package models

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"log"
	"time"

	"github.com/uptrace/bun"
)

type Timestamps struct {
	CreatedAt time.Time     `bun:"created_at,type:timestamptz,nullzero,notnull,default:current_timestamp"`
	UpdatedAt time.Time     `bun:"updated_at,type:timestamptz,nullzero,notnull,default:current_timestamp"`
	DeletedAt *bun.NullTime `bun:"deleted_at,soft_delete"`
}

func GetModels() []any {
	models := []any{
		(*User)(nil),
		(*Tenant)(nil),
		(*Customer)(nil),
		(*Student)(nil),
		(*Parent)(nil),
		(*Tutor)(nil),
		(*Organization)(nil),
		(*Appointment)(nil),
		(*TutorialSession)(nil),
		(*Transaction)(nil),
		(*Credit)(nil),
		(*CreditUsage)(nil),
		(*TutorReview)(nil),
		(*TutorBoost)(nil),
		(*Subscription)(nil),
		(*TutorEmbedding)(nil),
		(*SearchPrompt)(nil),
		(*Purchase)(nil),
		(*Appointment)(nil),
		(*UserKey)(nil),
		(*Device)(nil),
		(*DeviceGroupKey)(nil),
		(*SessionAccessCode)(nil),
	}
	return models
}

type NamedModel interface {
	name() string
}

func UpdateModels(ctx context.Context, db *bun.DB, tables ...any) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		log.Fatalf("Begin transaction failed: %v", err)
	}
	for _, t := range tables {
		_, err := tx.NewDropTable().
			Model(t).
			IfExists().
			Exec(ctx)
		if err != nil {
			log.Fatalf("could not drop table: %v", err)
		}
	}

	for _, t := range tables {
		_, err := tx.NewCreateTable().
			Model(t).
			IfNotExists().
			Exec(ctx)
		if err != nil {
			log.Fatalf("could not create table: %v", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	if err := GrantAllPrivileges(ctx, db, "teachmedb", "public", "service_role"); err != nil {
		return err
	}
	if err := GrantPrivileges(ctx, db, "teachmedb", "public", "authenticated"); err != nil {
		return err
	}
	if err := EnableRLS(ctx, db, "transactions"); err != nil {
		return err
	}

	// alterAppointmentsRLSPolicies(ctx, db)
	return nil
}

func CreateRoles(ctx context.Context, db *bun.DB) {
	if _, err := db.Exec(`
	DO $$
	BEGIN
		IF NOT EXISTS (
			SELECT FROM pg_roles WHERE rolname = 'service_role'
		) THEN
			CREATE USER service_role WITH LOGIN PASSWORD 'supersecurepassword' BYPASSRLS;
			ALTER ROLE service_role BYPASSRLS;
		END IF;
	END
	$$;

	DO $$
	BEGIN
		IF NOT EXISTS (
			SELECT FROM pg_roles WHERE rolname = 'authenticated'
		) THEN
			CREATE ROLE authenticated;
		END IF;
	END
	$$;

	DO $$
	BEGIN
		IF NOT EXISTS (
			SELECT FROM pg_roles WHERE rolname = 'anon'
		) THEN
			CREATE ROLE anon;
		END IF;
	END
	$$;

	GRANT CONNECT ON DATABASE teachmedb TO authenticated, anon;
	GRANT USAGE ON SCHEMA public TO authenticated, anon;
	GRANT ALL ON DATABASE teachmedb TO service_role;
	GRANT ALL PRIVILEGES ON SCHEMA public TO service_role;
	`); err != nil {
		log.Fatalf("Error setting up RLS: %v", err)
	}
}

func CreateRLSPolicies(ctx context.Context, db *bun.DB) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		log.Fatalf("Failed to begin tx: %v", err)
	}
	tx.NewRaw(`
	CREATE OR REPLACE FUNCTION set_rls_context(uid uuid)
	RETURNS void
	LANGUAGE plpgsql
	AS $$
	DECLARE v_pid uuid;
	DECLARE v_id uuid;
	DECLARE v_role text;
	DECLARE v_role_id uuid;
	DECLARE v_ttype tenant_type;
	DECLARE v_ctype customer_type;
	DECLARE v_tenant_id uuid;
	DECLARE v_customer_id uuid;
	DECLARE v_tid uuid;
	DECLARE v_cid uuid;
	DECLARE v_subid uuid;
	BEGIN
		SET LOCAL ROLE service_role;
		PERFORM set_config('app.pid', uid::text, true);
		SELECT id, role INTO v_id, v_role FROM users WHERE users.pid = uid;
		SET LOCAL ROLE authenticated;

		IF v_id IS NULL THEN
			RAISE EXCEPTION 'invalid user';
		END IF;
		PERFORM set_config('app.user_id', v_id::text, true);
		PERFORM set_config('app.owner_id', v_id::text, true);
		PERFORM set_config('app.role', v_role::text, true);

		IF v_role IS NULL THEN
			RAISE EXCEPTION 'invalid user with role %', v_role;
		END IF;

		IF v_role = 'tenant' THEN
			SELECT id,tenant_type INTO v_tenant_id,v_ttype FROM tenants WHERE owner_id = v_id;
			if v_tenant_id IS NULL THEN
				RAISE EXCEPTION 'no tenant id';
			END IF;
			PERFORM set_config('app.tenant_id', v_tenant_id::text, true);
			PERFORM set_config('app.subscriber_id', v_tenant_id::text, true);
			IF v_ttype = 'tutor_individual' THEN
				SELECT id INTO v_tid FROM tutors WHERE tenant_id = v_tenant_id;

				IF v_tid IS NULL THEN
					RAISE EXCEPTION 'invalid tutor id';
				END IF;
				PERFORM set_config('app.tutor_id', v_tid::text, true);

				v_role_id = v_tid;

			END IF;
			IF v_ttype = 'tutor_organization' THEN
				SELECT id INTO v_tid FROM organizations WHERE tenant_id = v_tenant_id;
				
				v_role_id = v_tid;
			END IF;

			IF v_ttype IS NULL THEN
				RAISE EXCEPTION 'invalid type %', v_ttype;
			END IF;

		END IF;

		IF v_role = 'customer' THEN
			SELECT id,customer_type INTO v_customer_id,v_ctype FROM customers WHERE user_id = v_id;
			PERFORM set_config('app.customer_id', v_customer_id::text, true);
			PERFORM set_config('app.subscriber_id', v_customer_id::text, true);
			IF v_ctype = 'student_learner' THEN
				SELECT id INTO v_cid FROM students WHERE customer_id = v_customer_id;

				IF v_cid IS NULL THEN
					RAISE EXCEPTION 'invalid customer %', v_customer_id;
				END IF;
				PERFORM set_config('app.student_id', v_cid::text, true);

				RAISE NOTICE 'v_cid = %', v_tid;

				v_role_id = v_cid;

			END IF;
			IF v_ctype = 'parent_guardian' THEN
				SELECT id INTO v_cid FROM parents WHERE customer_id = v_customer_id;

				v_role_id = v_cid;
			END IF;
		END IF;
		--PERFORM set_config('app.user_id', v_id::text, true);
		PERFORM set_config('app.role', v_role::text, true);
		PERFORM set_config('app.role_id', v_role_id::text, true);
		PERFORM set_config('app.tenant_id', v_tenant_id::text, true);
		PERFORM set_config('app.customer_id', v_customer_id::text, true);
		PERFORM set_config('app.customer_type', v_ctype::text, true);
		PERFORM set_config('app.tutor_id', v_tid::text, true);
		PERFORM set_config('app.organization_id', v_tid::text, true);
		PERFORM set_config('app.student_id', v_cid::text, true);
		PERFORM set_config('app.parent_id', v_cid::text, true);
		SET LOCAL ROLE authenticated;
	END;
	$$;
	`).Exec(ctx)
	tx.Exec("ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE credit_usages ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE credits ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE customers ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE parents ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE search_prompts ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE students ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE tutor_boosts ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE tutor_embeddings ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE tutor_reviews ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE tutorial_sessions ENABLE ROW LEVEL SECURITY;")
	tx.Exec("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
	tx.Commit()

	createUsersRLSPolicies(ctx, db)
	createAppointmentsRLSPolicies(ctx, db)
	CreateTenantsRLSPolicies(ctx, db)
	createCustomersRLSPolicies(ctx, db)
	createStudentsRLSPolicies(ctx, db)
	createTutorsRLSPolicies(ctx, db)
	createSubscriptionsRLSPolicies(ctx, db)
	createTransactionsRLSPolicies(ctx, db)
	createTutorSessionRLSPolicies(ctx, db)
	createTutorReviewRLSPolicies(ctx, db)
	createTutorBoostRLSPolicies(ctx, db)
	createTutorEmbeddingsRLSPolicies(ctx, db)
}

func UpdateRLSPolicies(ctx context.Context, db *bun.DB) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		log.Fatalf("Failed to begin tx: %v", err)
	}
	tx.NewRaw(`
	CREATE OR REPLACE FUNCTION set_rls_context(uid uuid)
	RETURNS void
	LANGUAGE plpgsql
	AS $$
	DECLARE v_pid uuid;
	DECLARE v_id uuid;
	DECLARE v_role text;
	DECLARE v_role_id uuid;
	DECLARE v_ttype tenant_type;
	DECLARE v_ctype customer_type;
	DECLARE v_tenant_id uuid;
	DECLARE v_customer_id uuid;
	DECLARE v_tid uuid;
	DECLARE v_cid uuid;
	DECLARE v_subid uuid;
	BEGIN
		--RAISE EXCEPTION 'uid %', uid;
		SET LOCAL ROLE service_role;
		--SET LOCAL ROLE authenticated;
		PERFORM set_config('app.pid', uid::text, true);
		--PERFORM set_config('app.uid', uid::text, true);
		--SELECT INTO v_pid FROM current_setting('app.pid', true);
		--RAISE EXCEPTION 'pid %', v_pid;
		--RAISE EXCEPTION 'uid %', uid;
		--SET LOCAL app.pid = uid;
		--PERFORM set_config('app.uid', uid::text, true);
		SELECT id, role INTO v_id, v_role FROM users WHERE users.pid = uid;
		--SET LOCAL ROLE authenticated;

		IF v_id IS NULL THEN
			RAISE EXCEPTION 'invalid user';
		END IF;
		PERFORM set_config('app.user_id', v_id::text, true);
		PERFORM set_config('app.owner_id', v_id::text, true);
		PERFORM set_config('app.role', v_role::text, true);
		--SET LOCAL ROLE authenticated;

		IF v_role IS NULL THEN
			RAISE EXCEPTION 'invalid user with role %', v_role;
		END IF;
		--RAISE EXCEPTION 'user with role %', v_role;

		IF v_role = 'tenant' THEN
			SELECT id,tenant_type INTO v_tenant_id,v_ttype FROM tenants WHERE owner_id = v_id;
			if v_tenant_id IS NULL THEN
				RAISE EXCEPTION 'no tenant id';
			END IF;
			--RAISE EXCEPTION 'tenant id %', v_tenant_id;
			PERFORM set_config('app.tenant_id', v_tenant_id::text, true);
			PERFORM set_config('app.subscriber_id', v_tenant_id::text, true);
			--SET LOCAL app.tenant_id = v_tenant_id;
			IF v_ttype = 'tutor_individual' THEN
				--RAISE EXCEPTION 'tenant ID %', v_tenant_id;
				SELECT id INTO v_tid FROM tutors WHERE tenant_id = v_tenant_id;
				--RAISE EXCEPTION 'tutor id = %', v_tid;

				IF v_tid IS NULL THEN
					RAISE EXCEPTION 'invalid tutor id';
				END IF;
				PERFORM set_config('app.tutor_id', v_tid::text, true);

				--RAISE EXCEPTION 'v_tid = %', v_tid;
				
				v_role_id = v_tid;

			END IF;
			IF v_ttype = 'tutor_organization' THEN
				SELECT id INTO v_tid FROM organizations WHERE tenant_id = v_tenant_id;
				
				v_role_id = v_tid;
			END IF;

			IF v_ttype IS NULL THEN
				RAISE EXCEPTION 'invalid type %', v_ttype;
			END IF;

		END IF;

		IF v_role = 'customer' THEN
			SELECT id,customer_type INTO v_customer_id,v_ctype FROM customers WHERE user_id = v_id;
			--RAISE EXCEPTION 'v_customer_id = %', v_customer_id;
			PERFORM set_config('app.customer_id', v_customer_id::text, true);
			PERFORM set_config('app.subscriber_id', v_customer_id::text, true);
			IF v_ctype = 'student_learner' THEN
				--SET LOCAL ROLE service_role;
				SELECT id INTO v_cid FROM students WHERE customer_id = v_customer_id;
				--SET LOCAL ROLE authenticated;

				IF v_cid IS NULL THEN
					RAISE EXCEPTION 'invalid customer %', v_customer_id;
				END IF;
				PERFORM set_config('app.student_id', v_cid::text, true);
				--RAISE EXCEPTION 'invalid student %', v_cid;

				RAISE NOTICE 'v_cid = %', v_tid;

				v_role_id = v_cid;

			END IF;
			IF v_ctype = 'parent_guardian' THEN
				SELECT id INTO v_cid FROM parents WHERE customer_id = v_customer_id;

				v_role_id = v_cid;
			END IF;
		END IF;
		--PERFORM set_config('app.user_id', v_id::text, true);
		PERFORM set_config('app.role', v_role::text, true);
		PERFORM set_config('app.role_id', v_role_id::text, true);
		PERFORM set_config('app.tenant_id', v_tenant_id::text, true);
		PERFORM set_config('app.customer_id', v_customer_id::text, true);
		PERFORM set_config('app.customer_type', v_ctype::text, true);
		PERFORM set_config('app.tutor_id', v_tid::text, true);
		PERFORM set_config('app.organization_id', v_tid::text, true);
		PERFORM set_config('app.student_id', v_cid::text, true);
		PERFORM set_config('app.parent_id', v_cid::text, true);
		SET LOCAL ROLE authenticated;
	END;
	$$;
	`).Exec(ctx)
	if err := tx.Commit(); err != nil {
		log.Fatalf("error updating RLS policices: %v", err)
	}
	alterUsersRLSPolicies(ctx, db)
	alterTenantsRLSPolicies(ctx, db)
	alterTutorsRLSPolicies(ctx, db)
	alterCustomersRLSPolicies(ctx, db)
	alterAppointmentsRLSPolicies(ctx, db)
	alterSubscriptionsRLSPolicies(ctx, db)
	alterTransactionsRLSPolicies(ctx, db)
	alterStudentsRLSPolicies(ctx, db)
}

func GrantAllPrivileges(ctx context.Context, db *bun.DB, dbName string, schema string, roleName string) error {
	db = db.WithNamedArg("DB", bun.Ident(dbName))
	db = db.WithNamedArg("ROLE", bun.Ident(roleName))
	db = db.WithNamedArg("SCHEMA", bun.Ident(schema))
	if _, err := db.Exec(`
	DO $$
	BEGIN
		GRANT ALL PRIVILEGES ON DATABASE ?DB TO ?ROLE;
		GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ?SCHEMA TO ?ROLE;
	END $$;
	`, dbName, roleName); err != nil {
		return err
	}
	return nil
}

func GrantPrivileges(ctx context.Context, db *bun.DB, dbName string, schema string, roleNames string) error {
	db = db.WithNamedArg("DB", bun.Ident(dbName))
	if _, err := db.ExecContext(ctx, `
	DO $$
	BEGIN
		GRANT CONNECT ON DATABASE ?DB TO authenticated, anon;
		GRANT USAGE ON SCHEMA public TO authenticated, anon;
		GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
	END $$;
	`, dbName); err != nil {
		return err
	}
	return nil
}

func EnableRLS(ctx context.Context, db *bun.DB, tableNames ...string) error {
	tx, _ := db.BeginTx(ctx, nil)
	for _, name := range tableNames {
		tx.Exec(`ALTER TABLE ? ENABLE ROW LEVEL SECURITY;`, bun.Ident(name))
	}
	return tx.Commit()
}

func SetRLSContext(ctx context.Context, db *bun.DB) (*bun.DB, error) {
	pid := ctx.Value("pid")
	log.Printf("context pid: %s", pid)
	if _, err := db.ExecContext(ctx, `
		SELECT set_rls_context(?);
	`, pid); err != nil {
		log.Println("[DB] Failed to set RLS context")
		return nil, err
	}

	return db, nil
}

type TxSessionID struct {
	Role           string            `json:"role"`
	RoleID         string            `json:"role_id"`
	UserID         string            `json:"user_id"`
	CustomerID     string            `json:"customer_id"`
	TenantID       string            `json:"tenant_id"`
	TutorID        string            `json:"tutor_id"`
	OrganizationID string            `json:"organization_id"`
	StudentID      string            `json:"student_id"`
	ParentID       string            `json:"parent_id"`
	Ctx            map[string]string `json:"ctx"`
	CustomerType   string            `json:"customer_type"`
	SubscriberID   string            `json:"subscriber_id"`
}

func (ct *TxSessionID) Scan(value any) error {
	st := string(value.([]byte))
	return json.Unmarshal([]byte(st), ct)
}

func (ct TxSessionID) Value() (driver.Value, error) {
	return json.Marshal(ct)
}

func GetTxSession(ctx context.Context, tx *bun.Tx) (*TxSessionID, error) {
	var sid TxSessionID
	if err := tx.QueryRowContext(ctx, `
			SELECT json_build_object(
				'role', current_setting('app.role', true),
				'role_id', current_setting('app.role_id', true),
				'user_id', current_setting('app.user_id', true),
				'customer_id', current_setting('app.customer_id', true),
				'tenant_id', current_setting('app.tenant_id', true),
				'tutor_id', current_setting('app.tutor_id', true),
				'organization_id', current_setting('app.organization_id', true),
				'student_id', current_setting('app.student_id', true),
				'parent_id', current_setting('app.parent_id', true),
				'customer_type', current_setting('app.customer_type', true),
				'subscriber_id', current_setting('app.subscriber_id', true)
			) as ctx;
		`).Scan(&sid); err != nil {
		return nil, err
	}
	return &sid, nil
}
