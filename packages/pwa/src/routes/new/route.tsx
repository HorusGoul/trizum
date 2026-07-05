import { t } from "@lingui/core/macro";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { DEFAULT_PARTY_SYMBOL, type Party, type PartyParticipant } from "#src/models/party.js";
import { IconButton } from "#src/ui/IconButton.js";
import type { DocumentId } from "@automerge/automerge-repo/slim";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Suspense, useId, useState } from "react";
import { toast } from "sonner";
import type { CurrencyCode } from "#src/lib/money.ts";
import { NewPartyDetailsFields } from "./-components/NewPartyDetailsFields.js";
import { NewPartyHeader } from "./-components/NewPartyHeader.js";
import { NewPartyParticipantsField } from "./-components/NewPartyParticipantsField.js";
import type {
  AddParticipantFormValues,
  CurrencyOption,
  NewPartyFormValues,
} from "./-components/types.js";

export const Route = createFileRoute("/new")({
  component: New,
});

function createDraftParticipant(name: string): Pick<PartyParticipant, "id" | "name"> {
  return {
    id: crypto.randomUUID(),
    name,
  };
}

function New() {
  const repo = useRepo();
  const { partyList } = usePartyList();
  const navigate = useNavigate();
  const [initialParticipant] = useState(() => createDraftParticipant(partyList.username));

  const currencyOptions = getCurrencyOptions();

  function onCreateParty(values: NewPartyFormValues) {
    const participants = values.participants.map(({ id, name }) => ({ id, name }));

    const handle = repo.create<Party>({
      id: "" as DocumentId,
      type: "party",
      name: values.name,
      symbol: values.symbol,
      description: values.description,
      currency: values.currency,
      participants: participants.reduce<Party["participants"]>((result, next) => {
        result[next.id] = {
          id: next.id,
          name: next.name,
        };
        return result;
      }, {}),
      chunkRefs: [],
    });
    handle.change((doc) => (doc.id = handle.documentId));
    void navigate({
      to: "/party/$partyId",
      params: { partyId: handle.documentId },
      search: {
        tab: "expenses",
      },
      replace: true,
    });

    toast.success(t`Party created`);

    return handle.documentId;
  }

  const form = useForm({
    defaultValues: {
      name: "",
      symbol: DEFAULT_PARTY_SYMBOL,
      description: "",
      currency: "EUR" as CurrencyCode,
      participants: [initialParticipant],
    },
    onSubmit: ({ value }) => {
      onCreateParty(value);
    },
  });

  const formId = useId();

  const addParticipantForm = useForm({
    defaultValues: {
      newParticipantName: "",
    } satisfies AddParticipantFormValues,
  });

  function addNewParticipant() {
    void addParticipantForm.validateField("newParticipantName", "submit");

    const meta = addParticipantForm.getFieldMeta("newParticipantName");
    const errorCount = meta?.errors?.length ?? 0;

    if (errorCount) {
      return;
    }

    const newParticipantName = addParticipantForm.getFieldValue("newParticipantName");

    form.pushFieldValue("participants", {
      ...createDraftParticipant(newParticipantName),
    });

    addParticipantForm.setFieldValue("newParticipantName", "");
  }

  return (
    <div className="flex min-h-full flex-col">
      <NewPartyHeader
        submitButton={
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) =>
              canSubmit ? (
                <Suspense fallback={null}>
                  <IconButton
                    icon="lucide.check"
                    aria-label={isSubmitting ? t`Submitting...` : t`Save`}
                    type="submit"
                    form={formId}
                    isDisabled={isSubmitting}
                  />
                </Suspense>
              ) : null
            }
          </form.Subscribe>
        }
      />

      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <NewPartyDetailsFields form={form} currencyOptions={currencyOptions} />
        <NewPartyParticipantsField
          addNewParticipant={addNewParticipant}
          addParticipantForm={addParticipantForm}
          form={form}
        />
      </form>
    </div>
  );
}

