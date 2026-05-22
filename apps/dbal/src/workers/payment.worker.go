package workers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	"github.com/hashicorp/vault-client-go/schema"
	"github.com/hibiken/asynq"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/types"
	"github.com/stripe/stripe-go/v85"
	"github.com/uptrace/bun"
)

const (
	PaymentConfirmed = "payment.confirmed"
)

type PaymentConfirmedWorkerArgs struct {
	EventID  string
	In       stripe.PaymentIntent
	CacheKey string
}
type PaymentConfirmedWorker struct {
	Name string
}
type PaymentConfirmedEvent struct {
	EventID uuid.UUID
}

func signSnapshot(ctx context.Context, snapshot []byte) (string, error) {
	vault, _ := lib.GetVault(ctx)
	output, err := vault.Secrets.TransitSign(ctx, "snapshot_key", schema.TransitSignRequest{
		HashAlgorithm: "sha2-256",
		Input:         base64.RawURLEncoding.EncodeToString(snapshot),
	})
	if err != nil {
		log.Errorf("[SNAPSHOT] error signing snapshot: %v", err)
		return "", err
	}
	log.Infof("[SNAPSHOT] %v", output)
	vaultKey := []byte("some-very-long-secret-key")
	mac := hmac.New(sha512.New, vaultKey)
	mac.Write(snapshot)
	sig := hex.EncodeToString(mac.Sum(nil))

	return sig, nil
}

