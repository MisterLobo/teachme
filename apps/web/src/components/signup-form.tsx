'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ChevronsUpDownIcon, GalleryVerticalEndIcon, SearchIcon } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Label } from './ui/label'
import { Controller, ControllerRenderProps, SubmitHandler, useForm } from 'react-hook-form'
import { Tabs, TabsList, TabsPanel, TabsTab } from './ui/tabs'
import { Combobox, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxPopup, ComboboxTrigger, ComboboxValue } from './ui/combobox'
import { SelectButton } from './ui/select'

type AccountType = 'organization' | 'tutor' | 'learner'
type OrganizationFormSchema = {}
type TutorFormSchema = {}
type StudentFormSchema = {}
type ParentFormSchema = {}

interface Country {
  code: string;
  value: string | null;
  continent: string;
  label: string;
}

const countries: Country[] = [
  { code: "", continent: "", label: "Select country", value: null },
  { code: "af", continent: "Asia", label: "Afghanistan", value: "afghanistan" },
  { code: "al", continent: "Europe", label: "Albania", value: "albania" },
  { code: "dz", continent: "Africa", label: "Algeria", value: "algeria" },
  { code: "ad", continent: "Europe", label: "Andorra", value: "andorra" },
  { code: "ao", continent: "Africa", label: "Angola", value: "angola" },
  {
    code: "ar",
    continent: "South America",
    label: "Argentina",
    value: "argentina",
  },
  { code: "am", continent: "Asia", label: "Armenia", value: "armenia" },
  { code: "au", continent: "Oceania", label: "Australia", value: "australia" },
  { code: "at", continent: "Europe", label: "Austria", value: "austria" },
  { code: "az", continent: "Asia", label: "Azerbaijan", value: "azerbaijan" },
  {
    code: "bs",
    continent: "North America",
    label: "Bahamas",
    value: "bahamas",
  },
  { code: "bh", continent: "Asia", label: "Bahrain", value: "bahrain" },
  { code: "bd", continent: "Asia", label: "Bangladesh", value: "bangladesh" },
  {
    code: "bb",
    continent: "North America",
    label: "Barbados",
    value: "barbados",
  },
  { code: "by", continent: "Europe", label: "Belarus", value: "belarus" },
  { code: "be", continent: "Europe", label: "Belgium", value: "belgium" },
  { code: "bz", continent: "North America", label: "Belize", value: "belize" },
  { code: "bj", continent: "Africa", label: "Benin", value: "benin" },
  { code: "bt", continent: "Asia", label: "Bhutan", value: "bhutan" },
  {
    code: "bo",
    continent: "South America",
    label: "Bolivia",
    value: "bolivia",
  },
  {
    code: "ba",
    continent: "Europe",
    label: "Bosnia and Herzegovina",
    value: "bosnia-and-herzegovina",
  },
  { code: "bw", continent: "Africa", label: "Botswana", value: "botswana" },
  { code: "br", continent: "South America", label: "Brazil", value: "brazil" },
  { code: "bn", continent: "Asia", label: "Brunei", value: "brunei" },
  { code: "bg", continent: "Europe", label: "Bulgaria", value: "bulgaria" },
  {
    code: "bf",
    continent: "Africa",
    label: "Burkina Faso",
    value: "burkina-faso",
  },
  { code: "bi", continent: "Africa", label: "Burundi", value: "burundi" },
  { code: "kh", continent: "Asia", label: "Cambodia", value: "cambodia" },
  { code: "cm", continent: "Africa", label: "Cameroon", value: "cameroon" },
  { code: "ca", continent: "North America", label: "Canada", value: "canada" },
  { code: "cv", continent: "Africa", label: "Cape Verde", value: "cape-verde" },
  {
    code: "cf",
    continent: "Africa",
    label: "Central African Republic",
    value: "central-african-republic",
  },
  { code: "td", continent: "Africa", label: "Chad", value: "chad" },
  { code: "cl", continent: "South America", label: "Chile", value: "chile" },
  { code: "cn", continent: "Asia", label: "China", value: "china" },
  {
    code: "co",
    continent: "South America",
    label: "Colombia",
    value: "colombia",
  },
  { code: "km", continent: "Africa", label: "Comoros", value: "comoros" },
  { code: "cg", continent: "Africa", label: "Congo", value: "congo" },
  {
    code: "cr",
    continent: "North America",
    label: "Costa Rica",
    value: "costa-rica",
  },
  { code: "hr", continent: "Europe", label: "Croatia", value: "croatia" },
  { code: "cu", continent: "North America", label: "Cuba", value: "cuba" },
  { code: "cy", continent: "Asia", label: "Cyprus", value: "cyprus" },
  {
    code: "cz",
    continent: "Europe",
    label: "Czech Republic",
    value: "czech-republic",
  },
  { code: "dk", continent: "Europe", label: "Denmark", value: "denmark" },
  { code: "dj", continent: "Africa", label: "Djibouti", value: "djibouti" },
  {
    code: "dm",
    continent: "North America",
    label: "Dominica",
    value: "dominica",
  },
  {
    code: "do",
    continent: "North America",
    label: "Dominican Republic",
    value: "dominican-republic",
  },
  {
    code: "ec",
    continent: "South America",
    label: "Ecuador",
    value: "ecuador",
  },
  { code: "eg", continent: "Africa", label: "Egypt", value: "egypt" },
  {
    code: "sv",
    continent: "North America",
    label: "El Salvador",
    value: "el-salvador",
  },
  {
    code: "gq",
    continent: "Africa",
    label: "Equatorial Guinea",
    value: "equatorial-guinea",
  },
  { code: "er", continent: "Africa", label: "Eritrea", value: "eritrea" },
  { code: "ee", continent: "Europe", label: "Estonia", value: "estonia" },
  { code: "et", continent: "Africa", label: "Ethiopia", value: "ethiopia" },
  { code: "fj", continent: "Oceania", label: "Fiji", value: "fiji" },
  { code: "fi", continent: "Europe", label: "Finland", value: "finland" },
  { code: "fr", continent: "Europe", label: "France", value: "france" },
  { code: "ga", continent: "Africa", label: "Gabon", value: "gabon" },
  { code: "gm", continent: "Africa", label: "Gambia", value: "gambia" },
  { code: "ge", continent: "Asia", label: "Georgia", value: "georgia" },
  { code: "de", continent: "Europe", label: "Germany", value: "germany" },
  { code: "gh", continent: "Africa", label: "Ghana", value: "ghana" },
  { code: "gr", continent: "Europe", label: "Greece", value: "greece" },
  {
    code: "gd",
    continent: "North America",
    label: "Grenada",
    value: "grenada",
  },
  {
    code: "gt",
    continent: "North America",
    label: "Guatemala",
    value: "guatemala",
  },
  { code: "gn", continent: "Africa", label: "Guinea", value: "guinea" },
  {
    code: "gw",
    continent: "Africa",
    label: "Guinea-Bissau",
    value: "guinea-bissau",
  },
  { code: "gy", continent: "South America", label: "Guyana", value: "guyana" },
  { code: "ht", continent: "North America", label: "Haiti", value: "haiti" },
  {
    code: "hn",
    continent: "North America",
    label: "Honduras",
    value: "honduras",
  },
  { code: "hu", continent: "Europe", label: "Hungary", value: "hungary" },
  { code: "is", continent: "Europe", label: "Iceland", value: "iceland" },
  { code: "in", continent: "Asia", label: "India", value: "india" },
  { code: "id", continent: "Asia", label: "Indonesia", value: "indonesia" },
  { code: "ir", continent: "Asia", label: "Iran", value: "iran" },
  { code: "iq", continent: "Asia", label: "Iraq", value: "iraq" },
  { code: "ie", continent: "Europe", label: "Ireland", value: "ireland" },
  { code: "il", continent: "Asia", label: "Israel", value: "israel" },
  { code: "it", continent: "Europe", label: "Italy", value: "italy" },
  {
    code: "jm",
    continent: "North America",
    label: "Jamaica",
    value: "jamaica",
  },
  { code: "jp", continent: "Asia", label: "Japan", value: "japan" },
  { code: "jo", continent: "Asia", label: "Jordan", value: "jordan" },
  { code: "kz", continent: "Asia", label: "Kazakhstan", value: "kazakhstan" },
  { code: "ke", continent: "Africa", label: "Kenya", value: "kenya" },
  { code: "kw", continent: "Asia", label: "Kuwait", value: "kuwait" },
  { code: "kg", continent: "Asia", label: "Kyrgyzstan", value: "kyrgyzstan" },
  { code: "la", continent: "Asia", label: "Laos", value: "laos" },
  { code: "lv", continent: "Europe", label: "Latvia", value: "latvia" },
  { code: "lb", continent: "Asia", label: "Lebanon", value: "lebanon" },
  { code: "ls", continent: "Africa", label: "Lesotho", value: "lesotho" },
  { code: "lr", continent: "Africa", label: "Liberia", value: "liberia" },
  { code: "ly", continent: "Africa", label: "Libya", value: "libya" },
  {
    code: "li",
    continent: "Europe",
    label: "Liechtenstein",
    value: "liechtenstein",
  },
  { code: "lt", continent: "Europe", label: "Lithuania", value: "lithuania" },
  { code: "lu", continent: "Europe", label: "Luxembourg", value: "luxembourg" },
  { code: "mg", continent: "Africa", label: "Madagascar", value: "madagascar" },
  { code: "mw", continent: "Africa", label: "Malawi", value: "malawi" },
  { code: "my", continent: "Asia", label: "Malaysia", value: "malaysia" },
  { code: "mv", continent: "Asia", label: "Maldives", value: "maldives" },
  { code: "ml", continent: "Africa", label: "Mali", value: "mali" },
  { code: "mt", continent: "Europe", label: "Malta", value: "malta" },
  {
    code: "mh",
    continent: "Oceania",
    label: "Marshall Islands",
    value: "marshall-islands",
  },
  { code: "mr", continent: "Africa", label: "Mauritania", value: "mauritania" },
  { code: "mu", continent: "Africa", label: "Mauritius", value: "mauritius" },
  { code: "mx", continent: "North America", label: "Mexico", value: "mexico" },
  {
    code: "fm",
    continent: "Oceania",
    label: "Micronesia",
    value: "micronesia",
  },
  { code: "md", continent: "Europe", label: "Moldova", value: "moldova" },
  { code: "mc", continent: "Europe", label: "Monaco", value: "monaco" },
  { code: "mn", continent: "Asia", label: "Mongolia", value: "mongolia" },
  { code: "me", continent: "Europe", label: "Montenegro", value: "montenegro" },
  { code: "ma", continent: "Africa", label: "Morocco", value: "morocco" },
  { code: "mz", continent: "Africa", label: "Mozambique", value: "mozambique" },
  { code: "mm", continent: "Asia", label: "Myanmar", value: "myanmar" },
  { code: "na", continent: "Africa", label: "Namibia", value: "namibia" },
  { code: "nr", continent: "Oceania", label: "Nauru", value: "nauru" },
  { code: "np", continent: "Asia", label: "Nepal", value: "nepal" },
  {
    code: "nl",
    continent: "Europe",
    label: "Netherlands",
    value: "netherlands",
  },
  {
    code: "nz",
    continent: "Oceania",
    label: "New Zealand",
    value: "new-zealand",
  },
  {
    code: "ni",
    continent: "North America",
    label: "Nicaragua",
    value: "nicaragua",
  },
  { code: "ne", continent: "Africa", label: "Niger", value: "niger" },
  { code: "ng", continent: "Africa", label: "Nigeria", value: "nigeria" },
  { code: "kp", continent: "Asia", label: "North Korea", value: "north-korea" },
  {
    code: "mk",
    continent: "Europe",
    label: "North Macedonia",
    value: "north-macedonia",
  },
  { code: "no", continent: "Europe", label: "Norway", value: "norway" },
  { code: "om", continent: "Asia", label: "Oman", value: "oman" },
  { code: "pk", continent: "Asia", label: "Pakistan", value: "pakistan" },
  { code: "pw", continent: "Oceania", label: "Palau", value: "palau" },
  { code: "ps", continent: "Asia", label: "Palestine", value: "palestine" },
  { code: "pa", continent: "North America", label: "Panama", value: "panama" },
  {
    code: "pg",
    continent: "Oceania",
    label: "Papua New Guinea",
    value: "papua-new-guinea",
  },
  {
    code: "py",
    continent: "South America",
    label: "Paraguay",
    value: "paraguay",
  },
  { code: "pe", continent: "South America", label: "Peru", value: "peru" },
  { code: "ph", continent: "Asia", label: "Philippines", value: "philippines" },
  { code: "pl", continent: "Europe", label: "Poland", value: "poland" },
  { code: "pt", continent: "Europe", label: "Portugal", value: "portugal" },
  { code: "qa", continent: "Asia", label: "Qatar", value: "qatar" },
  { code: "ro", continent: "Europe", label: "Romania", value: "romania" },
  { code: "ru", continent: "Europe", label: "Russia", value: "russia" },
  { code: "rw", continent: "Africa", label: "Rwanda", value: "rwanda" },
  { code: "ws", continent: "Oceania", label: "Samoa", value: "samoa" },
  { code: "sm", continent: "Europe", label: "San Marino", value: "san-marino" },
  {
    code: "sa",
    continent: "Asia",
    label: "Saudi Arabia",
    value: "saudi-arabia",
  },
  { code: "sn", continent: "Africa", label: "Senegal", value: "senegal" },
  { code: "rs", continent: "Europe", label: "Serbia", value: "serbia" },
  { code: "sc", continent: "Africa", label: "Seychelles", value: "seychelles" },
  {
    code: "sl",
    continent: "Africa",
    label: "Sierra Leone",
    value: "sierra-leone",
  },
  { code: "sg", continent: "Asia", label: "Singapore", value: "singapore" },
  { code: "sk", continent: "Europe", label: "Slovakia", value: "slovakia" },
  { code: "si", continent: "Europe", label: "Slovenia", value: "slovenia" },
  {
    code: "sb",
    continent: "Oceania",
    label: "Solomon Islands",
    value: "solomon-islands",
  },
  { code: "so", continent: "Africa", label: "Somalia", value: "somalia" },
  {
    code: "za",
    continent: "Africa",
    label: "South Africa",
    value: "south-africa",
  },
  { code: "kr", continent: "Asia", label: "South Korea", value: "south-korea" },
  {
    code: "ss",
    continent: "Africa",
    label: "South Sudan",
    value: "south-sudan",
  },
  { code: "es", continent: "Europe", label: "Spain", value: "spain" },
  { code: "lk", continent: "Asia", label: "Sri Lanka", value: "sri-lanka" },
  { code: "sd", continent: "Africa", label: "Sudan", value: "sudan" },
  {
    code: "sr",
    continent: "South America",
    label: "Suriname",
    value: "suriname",
  },
  { code: "se", continent: "Europe", label: "Sweden", value: "sweden" },
  {
    code: "ch",
    continent: "Europe",
    label: "Switzerland",
    value: "switzerland",
  },
  { code: "sy", continent: "Asia", label: "Syria", value: "syria" },
  { code: "tw", continent: "Asia", label: "Taiwan", value: "taiwan" },
  { code: "tj", continent: "Asia", label: "Tajikistan", value: "tajikistan" },
  { code: "tz", continent: "Africa", label: "Tanzania", value: "tanzania" },
  { code: "th", continent: "Asia", label: "Thailand", value: "thailand" },
  { code: "tl", continent: "Asia", label: "Timor-Leste", value: "timor-leste" },
  { code: "tg", continent: "Africa", label: "Togo", value: "togo" },
  { code: "to", continent: "Oceania", label: "Tonga", value: "tonga" },
  {
    code: "tt",
    continent: "North America",
    label: "Trinidad and Tobago",
    value: "trinidad-and-tobago",
  },
  { code: "tn", continent: "Africa", label: "Tunisia", value: "tunisia" },
  { code: "tr", continent: "Asia", label: "Turkey", value: "turkey" },
  {
    code: "tm",
    continent: "Asia",
    label: "Turkmenistan",
    value: "turkmenistan",
  },
  { code: "tv", continent: "Oceania", label: "Tuvalu", value: "tuvalu" },
  { code: "ug", continent: "Africa", label: "Uganda", value: "uganda" },
  { code: "ua", continent: "Europe", label: "Ukraine", value: "ukraine" },
  {
    code: "ae",
    continent: "Asia",
    label: "United Arab Emirates",
    value: "united-arab-emirates",
  },
  {
    code: "gb",
    continent: "Europe",
    label: "United Kingdom",
    value: "united-kingdom",
  },
  {
    code: "us",
    continent: "North America",
    label: "United States",
    value: "united-states",
  },
  {
    code: "uy",
    continent: "South America",
    label: "Uruguay",
    value: "uruguay",
  },
  { code: "uz", continent: "Asia", label: "Uzbekistan", value: "uzbekistan" },
  { code: "vu", continent: "Oceania", label: "Vanuatu", value: "vanuatu" },
  {
    code: "va",
    continent: "Europe",
    label: "Vatican City",
    value: "vatican-city",
  },
  {
    code: "ve",
    continent: "South America",
    label: "Venezuela",
    value: "venezuela",
  },
  { code: "vn", continent: "Asia", label: "Vietnam", value: "vietnam" },
  { code: "ye", continent: "Asia", label: "Yemen", value: "yemen" },
  { code: "zm", continent: "Africa", label: "Zambia", value: "zambia" },
  { code: "zw", continent: "Africa", label: "Zimbabwe", value: "zimbabwe" },
]

