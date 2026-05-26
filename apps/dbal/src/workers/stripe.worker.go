package workers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/redis/go-redis/v9"
	"github.com/stripe/stripe-go/v85"
	"github.com/uptrace/bun"
)

const (
	StripeAccountsCreate      = "stripe.accounts.create"
	StripeSubscriptionsCreate = "stripe.subscriptions.create"
	StripeCustomersCreate     = "stripe.customers.create"
)

type BackgroundWorker interface {
	HandleWork(ctx context.Context, t *asynq.Task) error
}

type StripeAccountsCreateWorkerArgs struct {
	User models.UserCreated
}
type StripeAccountsCreateWorker struct {
	Name string
}

func (s *StripeAccountsCreateWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	var p *StripeAccountsCreateWorkerArgs
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("[%s] json.Unmarshal failed: %v", s.Name, err)
	}
	pid := p.User.PID.String()
	log.Printf("[%s] Received message from %s", pid, s.Name)
	cacheKey := fmt.Sprintf("worker:{%s}", pid)
	rc := lib.GetRedisClient(ctx)
	jid := rc.JSONGet(ctx, cacheKey, "$.jobID").Val()
	jobID, _ := uuid.Parse(jid)
	log.Printf("[worker] starting worker with id: %s", jobID)
	j := rc.JSONGet(ctx, fmt.Sprintf("worker:{%s}", pid), "$.data").Val()
	var data []*models.UserCreated
	err := json.Unmarshal([]byte(j), &data)
	if err != nil {
		slog.Error("[worker] failed to deserialize json: ", "error", err.Error(), "worker", s.Name)
		return asynq.SkipRetry
	}
	uc := data[0]
	log.Printf("[%s] user from redis: %v", s.Name, uc)

	params := &stripe.V2CoreAccountCreateParams{
		ContactEmail: stripe.String(uc.User.Email),
		DisplayName:  stripe.String(uc.User.Name),
		Identity: &stripe.V2CoreAccountCreateIdentityParams{
			EntityType: stripe.String("individual"),
			Country:    stripe.String("us"),
		},
		Configuration: &stripe.V2CoreAccountCreateConfigurationParams{
			Merchant: &stripe.V2CoreAccountCreateConfigurationMerchantParams{
				Capabilities: &stripe.V2CoreAccountCreateConfigurationMerchantCapabilitiesParams{
					CardPayments: &stripe.V2CoreAccountCreateConfigurationMerchantCapabilitiesCardPaymentsParams{
						Requested: stripe.Bool(true),
					},
				},
				CardPayments: &stripe.V2CoreAccountCreateConfigurationMerchantCardPaymentsParams{
					DeclineOn: &stripe.V2CoreAccountCreateConfigurationMerchantCardPaymentsDeclineOnParams{
						AVSFailure: stripe.Bool(true),
						CVCFailure: stripe.Bool(true),
					},
				},
			},
			Recipient: &stripe.V2CoreAccountCreateConfigurationRecipientParams{},
		},
		Defaults: &stripe.V2CoreAccountCreateDefaultsParams{
			Responsibilities: &stripe.V2CoreAccountCreateDefaultsResponsibilitiesParams{
				FeesCollector:   stripe.String("application"),
				LossesCollector: stripe.String("application"),
			},
		},
		Dashboard: stripe.String("express"),
		Include: []*string{
			stripe.String("configuration.merchant"),
			stripe.String("configuration.customer"),
			stripe.String("configuration.recipient"),
			stripe.String("requirements"),
			stripe.String("identity"),
			stripe.String("defaults"),
		},
	}
	log.Printf("[%s] creating account", s.Name)
	idempCacheKey := fmt.Sprintf("%s:idemp:stripe-account", uc.ID)
	idem, err := rc.Get(ctx, idempCacheKey).Result()
	log.Println("-----------------> ", errors.Is(err, redis.Nil), " <-----------------")
	if errors.Is(err, redis.Nil) {
		idem = uuid.NewString()
		rc.Set(ctx, idempCacheKey, idem, 0)
	} else if err != nil {
		log.Printf("[%s] error reading idemp from cache: %v", s.Name, err)
		return err
	}
	log.Printf("[%s] creating account", s.Name)
	account, err := lib.CreateStripeAccount(ctx, idem, params)
	if err != nil {
		log.Printf("[%s] error creating account: %v", s.Name, err)
		return err
	}
	log.Printf("[%s] finished creating account", s.Name)
	log.Printf("[%s] new account: %s", s.Name, account.ID)

	rc.Set(ctx, fmt.Sprintf("%s:stripe-account", pid), account.ID, 0)

	db := db.GetDb()
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewUpdate().
			Model(&models.Tutor{}).
			Set("stripe_connect_id = ?", account.ID).
			Where("id = ?", uc.Tutor.ID).
			Exec(ctx); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	return nil
}

