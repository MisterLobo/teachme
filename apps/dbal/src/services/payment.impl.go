package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/gofiber/fiber/v3/log"
	"github.com/misterlobo/teachme/generated/v1/account"
	paymentpb "github.com/misterlobo/teachme/generated/v1/payment"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/redis/go-redis/v9"
	"github.com/stripe/stripe-go/v85"
	"github.com/uptrace/bun"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type PaymentServer struct {
	paymentpb.UnimplementedPaymentServiceServer
	AccountServer *AccountServer
}
type paymentSetupIntentData struct {
	ID           string  `json:"id"`
	ClientSecret string  `json:"clientSecret"`
	CustomerId   *string `json:"customerId"`
}
type paymentSetupIntentCache struct {
	IntentData *paymentSetupIntentData
}

func (s *PaymentServer) Setup(ctx context.Context, in *paymentpb.PaymentSetup) (*paymentpb.PaymentSetupResponse, error) {
	setverName := "PaymentServer#Setup"
	pid := ctx.Value("pid")
	var stripeCustomerId string
	ar, err := s.AccountServer.Retrieve(ctx, &account.AccountRetrieve{
		Customer: utils.BoolPtr(true),
	})
	if err != nil {
		log.Errorf("[ACCOUNT] AccountServer returned error: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	switch ar.Customer.(type) {
	case *account.AccountRetrieveResponse_CustomerId:
		stripeCustomerId = ar.GetCustomerId()
	}
	idemp := fmt.Sprintf("%s:payment:setup:%s:%s", pid, stripeCustomerId, in.RecipientId)
	rc := lib.GetRedisClient(ctx)
	cache, err := rc.JSONGet(ctx, idemp).Result()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			log.Errorf("[%s] error reading from cache with key=%s: %v", setverName, idemp, err)
			return nil, status.Error(codes.Internal, "internal error")
		}
	} else {
		// cache HIT
		log.Infof("[PAYMENT] data from cache: %v", cache)
		intentCached := &paymentSetupIntentCache{}
		if err := json.Unmarshal([]byte(cache), intentCached); err != nil {
			log.Errorf("[%s] could not deserialize json with key=%s: %v", setverName, idemp, err)
			return nil, status.Error(codes.Internal, "internal error")
		}
		log.Infof("[PAYMENT] cached: %#v", intentCached)
		// intentCache := intentCached[0]
		return &paymentpb.PaymentSetupResponse{
			SetupIntentId: intentCached.IntentData.ID,
			ClientSecret:  &intentCached.IntentData.ClientSecret,
		}, nil
	}
	// cache MISS
	si, err := lib.CreateStripeSetupIntent(ctx, idemp, &stripe.SetupIntentParams{
		Customer:           &stripeCustomerId,
		PaymentMethodTypes: []*string{stripe.String("card")},
	})
	if err != nil {
		log.Errorf("[PAYMENT]: error from stripe: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	log.Infof("[PAYMENT] SetupIntent: %#v", si)
	icd := &paymentSetupIntentCache{
		IntentData: &paymentSetupIntentData{
			ID:           si.ID,
			ClientSecret: si.ClientSecret,
			CustomerId:   &stripeCustomerId,
		},
	}
	rc.JSONSet(ctx, idemp, "$", icd)
	// rc.JSONSet(ctx, idemp, "$.intentData", si)
	// rc.Expire(ctx, idemp, 10*time.Minute)

	return &paymentpb.PaymentSetupResponse{
		SetupIntentId: si.ID,
		ClientSecret:  &si.ClientSecret,
	}, nil
}

func (s *PaymentServer) Process(ctx context.Context, in *paymentpb.PaymentProcess) (*paymentpb.PaymentProcessResponse, error) {
	return &paymentpb.PaymentProcessResponse{}, nil
}

func (s *PaymentServer) ListMethods(ctx context.Context, in *paymentpb.PaymentListMethods) (*paymentpb.PaymentListMethodsResponse, error) {
	// pid := ctx.Value("pid")
	// ctx = context.WithValue(ctx, "pid", pid)
	acc, err := s.AccountServer.Retrieve(ctx, &account.AccountRetrieve{
		Customer: utils.BoolPtr(true),
	})
	if err != nil {
		log.Errorf("[PAYMENT] AccountServer returned error: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	pm, err := lib.GetPaymentMethods(ctx, &stripe.PaymentMethodListParams{
		Customer: stripe.String((*acc).GetCustomerId()),
	})
	if err != nil {
		log.Errorf("[PAYMENT] Stripe returned error: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}

	protopm := make([]*paymentpb.PaymentMethod, 0, len(pm))

	for _, p := range pm {
		protopm = append(protopm, &paymentpb.PaymentMethod{
			Id: p.ID,
			Card: &paymentpb.PaymentMethodCard{
				Last4:        p.Card.Last4,
				ExpMonth:     p.Card.ExpMonth,
				ExpYear:      p.Card.ExpYear,
				Brand:        utils.StringPtr(string(p.Card.Brand)),
				DisplayBrand: &p.Card.DisplayBrand,
				Country:      &p.Card.Country,
				Description:  &p.Card.Description,
				Issuer:       &p.Card.Issuer,
				Fingerprint:  &p.Card.Fingerprint,
			},
		})
	}

	return &paymentpb.PaymentListMethodsResponse{
		Status: "OK",
		Data:   protopm,
	}, nil
}

func (s *PaymentServer) AttachMethod(ctx context.Context, in *paymentpb.PaymentAttachMethod) (*paymentpb.PaymentAttachMethodResponse, error) {
	pid := ctx.Value("pid")
	// rc := lib.GetRedisClient(ctx)
	// db := db.GetDb()
	var stripeCustomerId string
	ar, err := s.AccountServer.Retrieve(ctx, &account.AccountRetrieve{
		Customer: utils.BoolPtr(true),
	})
	if err != nil {
		log.Errorf("[ACCOUNT] AccountServer returned error: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	switch ar.Customer.(type) {
	case *account.AccountRetrieveResponse_CustomerId:
		stripeCustomerId = ar.GetCustomerId()
	}
	db := ctx.Value("db").(*bun.DB)
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			return err
		}
		log.Infof("SesssionID: %#v", sid)

		return nil
	}); err != nil {
		log.Errorf("[ATTACH] Stripe returned error: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}

	pm, err := lib.AttachPaymentMethod(ctx, fmt.Sprintf("%s:payment-method:attach:%s", pid, in.GetId()), in.GetId(), &stripe.PaymentMethodAttachParams{
		Customer: stripe.String(stripeCustomerId),
	})
	if err != nil {
		log.Errorf("[PAYMENT] Stripe returned error: %v", err)
		return nil, status.Error(codes.Internal, "internal error")
	}
	return &paymentpb.PaymentAttachMethodResponse{
		Status:     "OK",
		StatusCode: utils.IntPtr64(200),
		AttachedId: &pm.ID,
	}, nil
}
