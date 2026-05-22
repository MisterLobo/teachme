package lib

import (
	"context"
	"fmt"
	"os"

	"github.com/gofiber/fiber/v3/log"
	"github.com/stripe/stripe-go/v85"
	"github.com/stripe/stripe-go/v85/account"
	"github.com/stripe/stripe-go/v85/billing/creditgrant"
	"github.com/stripe/stripe-go/v85/coupon"
	"github.com/stripe/stripe-go/v85/customer"
	"github.com/stripe/stripe-go/v85/file"
	"github.com/stripe/stripe-go/v85/invoice"
	"github.com/stripe/stripe-go/v85/paymentintent"
	"github.com/stripe/stripe-go/v85/paymentlink"
	"github.com/stripe/stripe-go/v85/paymentmethod"
	"github.com/stripe/stripe-go/v85/price"
	"github.com/stripe/stripe-go/v85/product"
	"github.com/stripe/stripe-go/v85/promotioncode"
	"github.com/stripe/stripe-go/v85/refund"
	"github.com/stripe/stripe-go/v85/setupintent"
	"github.com/stripe/stripe-go/v85/subscription"
	"github.com/stripe/stripe-go/v85/subscriptionschedule"
	"github.com/stripe/stripe-go/v85/transfer"
)

func LoadStripe() {
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
}

var sc *stripe.Client

func GetStripeClient() *stripe.Client {
	if sc != nil {
		return sc
	}
	c := stripe.NewClient(os.Getenv("STRIPE_SECRET_KEY"))
	sc = c
	return c
}

func GetOrCreateProduct(name string, idemp string, recurring bool, interval string, forAccount bool, account *string) (*stripe.Product, error) {
	p := &stripe.ProductSearchParams{
		SearchParams: stripe.SearchParams{
			Query: fmt.Sprintf("name~'%s' AND active:'true'", name),
		},
	}
	searchResult := product.Search(p)
	if searchResult.Err() != nil {
		log.Errorf("[Stripe] search returned error: %v", searchResult.Err())
		return nil, searchResult.Err()
	}
	// prod := searchResult.Product()
	var prod *stripe.Product
	for searchResult.Next() {
		prod = searchResult.Product()
		log.Infof("[Stripe] Product: %v", prod)
	}
	if prod != nil {
		return prod, nil
	}
	params := &stripe.ProductParams{
		Name: stripe.String(name),
		DefaultPriceData: &stripe.ProductDefaultPriceDataParams{
			UnitAmount: stripe.Int64(0),
			Currency:   stripe.String("usd"),
		},
	}
	if recurring {
		params.DefaultPriceData.Recurring = &stripe.ProductDefaultPriceDataRecurringParams{
			Interval: stripe.String("month"),
		}
	}
	if forAccount {
		params.Params = stripe.Params{
			StripeAccount: account,
		}
	}
	params.SetIdempotencyKey(idemp)
	productResult, err := product.New(params)
	if err != nil {
		log.Errorf("[Stripe] failed to create product: %v", err)
		return nil, err
	}
	if productResult == nil {
		log.Errorf("[Stripe] product was not created: %s", *params.Name)
		return nil, err
	}
	return productResult, nil
}

func GetOrCreatePrice(product string, lookupKey string, idemp string) *stripe.Price {
	p := &stripe.PriceSearchParams{
		SearchParams: stripe.SearchParams{
			Query: fmt.Sprintf("product:'%s' AND lookup_key:'%s' AND active:'true'", product, lookupKey),
		},
	}
	searchResult := price.Search(p)
	var prc *stripe.Price
	for searchResult.Next() {
		prc = searchResult.Price()
		log.Infof("[Stripe] Price: %s %s %s", prc.ID, prc.LookupKey, prc.Nickname)
	}
	if prc != nil {
		return prc
	}
	params := &stripe.PriceParams{
		Nickname:   stripe.String("price"),
		Product:    &product,
		LookupKey:  &lookupKey,
		Currency:   stripe.String("usd"),
		UnitAmount: stripe.Int64(0),
		Recurring: &stripe.PriceRecurringParams{
			Interval:        stripe.String("month"),
			TrialPeriodDays: stripe.Int64(30),
		},
	}
	params.SetIdempotencyKey(idemp)
	priceResult, err := price.New(params)
	if err != nil {
		return nil
	}
	return priceResult
}

func CreateStripeAccount(
	ctx context.Context,
	idempKey string,
	params *stripe.V2CoreAccountCreateParams,
) (*stripe.V2CoreAccount, error) {
	sc := GetStripeClient()
	params.SetIdempotencyKey(idempKey)
	return sc.V2CoreAccounts.Create(ctx, params)
}

