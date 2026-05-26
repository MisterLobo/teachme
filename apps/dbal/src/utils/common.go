package utils

import (
	"math"
	"strings"

	"github.com/gofiber/fiber/v3/log"
)

func BoolPtr(value bool) *bool {
	return &value
}

func StringPtr(value string) *string {
	return &value
}

func IntPtr(value int) *int {
	return &value
}

func Int32Ptr(value int32) *int32 {
	return &value
}

func IntPtr64(value int64) *int64 {
	return &value
}

func UintPtr(value uint) *uint {
	return &value
}

func Uint64Ptr(value uint64) *uint64 {
	return &value
}

func MapPtr(value map[string]any) *map[string]any {
	return &value
}

func F32Ptr(value float32) *float32 {
	return &value
}

func F64Ptr(value float64) *float64 {
	return &value
}

func Coalesce[T comparable](t *T, defaultValue T) T {
	log.Infof("Coalesce args: %v %v", t, defaultValue)
	if t != nil {
		return *t
	}
	return defaultValue
}

func CoalesceString(t *string, defaultValue string) string {
	if t != nil && strings.Trim(string(*t), " ") == "" {
		return defaultValue
	}
	return Coalesce(t, defaultValue)
}

func NullIf[T comparable](a *T, b *T) *T {
	if a == nil || b == nil {
		return nil
	}
	return a
}

func Ternary[T any](condition bool, truePart T, falsePart T) T {
	if condition {
		return truePart
	}
	return falsePart
}

func TernaryFunc[T any](condition bool, truePart func(args ...any) T, falsePart func(args ...any) T, args ...any) T {
	if condition {
		return truePart(args...)
	}
	return falsePart(args...)
}

func AnyPtr[T any](t T) *T {
	return &t
}

func Clamp(value int, min int, max int) (int, int) {
	lower := math.Max(float64(value), float64(min))
	upper := math.Min(float64(value), float64(max))
	return int(lower), int(upper)
}
