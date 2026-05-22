package boot

import (
	"context"
	"log"

	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/models"
	"github.com/uptrace/bun"
)

func createRLSPolicies(ctx context.Context, db *bun.DB) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		log.Fatalf("Failed to begin tx: %v", err)
	}
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
}

func grantAllPrivileges(ctx context.Context, db *bun.DB, dbName string, schema string, roleName string) {
	db = db.WithNamedArg("DB", bun.Ident(dbName))
	db = db.WithNamedArg("ROLE", bun.Ident(roleName))
	db = db.WithNamedArg("SCHEMA", bun.Ident(schema))
	db.ExecContext(ctx, `
	DO $$
	BEGIN
		GRANT ALL PRIVILEGES ON DATABASE ?DB TO ?ROLE;
		GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ?SCHEMA TO ?ROLE;
		GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ?ROLE;
		GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ?ROLE;
	END $$;
	`, dbName, roleName)
}

func grantPrivileges(ctx context.Context, db *bun.DB, dbName string) {
	db = db.WithNamedArg("DB", bun.Ident(dbName))
	db.ExecContext(ctx, `
	DO $$
	BEGIN
		GRANT CONNECT ON DATABASE ?DB TO authenticated, anon;
		GRANT USAGE ON SCHEMA public TO authenticated, anon;
		GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
	END $$;
	`, dbName)
}

func InitDB(ctx context.Context) *bun.DB {
	db := db.GetDb()

	models.CreateUserRoleType(db)
	models.CreateAppointmentStatusType(db)
	models.CreateCreditUsageStatusType(db)
	models.CreateCustomerTypeType(db)
	models.CreateTenantTypeType(db)

	if _, err := db.Exec("CREATE EXTENSION IF NOT EXISTS vector;"); err != nil {
		log.Fatalf("could not create extension")
	}

	if _, err := db.Exec(`
	CREATE OR REPLACE FUNCTION set_tenant(tenant_id text) RETURNS void AS $$
	BEGIN
		PERFORM set_config('app.current_tenant', tenant_id, false);
	END;
	$$ LANGUAGE plpgsql;

	CREATE OR REPLACE FUNCTION set_customer(customer_id text) RETURNS void AS $$
	BEGIN
		PERFORM set_config('app.current_customer', customer_id, false);
	END;
	$$ LANGUAGE plpgsql;
	`); err != nil {
		log.Printf("Error creating function: %s\n", err.Error())
	}

	models.CreateRoles(ctx, db)

	tables := models.GetModels()

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
	tx.Commit()

	models.CreateRLSPolicies(ctx, db)

	grantAllPrivileges(ctx, db, "teachmedb", "public", "service_role")
	grantPrivileges(ctx, db, "teachmedb")
	grantPrivileges(ctx, db, "teachmedb")

	return db
}

func RunDBUpdates(ctx context.Context) {
	db := db.GetDb()
	models.UpdateModels(
		ctx,
		db,
		// (*models.UserKey)(nil),
		// (*models.SessionAccessCode)(nil),
		// (*models.Appointment)(nil),
		// (*models.SessionAccessCode)(nil),
		/* (*models.Appointment)(nil),
		(*models.UserKey)(nil),
		(*models.Device)(nil),
		(*models.DeviceGroupKey)(nil),
		(*models.SessionAccessCode)(nil), */
	)
	models.UpdateRLSPolicies(ctx, db)
}