func CreateStripeConnectAccount(ctx context.Context, idempKey string, params *stripe.AccountParams) (*stripe.Account, error) {
	params.SetIdempotencyKey(idempKey)
	return account.New(params)
}
func CreateStripeCustomer(ctx context.Context, idempKey string, params *stripe.CustomerParams) (*stripe.Customer, error) {
	params.SetIdempotencyKey(idempKey)
	return customer.New(params)
}
func CreateStripeSubscription(ctx context.Context, idempKey string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
	params.SetIdempotencyKey(idempKey)
	return subscription.New(params)
}
func CreateStripeInvoice(ctx context.Context, idempKey string, params *stripe.InvoiceParams) (*stripe.Invoice, error) {
	params.SetIdempotencyKey(idempKey)
	return invoice.New(params)
}
func CreateStripePaymentIntent(ctx context.Context, idempKey string, params *stripe.PaymentIntentParams) (*stripe.PaymentIntent, error) {
	params.SetIdempotencyKey(idempKey)
	return paymentintent.New(params)
}
func ConfirmPaymentIntent(ctx context.Context, idempkey string, id string, params *stripe.PaymentIntentConfirmParams) (*stripe.PaymentIntent, error) {
	if params != nil {
		params.SetIdempotencyKey(idempkey)
	}
	return paymentintent.Confirm(id, params)
}
func CreateStripeSetupIntent(ctx context.Context, idempKey string, params *stripe.SetupIntentParams) (*stripe.SetupIntent, error) {
	params.SetIdempotencyKey(idempKey)
	return setupintent.New(params)
}
func CreateStripeRefund(ctx context.Context, idempKey string, params *stripe.RefundParams) (*stripe.Refund, error) {
	params.SetIdempotencyKey(idempKey)
	return refund.New(params)
}
func CreateStripeTransfer(ctx context.Context, idempKey string, params *stripe.TransferParams) (*stripe.Transfer, error) {
	params.SetIdempotencyKey(idempKey)
	return transfer.New(params)
}
func CreateStripeAccountLink(ctx context.Context, idempKey string, params *stripe.V2CoreAccountLinkCreateParams) (*stripe.V2CoreAccountLink, error) {
	sc := GetStripeClient()
	params.SetIdempotencyKey(idempKey)
	return sc.V2CoreAccountLinks.Create(ctx, params)
}
func CreateStripeFile(ctx context.Context, idempKey string, params *stripe.FileParams) (*stripe.File, error) {
	params.SetIdempotencyKey(idempKey)
	return file.New(params)
}
func CreateStripePromoCode(ctx context.Context, idempKey string, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
	return promotioncode.New(params)
}
func CreateStripeCoupon(ctx context.Context, idempKey string, params *stripe.CouponParams) (*stripe.Coupon, error) {
	params.SetIdempotencyKey(idempKey)
	return coupon.New(params)
}
func CreateStripeCreditGrant(ctx context.Context, idempKey string, params *stripe.BillingCreditGrantParams) (*stripe.BillingCreditGrant, error) {
	params.SetIdempotencyKey(idempKey)
	return creditgrant.New(params)
}
func CreateStripeSubscriptionSchedule(ctx context.Context, idempKey string, params *stripe.SubscriptionScheduleParams) (*stripe.SubscriptionSchedule, error) {
	params.SetIdempotencyKey(idempKey)
	return subscriptionschedule.New(params)
}
func CreateStripePaymentLink(ctx context.Context, idempKey string, params *stripe.PaymentLinkParams) (*stripe.PaymentLink, error) {
	params.SetIdempotencyKey(idempKey)
	return paymentlink.New(params)
}
func GetStripeCustomerDefaultPaymentMethod(ctx context.Context, customerId string, params *stripe.CustomerParams) (*stripe.PaymentMethod, error) {
	cus, err := customer.Get(customerId, params)
	if err != nil {
		return nil, err

	}
	return cus.InvoiceSettings.DefaultPaymentMethod, nil
}
func GetStripeSubscription(ctx context.Context, subscriptionId string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
	return subscription.Get(subscriptionId, params)
}
func GetStripeAccount(ctx context.Context, accountId string, params *stripe.AccountParams) (*stripe.Account, error) {
	return account.GetByID(accountId, params)
}
func GetStripeCustomer(ctx context.Context, customerId string, params *stripe.CustomerParams) (*stripe.Customer, error) {
	return customer.Get(customerId, params)
}
func GetPaymentMethods(ctx context.Context, params *stripe.PaymentMethodListParams) ([]*stripe.PaymentMethod, error) {
	list := paymentmethod.List(params)
	pm := make([]*stripe.PaymentMethod, 0)
	for list.Next() {
		pm = append(pm, list.PaymentMethod())
	}

	return pm, nil
}
func AttachPaymentMethod(ctx context.Context, idemp string, id string, params *stripe.PaymentMethodAttachParams) (*stripe.PaymentMethod, error) {
	if params != nil {
		params.SetIdempotencyKey(idemp)
	}
	return paymentmethod.Attach(id, params)
}