type StripeSubscriptionCreateWorker struct {
	Name string
}
type StripeSubscriptionCreateWorkerArgs struct {
	PID                    uuid.UUID
	StripeCustomerId       string
	StripeCustomerMetadata map[string]string
}

func (s *StripeSubscriptionCreateWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	var p *StripeSubscriptionCreateWorkerArgs
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("[%s] json.Unmarshal failed: %v", s.Name, err)
	}
	pid := p.PID.String()
	cacheKey := fmt.Sprintf("worker:{%s}", pid)
	log.Printf("[%s] Received message from %s", pid, s.Name)
	rc := lib.GetRedisClient(ctx)
	jidc := rc.JSONGet(ctx, cacheKey, "$.jobID").Val()
	log.Printf("cache data: %s", jidc)
	var jids []*uuid.UUID
	err := json.Unmarshal([]byte(jidc), &jids)
	if err != nil {
		log.Printf("[worker:%s] invalid worker id '%s': %v", s.Name, jidc, err)
		return asynq.SkipRetry
	}
	jobID := jids[0]
	log.Printf("[worker] starting worker with id: %s", jobID)
	j := rc.JSONGet(ctx, fmt.Sprintf("worker:{%s}", pid), "$.data").Val()
	var data []*models.UserCreated
	err = json.Unmarshal([]byte(j), &data)
	if err != nil {
		slog.Error("[StripeSubscriptionCreateWorker] failed to deserialize json: ", "error", err.Error(), "worker", jobID)
		return asynq.SkipRetry
	}
	uc := data[0]
	log.Printf("[%s] user from redis: %v", s.Name, uc)

	idemp, _ := uuid.NewV7()
	prod, _ := lib.GetOrCreateProduct("Free Trialz", idemp.String(), true, "month", false, nil)
	idemp, _ = uuid.NewV7()

	price := prod.DefaultPrice.ID
	stripeCustomerId := p.StripeCustomerId
	params := &stripe.SubscriptionParams{
		Customer:        stripe.String(stripeCustomerId),
		TrialPeriodDays: stripe.Int64(30),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(price),
			},
		},
	}
	idemp, _ = uuid.NewV7()
	result, err := lib.CreateStripeSubscription(ctx, idemp.String(), params)
	if err != nil {
		log.Printf("[%s] could not create subscription: %v", jobID, err)
		return err
	}
	log.Printf("[%s] new Stripe subscription: %s", jobID, result.ID)
	log.Printf("[%s] cacheKey: %s", jobID, cacheKey)
	rc.JSONSet(ctx, cacheKey, "$.stripeSubscription", &result)
	rc.Set(ctx, fmt.Sprintf("%s:stripe-subscription", pid), result.ID, 0)

	db := db.GetDb()
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		uid := uc.PID
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, uid); err != nil {
			return err
		}
		trialStartsAt := time.Unix(result.TrialStart, 0)
		trialEndsAt := time.Unix(result.TrialEnd, 0)
		periodStartsAt := time.Unix(result.StartDate, 0)
		cancelAt := time.Unix(result.CancelAt, 0)
		canceledAt := time.Unix(result.CanceledAt, 0)
		cancelReason := string(result.CancellationDetails.Reason)
		var trialDuration uint = 30

		status := string(result.Status)
		sub := &models.Subscription{
			ID:                   uc.Subscription.ID,
			StripeProductId:      &prod.ID,
			StripePriceId:        &price,
			StripeCustomerId:     &stripeCustomerId,
			StripeSubscriptionId: &result.ID,
			TrialStartsAt:        &trialStartsAt,
			TrialEndsAt:          &trialEndsAt,
			TrialDuration:        &trialDuration,
			Status:               &status,
			PeriodStart:          &periodStartsAt,
			CancelAt:             &cancelAt,
			CanceledAt:           &canceledAt,
			CancelReason:         &cancelReason,
		}
		if _, err := tx.NewUpdate().
			Model(&models.Subscription{}).
			Where("id = ?", sub.ID).
			// Set("subscriber_id = ?", &sub.ID).
			Set("stripe_product_id = ?", &sub.StripeProductId).
			Set("stripe_price_id = ?", &sub.StripePriceId).
			Set("stripe_customer_id = ?", &sub.StripeCustomerId).
			Set("stripe_subscription_id = ?", &sub.StripeSubscriptionId).
			Set("trial_starts_at = ?", &sub.TrialStartsAt).
			Set("trial_ends_at = ?", &sub.TrialEndsAt).
			Set("trial_duration = ?", &sub.TrialDuration).
			Set("status = ?", &sub.Status).
			Set("cancel_at = ?", &sub.CancelAt).
			Set("canceled_at = ?", &sub.CanceledAt).
			Set("cancel_reason = ?", &sub.CancelReason).
			Exec(ctx); err != nil {
			log.Printf("[%s] Failed to update user subscription: %v", s.Name, err)
			return err
		}

		return nil
	}); err != nil {
		log.Printf("[%s] error updating subscription %s: %v", s.Name, uc.Subscription.ID, err)
		return err
	}
	return nil
}

