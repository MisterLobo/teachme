package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/redis/go-redis/v9"
	"github.com/stripe/stripe-go/v85"
	"github.com/uptrace/bun"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/anypb"

	bookingpb "github.com/misterlobo/teachme/generated/v1/booking"
)

type BookingServer struct {
	bookingpb.UnimplementedBookingServiceServer
	AccountServer *AccountServer
}

func (s *BookingServer) Create(ctx context.Context, in *bookingpb.BookingCreate) (*bookingpb.BookingResponse, error) {
	statusCode := codes.OK
	db := db.GetDb()
	pid := ctx.Value("pid")
	uid := pid.(uuid.UUID)
	log.Infof("context pid: %v %T", pid, pid)
	var bookingID uuid.UUID
	models.SetRLSContext(ctx, db)
	var tutor models.Tutor
	var tutorUser models.User
	var tutorTenant models.Tenant
	student := new(models.Student)
	studentUser := new(models.User)
	studentCustomer := new(models.Customer)
	tSubscription := models.Subscription{}
	sSubscription := models.Subscription{}
	var appt *models.Appointment
	tutorID, err := uuid.Parse(in.HostId)
	if err != nil {
		log.Errorf("invalid host id: %v: %s", err, in.HostId)
		return &bookingpb.BookingResponse{
			Status:     "Bad request",
			StatusCode: 400,
			Error:      utils.StringPtr("bad request"),
		}, nil
	}
	log.Errorf("Host ID: %v", tutorID)
	ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

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
		log.Infof("Tutor TenantID: %s", tutor.TenantID)
		tx.ExecContext(ctx, `
			SET LOCAL app.tutor_id = ?;
			SET LOCAL app.host_id = ?;
		`, tutorID, tutorID)
		log.Infof("TxSessionID: %#v", sid)
		if err := tx.NewSelect().
			Model(&models.Tutor{}).
			Where("id = ?", tutorID).
			Scan(ctx, &tutor); err != nil {
			statusCode = codes.PermissionDenied
			log.Errorf("[tutors] error selecting row: %v", err)
			return errors.New("you do not have enough permissions to access this resource")
		}
		tx.ExecContext(ctx, `
			SET LOCAL app.tenant_id = ?;
		`, tutor.TenantID)
		if err := tx.NewSelect().
			Model(&models.Tenant{}).
			Where("id = ?", tutor.TenantID).
			Scan(ctx, &tutorTenant); err != nil {
			return err
		}
		log.Infof("tutor tenant: %v", tutorTenant)
		tx.ExecContext(ctx, `
			SET LOCAL app.user_id = ?;
		`, tutorTenant.OwnerID, tutorTenant.ID)
		if err := tx.NewSelect().
			Model(&models.User{}).
			Where("id = ?", tutorTenant.OwnerID).
			Scan(ctx, &tutorUser); err != nil {
			return err
		}

		tx.ExecContext(ctx, `
			SET LOCAL app.tenant_id = ?;
			SET LOCAL app.subscriber_id = ?;
		`, tutor.TenantID, tutor.TenantID)
		if err := tx.NewSelect().
			Model(&models.Subscription{}).
			Where("subscriber_id = ?", tutor.TenantID).
			Scan(ctx, &tSubscription); err != nil {
			statusCode = codes.PermissionDenied
			log.Errorf("[tutor.subscriptions] error selecting row: %v", err)
			log.Error("you do not have enough permissions to access this resource")
			return asynq.SkipRetry
		}

		/* tx.ExecContext(ctx, `
		SET LOCAL app.student_id = ?;
		`, tutorID) */
		if err := tx.NewSelect().
			Model(&models.Student{}).
			Where("id = ?", sid.StudentID).
			Scan(ctx, student); err != nil {
			statusCode = codes.PermissionDenied
			log.Errorf("[students] error selecting row: %v", err)
			log.Error("you do not have enough permissions to access this resource")
			return asynq.SkipRetry
		}
		tx.ExecContext(ctx, `
			SET LOCAL app.user_id = ?;
		`, sid.UserID)
		if err := tx.NewSelect().
			Model(&models.Customer{}).
			Where("id = ?", student.CustomerID).
			Scan(ctx, studentCustomer); err != nil {
			return err
		}
		tx.ExecContext(ctx, `
			SET LOCAL app.user_id = ?;
		`, studentCustomer.UserID)
		if err := tx.NewSelect().
			Model(&models.User{}).
			Column("email", "name").
			Where("id = ?", studentCustomer.UserID).
			Scan(ctx, studentUser); err != nil {
			return err
		}

		tx.ExecContext(ctx, `
			SET LOCAL app.customer_id = ?;
			SET LOCAL app.subscriber_id = ?;
		`, student.CustomerID, student.CustomerID)
		if err := tx.NewSelect().
			Model(&models.Subscription{}).
			Where("subscriber_id = ?", student.CustomerID).
			Scan(ctx, &sSubscription); err != nil {
			statusCode = codes.PermissionDenied
			log.Errorf("[student.subscriptions] error selecting row: %v", err)
			return errors.New("you do not have enough permissions to access this resource")
		}
		stid, _ := uuid.Parse(sid.StudentID)
		t, _ := time.Parse(time.RFC3339, in.GetDateTime())

		encAccessCode := base64.RawURLEncoding.EncodeToString(in.EncAccessCode)

		hostSessionKeys := make([]*models.AccessCodeManifest, 0, len(in.HostSessionKeys))
		for _, hsk := range in.HostSessionKeys {
			acm := &models.AccessCodeManifest{
				KeyCiphertext: base64.RawURLEncoding.EncodeToString(hsk.KeyCiphertext),
				KeyType:       hsk.KeyType,
			}
			if hsk.KeyType == "passkey" {
				acm.CredentialId = &hsk.CredentialId
			}
			hostSessionKeys = append(hostSessionKeys, acm)
		}

		guestSessionKeys := make([]*models.AccessCodeManifest, 0, len(in.GuestSessionKeys))
		for _, gsk := range in.GuestSessionKeys {
			acm := &models.AccessCodeManifest{
				KeyCiphertext: base64.RawURLEncoding.EncodeToString(gsk.KeyCiphertext),
				KeyType:       gsk.KeyType,
			}
			if gsk.KeyType == "passkey" {
				acm.CredentialId = utils.StringPtr(gsk.CredentialId)
			}
			guestSessionKeys = append(guestSessionKeys, acm)
		}

		appt = &models.Appointment{
			TenantID:    &tutor.TenantID,
			HostID:      tutorID,
			AttendeeID:  stid,
			StartAt:     t,
			Duration:    tutor.SessionDuration,
			EndAt:       t.Add(time.Duration(in.Duration) * time.Minute),
			Status:      models.Pending,
			SessionSalt: new(base64.RawURLEncoding.EncodeToString(in.Salt)),
			SessionMetadata: &models.SessionAccessCode{
				AccessCode:       encAccessCode,
				HostSessionKeys:  hostSessionKeys,
				GuestSessionKeys: guestSessionKeys,
				Salt:             base64.RawURLEncoding.EncodeToString(in.Salt),
			},
		}
		if _, err := tx.NewInsert().Model(appt).Exec(ctx); err != nil {
			statusCode = codes.PermissionDenied
			log.Errorf("[appointments] insert row failed: %v", err)
			return errors.New("could not create appointment")
		}
		bookingID = appt.ID

		log.Infof("Booking ID: %v", bookingID)

		return nil
	}); err != nil {
		log.Errorf("[appointment] Failed to write data to db: %v", err)
		return nil, status.Error(statusCode, "something went wrong")
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
		log.Infof("SessionID: %#v", sid)

		/* sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			return err
		} */

		tx.ExecContext(ctx, `
			SET LOCAL app.tutor_id = ?;
			SET LOCAL app.host_id = ?;
			SET LOCAL app.tenant_id = ?;
			SET LOCAL app.user_id = ?;
			SET LOCAL app.subscriber_id = ?;
			SET LOCAL app.biller_id = ?;
		`,
			tutorID,
			tutorID,
			tutor.TenantID,
			tutorTenant.OwnerID,
			tutor.TenantID,
			tutor.ID,
		)
		tx.ExecContext(ctx, `
			SET LOCAL app.user_id = ?;
			SET LOCAL app.customer_id = ?;

			SET LOCAL app.appointment_id = ?;
		`,
			studentCustomer.UserID,
			student.CustomerID,
			bookingID,
		)

		txn := &models.Transaction{
			InitiatedAt:   utils.AnyPtr(time.Now()),
			Status:        utils.StringPtr("pending"),
			AppointmentID: &bookingID,
			TenantID:      &tutor.TenantID,
			Biller:        &student.ID,
			BilledTo:      &tutor.ID,
			Purpose:       utils.StringPtr("booking_payment"),
			BilledToType:  models.StudentLearner,
		}
		if _, err := tx.NewInsert().Model(txn).Exec(ctx); err != nil {
			statusCode = codes.PermissionDenied
			return err
		}

		return nil
	}); err != nil {
		log.Errorf("[transaction] failed to write Transaction data to db: %v", err)
		return nil, status.Error(statusCode, "not enough permissions to access this resource")
	}

	log.Infof("tutor with subscription: %s", tutor.ID)
	log.Infof("student with subscription: %s", student.ID)

	calm := tutor.CalMetadata
	log.Infof("tutor metadata: %s %#v", calm.Org, tutor)
	calc := lib.NewCalClient()
	bs, err := calc.BookSlot(ctx, in.DateTime, tutor.CalMetadata.EventType.Slug, tutor.CalMetadata.Team.Slug, map[string]any{
		"name":        fmt.Sprintf("%s %s", student.FirstName, student.LastName),
		"timeZone":    utils.CoalesceString(student.Timezone, "Asia/Manila"),
		"email":       studentUser.Email,
		"phoneNumber": studentUser.Phone,
	})
	if err != nil {
		log.Errorf("failed to create booking: %#v", err)
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	log.Infof("[Cal] booked slot: %v", bs)

	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewUpdate().
			Model(&models.Appointment{
				CalBookingId: utils.StringPtr(bs.Uid),
				CalMetadata: &map[string]any{
					"id":          bs.Id,
					"title":       bs.Title,
					"status":      bs.Status,
					"description": bs.Description,
				},
			}).
			OmitZero().
			Where("id = ?", bookingID).
			Exec(ctx); err != nil {
			return err
		}
		return nil
	}); err != nil {
		log.Errorf("failed to update appointment: %v", err)
		return nil, status.Error(codes.Aborted, "aborted")
	}

	/* pm, err := lib.GetStripeCustomerDefaultPaymentMethod(ctx, *sSubscription.StripeCustomerId, nil)
	if err != nil {
		log.Errorf("error return from Stripe response: %v", err)
		return &bookingpb.BookingResponse{
			Status:     "internal error",
			StatusCode: 500,
		}, nil
	} */
	rc := lib.GetRedisClient(ctx)
	connectId := utils.CoalesceString(tutor.StripeConnectId, "no connect id")
	log.Infof("[connectId]: %s", connectId)
	pmId := in.GetPaymentMethod()
	if in.PaymentMethod == nil {
		log.Errorf("[BOOKING] no payment method: %s %v", pmId, in)
		idempKey := fmt.Sprintf("prod:%s:%s", tutor.ID, connectId)
		prod, err := lib.GetOrCreateProduct(fmt.Sprint("1-on-1 Sesssion with ", utils.CoalesceString(&tutor.FirstName, "Tutor")), idempKey, false, "", true, nil)
		if err != nil {
			log.Errorf("[STRIPE] could not retrieve product info: %v", err)
			return &bookingpb.BookingResponse{
				Status:     "Bad request",
				StatusCode: 400,
			}, nil
		}
		paymentMetadata := map[string]string{
			"booking_id": bookingID.String(),
			"purpose":    "booking",
		}
		params := &stripe.PaymentLinkParams{
			Currency: stripe.String("usd"),
			PaymentIntentData: &stripe.PaymentLinkPaymentIntentDataParams{
				SetupFutureUsage: stripe.String("on_session"),
				Metadata:         paymentMetadata,
			},
			LineItems: []*stripe.PaymentLinkLineItemParams{
				{
					Price:    stripe.String(prod.DefaultPrice.ID),
					Quantity: stripe.Int64(1),
				},
			},
			Metadata: paymentMetadata,
		}
		cacheKey := fmt.Sprintf("stripe:paymentLink:%s", bookingID)
		idempKey, err = rc.Get(ctx, cacheKey).Result()
		if errors.Is(err, redis.Nil) {
			idempKey = uuid.NewString()
			rc.Set(ctx, cacheKey, idempKey, 0)
		} else if err != nil {
			log.Errorf("[STRIPE] error reading idemp key from cache: %v", err)
			return nil, status.Error(codes.Internal, "something went wrong")
		}
		pl, err := lib.CreateStripePaymentLink(ctx, idempKey, params)
		if err != nil {
			log.Errorf("[STRIPE] failed to process request: %v", err)
			return &bookingpb.BookingResponse{
				Status:     "something went wrong",
				StatusCode: 500,
			}, nil
		}
		log.Infof("payment link: %s", pl.URL)
		return &bookingpb.BookingResponse{
			Status:     "success",
			StatusCode: 200,
			Data: &bookingpb.BookingResponse_Created{
				Created: &bookingpb.BookingCreateResponse{
					PaymentLink: utils.StringPtr(pl.URL),
				},
			},
		}, nil
	}

	idempKey := fmt.Sprintf("booking:%s", bookingID)

	/* params := &stripe.PaymentLinkParams{
		Params: stripe.Params{
			StripeAccount: stripe.String(connectId),
		},
		Currency: stripe.String("usd"),
		PaymentIntentData: &stripe.PaymentLinkPaymentIntentDataParams{
			SetupFutureUsage: stripe.String("on_session"),
		},
		LineItems: []*stripe.PaymentLinkLineItemParams{
			{
				Price:    stripe.String(prod.DefaultPrice.ID),
				Quantity: stripe.Int64(1),
			},
		},
	}
	cacheKey := fmt.Sprintf("stripe:paymentLink:%s", bookingID)
	idempKey, err = rc.Get(ctx, cacheKey).Result()
	if errors.Is(err, redis.Nil) {
		idempKey = uuid.NewString()
		rc.Set(ctx, cacheKey, idempKey, 0)
	} else if err != nil {
		log.Errorf("[STRIPE] error reading idemp key from cache: %v", err)
		return nil, status.Error(codes.Internal, "something went wrong")
	} */

	amount := utils.Ternary(tutor.SessionPrice > 0, tutor.SessionPrice, 10) * 100
	log.Infof("[BOOKING] amount to charge: %v", amount)
	piParams := &stripe.PaymentIntentParams{
		// Confirm:  stripe.Bool(true),
		Customer: stripe.String(*sSubscription.StripeCustomerId),
		Amount:   stripe.Int64(amount),
		Currency: stripe.String("usd"),
		AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled:        stripe.Bool(true),
			AllowRedirects: stripe.String("never"),
		},
		Metadata: map[string]string{
			"pid":           uid.String(),
			"appointmentID": appt.ID.String(),
		},
	}
	log.Infof("[BOOKING] input params: %#v", in)
	log.Infof("[BOOKING] payment params: %v", piParams)
	if in.PaymentMethod != nil {
		piParams.PaymentMethod = &pmId
		piParams.Confirm = stripe.Bool(true)
	}
	if in.ConfirmationToken != nil {
		piParams.ConfirmationToken = in.ConfirmationToken
	}
	pipBytes, _ := json.Marshal(piParams)
	sig := utils.Hash(pipBytes)
	cacheKey := fmt.Sprintf("stripe:paymentIntent:%s:%s", bookingID, sig)
	idempKey, err = rc.Get(ctx, cacheKey).Result()
	if errors.Is(err, redis.Nil) {
		idempKey = uuid.NewString()
		rc.Set(ctx, cacheKey, idempKey, 0)
	} else if err != nil {
		log.Errorf("[STRIPE] error reading idemp key from cache: %v", err)
		return nil, status.Error(codes.Internal, "something went wrong")
	}
	pi, err := lib.CreateStripePaymentIntent(ctx, idempKey, piParams)
	if err != nil {
		log.Errorf("error returned from Stripe response: %v", err)
		return &bookingpb.BookingResponse{
			Status:     "internal error",
			StatusCode: 500,
		}, nil
	}
	log.Infof("PaymentIntent ID: %s", pi.ID)
	return &bookingpb.BookingResponse{
		Status:     "success",
		StatusCode: 200,
		Data: &bookingpb.BookingResponse_Created{
			Created: &bookingpb.BookingCreateResponse{
				PaymentIntent: utils.StringPtr(pi.ID),
				BookingId:     utils.StringPtr(appt.ID.String()),
			},
		},
	}, nil
}

func (s *BookingServer) List(ctx context.Context, in *bookingpb.BookingList) (*bookingpb.BookingResponse, error) {
	return &bookingpb.BookingResponse{
		Data: &bookingpb.BookingResponse_Listed{
			Listed: &bookingpb.BookingListResponse{
				Items: &anypb.Any{},
			},
		},
	}, nil
}
