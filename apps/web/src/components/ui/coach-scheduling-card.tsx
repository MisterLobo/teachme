"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Star, SearchIcon } from "lucide-react";
import { bytesFromBase64, bytesToBase64, cn, createAccessCode, exportKey, exportPublicKey, importKey, importX25519PublicKey, secureRandomBytes } from "@/lib/utils";
import { addPaymentMethod, confirmBooking, createCheckout, createPayment, getPaymentMethods, getTutorDetails, getTutorPubKeys, getUserKeys, setupPayment } from "@/lib/actions";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Field, FieldContent, FieldDescription, FieldLabel } from "./field";
import { Combobox, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxPopup, ComboboxTrigger, ComboboxValue } from "./combobox";
import { SelectButton } from "./select";
import { CardElement, Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, StripeCardElement, StripeElements, StripePaymentElement } from '@stripe/stripe-js'
import { CardPaymentMethod, useStripeStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Button } from "./button";
import { toast } from "sonner";

interface TimeSlot {
  isoDate?: string;
  time: string;
  available: boolean;
}

interface DaySchedule {
  isoDate?: string;
  date: string;
  dayName: string;
  dayNumber: number;
  slots: TimeSlot[];
  hasAvailability: boolean;
}

interface Coach {
  name: string;
  title: string;
  location: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
}

export type AvailableTimeSlots = {
  start: string,
}
export type AvailableSlots = {
  dateSlot: string,
  timeSlots: AvailableTimeSlots[],
}

interface CoachSchedulingProps {
  coach?: Coach;
  locations?: string[];
  weekSchedule?: DaySchedule[];
  onLocationChange?: (location: string) => void;
  onTimeSlotSelect?: (day: string, time: string) => void;
  onWeekChange?: (direction: "prev" | "next") => void;
  enableAnimations?: boolean;
  className?: string;
  recordId: string;
  record: Record<string, any>,
  availableSlots: AvailableSlots[],
  timezone: string,
}

const defaultCoach: Coach = {
  name: "Michael Baumgardner",
  title: "Tennis coach",
  location: "New York",
  rating: 5.0,
  reviewCount: 7,
  imageUrl: "https://images.unsplash.com/photo-1660463532854-f887f2a6c674"
};