func verifySnapshot(ctx context.Context, snapshot []byte, signature string) bool {
	expected, _ := signSnapshot(ctx, snapshot)
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (s *PaymentConfirmedWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	p := new(PaymentConfirmedWorkerArgs)
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		err = fmt.Errorf("json.Unmarshal failed: %v", err)
		log.Errorf("[PAYMENT] %v", err)
		return asynq.SkipRetry
	}
	log.Infof("[PAYMENT] payment intent: %s %s", p.CacheKey, p.In.ID)
	rc := lib.GetRedisClient(ctx)
	val, err := rc.JSONGet(ctx, p.CacheKey).Result()
	if err != nil {
		log.Errorf("[PAYMENT] could not read data from cache %s: %v", p.CacheKey, err)
		return asynq.SkipRetry
	}
	var pi stripe.PaymentIntent
	if err := json.Unmarshal([]byte(val), &pi); err != nil {
		log.Errorf("[PAYMENT] could not deserialize from json %s: %v", p.CacheKey, err)
		return asynq.SkipRetry
	}
	log.Infof("[PAYMENT] payment: %v", pi)

	if p.In.Status != stripe.PaymentIntentStatusSucceeded {
		err := fmt.Errorf("[PAYMENT] %s invalid payment state for %v: %v", s.Name, pi.ID, pi.Status)
		log.Error(err)
		return err
	}
	log.Infof("[PAYMENT] processing payment: %s", p.In.ID)
	md := p.In.Metadata
	pid := md["pid"]
	log.Infof("[PAYMENT] processing payment for %s: %s", pid, p.In.ID)
	appointmentID := md["appointmentID"]
	appt := new(models.Appointment)
	// txn := new(models.Transaction)
	var host models.Tutor
	var guest models.Student
	// cols := make([]string, 0)
	var txId string
	db := db.GetDb()
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		/* sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			return err
		} */
		returning := map[string]any{}
		// returning := make([]string, 0)

		if err := tx.NewUpdate().
			Model(&models.Appointment{
				Status: "confirmed",
			}).
			Column("status").
			// Set("status = ?", "confirmed").
			// Column("id", "status", "host_id", "attendee_id", "host_access_code", "guest_access_code", "session_salt").
			Where("id = ?", appointmentID).
			Where("status = ?", "pending").
			Returning(
				"id,status,host_id,attendee_id,session_metadata,session_salt",
				/* "id",
				"status",
				"host_id",
				"attendee_id",
				"session_metadata",
				"session_salt", */
				// `"id","status","host_id","attendee_id","host_access_code","guest_access_code","session_salt"`,
			).
			Scan(ctx, &returning); err != nil {
			log.Errorf("[PAYMENT] error updating status for Appointment: %v", err)
			return err
		}
		if err := tx.NewSelect().Model(&models.Appointment{}).Where("id = ?", appointmentID).Scan(ctx, appt); err != nil {
			return err
		}
		log.Infof("cols: %T %v", returning, returning)
		returning_host_id := string(returning["host_id"].([]byte))
		returning_guest_id := string(returning["attendee_id"].([]byte))
		log.Infof("[UPDATE] host_id: %s guest_id: %s", returning_host_id, returning_guest_id)
		appt.HostID, _ = uuid.Parse(returning_host_id)
		appt.AttendeeID, _ = uuid.Parse(returning_guest_id)
		appt.ID, _ = uuid.Parse(appointmentID)
		appt.Status, _ = returning["status"].(models.AppointmentStatus)
		log.Infof("[UPDATE] returned session_metadata: %T %d", returning["session_metadata"], len(returning["session_metadata"].([]byte)))

		mdBytes, ok := returning["session_metadata"].([]byte)
		if !ok {
			log.Errorf("[UPDATE] cannot read bytes from metadata")
			return err
		}
		if err := json.Unmarshal(mdBytes, appt.SessionMetadata); err != nil {
			log.Errorf("[UPDATE] error parsing metadata: %v", err)
			return asynq.SkipRetry
		}
		log.Infof("[UPDATE] host_id: %s guest_id: %s", appt.HostID, appt.AttendeeID)
		log.Infof("[UPDATE] appt: %v", appt.SessionMetadata)
		if _, err := tx.NewUpdate().
			Model(&models.Transaction{}).
			/* Model(&models.Transaction{
				StripePaymentIntentId: &p.In.ID,
				Status:                utils.StringPtr(string(p.In.Status)),
			}). */
			Set("stripe_payment_intent_id = ?", p.In.ID).
			Set("status = ?", p.In.Status).
			Where("appointment_id = ?", appointmentID).
			Where("status = ?", "pending").
			Returning("id").
			Exec(ctx, &txId); err != nil {
			log.Errorf("[PAYMENT] error updating status for Transaction: %v", err)
			return err
		}
		return nil
	}); err != nil {
		log.Errorf("[PAYMENT] error performing updates: %v", err)
		return err
	}
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			return err
		}
		log.Infof("[PAYMENT] tx sesn: %v", sid)

		tx.ExecContext(ctx, `
			SET LOCAL app.student_id = ?;
			SET LOCAL app.tutor_id = ?;
		`, sid.StudentID, appt.HostID)

		if err := tx.NewSelect().
			Model(&models.Tutor{}).
			Where("id = ?", appt.HostID).
			Scan(ctx, &host); err != nil {
			log.Errorf("[tutors] error selecting row: %v", err)
			return errors.New("you do not have enough permissions to access this resource")
		}

		tx.ExecContext(ctx, `
			SET LOCAL app.customer_id = ?
		`, sid.CustomerID)

		if err := tx.NewSelect().
			Model(&models.Student{}).
			Where("id = ?", appt.AttendeeID).
			Scan(ctx, &guest); err != nil {
			log.Errorf("[students] error selecting row: %v", err)
			return errors.New("you do not have enough permissions to access this resource")
		}

		return nil
	}); err != nil {
		return err
	}
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		ssn := &models.TutorialSession{
			AppointmentID: appt.ID,
			TutorID:       appt.HostID,
			StudentID:     appt.AttendeeID,
			TenantID:      host.TenantID,
			Status:        "pending",
		}
		if _, err := tx.NewInsert().Model(ssn).Exec(ctx); err != nil {
			log.Errorf("[PAYMENT] failed to insert new row for session: %v", err)
			return err
		}
		sac := &models.SessionAccessCode{
			SessionID:        &ssn.ID,
			AccessCode:       appt.SessionMetadata.AccessCode,
			Salt:             appt.SessionMetadata.Salt,
			HostSessionKeys:  appt.SessionMetadata.HostSessionKeys,
			GuestSessionKeys: appt.SessionMetadata.GuestSessionKeys,
		}
		if _, err := tx.NewInsert().Model(sac).Exec(ctx); err != nil {
			log.Errorf("[PAYMENT] failed to insert new row for session: %v", err)
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	_, js, err := lib.GetNatsInstance()
	if err != nil {
		return fmt.Errorf("Error connecting to NATS: %v", err)
	}
	uid, _ := uuid.NewV7()
	now := time.Now()
	paymentConfirmedPayload := &types.EventMessage{
		EventID:     p.EventID,
		UID:         uid,
		ServiceName: "core.service.internal",
		Channel:     "payment.confirmed",
		Timestamp:   &now,
		Payload: &types.AnyMap{
			"pid": pid,
		},
	}
	paymentConfirmedBytes, _ := json.Marshal(paymentConfirmedPayload)
	js.PublishAsync("payment.confirmed", paymentConfirmedBytes)

	salt := make([]byte, 16)
	rand.Read(salt)
	bookingConfirmedPayload := &types.EventMessage{EventID: p.EventID,
		UID:         uid,
		ServiceName: "core.service.internal",
		Channel:     "booking.confirmed",
		Timestamp:   &now,
		Payload: &types.AnyMap{
			"pid":          pid,
			"session_salt": salt,
			"pubkey":       "PUBKEY",
		},
	}
	bookingConfirmedBytes, _ := json.Marshal(bookingConfirmedPayload)
	js.PublishAsync("booking.confirmed", bookingConfirmedBytes)

	snapshot := types.AnyMap{
		"pid":               pid,
		"appointment_id":    appt.ID.String(),
		"transaction_id":    txId,
		"payment_intent_id": p.In.ID,
		"amount":            p.In.Amount,
		"currency":          p.In.Currency,
		"timestamp":         time.Now().Unix(),
		"status":            appt.Status,
		"tutor_id":          appt.HostID.String(),
		"attendee_id":       appt.AttendeeID.String(),
		"version":           1,
		"date_time":         appt.StartAt,
		"session_salt":      salt,
	}
	snap, _ := json.Marshal(&snapshot)
	sig, _ := signSnapshot(ctx, snap)
	log.Info("==============================================================================")
	log.Infof("[PAYMENT] >>>>>>>>>>>>>>>>>>>>>>>>>>> snapshot sig: %s", sig)
	log.Info("==============================================================================")

	cacheKey := fmt.Sprintf("%s:snapshot", appt.ID.String())
	rc.JSONSet(ctx, cacheKey, "$", types.AnyMap{
		"signature": sig,
		"snapshot":  base64.RawURLEncoding.EncodeToString(snap),
	})

	return nil
}