const languages = [
  'English',
  'Filipino',
  'Japanese',
  'French',
  'Spanish',
  'Italian',
  'Russian',
]
const currencies = [
  'USD',
  'PHP',
  'GBP',
  'CAD',
  'AUD',
  'EUR',
]

type FormSchema = {
  email: string,
  firstName: string,
  lastName: string,
  dob: string,
  phone: string,
  country: string,
  city: string,
  timezone: string,
  currency: string,
  primaryLanguage: string,
  password: string,
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const {
    control,
    getValues,
    setValue,
    handleSubmit,
    formState,
    clearErrors,
    setError
  } = useForm<FormSchema>()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
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
  const [role, setRole] = useState<AccountType | undefined>()
  const selectRole = (e: any, role: AccountType) => {
    e.preventDefault()
    setRole(role)
  }
  const onSubmit: SubmitHandler<FormSchema> = (data) => {
    console.log(data)
  }

  return (
    <div className={cn("flex flex-col gap-6 h-96", className)} {...props}>
      <div>
        <FieldGroup>
          {!role && (
            <>
            <div className="flex flex-col items-center gap-2 text-center">
              <a
                href="#"
                className="flex flex-col items-center gap-2 font-medium"
              >
                <div className="flex size-8 items-center justify-center rounded-md">
                  <GalleryVerticalEndIcon className="size-6" />
                </div>
                <span className="sr-only">Acme Inc.</span>
              </a>
              <h1 className="text-xl font-bold">Welcome to Acme Inc.</h1>
              <FieldDescription>
                Already have an account? <Link href="/login">Sign in</Link>
              </FieldDescription>
            </div>
            <Field>
              <Button className="cursor-pointer" onClick={e => selectRole(e, 'tutor')}>Sign Up as Tutor</Button>
              <Button className="cursor-pointer" onClick={e => selectRole(e, 'learner')}>Sign Up as Learner</Button>
            </Field>
            <FieldSeparator>Or</FieldSeparator>
            </>
          )}
          {/* <Field className="grid gap-4 sm:grid-cols-2">
            <Button variant="outline" type="button" className="cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  fill="currentColor"
                />
              </svg>
              Continue with Apple
            </Button>
            <Button variant="outline" type="button" className="cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>
          </Field> */}
        </FieldGroup>
      </div>
      {role === 'tutor' && (
        <Tabs defaultValue="individual" className="w-full">
          <TabsList>
            <TabsTab value="individual">Individual</TabsTab>
            <TabsTab value="organization">Organization</TabsTab>
          </TabsList>
          <TabsPanel value="individual">
            <form onSubmit={handleSubmit(onSubmit)}>
              <h1>Tutor Form</h1>
              <FieldGroup>
                <Field>
                  <Label htmlFor="email">Email</Label>
                  <Input type="email" id="email" name="email" />
                </Field>
                <Field>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input type="text" id="first_name" name="first_name" />
                </Field>
                <Field>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input type="text" id="last_name" name="last_name" />
                </Field>
                <Field orientation="horizontal">
                  <Field>
                    <span>Country</span>
                    <Combobox autoHighlight defaultValue={countries[0]} items={countries}>
                      <ComboboxTrigger
                        className="w-96"
                        render={
                          <Button
                            className="w-full justify-between font-normal"
                            variant="outline"
                          />
                        }
                      >
                        <ComboboxValue />
                        <ChevronsUpDownIcon className="-me-1!" />
                      </ComboboxTrigger>
                      <ComboboxPopup aria-label="Select country">
                        <div className="border-b p-2">
                          <ComboboxInput
                            className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                            placeholder="e.g. United Kingdom"
                            showTrigger={false}
                            startAddon={<SearchIcon />}
                          />
                        </div>
                        <ComboboxEmpty>No countries found.</ComboboxEmpty>
                        <ComboboxList>
                          {(country: Country) => (
                            <ComboboxItem key={country.code} value={country} className="truncate">
                              {country.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxPopup>
                    </Combobox>
                  </Field>
                </Field>
                <Field>
                  <span>Time zone</span>
                  <Combobox autoHighlight defaultValue={tz} items={formattedTimezones}>
                    <ComboboxTrigger render={<SelectButton />} className="w-1/2">
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
                <Field orientation="horizontal">
                  <Field>
                    <span>Currency</span>
                    <Combobox autoHighlight items={currencies}>
                      <ComboboxTrigger render={<SelectButton />} className="w-96">
                        <ComboboxValue placeholder="Select currency" />
                      </ComboboxTrigger>
                      <ComboboxPopup aria-label="Select currency">
                        <div className="border-b p-2">
                          <ComboboxInput
                            className="rounded-md before:rounded-[calc(var(--radius-md)+10px)]"
                            placeholder="e.g. USD"
                            showTrigger={false}
                            startAddon={<SearchIcon />}
                          />
                        </div>
                        <ComboboxEmpty>No results.</ComboboxEmpty>
                        <ComboboxList>
                          {item => (
                            <ComboboxItem key={item} value={item}>
                              {item}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxPopup>
                    </Combobox>
                  </Field>
                  <Field>
                    <span>Primary Language</span>
                    <Combobox autoHighlight items={languages}>
                      <ComboboxTrigger render={<SelectButton />} className="w-96">
                        <ComboboxValue placeholder="Select language" />
                      </ComboboxTrigger>
                      <ComboboxPopup aria-label="Select language">
                        <div className="border-b p-2">
                          <ComboboxInput
                            className="rounded-md before:rounded-[calc(var(--radius-md)+10px)]"
                            placeholder="e.g. English"
                            showTrigger={false}
                            startAddon={<SearchIcon />}
                          />
                        </div>
                        <ComboboxEmpty>No languages found.</ComboboxEmpty>
                        <ComboboxList>
                          {item => (
                            <ComboboxItem key={item} value={item}>
                              {item}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxPopup>
                    </Combobox>
                  </Field>
                </Field>
                <Field orientation="horizontal" className="grid grid-cols-2">
                  <Field>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input type="date" id="dob" name="dob" />
                  </Field>
                  <Controller
                    name="phone"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => <PhoneInputField field={field} />}
                  />
                </Field>
                <Field>
                  <Controller
                    name="password"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => <PasswordInput field={field} />}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm_password">Confirm Password</FieldLabel>
                  <Input type="password" id="confirm_password" name="confirm_password" placeholder="Confirm your password" />
                </Field>
                <Button type="submit" className="cursor-pointer">Create Tutor Account</Button>
              </FieldGroup>
            </form>
          </TabsPanel>
          <TabsPanel value="organization">
            <form>
              <h1>Organization Form</h1>
              <FieldGroup>
                <Field>
                  <Label htmlFor="organization">Name</Label>
                  <Input type="text" id="name" name="name" />
                </Field>
                <Field>
                  <Label htmlFor="emai">Email</Label>
                  <Input type="email" id="email" name="email" />
                </Field>
                <Field orientation="horizontal">
                  <Field>
                    <span>Country: </span>
                    <Combobox defaultValue={countries[0]} items={countries}>
                      <ComboboxTrigger
                        className="w-96"
                        render={
                          <Button
                            className="w-full justify-between font-normal"
                            variant="outline"
                          />
                        }
                      >
                        <ComboboxValue />
                        <ChevronsUpDownIcon className="-me-1!" />
                      </ComboboxTrigger>
                      <ComboboxPopup aria-label="Select country">
                        <div className="border-b p-2">
                          <ComboboxInput
                            className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                            placeholder="e.g. United Kingdom"
                            showTrigger={false}
                            startAddon={<SearchIcon />}
                          />
                        </div>
                        <ComboboxEmpty>No countries found.</ComboboxEmpty>
                        <ComboboxList>
                          {(country: Country) => (
                            <ComboboxItem key={country.code} value={country} className="truncate">
                              {country.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxPopup>
                    </Combobox>
                  </Field>
                  <Field>
                    <span>Time zone: </span>
                    <Combobox autoHighlight defaultValue={tz} items={formattedTimezones}>
                      <ComboboxTrigger render={<SelectButton />} className="w-96">
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
                </Field>
                <Button className="cursor-pointer">Create Organization Account</Button>
              </FieldGroup>
            </form>
          </TabsPanel>
        </Tabs>
      )}
      {role === 'learner' && (
        <Tabs>
          <TabsList>
            <TabsTab value="student_learner">Student Learner</TabsTab>
            <TabsTab value="parent_guardian">Parent/Guardian</TabsTab>
          </TabsList>
          <TabsPanel value="student_learner">
            <form>
              <h1>Student Form</h1>
              <FieldGroup>
                <Field>
                  <Label htmlFor="emai">Email</Label>
                  <Input type="email" id="email" name="email" />
                </Field>
                <Field>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input type="text" id="first_name" name="first_name" />
                </Field>
                <Field>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input type="text" id="last_name" name="last_name" />
                </Field>
                <Field>
                  <Label htmlFor="country">Country</Label>
                  <Input type="text" id="country" name="country" />
                </Field>
                <Field>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input type="date" id="dob" name="dob" />
                </Field>
                <Field orientation="horizontal">
                  <Field>
                    <span>Country: </span>
                    <Combobox defaultValue={countries[0]} items={countries}>
                      <ComboboxTrigger
                        className="w-96"
                        render={
                          <Button
                            className="w-full justify-between font-normal"
                            variant="outline"
                          />
                        }
                      >
                        <ComboboxValue />
                        <ChevronsUpDownIcon className="-me-1!" />
                      </ComboboxTrigger>
                      <ComboboxPopup aria-label="Select country">
                        <div className="border-b p-2">
                          <ComboboxInput
                            className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                            placeholder="e.g. United Kingdom"
                            showTrigger={false}
                            startAddon={<SearchIcon />}
                          />
                        </div>
                        <ComboboxEmpty>No countries found.</ComboboxEmpty>
                        <ComboboxList>
                          {(country: Country) => (
                            <ComboboxItem key={country.code} value={country} className="truncate">
                              {country.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxPopup>
                    </Combobox>
                  </Field>
                  <Field>
                    <span>Time zone: </span>
                    <Combobox autoHighlight defaultValue={tz} items={formattedTimezones}>
                      <ComboboxTrigger render={<SelectButton />} className="w-96">
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
                </Field>
                <Button className="cursor-pointer">Create Student Account</Button>
              </FieldGroup>
            </form>
          </TabsPanel>
          <TabsPanel value="parent_guardian">
            <form>
              <h1>Parent Form</h1>
              <FieldGroup>
                <Field>
                  <Label htmlFor="emai">Email</Label>
                  <Input type="email" id="email" name="email" />
                </Field>
                <Field>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input type="text" id="first_name" name="first_name" />
                </Field>
                <Field>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input type="text" id="last_name" name="last_name" />
                </Field>
                <Field orientation="horizontal">
                  <Field>
                    <span>Country: </span>
                    <Combobox defaultValue={countries[0]} items={countries}>
                      <ComboboxTrigger
                        className="w-96"
                        render={
                          <Button
                            className="w-full justify-between font-normal"
                            variant="outline"
                          />
                        }
                      >
                        <ComboboxValue />
                        <ChevronsUpDownIcon className="-me-1!" />
                      </ComboboxTrigger>
                      <ComboboxPopup aria-label="Select country">
                        <div className="border-b p-2">
                          <ComboboxInput
                            className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                            placeholder="e.g. United Kingdom"
                            showTrigger={false}
                            startAddon={<SearchIcon />}
                          />
                        </div>
                        <ComboboxEmpty>No countries found.</ComboboxEmpty>
                        <ComboboxList>
                          {(country: Country) => (
                            <ComboboxItem key={country.code} value={country} className="truncate">
                              {country.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxPopup>
                    </Combobox>
                  </Field>
                  <Field>
                    <span>Time zone: </span>
                    <Combobox autoHighlight defaultValue={tz} items={formattedTimezones}>
                      <ComboboxTrigger render={<SelectButton />} className="w-96">
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
                </Field>
                <Field>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input type="date" id="dob" name="dob" />
                </Field>
                <Button className="cursor-pointer">Create Parent Account</Button>
              </FieldGroup>
            </form>
          </TabsPanel>
        </Tabs>
      )}
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <Link href="#">Terms of Service</Link>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

import { Check, Eye, EyeOff, X } from 'lucide-react';

// Constants
const PASSWORD_REQUIREMENTS = [
  { regex: /.{8,}/, text: 'At least 8 characters' },
  { regex: /[0-9]/, text: 'At least 1 number' },
  { regex: /[a-z]/, text: 'At least 1 lowercase letter' },
  { regex: /[A-Z]/, text: 'At least 1 uppercase letter' },
  { regex: /[!-\/:-@[-`{-~]/, text: 'At least 1 special characters' },
] as const

type StrengthScore = 0 | 1 | 2 | 3 | 4 | 5;

const STRENGTH_CONFIG = {
  colors: {
    0: 'bg-border',
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-amber-500',
    4: 'bg-amber-700',
    5: 'bg-emerald-500',
  } satisfies Record<StrengthScore, string>,
  texts: {
    0: 'Enter a password',
    1: 'Weak password',
    2: 'Medium password!',
    3: 'Strong password!!',
    4: 'Very Strong password!!!',
  } satisfies Record<Exclude<StrengthScore, 5>, string>,
} as const

// Types
type Requirement = {
  met: boolean;
  text: string;
};

type PasswordStrength = {
  score: StrengthScore;
  requirements: Requirement[];
}
const PasswordInput = ({ field }: { field: ControllerRenderProps<FormSchema, 'password'> }) => {
  const [password, setPassword] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const calculateStrength = useMemo((): PasswordStrength => {
    const requirements = PASSWORD_REQUIREMENTS.map((req) => ({
      met: req.regex.test(password),
      text: req.text,
    }));

    return {
      score: requirements.filter((req) => req.met).length as StrengthScore,
      requirements,
    };
  }, [password]);

  // console.log(calculateStrength);
  const onChange = (v: string) => {
    setPassword(v)
    field.onChange(v)
  }

  return (
    <div className='w-full mx-auto'>
      <div className="space-y-2">
        <label htmlFor='password' className='block text-sm font-medium'>
          Password
        </label>
        <div className='relative'>
          <Input
            id='password'
            type={isVisible ? 'text' : 'password'}
            {...field}
            value={password}
            onChange={(e) => onChange(e.target.value)}
            placeholder='Password'
            aria-invalid={calculateStrength.score < 4}
            aria-describedby="password-strength"
            className="w-full border-2 rounded-md bg-background outline-none focus-within:border-blue-700 transition"
          />
          <button
            type='button'
            onClick={() => setIsVisible((prev) => !prev)}
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            className='absolute inset-y-0 right-0 flex items-center justify-center w-9 text-muted-foreground/80 '
          >
            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div
        className='mt-3 mb-4 h-1 rounded-full bg-border overflow-hidden'
        role='progressbar'
        aria-valuenow={calculateStrength.score}
        aria-valuemin={0}
        aria-valuemax={4}
      >
        <div
          className={`h-full ${
            STRENGTH_CONFIG.colors[calculateStrength.score]
          } transition-all duration-500`}
          style={{ width: `${(calculateStrength.score / 5) * 100}%` }}
        />
      </div>

      <p
        id='password-strength'
        className='mb-2 text-sm font-medium flex justify-between'
      >
        <span>Must contain:</span>
        <span>
          {
            STRENGTH_CONFIG.texts[
              Math.min(
                calculateStrength.score,
                4
              ) as keyof typeof STRENGTH_CONFIG.texts
            ]
          }
        </span>
      </p>

      <ul className='space-y-1.5' aria-label='Password requirements'>
        {calculateStrength.requirements.map((req, index) => (
          <li key={index} className='flex items-center space-x-2'>
            {req.met ? (
              <Check size={16} className='text-emerald-500' />
            ) : (
              <X size={16} className='text-muted-foreground/80' />
            )}
            <span
              className={`text-xs ${
                req.met ? 'text-emerald-600' : 'text-muted-foreground'
              }`}
            >
              {req.text}
              <span className='sr-only'>
                {req.met ? ' - Requirement met' : ' - Requirement not met'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { z } from 'zod'
import { isValidPhoneNumber } from 'react-phone-number-input'
import { zodResolver } from '@hookform/resolvers/zod'
import PhoneInput from './ui/phone-input'

const FormSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine((value) => value && isValidPhoneNumber(value), {
      message: 'Invalid phone number',
    }),
});
type FormData = z.infer<typeof FormSchema>;

const PhoneInputField = ({ field }: { field: ControllerRenderProps<FormSchema, 'phone'> }) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: { phone: '' },
  });

  const [submittedData, setSubmittedData] = useState<FormData | null>(null);

  const onSubmit = (data: FormData) => {
    setSubmittedData(data);
  };

  const handleReset = () => {
    reset();
    setSubmittedData(null);
  };

  return (
    <div className='flex flex-col items-center justify-center'>
      <div className='w-full rounded-lg shadow-xl space-y-8'>
        <div className='flex flex-col items-stretch space-y-4'>
          <div className='flex flex-col space-y-2'>
            <label htmlFor='phone-field' className='text-sm font-medium'>
              Phone Number
            </label>
            <PhoneInput
              {...field}
              id='phone-field'
              placeholder='Enter a phone number'
              className='border rounded-lg h-10 flex w-auto'
              value={field.value || undefined}
              onChange={(val) => field.onChange(val || '')}
              onBlur={field.onBlur}
            />
            {errors.phone && (
              <p className='text-red-500 text-sm'>{errors.phone.message}</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};