const stripeLoader = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export function CoachSchedulingCard({
  coach = defaultCoach,
  onLocationChange,
  onTimeSlotSelect,
  onWeekChange,
  recordId,
  timezone: tz,
  record,
  enableAnimations = true,
  availableSlots,
  className
}: CoachSchedulingProps) {
  const router = useRouter()
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([])
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [weekRange] = useState('Apr 5 - Apr 11');
  const [showConfirmationView, setShowConfirmationView] = useState(false);
  const [dateTime, setDateTime] = useState<string>()
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{day: string, time: string, dayName: string} | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = enableAnimations && !shouldReduceMotion;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [timezone, setTimezone] = useState(tz)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>()
  const stripeStore = useStripeStore()
  const addMany = useStripeStore(state => state.addPaymentMethods)
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading, refetch } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: async () => {
      const pm = await getPaymentMethods()
      if (!pm) {
        return []
      }
      addMany(...(pm as CardPaymentMethod[]))
      return pm
    },
    // staleTime: 1000 * 60 * 10,
  })
  const methods: CardPaymentMethod[] = useMemo(() => {
    return Array.from(paymentMethods).map(pm => pm as CardPaymentMethod)
  }, [paymentMethodsLoading])
  const {
    bookingFee,
    totalAmount,
  } = useMemo(() => {
    const price = Number(record.sessionPrice) ?? 0
    const bookingFeeAmount = price * .05
    const total = price + bookingFeeAmount
    return {
      bookingFee: bookingFeeAmount,
      totalAmount: total,
    }
  }, [record])

  useEffect(() => {
    console.log('freeSlots:', availableSlots)
  }, [availableSlots])

  const dates = useMemo(() => {
    if (!availableSlots) return
    const entries = availableSlots.map(availableSlot => {
      const timeSlots = availableSlot.timeSlots.map(ts => {
        const hh = new Date(ts.start).getHours().toString().padStart(2, '0')
        const mm = new Date(ts.start).getMinutes().toString().padStart(2, '0')
        return { start: ts.start, date: availableSlot.dateSlot, time: `${hh}:${mm}` }
      })
      return timeSlots
    })
    /* const entries = Object.entries(availableSlots).map(([k, v]) => {
      const slots = Array.from(v).map(v => {
        const hh = new Date(v.start).getHours().toString().padStart(2, '0')
        const mm = new Date(v.start).getMinutes().toString().padStart(2, '0')
        return { start: v.start, date: k, time: `${hh}:${mm}` }
      })
      return slots
    }) */
    console.log('entries:', entries)
    return entries
  }, [availableSlots])
  const timezones = Intl.supportedValuesOf('timeZone')
  const formattedTimezones = useMemo(() => {
    return timezones.map(tz => {
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      })
      const parts = formatter.formatToParts(new Date())
      const offset = parts.find(p => p.type === 'timeZoneName')?.value || ''
      const modifiedOffset = offset === 'GMT' ? 'GMT+0' : offset

      const offsetMatch = offset.match(/GMT([+-]?)(\d+)(?::(\d+))?/)
      const sign = offsetMatch?.[1] === '-' ? -1 : 1
      const hours = Number.parseInt(offsetMatch?.[2] || '0', 10)
      const minutes = Number.parseInt(offsetMatch?.[3] || '0', 10)
      const totalMinutes = sign * (hours + 60 + minutes)

      return {
        label: `(${modifiedOffset}) ${tz.replace(/_/g, ' ')}`,
        numericOffset: totalMinutes,
        value: tz,
      }
    })
    .sort((a, b) => a.numericOffset - b.numericOffset)
  }, [timezones])

  /* const [clientSecret, setClientSecret] = useState<string>()
  useEffect(() => {
    if (paymentMethodsLoading) return
    if (paymentMethods.length > 0) return
    setupPayment()
      .then(p => {
        console.log('setup:', p)
        const [id, secret] = `${p.clientSecret}`.split('')
        setClientSecret(p.clientSecret)
      })
  }, [paymentMethodsLoading]) */
  const { data: setupData, isLoading, isSuccess } = useQuery({
    queryKey: ['setupintent'],
    queryFn: setupPayment,
  })
  const clientSecret = useMemo(() => {
    if (isLoading || !isSuccess) {
      return
    }
    console.log('setupData:', setupData)
    return setupData?.clientSecret
  }, [isLoading, isSuccess])

  useEffect(() => {
    if (!recordId) return
    const weeklySched = availableSlots.map(availableSlot => {
      const { dateSlot, timeSlots } = availableSlot
      const sched = {
        isoDate: dateSlot,
        date: format(dateSlot, 'MMM d'),
        dayName: format(dateSlot, 'E'),
        dayNumber: parseInt(format(dateSlot, 'd')),
        hasAvailability: true,
        slots: Array.from(timeSlots as { start: string }[]).map(v => ({ isoDate: v.start, time: format(v.start, 'HH:mm'), available: true })),
      } as DaySchedule
      return sched
    })
    setWeeklySchedule(weeklySched)
  }, [recordId, timezone, availableSlots, dates])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const handleTimeSlotClick = (day: string, time: string) => {
    setSelectedTimeSlot({
      day: format(day, 'MMM d'),
      time,
      dayName: format(day, 'E')
    });
    console.log('day:', day)
    setDateTime(day)
    setShowConfirmationView(true);
    onTimeSlotSelect?.(day, time);
  };

  const handleBackToMain = () => {
    setShowConfirmationView(false);
    setSelectedTimeSlot(null);
  };

  const handleConfirmBooking = async () => {
    // Retrieve Tutor's public key
    // Derive master key
    // Handle booking confirmation logic here
    console.log(selectedTimeSlot, selectedPaymentMethod, clientSecret)
    const pubKeys = await getTutorPubKeys(recordId)
    console.log('pubKeys:', pubKeys)
    if (pubKeys.length === 0) {
      console.error('Invalid operation: no public keys available')
      return
    }

    try {
      const userKeys = await getUserKeys()
      console.log('userKeys:', userKeys)
      const dhkp = JSON.parse(new TextDecoder().decode(bytesFromBase64(userKeys?.key_cipher!)))
      console.log({ dhkp })
      const dhCipherBytes = bytesFromBase64(dhkp.derivation.privateKey)
      const dhNonceBytes = bytesFromBase64(dhkp.derivation.nonce)
      const dhWrappedKey = new Uint8Array(dhNonceBytes.byteLength + dhCipherBytes.byteLength)
      dhWrappedKey.set(dhNonceBytes, 0)
      dhWrappedKey.set(dhCipherBytes, dhNonceBytes.byteLength)
      const localSalt = bytesFromBase64(userKeys?.salt!)
      let sessionSalt = new Uint8Array()
      const encAccessCodes: string[] = []
      const accessCodeBytes= secureRandomBytes()
      for (const pubKey of pubKeys) {
        if (!pubKey.key) continue
        // const skey = Buffer.from(pubKey.key).toString('utf8')
        // console.log(skey)
        if (pubKey.type !== 'device-key') continue
        // if (pubKey.key.byteLength !== 32) continue
        const pub = Buffer.from(pubKey.key).toBase64({ alphabet: 'base64url' })
        console.log('pub:', pubKey, pub, )
        // const pk = await exportKey(await importX25519PublicKey(pub))
        console.log('pubKey.key:', pubKey.key)
        // const pk = JSON.parse(dec)
        const accessCode = await createAccessCode(pub, dhWrappedKey, false, accessCodeBytes, localSalt, new Uint8Array(new TextEncoder().encode('ac-kek-v1')))
        sessionSalt = bytesFromBase64(accessCode?.salt!)
        encAccessCodes.push(accessCode?.accessCodeCiphertext!)
      }
      console.log(encAccessCodes)

      const confirmed = await confirmBooking(
        selectedPaymentMethod as string,
        recordId,
        dateTime as string,
        timezone,
        encAccessCodes,
        bytesToBase64(sessionSalt),
        record.sessionDuration,
      )
      console.log(confirmed)
      if (confirmed) {
        toast('Your booking has been confirmed!')
        setShowConfirmationView(false);
        setSelectedTimeSlot(null);
        router.push('/calendar')
      }
    } catch (err: any) {
      toast('request failed')
      console.error(err)
    }
  };

  const handleWeekNavigation = (direction: "prev" | "next") => {
    onWeekChange?.(direction);
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      x: -25,
      scale: 0.95,
      filter: "blur(4px)"
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 28,
        mass: 0.6,
      },
    },
  };

  const timeSlotVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25,
      }
    }
  };

  return (
    <motion.div
      variants={shouldAnimate ? containerVariants : {}}
      initial={shouldAnimate ? "hidden" : "visible"}
      animate="visible"
      className={cn(
        "bg-card rounded-xl border border-border/50 shadow-lg overflow-hidden max-w-2xl relative h-200",
        className
      )}
    >
      <div className="relative h-fit">
        {/* Main Content */}
        <motion.div
          initial={false}
          animate={{ 
            y: showConfirmationView ? "-20px" : "0px",
            opacity: showConfirmationView ? 0.3 : 1,
            scale: showConfirmationView ? 0.95 : 1
          }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            mass: 0.8
          }}
          className="w-full"
        >
      {/* Coach Profile Header */}
      <motion.div 
        variants={(shouldAnimate ? itemVariants : {}) as any}
        className="p-6 pb-6"
      >
        <div className="flex items-start justify-between gap-6">
          {/* Left Side - Profile Image */}
          <motion.div
            whileHover={shouldAnimate ? { 
              scale: 1.05,
              transition: { type: "spring", stiffness: 400, damping: 25 }
            } : {}}
            className="flex-shrink-0"
          >
            <img
              src={coach.imageUrl}
              alt={coach.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
          </motion.div>

          {/* Center - Coach Info */}
          <div className="flex-1 min-w-0 space-y-4">
            <h2 className="text-xl font-semibold text-foreground uppercase">
              {record.firstName} {record.lastName}
            </h2>
            
            {/* Rating and Details Row */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-red-500 text-red-500" />
                <span className="font-medium">{coach.rating}</span>
                <motion.button
                  whileHover={shouldAnimate ? { 
                    scale: 1.05,
                    transition: { type: "spring", stiffness: 400, damping: 25 }
                  } : {}}
                  className="underline hover:text-foreground transition-colors"
                >
                  ({coach.reviewCount} reviews)
                </motion.button>
              </div>
              <span>•</span>
              <span>{record.title}</span>
              <span>•</span>
              <span className="uppercase">{record.country}</span>
            </div>
          </div>

          {/* Right Side - Pricing */}
          <motion.div
            initial={shouldAnimate ? { 
              opacity: 0, 
              scale: 0.8,
              x: 20,
              filter: "blur(4px)"
            } : {}}
            animate={shouldAnimate ? {
              opacity: 1,
              scale: 1,
              x: 0,
              filter: "blur(0px)"
            } : {}}
            transition={shouldAnimate ? {
              type: "spring",
              stiffness: 400,
              damping: 25,
              delay: 0.3,
              mass: 0.6
            } : {}}
            className="text-right flex-shrink-0"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Per Session</p>
            <motion.p 
              className="text-2xl font-bold text-emerald-500"
              initial={shouldAnimate ? { scale: 0.5 } : {}}
              animate={shouldAnimate ? { scale: 1 } : {}}
              transition={shouldAnimate ? {
                type: "spring",
                stiffness: 500,
                damping: 20,
                delay: 0.5
              } : {}}
            >
              {record.currency} {`${record.sessionPrice ?? 0}`}
            </motion.p>
          </motion.div>
        </div>
      </motion.div>

      {/* Separator */}
      <motion.div 
        variants={(shouldAnimate ? itemVariants : {}) as any}
        className="mx-6 border-t border-border/50"
      />

      {/* Week Navigation */}
      <motion.div 
        variants={(shouldAnimate ? itemVariants : {}) as any}
        className="p-6 pb-4"
      >
        <div className="flex items-center justify-between">
                     <motion.button
             whileHover={shouldAnimate ? {
               scale: 1.05,
               transition: { type: "spring", stiffness: 400, damping: 25 }
             } : {}}
             whileTap={shouldAnimate ? { scale: 0.95 } : {}}
             onClick={() => handleWeekNavigation("prev")}
             aria-label="Previous week"
             className="p-2 hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
           >
             <ChevronLeft className="w-5 h-5 text-muted-foreground" />
           </motion.button>

          <h3 className="font-semibold text-foreground">
            {weekRange}
          </h3>

                     <motion.button
             whileHover={shouldAnimate ? {
               scale: 1.05,
               transition: { type: "spring", stiffness: 400, damping: 25 }
             } : {}}
             whileTap={shouldAnimate ? { scale: 0.95 } : {}}
             onClick={() => handleWeekNavigation("next")}
             aria-label="Next week"
             className="p-2 hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
           >
             <ChevronRight className="w-5 h-5 text-muted-foreground" />
           </motion.button>
        </div>
      </motion.div>

      {/* Daily Schedule */}
      <motion.div 
        variants={(shouldAnimate ? itemVariants : {}) as any}
        className="px-6 pb-6 space-y-4"
      >
        {weeklySchedule.map((day) => (
          <motion.div
            key={day.date}
            variants={(shouldAnimate ? itemVariants : {}) as any}
            className="space-y-3"
          >
            {/* Day Header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-foreground">
                  {day.dayName}, {day.date}
                </h4>
              </div>
              {!day.hasAvailability && (
                <span className="text-sm text-muted-foreground">
                  No Availability
                </span>
              )}
            </div>

            {/* Time Slots */}
            {day.hasAvailability && (
              <motion.div 
                variants={shouldAnimate ? containerVariants : {}}
                className="flex flex-wrap gap-2"
              >
                {day.slots.map((slot) => (
                                     <motion.button
                     key={`${day.date}-${slot.time}`}
                     variants={(shouldAnimate ? itemVariants : {}) as any}
                     whileHover={shouldAnimate && slot.available ? {
                       scale: 1.05,
                       y: -2,
                       transition: { type: "spring", stiffness: 400, damping: 25 }
                     } : {}}
                     whileTap={shouldAnimate && slot.available ? { scale: 0.98 } : {}}
                     onClick={() => slot.available && handleTimeSlotClick(slot.isoDate as string, slot.time)}
                     disabled={!slot.available}
                     aria-label={`${slot.available ? 'Book' : 'Unavailable'} time slot at ${slot.time} on ${day.dayName}, ${day.date}`}
                     className={cn(
                       "px-3 py-1.5 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
                       slot.available
                         ? "bg-background border-border/50 hover:border-border hover:bg-muted text-foreground cursor-pointer"
                         : "bg-muted/50 border-border/30 text-muted-foreground cursor-not-allowed opacity-60"
                     )}
                   >
                     {slot.time}
                   </motion.button>
                ))}
              </motion.div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Bottom Actions */}
      <motion.div 
        variants={(shouldAnimate ? itemVariants : {}) as any}
        className="border-t border-border/50 p-6"
      >
                 <div className="flex gap-3">
           <motion.button
             whileHover={shouldAnimate ? {
               scale: 1.02,
               transition: { type: "spring", stiffness: 400, damping: 25 }
             } : {}}
             whileTap={shouldAnimate ? { scale: 0.98 } : {}}
             className="flex-1 bg-muted text-muted-foreground py-2.5 rounded-lg hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
           >
             Cancel
           </motion.button>
           <motion.button
             whileHover={shouldAnimate ? {
               scale: 1.02,
               transition: { type: "spring", stiffness: 400, damping: 25 }
             } : {}}
             whileTap={shouldAnimate ? { scale: 0.98 } : {}}
             className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
           >
             Next
           </motion.button>
         </div>
        </motion.div>
        </motion.div>

        {/* Confirmation View */}
        <motion.div
          initial={false}
          animate={{ 
            y: showConfirmationView ? "0%" : "100%",
            opacity: showConfirmationView ? 1 : 0 
          }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            mass: 0.8
          }}
          className="absolute top-0 left-0 w-full h-full bg-card"
        >
          <div className="p-6 space-y-6">
            {/* Header with back button */}
            <div className="flex items-center justify-between">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBackToMain}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back</span>
              </motion.button>
              <h3 className="text-lg font-semibold text-foreground">Confirm Booking</h3>
              <div></div> {/* Spacer for centering */}
            </div>

            {/* Coach info summary */}
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <img
                src={coach.imageUrl}
                alt={coach.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div>
                <h4 className="font-semibold text-foreground">{`${record.firstName} ${record.lastName}`}</h4>
                <p className="text-sm text-muted-foreground">{record.title}</p>
              </div>
            </div>

            {/* Booking details */}
            {selectedTimeSlot && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">Your Booking</p>
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <p className="text-lg font-semibold text-foreground">
                      {selectedTimeSlot.dayName}, {selectedTimeSlot.day}
                    </p>
                    <p className="text-xl font-bold text-primary">
                      {selectedTimeSlot.time}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex w-full justify-between items-center py-2">
                    <span className="text-muted-foreground">Time zone: </span>
                    <Field className="w-auto" orientation="horizontal">
                      <Combobox autoHighlight defaultValue={timezone} items={formattedTimezones} onValueChange={(v: string | null) => setTimezone(v ?? tz)}>
                        <ComboboxTrigger render={<SelectButton />} className="w-auto">
                          <ComboboxValue placeholder="Select timezone" />
                        </ComboboxTrigger>
                        <ComboboxPopup aria-label="Select timezone">
                          <div className="border-b p-2">
                            <ComboboxInput
                              className="rounded-md before:rounded-[calc(var(--radius-md)+10px)]"
                              placeholder="e.g. Asia/Manila"
                              showTrigger={false}
                              startAddon={<SearchIcon />}
                            />
                          </div>
                          <ComboboxEmpty>No timezones found.</ComboboxEmpty>
                          <ComboboxList>
                            {item => (
                              <ComboboxItem key={item.value} value={item}>
                                {item.label}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxPopup>
                      </Combobox>
                    </Field>
                  </div>
                  <Field className="w-full flex justify-between" orientation="horizontal">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="text-foreground font-medium">{record.sessionDuration} minutes</span>
                  </Field>
                  <Field className="w-full flex justify-between" orientation="horizontal">
                    <span className="text-muted-foreground">Price</span>
                    <span className="text-foreground font-medium">{record.currency} {record.sessionPrice ?? '0'}</span>
                  </Field>
                  <Field className="w-full flex justify-between" orientation="horizontal">
                    <span className="text-muted-foreground">Booking fee (5% non refundable)</span>
                    <span className="text-foreground font-medium">{record.currency} {bookingFee}</span>
                  </Field>
                  <Field className="w-full flex justify-between" orientation="horizontal">
                    <span className="text-muted-foreground">TOTAL</span>
                    <span className="text-foreground font-medium">{record.currency} {totalAmount}</span>
                  </Field>
                </div>
              </div>
            )}
            {/* <Elements>
              <PaymentElement />
            </Elements> */}

            {/* Payment Methods */}
            {/* <div className="flex flex-col justify-between"></div> */}
            {methods.length > 0 ?
              <RadioGroup className="w-full">
                {methods.slice(0, 2)?.map(m => (
                  <FieldLabel htmlFor={m.id} key={m.id} className="cursor-pointer" onClick={() => setSelectedPaymentMethod(m.id)}>
                    <Field orientation="horizontal">
                      <RadioGroupItem value={m.id} id={m.id} checked={m.isDefault || m.id === selectedPaymentMethod} />
                      <FieldContent>
                        <FieldDescription className="flex items-center justify-between">
                          <span className="inline-flex items-center capitalize">{m.card?.brand} {m.card?.last4}</span>
                          <span className="inline-flex items-center">{m.card?.expMonth.toString().padStart(2, '0')}/{m.card.expYear}</span>
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup> :
              <>
              {clientSecret && <Elements stripe={stripeLoader} options={{ clientSecret, appearance: { theme: 'night', labels: 'floating' } }}>
                <PaymentMethodForm />
              </Elements>}
              </>}

            {/* {methods.length === 0 && <p>No payment method</p>} */}

            {/* Confirm button */}
            {methods.length > 0 && <motion.button
              whileHover={shouldAnimate ? { scale: 1.02, y: -1 } : {}}
              whileTap={shouldAnimate ? { scale: 0.98 } : {}}
              onClick={handleConfirmBooking}
              disabled={!clientSecret || !selectedPaymentMethod}
              className="w-full relative overflow-hidden py-3 rounded-lg font-semibold transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground border cursor-pointer group disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                CONFIRM BOOKING
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
            </motion.button>}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function PaymentMethodForm() {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()!
  const cardEl = useRef(null)
  const [ready, setReady] = useState(false)
  const [element, setElement] = useState<StripeCardElement>()
  const addOne = useStripeStore(state => state.addPaymentMethod)
  const addMany = useStripeStore(state => state.addPaymentMethods)
  const { refetch } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: async () => {
      const pm = await getPaymentMethods()
      if (!pm) {
        return []
      }
      addMany(...(pm as CardPaymentMethod[]))
      return pm
    },
    staleTime: 1000 * 60 * 10,
  })
  const { data: setupIntent, isLoading, isSuccess } = useQuery({
    queryKey: ['setupintent'],
    queryFn: setupPayment,
  })
  useEffect(() => {
    console.log('clientSecret:', setupIntent?.clientSecret)
    if (!cardEl.current || !elements || !setupIntent?.clientSecret) return
    if (setupIntent?.clientSecret) {

    }
    const element = elements?.create('payment', {
      /* style: {
        base: {
          fontSize: '16px',
          lineHeight: '48px',
          color: 'white',
          padding:  '48px'
        },
      }, */
    })
    element.on('ready', () => {
      setReady(true)
    })
    element.mount(cardEl.current)
    // setElement(element)
  }, [elements, cardEl.current, setupIntent?.clientSecret, isLoading])

  const handleSaveMethod = useCallback(async (event: any) => {
    // event.prevenDefault()
    if (!stripe) {
      console.error('stripe not initialized')
      return
    }
    const { error } = await elements?.submit()
    if (error) {
      console.error('Error submitting details:', error)
      return
    }
    // const el = elements?.getElement('payment')!
    /* const paymentMethod = await stripe?.createPaymentMethod({
      element: el!,
    })
    const added = await addPaymentMethod(paymentMethod?.paymentMethod?.id!)
    if (added) {
      addOne({
        id: paymentMethod?.paymentMethod?.id!,
        type: 'card',
        card: paymentMethod?.paymentMethod?.card,
        isDefault: true,
      })
    } */
    const { error: err } = await stripe?.confirmSetup({
      elements,
      clientSecret: setupIntent?.clientSecret,
      confirmParams: {
        return_url: 'https://localhost:3005/me',
      },
      // redirect: 'if_required',
    })
    if (err) {
      console.error('could not create confirmation token')
      return
    }
    // onSaved(confirmationToken.id)
  }, [cardEl.current, stripe, setupIntent?.clientSecret])

  return (
    <form onSubmit={handleSaveMethod}>
      <div id="setupCard" ref={cardEl} className="w-full"></div>
      <Button type="button" className="w-full relative overflow-hidden py-3 rounded-lg font-semibold transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground border cursor-pointer group disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSaveMethod} disabled={!ready}>Confirm Booking</Button>
      {/* <motion.button
        whileHover={shouldAnimate ? { scale: 1.02, y: -1 } : {}}
        whileTap={shouldAnimate ? { scale: 0.98 } : {}}
        onClick={handleConfirmBooking}
        disabled={!clientSecret}
        className="w-full relative overflow-hidden py-3 rounded-lg font-semibold transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground border cursor-pointer group disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          CONFIRM BOOKING
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
      </motion.button> */}
    </form>
  )
}