type StripeCustomerCreateWorker struct {
	Name string
}
type StripeCustomerCreateWorkerArgs struct {
	User models.UserCreated
}

func (s *StripeCustomerCreateWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	var p *StripeCustomerCreateWorkerArgs
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("[%s] json.Unmarshal failed: %v", s.Name, err)
	}
	pid := p.User.PID.String()
	cacheKey := fmt.Sprintf("worker:{%s}", pid)
	log.Printf("[%s] Received message from %s", pid, s.Name)
	rc := lib.GetRedisClient(ctx)
	jidc := rc.JSONGet(ctx, cacheKey, "$.jobID").Val()
	var jids []*uuid.UUID
	err := json.Unmarshal([]byte(jidc), &jids)
	if err != nil {
		log.Printf("[worker:%s] invalid worker id '%s': %v", s.Name, jidc, err)
		return asynq.SkipRetry
	}
	jobID := jids[0]
	log.Printf("[worker:%s] starting worker with id: %s", s.Name, jobID)
	j := rc.JSONGet(ctx, fmt.Sprintf("worker:{%s}", pid), "$.data").Val()
	var data []*models.UserCreated
	err = json.Unmarshal([]byte(j), &data)
	if err != nil {
		slog.Error("[worker] failed to deserialize json: ", "error", err.Error(), "worker", s.Name)
		return asynq.SkipRetry
	}
	uc := data[0]
	log.Printf("[%s] user from redis: %v", s.Name, uc)

	params := &stripe.CustomerParams{
		Email: stripe.String(uc.User.Email),
		Name:  stripe.String(uc.User.Name),
		Metadata: map[string]string{
			"pid": pid,
		},
	}
	params.IdempotencyKey = utils.StringPtr(fmt.Sprintf("%s:customer", pid))
	result, err := lib.CreateStripeCustomer(ctx, jobID.String(), params)
	if err != nil {
		log.Printf("[%s] failed to create Stripe customer: %v", jobID, err)
		return err
	}
	log.Printf("[%s] new Stripe customer: %s", jobID, result.ID)

	rc.JSONSet(ctx, cacheKey, "$.stripeCustomerID", result.ID)
	rc.Set(ctx, fmt.Sprintf("%s:stripe-customer", pid), result.ID, 0)

	ssubPayload, err := json.Marshal(StripeSubscriptionCreateWorkerArgs{
		PID:                    p.User.PID,
		StripeCustomerId:       result.ID,
		StripeCustomerMetadata: result.Metadata,
	})
	tc := lib.GetTaskClient()
	defer tc.Close()
	ssubTask := asynq.NewTask(StripeSubscriptionsCreate, ssubPayload)
	_, err = tc.Enqueue(ssubTask, asynq.Queue("critical"))
	if err != nil {
		log.Printf("[worker] could not enqueue task: %v", err)
		return err
	}

	return nil
}
