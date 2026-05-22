package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/gofiber/fiber/v3/log"
	accountpb "github.com/misterlobo/teachme/generated/v1/account"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/redis/go-redis/v9"
	"github.com/uptrace/bun"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type AccountServer struct {
	accountpb.UnimplementedAccountServiceServer
}

func (s *AccountServer) Setup(ctx context.Context, in *accountpb.AccountSetup) (*accountpb.AccountSetupResponse, error) {
	return &accountpb.AccountSetupResponse{}, nil
}

func (s *AccountServer) Verify(ctx context.Context, in *accountpb.AccountVerify) (*accountpb.AccountVerifyResponse, error) {
	return &accountpb.AccountVerifyResponse{}, nil
}

func (s *AccountServer) Retrieve(ctx context.Context, in *accountpb.AccountRetrieve) (*accountpb.AccountRetrieveResponse, error) {
	rc := lib.GetRedisClient(ctx)
	pid := ctx.Value("pid")
	customerCacheKey := fmt.Sprintf("%s:payment:stripe-customer", pid)
	cacheHit := false
	stripeCustomer, err := rc.Get(ctx, customerCacheKey).Result()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			log.Errorf("[Account] error reading from cache: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}
	} else {
		cacheHit = true
	}
	accountCacheKey := fmt.Sprintf("%s:payment:stripe-account", pid)
	stripeAccount, err := rc.Get(ctx, accountCacheKey).Result()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			log.Errorf("[Account] error reading from cache: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}
	} else {
		cacheHit = true
	}
	subscriptionCacheKey := fmt.Sprintf("%s:payment:stripe-subscription", pid)
	stripeSubscription, err := rc.Get(ctx, subscriptionCacheKey).Result()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			log.Errorf("[Account] error reading from cache: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}
	} else {
		cacheHit = true
	}
	if cacheHit {
		return &accountpb.AccountRetrieveResponse{
			Account: &accountpb.AccountRetrieveResponse_AccountId{
				AccountId: stripeAccount,
			},
			Customer: &accountpb.AccountRetrieveResponse_CustomerId{
				CustomerId: stripeCustomer,
			},
			Subscription: &accountpb.AccountRetrieveResponse_SubscriptionId{
				SubscriptionId: stripeSubscription,
			},
		}, nil
	}

	db := db.GetDb()
	sub := new(models.Subscription)
	tut := new(models.Tutor)
	statusCode := codes.OK
	statusMessage := "OK"
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
		log.Infof("SesssionID: %#v", sid)
		if _, err := tx.ExecContext(ctx, `
			SET LOCAL app.subscriber_id = ?;
			SET LOCAL app.user_id = ?;
		`, sid.SubscriberID, sid.UserID); err != nil {
			return err
		}
		if in.Account != nil && *in.Account {
			if _, err := tx.ExecContext(ctx, `
			SET LOCAL app.tutor_id = ?;
		`, sid.TutorID); err != nil {
				return err
			}
			if err := tx.NewSelect().
				Model(&models.Tutor{}).
				Column("stripe_connect_id").
				Where("id = ?", sid.TutorID).
				Scan(ctx, tut); err != nil {
				statusCode = codes.NotFound
				statusMessage = "tutor not found"
				return err
			}
		}

		if err := tx.NewSelect().
			Model(&models.Subscription{}).
			Column("stripe_customer_id").
			Column("stripe_subscription_id").
			Where("subscriber_id = ?", sid.SubscriberID).
			Scan(ctx, sub); err != nil {
			statusCode = codes.NotFound
			statusMessage = "subscriber not found"
			return err
		}
		return nil
	}); err != nil {
		log.Errorf("[account] there was en error: %v", err)
		return nil, status.Error(statusCode, statusMessage)
	}
	log.Infof("SUB: %#v", sub)

	return &accountpb.AccountRetrieveResponse{
		/* Account: &accountpb.AccountRetrieveResponse_AccountId{
			AccountId: utils.CoalesceString(tut.StripeConnectId, ""),
		}, */
		Customer: &accountpb.AccountRetrieveResponse_CustomerId{
			CustomerId: utils.CoalesceString(sub.StripeCustomerId, ""),
		},
		Subscription: &accountpb.AccountRetrieveResponse_SubscriptionId{
			SubscriptionId: utils.CoalesceString(sub.StripeSubscriptionId, ""),
		},
	}, nil
}
