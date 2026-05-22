package db

import (
	"database/sql"
	"log"
	"time"

	"github.com/misterlobo/teachme/src/config"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"github.com/uptrace/bun/extra/bundebug"
)

var db *bun.DB

func GetDb() *bun.DB {
	if db != nil {
		return db
	}
	sqldb := sql.OpenDB(pgdriver.NewConnector(
		pgdriver.WithDSN(config.GetDSN()),
	))
	sqldb.SetMaxOpenConns(25)
	sqldb.SetMaxIdleConns(10)
	sqldb.SetConnMaxIdleTime(5 * time.Minute)
	sqldb.SetConnMaxLifetime(5 * time.Minute)

	if err := sqldb.Ping(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	_db := bun.NewDB(sqldb, pgdialect.New())
	/* logger, _ := zap.NewProduction()
	_db = _db.WithQueryHook(bunzap.NewQueryHook(bunzap.QueryHookOptions{
		Logger:       logger,
		SlowDuration: 200 * time.Millisecond,
	})) */
	_db = _db.WithQueryHook(bundebug.NewQueryHook(
		bundebug.WithEnabled(true),
		bundebug.WithVerbose(true),
	))
	db = _db
	return _db
}