/**
 * Returns the currencies users can choose for a party.
 * Common currencies are listed first for convenience.
 */
function getCurrencyOptions(): CurrencyOption[] {
  return [
    // Common currencies (frequently used)
    { id: "EUR", name: t`Euro`, symbol: "€" },
    { id: "USD", name: t`US Dollar`, symbol: "$" },
    { id: "GBP", name: t`British Pound`, symbol: "£" },
    { id: "JPY", name: t`Japanese Yen`, symbol: "¥" },
    { id: "CHF", name: t`Swiss Franc`, symbol: "CHF" },
    { id: "CAD", name: t`Canadian Dollar`, symbol: "CA$" },
    { id: "AUD", name: t`Australian Dollar`, symbol: "A$" },
    { id: "CNY", name: t`Chinese Yuan`, symbol: "¥" },
    { id: "INR", name: t`Indian Rupee`, symbol: "₹" },
    { id: "MXN", name: t`Mexican Peso`, symbol: "MX$" },
    { id: "BRL", name: t`Brazilian Real`, symbol: "R$" },
    { id: "KRW", name: t`South Korean Won`, symbol: "₩" },
    { id: "SEK", name: t`Swedish Krona`, symbol: "kr" },
    { id: "NOK", name: t`Norwegian Krone`, symbol: "kr" },
    { id: "DKK", name: t`Danish Krone`, symbol: "kr" },
    { id: "PLN", name: t`Polish Zloty`, symbol: "zł" },
    { id: "CZK", name: t`Czech Koruna`, symbol: "Kč" },
    { id: "HUF", name: t`Hungarian Forint`, symbol: "Ft" },
    { id: "RON", name: t`Romanian Leu`, symbol: "lei" },
    { id: "BGN", name: t`Bulgarian Lev`, symbol: "лв" },
    { id: "HRK", name: t`Croatian Kuna`, symbol: "kn" },
    { id: "RUB", name: t`Russian Ruble`, symbol: "₽" },
    { id: "TRY", name: t`Turkish Lira`, symbol: "₺" },
    { id: "NZD", name: t`New Zealand Dollar`, symbol: "NZ$" },
    { id: "SGD", name: t`Singapore Dollar`, symbol: "S$" },
    { id: "HKD", name: t`Hong Kong Dollar`, symbol: "HK$" },
    { id: "THB", name: t`Thai Baht`, symbol: "฿" },
    { id: "ZAR", name: t`South African Rand`, symbol: "R" },
    { id: "ILS", name: t`Israeli Shekel`, symbol: "₪" },
    { id: "AED", name: t`UAE Dirham`, symbol: "د.إ" },
    { id: "SAR", name: t`Saudi Riyal`, symbol: "﷼" },
    // All other currencies (alphabetical by code)
    { id: "AFN", name: t`Afghan Afghani`, symbol: "؋" },
    { id: "ALL", name: t`Albanian Lek`, symbol: "L" },
    { id: "AMD", name: t`Armenian Dram`, symbol: "֏" },
    { id: "ANG", name: t`Netherlands Antillean Guilder`, symbol: "ƒ" },
    { id: "AOA", name: t`Angolan Kwanza`, symbol: "Kz" },
    { id: "ARS", name: t`Argentine Peso`, symbol: "AR$" },
    { id: "AWG", name: t`Aruban Florin`, symbol: "ƒ" },
    { id: "AZN", name: t`Azerbaijani Manat`, symbol: "₼" },
    { id: "BAM", name: t`Bosnia-Herzegovina Convertible Mark`, symbol: "KM" },
    { id: "BBD", name: t`Barbadian Dollar`, symbol: "Bds$" },
    { id: "BDT", name: t`Bangladeshi Taka`, symbol: "৳" },
    { id: "BHD", name: t`Bahraini Dinar`, symbol: ".د.ب" },
    { id: "BIF", name: t`Burundian Franc`, symbol: "FBu" },
    { id: "BMD", name: t`Bermudan Dollar`, symbol: "BD$" },
    { id: "BND", name: t`Brunei Dollar`, symbol: "B$" },
    { id: "BOB", name: t`Bolivian Boliviano`, symbol: "Bs." },
    { id: "BOV", name: t`Bolivian Mvdol`, symbol: "BOV" },
    { id: "BSD", name: t`Bahamian Dollar`, symbol: "B$" },
    { id: "BTN", name: t`Bhutanese Ngultrum`, symbol: "Nu." },
    { id: "BWP", name: t`Botswanan Pula`, symbol: "P" },
    { id: "BYN", name: t`Belarusian Ruble`, symbol: "Br" },
    { id: "BZD", name: t`Belize Dollar`, symbol: "BZ$" },
    { id: "CDF", name: t`Congolese Franc`, symbol: "FC" },
    { id: "CHE", name: t`WIR Euro`, symbol: "CHE" },
    { id: "CHW", name: t`WIR Franc`, symbol: "CHW" },
    { id: "CLF", name: t`Chilean Unit of Account (UF)`, symbol: "CLF" },
    { id: "CLP", name: t`Chilean Peso`, symbol: "CL$" },
    { id: "COP", name: t`Colombian Peso`, symbol: "CO$" },
    { id: "COU", name: t`Colombian Real Value Unit`, symbol: "COU" },
    { id: "CRC", name: t`Costa Rican Colón`, symbol: "₡" },
    { id: "CUC", name: t`Cuban Convertible Peso`, symbol: "CUC$" },
    { id: "CUP", name: t`Cuban Peso`, symbol: "₱" },
    { id: "CVE", name: t`Cape Verdean Escudo`, symbol: "CV$" },
    { id: "DJF", name: t`Djiboutian Franc`, symbol: "Fdj" },
    { id: "DOP", name: t`Dominican Peso`, symbol: "RD$" },
    { id: "DZD", name: t`Algerian Dinar`, symbol: "د.ج" },
    { id: "EGP", name: t`Egyptian Pound`, symbol: "E£" },
    { id: "ERN", name: t`Eritrean Nakfa`, symbol: "Nfk" },
    { id: "ETB", name: t`Ethiopian Birr`, symbol: "Br" },
    { id: "FJD", name: t`Fijian Dollar`, symbol: "FJ$" },
    { id: "FKP", name: t`Falkland Islands Pound`, symbol: "FK£" },
    { id: "GEL", name: t`Georgian Lari`, symbol: "₾" },
    { id: "GHS", name: t`Ghanaian Cedi`, symbol: "GH₵" },
    { id: "GIP", name: t`Gibraltar Pound`, symbol: "£" },
    { id: "GMD", name: t`Gambian Dalasi`, symbol: "D" },
    { id: "GNF", name: t`Guinean Franc`, symbol: "FG" },
    { id: "GTQ", name: t`Guatemalan Quetzal`, symbol: "Q" },
    { id: "GYD", name: t`Guyanaese Dollar`, symbol: "GY$" },
    { id: "HNL", name: t`Honduran Lempira`, symbol: "L" },
    { id: "HTG", name: t`Haitian Gourde`, symbol: "G" },
    { id: "IDR", name: t`Indonesian Rupiah`, symbol: "Rp" },
    { id: "IQD", name: t`Iraqi Dinar`, symbol: "ع.د" },
    { id: "IRR", name: t`Iranian Rial`, symbol: "﷼" },
    { id: "ISK", name: t`Icelandic Króna`, symbol: "kr" },
    { id: "JMD", name: t`Jamaican Dollar`, symbol: "J$" },
    { id: "JOD", name: t`Jordanian Dinar`, symbol: "د.ا" },
    { id: "KES", name: t`Kenyan Shilling`, symbol: "KSh" },
    { id: "KGS", name: t`Kyrgystani Som`, symbol: "лв" },
    { id: "KHR", name: t`Cambodian Riel`, symbol: "៛" },
    { id: "KMF", name: t`Comorian Franc`, symbol: "CF" },
    { id: "KPW", name: t`North Korean Won`, symbol: "₩" },
    { id: "KWD", name: t`Kuwaiti Dinar`, symbol: "د.ك" },
    { id: "KYD", name: t`Cayman Islands Dollar`, symbol: "CI$" },
    { id: "KZT", name: t`Kazakhstani Tenge`, symbol: "₸" },
    { id: "LAK", name: t`Laotian Kip`, symbol: "₭" },
    { id: "LBP", name: t`Lebanese Pound`, symbol: "ل.ل" },
    { id: "LKR", name: t`Sri Lankan Rupee`, symbol: "Rs" },
    { id: "LRD", name: t`Liberian Dollar`, symbol: "L$" },
    { id: "LSL", name: t`Lesotho Loti`, symbol: "M" },
    { id: "LYD", name: t`Libyan Dinar`, symbol: "ل.د" },
    { id: "MAD", name: t`Moroccan Dirham`, symbol: "د.م." },
    { id: "MDL", name: t`Moldovan Leu`, symbol: "MDL" },
    { id: "MGA", name: t`Malagasy Ariary`, symbol: "Ar" },
    { id: "MKD", name: t`Macedonian Denar`, symbol: "ден" },
    { id: "MMK", name: t`Myanma Kyat`, symbol: "K" },
    { id: "MNT", name: t`Mongolian Tugrik`, symbol: "₮" },
    { id: "MOP", name: t`Macanese Pataca`, symbol: "MOP$" },
    { id: "MRU", name: t`Mauritanian Ouguiya`, symbol: "UM" },
    { id: "MUR", name: t`Mauritian Rupee`, symbol: "Rs" },
    { id: "MVR", name: t`Maldivian Rufiyaa`, symbol: "Rf" },
    { id: "MWK", name: t`Malawian Kwacha`, symbol: "MK" },
    { id: "MXV", name: t`Mexican Investment Unit`, symbol: "MXV" },
    { id: "MYR", name: t`Malaysian Ringgit`, symbol: "RM" },
    { id: "MZN", name: t`Mozambican Metical`, symbol: "MT" },
    { id: "NAD", name: t`Namibian Dollar`, symbol: "N$" },
    { id: "NGN", name: t`Nigerian Naira`, symbol: "₦" },
    { id: "NIO", name: t`Nicaraguan Córdoba`, symbol: "C$" },
    { id: "NPR", name: t`Nepalese Rupee`, symbol: "Rs" },
    { id: "OMR", name: t`Omani Rial`, symbol: "ر.ع." },
    { id: "PAB", name: t`Panamanian Balboa`, symbol: "B/." },
    { id: "PEN", name: t`Peruvian Sol`, symbol: "S/" },
    { id: "PGK", name: t`Papua New Guinean Kina`, symbol: "K" },
    { id: "PHP", name: t`Philippine Peso`, symbol: "₱" },
    { id: "PKR", name: t`Pakistani Rupee`, symbol: "Rs" },
    { id: "PYG", name: t`Paraguayan Guarani`, symbol: "₲" },
    { id: "QAR", name: t`Qatari Rial`, symbol: "ر.ق" },
    { id: "RSD", name: t`Serbian Dinar`, symbol: "дин." },
    { id: "RWF", name: t`Rwandan Franc`, symbol: "FRw" },
    { id: "SBD", name: t`Solomon Islands Dollar`, symbol: "SI$" },
    { id: "SCR", name: t`Seychellois Rupee`, symbol: "Rs" },
    { id: "SDG", name: t`Sudanese Pound`, symbol: "ج.س." },
    { id: "SHP", name: t`Saint Helena Pound`, symbol: "£" },
    { id: "SLL", name: t`Sierra Leonean Leone`, symbol: "Le" },
    { id: "SOS", name: t`Somali Shilling`, symbol: "S" },
    { id: "SRD", name: t`Surinamese Dollar`, symbol: "SR$" },
    { id: "SSP", name: t`South Sudanese Pound`, symbol: "£" },
    { id: "STN", name: t`São Tomé and Príncipe Dobra`, symbol: "Db" },
    { id: "SVC", name: t`Salvadoran Colón`, symbol: "₡" },
    { id: "SYP", name: t`Syrian Pound`, symbol: "£S" },
    { id: "SZL", name: t`Swazi Lilangeni`, symbol: "E" },
    { id: "TJS", name: t`Tajikistani Somoni`, symbol: "SM" },
    { id: "TMT", name: t`Turkmenistani Manat`, symbol: "T" },
    { id: "TND", name: t`Tunisian Dinar`, symbol: "د.ت" },
    { id: "TOP", name: t`Tongan Paʻanga`, symbol: "T$" },
    { id: "TTD", name: t`Trinidad and Tobago Dollar`, symbol: "TT$" },
    { id: "TWD", name: t`New Taiwan Dollar`, symbol: "NT$" },
    { id: "TZS", name: t`Tanzanian Shilling`, symbol: "TSh" },
    { id: "UAH", name: t`Ukrainian Hryvnia`, symbol: "₴" },
    { id: "UGX", name: t`Ugandan Shilling`, symbol: "USh" },
    { id: "USN", name: t`US Dollar (Next day)`, symbol: "USN" },
    { id: "UYI", name: t`Uruguay Peso en Unidades Indexadas`, symbol: "UYI" },
    { id: "UYU", name: t`Uruguayan Peso`, symbol: "$U" },
    { id: "UYW", name: t`Unidad Previsional`, symbol: "UYW" },
    { id: "UZS", name: t`Uzbekistan Som`, symbol: "лв" },
    { id: "VES", name: t`Venezuelan Bolívar Soberano`, symbol: "Bs.S" },
    { id: "VND", name: t`Vietnamese Dong`, symbol: "₫" },
    { id: "VUV", name: t`Vanuatu Vatu`, symbol: "VT" },
    { id: "WST", name: t`Samoan Tala`, symbol: "WS$" },
    { id: "XAF", name: t`CFA Franc BEAC`, symbol: "FCFA" },
    { id: "XAG", name: t`Silver (troy ounce)`, symbol: "XAG" },
    { id: "XAU", name: t`Gold (troy ounce)`, symbol: "XAU" },
    { id: "XBA", name: t`European Composite Unit`, symbol: "XBA" },
    { id: "XBB", name: t`European Monetary Unit`, symbol: "XBB" },
    { id: "XBC", name: t`European Unit of Account 9`, symbol: "XBC" },
    { id: "XBD", name: t`European Unit of Account 17`, symbol: "XBD" },
    { id: "XCD", name: t`East Caribbean Dollar`, symbol: "EC$" },
    { id: "XDR", name: t`Special Drawing Rights`, symbol: "SDR" },
    { id: "XOF", name: t`CFA Franc BCEAO`, symbol: "CFA" },
    { id: "XPD", name: t`Palladium (troy ounce)`, symbol: "XPD" },
    { id: "XPF", name: t`CFP Franc`, symbol: "₣" },
    { id: "XPT", name: t`Platinum (troy ounce)`, symbol: "XPT" },
    { id: "XSU", name: t`Sucre`, symbol: "XSU" },
    { id: "XTS", name: t`Code for testing`, symbol: "XTS" },
    { id: "XUA", name: t`ADB Unit of Account`, symbol: "XUA" },
    { id: "XXX", name: t`No currency`, symbol: "XXX" },
    { id: "YER", name: t`Yemeni Rial`, symbol: "﷼" },
    { id: "ZMW", name: t`Zambian Kwacha`, symbol: "ZK" },
    { id: "ZWL", name: t`Zimbabwean Dollar`, symbol: "Z$" },
  ];
}
